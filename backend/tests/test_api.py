import io
import zipfile
from datetime import timedelta

from app.config import ANSWER_KEY, MAX_FILES, SECTION_A_MARKS
from app.db import SessionLocal, utcnow
from app.models import Attempt


def answer_all(client, headers, correct=True):
    for question_id, right in ANSWER_KEY.items():
        choice = right if correct else (right + 1) % 4
        r = client.put("/api/attempt/answers", json={"question_id": question_id, "choice": choice}, headers=headers)
        assert r.status_code == 200, r.text


def test_start_hides_the_answer_key(student):
    _, state = student
    assert state["status"] == "in_progress"
    assert len(state["questions"]) == SECTION_A_MARKS
    assert all("answer" not in q for q in state["questions"])
    assert state["section_b"]["marks"] == 30


def test_name_is_required(client):
    r = client.post("/api/attempts", json={"first_name": "  ", "surname": "Dlamini"})
    assert r.status_code == 422


def test_perfect_score_and_wrong_score(client, student):
    headers, _ = student
    answer_all(client, headers, correct=True)
    done = client.post("/api/attempt/submit", headers=headers).json()
    assert done["status"] == "submitted"
    assert done["result"]["score"] == SECTION_A_MARKS
    assert all("answer" not in p and "correct_choice" not in p for p in done["result"]["per"])

    other_headers, _ = (lambda r: ({"Authorization": f"Bearer {r['token']}"}, r))(
        client.post("/api/attempts", json={"first_name": "Zanele", "surname": "Nkosi"}).json()
    )
    answer_all(client, other_headers, correct=False)
    done = client.post("/api/attempt/submit", headers=other_headers).json()
    assert done["result"]["score"] == 0


def test_unanswered_counts_as_wrong(client, student):
    headers, _ = student
    done = client.post("/api/attempt/submit", headers=headers).json()
    assert done["result"]["score"] == 0
    assert done["result"]["per"][0]["chosen"] is None


def test_answers_resume_from_server(client, student):
    headers, _ = student
    client.put("/api/attempt/answers", json={"question_id": 1, "choice": 3}, headers=headers)
    client.put("/api/attempt/answers", json={"question_id": 1, "choice": 2}, headers=headers)
    state = client.get("/api/attempt", headers=headers).json()
    assert state["answers"] == {"1": 2}


def test_cannot_change_after_submit(client, student):
    headers, _ = student
    client.post("/api/attempt/submit", headers=headers)
    r = client.put("/api/attempt/answers", json={"question_id": 1, "choice": 0}, headers=headers)
    assert r.status_code == 409
    again = client.post("/api/attempt/submit", headers=headers)
    assert again.status_code == 200


def test_invalid_question_and_option(client, student):
    headers, _ = student
    assert client.put("/api/attempt/answers", json={"question_id": 999, "choice": 0}, headers=headers).status_code == 404
    assert client.put("/api/attempt/answers", json={"question_id": 1, "choice": 7}, headers=headers).status_code == 422


