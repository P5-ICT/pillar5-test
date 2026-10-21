"""Endpoints a student uses while taking the test."""
import io
import zipfile
from datetime import timedelta
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import (
    ALLOWED_EXTENSIONS, DURATION_SECONDS, MAX_FILES, MAX_TOTAL_BYTES, MAX_ZIP_BYTES, OPTION_COUNT,
    ZIP_SKIP_FOLDERS,
)
from .db import IS_SQLITE, get_db, utcnow
from .models import Answer, Attempt, UploadedFile
from .schemas import AnswerIn, StartIn
from .security import current_attempt, hash_token, new_token
from .services import attempt_state, ensure_finalized, finalize, is_open

if IS_SQLITE:
    from sqlalchemy.dialects.sqlite import insert as dialect_insert
else:
    from sqlalchemy.dialects.postgresql import insert as dialect_insert

router = APIRouter(prefix="/api")


def _require_open(attempt: Attempt) -> None:
    if attempt.submitted_at is not None:
        raise HTTPException(409, "This test has already been submitted.")
    if not is_open(attempt):
        raise HTTPException(409, "Time is up. Your test was submitted for you.")


@router.post("/attempts", status_code=201)
def start_attempt(body: StartIn, db: Session = Depends(get_db)):
    """Create an attempt. The 2 hour clock starts now, on the server."""
    token = new_token()
    now = utcnow()
    attempt = Attempt(
        token_hash=hash_token(token),
        first_name=body.first_name,
        surname=body.surname,
        started_at=now,
        deadline_at=now + timedelta(seconds=DURATION_SECONDS),
    )
    db.add(attempt)
    db.commit()
    return {"token": token, "attempt": attempt_state(db, attempt)}


@router.get("/attempt")
def get_attempt(attempt: Attempt = Depends(current_attempt), db: Session = Depends(get_db)):
    return attempt_state(db, attempt)


@router.put("/attempt/answers")
def save_answer(
    body: AnswerIn, attempt: Attempt = Depends(current_attempt), db: Session = Depends(get_db)
):
    ensure_finalized(db, attempt)
    _require_open(attempt)
    options = OPTION_COUNT.get(body.question_id)
    if options is None:
        raise HTTPException(404, "That question does not exist.")
    if body.choice >= options:
        raise HTTPException(422, "That option does not exist.")
    now = utcnow()
    stmt = dialect_insert(Answer).values(
        attempt_id=attempt.id, question_id=body.question_id, choice=body.choice, updated_at=now
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["attempt_id", "question_id"],
        set_={"choice": body.choice, "updated_at": now},
    )
    db.execute(stmt)
    db.commit()
    return {"ok": True}


def _file_list(attempt: Attempt, db: Session):
    rows = db.execute(
        select(UploadedFile.id, UploadedFile.name, UploadedFile.size)
        .where(UploadedFile.attempt_id == attempt.id)
        .order_by(UploadedFile.id)
    ).all()
    return [{"id": i, "name": n, "size": s} for i, n, s in rows]


