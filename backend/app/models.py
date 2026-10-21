from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


class Attempt(Base):
    """One student's try at the test."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(80))
    surname: Mapped[str] = mapped_column(String(80))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    deadline_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    timed_out: Mapped[bool] = mapped_column(Boolean, default=False)
    score_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    b_mark: Mapped[int | None] = mapped_column(Integer, nullable=True)

    answers: Mapped[list["Answer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", passive_deletes=True
    )
    files: Mapped[list["UploadedFile"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", passive_deletes=True,
        order_by="UploadedFile.id",
    )


class Answer(Base):
    """The choice a student picked for one question. One row per question."""

    __tablename__ = "answers"

    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    choice: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    attempt: Mapped[Attempt] = relationship(back_populates="answers")


class UploadedFile(Base):
    """A source code file attached for Section B."""

    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    size: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    attempt: Mapped[Attempt] = relationship(back_populates="files")
