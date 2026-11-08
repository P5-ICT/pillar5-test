"""Endpoints for the facilitator dashboard."""
import csv
import io
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import SECTION_A_MARKS, SECTION_B_BONUS, SECTION_B_MARKS
from .db import get_db, iso, utcnow
from .models import Answer, Attempt, UploadedFile
from .schemas import AdminLoginIn, MarkIn
from .security import make_admin_token, password_ok, require_admin
from .services import ensure_finalized, grace_deadline

router = APIRouter(prefix="/api/admin")


@router.post("/login")
def login(body: AdminLoginIn):
    if not password_ok(body.password):
        time.sleep(0.6)  # slows down password guessing
        raise HTTPException(401, "That password is not correct.")
    return {"token": make_admin_token()}


def _close_expired(db: Session) -> None:
    """Submit every attempt whose time ran out, so the dashboard never shows stale rows."""
    rows = db.scalars(select(Attempt).where(Attempt.submitted_at.is_(None))).all()
    now = utcnow()
    for attempt in rows:
        if now > grace_deadline(attempt):
            ensure_finalized(db, attempt)


def _row(attempt: Attempt, answered: int, file_count: int) -> dict:
    if attempt.submitted_at is None:
        status = "in_progress"
    else:
        status = "timed_out" if attempt.timed_out else "submitted"
    total = None
    if attempt.score_a is not None and attempt.b_mark is not None:
        total = attempt.score_a + attempt.b_mark
    return {
        "id": attempt.id,
        "first_name": attempt.first_name,
        "surname": attempt.surname,
        "status": status,
        "started_at": iso(attempt.started_at),
        "submitted_at": iso(attempt.submitted_at),
        "deadline_at": iso(attempt.deadline_at),
        "answered": answered,
        "files": file_count,
        "score_a": attempt.score_a,
        "b_mark": attempt.b_mark,
        "total": total,
    }


def _rows(db: Session) -> list[dict]:
    answered = dict(db.execute(select(Answer.attempt_id, func.count()).group_by(Answer.attempt_id)).all())
    files = dict(db.execute(select(UploadedFile.attempt_id, func.count()).group_by(UploadedFile.attempt_id)).all())
    attempts = db.scalars(select(Attempt).order_by(Attempt.started_at.desc())).all()
    return [_row(a, answered.get(a.id, 0), files.get(a.id, 0)) for a in attempts]


@router.get("/attempts", dependencies=[Depends(require_admin)])
def list_attempts(db: Session = Depends(get_db)):
    _close_expired(db)
    rows = _rows(db)
    summary = {
        "started": len(rows),
        "in_progress": sum(r["status"] == "in_progress" for r in rows),
        "submitted": sum(r["status"] != "in_progress" for r in rows),
        "section_a_total": SECTION_A_MARKS,
        "section_b_total": SECTION_B_MARKS,
        "section_b_bonus": SECTION_B_BONUS,
    }
    return {"summary": summary, "attempts": rows}


@router.get("/attempts/{attempt_id}", dependencies=[Depends(require_admin)])
def attempt_detail(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(404, "That attempt does not exist.")
    files = db.scalars(
        select(UploadedFile).where(UploadedFile.attempt_id == attempt_id).order_by(UploadedFile.id)
    ).all()
    return {
        "id": attempt.id,
        "files": [{"id": f.id, "name": f.name, "size": f.size, "content": f.content} for f in files],
    }


@router.put("/attempts/{attempt_id}/mark", dependencies=[Depends(require_admin)])
def set_mark(attempt_id: int, body: MarkIn, db: Session = Depends(get_db)):
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(404, "That attempt does not exist.")
    ensure_finalized(db, attempt)
    if attempt.submitted_at is None:
        raise HTTPException(409, "This student has not submitted yet.")
    attempt.b_mark = body.b_mark
    db.commit()
    return {"ok": True}


@router.delete("/attempts/{attempt_id}", dependencies=[Depends(require_admin)])
def delete_attempt(attempt_id: int, db: Session = Depends(get_db)):
    db.execute(delete(Answer).where(Answer.attempt_id == attempt_id))
    db.execute(delete(UploadedFile).where(UploadedFile.attempt_id == attempt_id))
    db.execute(delete(Attempt).where(Attempt.id == attempt_id))
    db.commit()
    return {"ok": True}


@router.get("/export.csv", dependencies=[Depends(require_admin)])
def export_csv(db: Session = Depends(get_db)):
    _close_expired(db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "First name", "Surname", "Status", "Started (UTC)", "Submitted (UTC)",
        f"Section A (out of {SECTION_A_MARKS})", f"Section B (out of {SECTION_B_MARKS})", "Total",
    ])
    for r in _rows(db):
        writer.writerow([
            r["first_name"], r["surname"], r["status"], r["started_at"], r["submitted_at"] or "",
            "" if r["score_a"] is None else r["score_a"],
            "" if r["b_mark"] is None else r["b_mark"],
            "" if r["total"] is None else r["total"],
        ])
    return Response(
        buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="pillar5-test-results.csv"'},
    )
