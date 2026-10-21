import os
import sys
import tempfile
from pathlib import Path

# Use a throwaway database and known passwords for the tests.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["GRACE_SECONDS"] = "20"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def student(client):
    """A fresh student with a started attempt. Returns (headers, attempt_state)."""
    response = client.post("/api/attempts", json={"first_name": "Thabo", "surname": "Dlamini"})
    assert response.status_code == 201
    body = response.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["attempt"]


@pytest.fixture()
def admin(client):
    response = client.post("/api/admin/login", json={"password": "test-password"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}
