"""Settings, read from environment variables."""
import json
import os
from pathlib import Path

CONTENT_DIR = Path(__file__).parent / "content"


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip() or "sqlite:///./p5test.db"
    # Render and Heroku hand out postgres:// URLs. SQLAlchemy with psycopg 3 needs this prefix.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _database_url()
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")
DURATION_SECONDS = int(os.getenv("TEST_DURATION_SECONDS", "7200"))
GRACE_SECONDS = int(os.getenv("GRACE_SECONDS", "20"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

SECTION_B_MARKS = 30
SECTION_B_BONUS = 4  # extra marks a facilitator may give on top of SECTION_B_MARKS
MAX_FILES = 20
MAX_TOTAL_BYTES = 150 * 1024
# A zip may also hold images and other files we skip, so the zip itself may be bigger.
MAX_ZIP_BYTES = 5 * 1024 * 1024
# Folders inside a zip that never hold the student's own code.
ZIP_SKIP_FOLDERS = {"__MACOSX", ".git", "node_modules", ".venv", "venv", "env", "__pycache__", ".idea", ".vscode"}
ALLOWED_EXTENSIONS = ["py", "html", "htm", "js", "css", "txt", "json", "md", "jinja", "j2"]

QUESTIONS = json.loads((CONTENT_DIR / "questions.json").read_text(encoding="utf-8"))
SECTION_B = json.loads((CONTENT_DIR / "section_b.json").read_text(encoding="utf-8"))
SECTION_A_MARKS = len(QUESTIONS)

# The question list sent to students. The answer key never leaves the server.
PUBLIC_QUESTIONS = [
    {"id": q["id"], "prompt": q["prompt"], "code": q["code"], "options": q["options"]}
    for q in QUESTIONS
]
ANSWER_KEY = {q["id"]: q["answer"] for q in QUESTIONS}
OPTION_COUNT = {q["id"]: len(q["options"]) for q in QUESTIONS}