def _extension(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _as_text(name: str, raw: bytes) -> str:
    """Check one file's size and decode it. Raises if it is too big or not text."""
    if len(raw) > MAX_TOTAL_BYTES:
        raise HTTPException(413, f"{name} is bigger than 150 KB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(422, f"{name} is not a text file.")
    if "\x00" in text:
        raise HTTPException(422, f"{name} is not a text file.")
    return text


def _unzip(zip_name: str, raw: bytes) -> tuple[list[tuple[str, int, str]], list[str]]:
    """Return the source files inside a zip as (path, size, text), and the names it skipped."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(422, f"{zip_name} is not a valid zip file.")

    kept: list[tuple[str, zipfile.ZipInfo]] = []
    skipped: list[str] = []
    for info in archive.infolist():
        if info.is_dir():
            continue
        parts = [p for p in PurePosixPath(info.filename.replace("\\", "/")).parts if p not in ("", ".", "..")]
        if not parts or any(p in ZIP_SKIP_FOLDERS for p in parts[:-1]) or parts[-1].startswith("."):
            continue
        path = "/".join(parts)
        if _extension(parts[-1]) not in ALLOWED_EXTENSIONS:
            skipped.append(path)
            continue
        kept.append((path, info))

    # Most zips hold one top folder, like helpdesk/app.py. Leave it out of the names.
    roots = {path.split("/", 1)[0] for path, _ in kept}
    if len(roots) == 1 and all("/" in path for path, _ in kept):
        kept = [(path.split("/", 1)[1], info) for path, info in kept]

    files = []
    for path, info in kept:
        if info.file_size > MAX_TOTAL_BYTES:
            raise HTTPException(413, f"{path} in {zip_name} is bigger than 150 KB.")
        try:
            with archive.open(info) as member:
                data = member.read(MAX_TOTAL_BYTES + 1)
        except (RuntimeError, zipfile.BadZipFile, NotImplementedError):
            raise HTTPException(422, f"{zip_name} could not be opened. Zip it again without a password.")
        files.append((path[:255], len(data), _as_text(path, data)))
    if not files:
        raise HTTPException(422, f"{zip_name} has no code files in it, such as .py, .html, .js or .css.")
    return files, skipped


@router.post("/attempt/files", status_code=201)
def upload_file(
    file: UploadFile, attempt: Attempt = Depends(current_attempt), db: Session = Depends(get_db)
):
    ensure_finalized(db, attempt)
    _require_open(attempt)

    name = PurePosixPath((file.filename or "").replace("\\", "/")).name
    extension = _extension(name)
    skipped: list[str] = []
    if name and extension == "zip":
        raw = file.file.read(MAX_ZIP_BYTES + 1)
        if len(raw) > MAX_ZIP_BYTES:
            raise HTTPException(413, f"{name} is bigger than {MAX_ZIP_BYTES // (1024 * 1024)} MB.")
        new_files, skipped = _unzip(name, raw)
    elif name and extension in ALLOWED_EXTENSIONS:
        raw = file.file.read(MAX_TOTAL_BYTES + 1)
        new_files = [(name[:255], len(raw), _as_text(name, raw))]
    else:
        raise HTTPException(
            422, f"{name or 'That file'} was skipped. Attach a .zip or text files such as .py, .html, .js or .css."
        )

    count, total = db.execute(
        select(func.count(UploadedFile.id), func.coalesce(func.sum(UploadedFile.size), 0))
        .where(UploadedFile.attempt_id == attempt.id)
    ).one()
    if count + len(new_files) > MAX_FILES:
        if len(new_files) == 1:
            raise HTTPException(422, f"You can attach up to {MAX_FILES} files.")
        raise HTTPException(
            422, f"{name} holds {len(new_files)} code files, and you can attach up to {MAX_FILES} files in total."
        )
    if total + sum(size for _, size, _ in new_files) > MAX_TOTAL_BYTES:
        raise HTTPException(413, f"{name} was skipped because the total would pass 150 KB.")

    for file_name, size, text in new_files:
        db.add(UploadedFile(attempt_id=attempt.id, name=file_name, size=size, content=text))
    db.commit()
    return {"files": _file_list(attempt, db), "skipped": skipped}


@router.delete("/attempt/files/{file_id}")
def remove_file(
    file_id: int, attempt: Attempt = Depends(current_attempt), db: Session = Depends(get_db)
):
    ensure_finalized(db, attempt)
    _require_open(attempt)
    db.execute(
        delete(UploadedFile).where(UploadedFile.id == file_id, UploadedFile.attempt_id == attempt.id)
    )
    db.commit()
    return {"files": _file_list(attempt, db)}


@router.post("/attempt/submit")
def submit(attempt: Attempt = Depends(current_attempt), db: Session = Depends(get_db)):
    """Mark Section A and close the attempt. Calling it twice is harmless."""
    if attempt.submitted_at is None:
        finalize(db, attempt, timed_out=utcnow() >= attempt.deadline_at)
    return attempt_state(db, attempt)
