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
uvicorn main:app --port 8002 --reload      # proxy server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Sandbox Coverage

The sandbox seeds active balances for 26 account-holding currencies: `AUD`, `USD`,
`GBP`, `EUR`, `CAD`, `SGD`, `HKD`, `NZD`, `JPY`, `CHF`, `SEK`, `NOK`, `DKK`, `PLN`,
`CZK`, `HUF`, `RON`, `BGN`, `HRK`, `MXN`, `ZAR`, `AED`, `SAR`, `QAR`, `BHD`, and `KWD`.

It provides practical test rates for `AUD -> USD`, `AUD -> GBP`, `USD -> GBP`,
`EUR -> USD`, `AUD -> AED`, and `AUD -> SGD`. **Load sample values** creates a
future-dated payload using one of these pairs and a unique payment reference.

## Connection Settings

Use the settings icon beside **API documentation** to change sandbox, proxy, and
displayed UAT API URLs for the current browser session. Credentials and UAT candidate
hosts remain in `backend/.env` and are never exposed to the browser.

## RPA Tests

The async Playwright runner starts isolated sandbox, proxy, and frontend servers,
resets its temporary SQLite state, records a browser video, and verifies database
writes directly. Install the test dependency and run all ten scenarios with:

```bash
pip install -r tests/requirements.txt
playwright install chromium
pytest -q tests/rpa_runner.py -s
```

Video artifacts are saved locally in `tests/recordings/` and excluded from Git.

## Disclaimer
This is an independent developer tool and is not affiliated with or
endorsed by Sokin. No proprietary API credentials or data are included.