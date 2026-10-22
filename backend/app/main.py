"""Pillar 5 Developer Test: backend API."""
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
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

def _create_tables(attempts: int = 10) -> None:
    """Create the tables, waiting for the database if it is still starting up.

    Stops the app if the tables still do not exist after every try, so a broken
    start shows up in the logs instead of every request failing later.
    """
    for attempt in range(1, attempts + 1):
        try:
            Base.metadata.create_all(engine)
            return
        except DBAPIError as error:
            # Another worker may have created the tables at the same moment.
            try:
                if set(Base.metadata.tables) <= set(inspect(engine).get_table_names()):
                    return
            except DBAPIError:
                pass
            if attempt == attempts:
                raise
            log.warning("Could not create tables (try %d of %d): %s", attempt, attempts, error)
            time.sleep(min(2 * attempt, 10))


_create_tables()

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
        # Reading a real table also proves the tables were created.
        connection.execute(text("SELECT 1 FROM attempts LIMIT 1"))
    return {"status": "ok"}
