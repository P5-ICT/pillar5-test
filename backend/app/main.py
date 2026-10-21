"""Pillar 5 Developer Test: backend API."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from . import routes_admin, routes_attempt
from .config import (
    ADMIN_PASSWORD, ALLOWED_EXTENSIONS, CORS_ORIGINS, DURATION_SECONDS, MAX_FILES,
    MAX_TOTAL_BYTES, SECRET_KEY, SECTION_A_MARKS, SECTION_B_MARKS,
)
from .db import Base, engine
from . import models  # noqa: F401  (registers the tables)

log = logging.getLogger("p5test")

if ADMIN_PASSWORD == "changeme" or SECRET_KEY == "dev-secret-change-me":
    log.warning("ADMIN_PASSWORD or SECRET_KEY still has its default value. Change both before real use.")

try:
    Base.metadata.create_all(engine)
except DBAPIError:  # another worker created the tables at the same moment
    log.info("Tables already created by another worker.")

app = FastAPI(title="Pillar 5 Developer Test", docs_url="/api/docs", openapi_url="/api/openapi.json")

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"]
    )

app.include_router(routes_attempt.router)
app.include_router(routes_admin.router)


@app.get("/api/config")
def public_config():
    """What the landing and brief pages need before a student starts."""
    return {
        "duration_seconds": DURATION_SECONDS,
        "total_a": SECTION_A_MARKS,
        "total_b": SECTION_B_MARKS,
        "max_files": MAX_FILES,
        "max_total_bytes": MAX_TOTAL_BYTES,
        "allowed_extensions": ALLOWED_EXTENSIONS,
    }


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
