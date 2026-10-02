# Job Application & Interview Tracker
React + TypeScript (Vite) frontend, FastAPI + SQLite backend.

## Run (two terminals)
Backend (Python 3.10+):
    cd backend
    python -m venv .venv
    source .venv/bin/activate        # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Frontend (Node 18+):
    cd frontend
    npm install
    npm run dev

Open http://localhost:5173. API docs: http://localhost:8000/docs
Data is stored in backend/jobs.db (created on first run).

UI refresh: new theme (auto light/dark), animated dashboard (count-up stats, growing bars),
staggered list, modal transitions. Animations respect "reduce motion" OS settings.