def test_requires_a_valid_token(client):
    assert client.get("/api/attempt").status_code == 401
    assert client.get("/api/attempt", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_time_running_out_submits_automatically(client, student):
    headers, state = student
    client.put("/api/attempt/answers", json={"question_id": 1, "choice": ANSWER_KEY[1]}, headers=headers)
    with SessionLocal() as db:
        attempt = db.get(Attempt, state["id"])
        attempt.deadline_at = utcnow() - timedelta(seconds=120)
        db.commit()
    r = client.put("/api/attempt/answers", json={"question_id": 2, "choice": ANSWER_KEY[2]}, headers=headers)
    assert r.status_code == 409
    final = client.get("/api/attempt", headers=headers).json()
    assert final["status"] == "submitted"
    assert final["timed_out"] is True
    assert final["result"]["score"] == 1


def test_file_upload_rules(client, student):
    headers, _ = student
    ok = client.post("/api/attempt/files", files={"file": ("app.py", b"print('hi')\n")}, headers=headers)
    assert ok.status_code == 201 and ok.json()["files"][0]["name"] == "app.py"
    assert client.post("/api/attempt/files", files={"file": ("virus.exe", b"MZ")}, headers=headers).status_code == 422
    assert client.post("/api/attempt/files", files={"file": ("pic.py", b"\xff\xfe\x00\x00")}, headers=headers).status_code == 422
    big = b"x" * (150 * 1024 + 1)
    assert client.post("/api/attempt/files", files={"file": ("big.py", big)}, headers=headers).status_code == 413
    for i in range(MAX_FILES - 1):
        assert client.post("/api/attempt/files", files={"file": (f"f{i}.py", b"1")}, headers=headers).status_code == 201
    assert client.post("/api/attempt/files", files={"file": ("extra.py", b"1")}, headers=headers).status_code == 422
    file_id = client.get("/api/attempt", headers=headers).json()["files"][0]["id"]
    removed = client.delete(f"/api/attempt/files/{file_id}", headers=headers).json()
    assert len(removed["files"]) == MAX_FILES - 1


def make_zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for path, data in entries.items():
            archive.writestr(path, data)
    return buffer.getvalue()


def test_zip_upload(client, student):
    headers, _ = student
    data = make_zip({
        "helpdesk/app.py": b"print('help desk')\n",
        "helpdesk/templates/index.html": b"<h1>Help</h1>\n",
        "helpdesk/static/logo.png": b"\x89PNG\x00",
        "helpdesk/__pycache__/app.cpython-312.pyc": b"\x00",
        "__MACOSX/helpdesk/._app.py": b"\x00",
    })
    r = client.post("/api/attempt/files", files={"file": ("helpdesk.zip", data)}, headers=headers)
    assert r.status_code == 201, r.text
    assert [f["name"] for f in r.json()["files"]] == ["app.py", "templates/index.html"]
    assert r.json()["skipped"] == ["helpdesk/static/logo.png"]

    assert client.post("/api/attempt/files", files={"file": ("bad.zip", b"not a zip")}, headers=headers).status_code == 422
    empty = make_zip({"logo.png": b"\x89PNG"})
    assert client.post("/api/attempt/files", files={"file": ("pics.zip", empty)}, headers=headers).status_code == 422
    too_many = make_zip({f"f{i}.py": b"1" for i in range(MAX_FILES)})
    assert client.post("/api/attempt/files", files={"file": ("many.zip", too_many)}, headers=headers).status_code == 422
    assert len(client.get("/api/attempt", headers=headers).json()["files"]) == 2


def test_total_size_limit(client, student):
    headers, _ = student
    chunk = b"a" * (100 * 1024)
    assert client.post("/api/attempt/files", files={"file": ("a.py", chunk)}, headers=headers).status_code == 201
    assert client.post("/api/attempt/files", files={"file": ("b.py", chunk)}, headers=headers).status_code == 413


def test_admin_requires_login(client, student):
    headers, _ = student
    assert client.get("/api/admin/attempts").status_code == 401
    assert client.get("/api/admin/attempts", headers=headers).status_code == 401
    assert client.post("/api/admin/login", json={"password": "wrong"}).status_code == 401


def test_admin_can_read_code_and_mark(client, student, admin):
    headers, state = student
    client.post("/api/attempt/files", files={"file": ("app.py", b"print('help desk')\n")}, headers=headers)
    # Cannot mark before the student submits.
    assert client.put(f"/api/admin/attempts/{state['id']}/mark", json={"b_mark": 20}, headers=admin).status_code == 409
    answer_all(client, headers)
    client.post("/api/attempt/submit", headers=headers)

    detail = client.get(f"/api/admin/attempts/{state['id']}", headers=admin).json()
    assert detail["files"][0]["content"] == "print('help desk')\n"

    assert client.put(f"/api/admin/attempts/{state['id']}/mark", json={"b_mark": 31}, headers=admin).status_code == 422
    assert client.put(f"/api/admin/attempts/{state['id']}/mark", json={"b_mark": 24}, headers=admin).status_code == 200

    rows = client.get("/api/admin/attempts", headers=admin).json()["attempts"]
    row = next(r for r in rows if r["id"] == state["id"])
    assert row["score_a"] == SECTION_A_MARKS and row["b_mark"] == 24 and row["total"] == SECTION_A_MARKS + 24

    shown = client.get("/api/attempt", headers=headers).json()
    assert shown["result"]["b_mark"] == 24

    csv = client.get("/api/admin/export.csv", headers=admin)
    assert csv.status_code == 200 and "Thabo" in csv.text


def test_admin_can_delete_an_attempt(client, student, admin):
    headers, state = student
    assert client.delete(f"/api/admin/attempts/{state['id']}", headers=admin).status_code == 200
    assert client.get("/api/attempt", headers=headers).status_code == 401
    ids = [r["id"] for r in client.get("/api/admin/attempts", headers=admin).json()["attempts"]]
    assert state["id"] not in ids
