"""Student session tokens and facilitator login."""
import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import ADMIN_PASSWORD, SECRET_KEY
from .db import get_db
from .models import Attempt

ADMIN_TOKEN_MAX_AGE = 12 * 60 * 60  # 12 hours
_signer = URLSafeTimedSerializer(SECRET_KEY, salt="p5-admin")


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # Only the hash is stored, so a copy of the database does not reveal student sessions.
    return hashlib.sha256(token.encode()).hexdigest()


def _bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


def current_attempt(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> Attempt:
    token = _bearer(authorization)
    if not token:
        raise HTTPException(401, "Missing session token.")
    attempt = db.scalar(select(Attempt).where(Attempt.token_hash == hash_token(token)))
    if attempt is None:
        raise HTTPException(401, "This session was not found. Start the test again.")
    return attempt


def password_ok(candidate: str) -> bool:
    return hmac.compare_digest(candidate.encode(), ADMIN_PASSWORD.encode())


def make_admin_token() -> str:
    return _signer.dumps({"role": "facilitator"})


def require_admin(authorization: str | None = Header(default=None)) -> None:
    token = _bearer(authorization)
    if not token:
        raise HTTPException(401, "Facilitator login required.")
    try:
        data = _signer.loads(token, max_age=ADMIN_TOKEN_MAX_AGE)
    except SignatureExpired:
        raise HTTPException(401, "Your facilitator session expired. Log in again.")
    except BadSignature:
        raise HTTPException(401, "Facilitator login required.")
    if data.get("role") != "facilitator":
        raise HTTPException(401, "Facilitator login required.")
