# Pillar 5 Developer Test

A Python (FastAPI) back end and a Next.js front end for the entry test.

* Section A: 30 multiple choice questions, one at a time, marked on the server.
* Section B: Help Desk website task. Students attach their source files.
* Timer: 2 hours, kept by the server, so refreshing or changing device does not help anyone.
* Facilitator page at `/admin`: see everyone, read their code, enter the Section B mark, download a CSV.
* Students never receive the correct answers.

## Run it on your computer

Back end (needs Python 3.11 or newer):

    cd backend
    python -m venv .venv
    source .venv/bin/activate        # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env             # then edit ADMIN_PASSWORD and SECRET_KEY
    uvicorn app.main:app --port 8000

Front end (needs Node 20 or newer), in a second terminal:

    cd frontend
    npm install
    npm run dev

Open http://localhost:3000. Facilitator page: http://localhost:3000/admin.
The front end passes every `/api` request to the back end, so there is one address and no CORS setup.
If your back end is not on port 8000, copy `frontend/.env.example` to `frontend/.env.local` and set `BACKEND_URL`.

## Settings (backend/.env)

| Name | What it does |
| --- | --- |
| DATABASE_URL | Leave empty for a local SQLite file. Use a Postgres address in production. |
| SECRET_KEY | Long random text. Change it. |
| ADMIN_PASSWORD | Facilitator password. Change it. |
| TEST_DURATION_SECONDS | 7200 is 2 hours. |
| GRACE_SECONDS | Extra seconds allowed for the last save when time ends. |

Questions live in `backend/app/content/questions.json` and the Section B text in `section_b.json`.

## Test it with many students

With the back end running:

    cd backend
    pip install -r requirements-dev.txt
    python loadtest.py --students 60

It pretends to be that many students starting at the same moment, answering, uploading and submitting, then checks every score.
Run the automatic tests with `pytest`.
Do not use that database for a real intake. Delete `p5test.db` first.

## Put it online

Use `render.yaml` (Render Blueprint). It creates a Postgres database, the API and the website.
Set ADMIN_PASSWORD in the Render dashboard when asked. Use a paid plan for the test day:
free plans go to sleep and would make the first students wait.
Use Postgres in production, never the SQLite file.
