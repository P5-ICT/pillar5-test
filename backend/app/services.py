"""Shared logic: finishing an attempt and building the state the frontend needs."""
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .config import (
    GRACE_SECONDS, MAX_FILES, MAX_TOTAL_BYTES, PUBLIC_QUESTIONS, SECTION_A_MARKS,
    SECTION_B, SECTION_B_MARKS,
)
from .db import iso, utcnow
from .grading import grade
from .models import Answer, Attempt


def grace_deadline(attempt: Attempt):
    return attempt.deadline_at + timedelta(seconds=GRACE_SECONDS)


def is_open(attempt: Attempt) -> bool:
    """True while the student may still change answers and files."""
    return attempt.submitted_at is None and utcnow() <= grace_deadline(attempt)


def answers_of(db: Session, attempt: Attempt) -> dict[int, int]:
    rows = db.execute(
        select(Answer.question_id, Answer.choice).where(Answer.attempt_id == attempt.id)
    ).all()
    return {question_id: choice for question_id, choice in rows}


def finalize(db: Session, attempt: Attempt, timed_out: bool) -> None:
    """Mark Section A and close the attempt. Safe to call twice: the first call wins."""
    score, _ = grade(answers_of(db, attempt))
    db.execute(
        update(Attempt)
        .where(Attempt.id == attempt.id, Attempt.submitted_at.is_(None))
        .values(submitted_at=utcnow(), timed_out=timed_out, score_a=score)
    )
    db.commit()
    db.refresh(attempt)


def ensure_finalized(db: Session, attempt: Attempt) -> None:
    """If the clock ran out, close the attempt with what the student had saved."""
    if attempt.submitted_at is None and utcnow() > grace_deadline(attempt):
        finalize(db, attempt, timed_out=True)


def attempt_state(db: Session, attempt: Attempt) -> dict:
    ensure_finalized(db, attempt)
    submitted = attempt.submitted_at is not None
    answers = answers_of(db, attempt)
    state = {
        "id": attempt.id,
        "first_name": attempt.first_name,
        "surname": attempt.surname,
        "status": "submitted" if submitted else "in_progress",
        "server_time": iso(utcnow()),
        "started_at": iso(attempt.started_at),
        "deadline_at": iso(attempt.deadline_at),
        "timed_out": attempt.timed_out,
        "answers": {str(k): v for k, v in answers.items()},
        "files": [{"id": f.id, "name": f.name, "size": f.size} for f in attempt.files],
        "limits": {"max_files": MAX_FILES, "max_total_bytes": MAX_TOTAL_BYTES},
        "total_a": SECTION_A_MARKS,
        "total_b": SECTION_B_MARKS,
    }
    if submitted:
        score, per = grade(answers)
        state["result"] = {
            "score": score,
            "total": SECTION_A_MARKS,
            "per": per,
            "b_mark": attempt.b_mark,
        }
    else:
        state["questions"] = PUBLIC_QUESTIONS
        state["section_b"] = SECTION_B
    return state
