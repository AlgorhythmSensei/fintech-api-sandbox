# fintech-api-sandbox

A local sandbox and Postman-style test UI for embedded fintech payment APIs.
Includes a FastAPI mock server with SQLite state, a proxy to real UAT environments,
and one-click Postman environment export. Built for Solution Consultant workflow.

## Stack
- Backend: FastAPI + SQLite (sandbox) / httpx proxy (real UAT)
- Frontend: React (Postman-style UI with environment switcher)

## Setup

### Backend
```bash
cd backend
cp .env.example .env      # fill in your credentials
pip install -r requirements.txt
uvicorn sandbox:app --port 8001 --reload   # mock server
uvicorn main:app --port 8000 --reload      # proxy server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Disclaimer
This is an independent developer tool and is not affiliated with or
endorsed by Sokin. No proprietary API credentials or data are included.