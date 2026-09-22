# fintech-api-sandbox

A local sandbox and Postman-style test UI for embedded fintech payment APIs. It combines a stateful FastAPI mock, a credential-protecting UAT proxy, realistic request samples, and an RPA walkthrough for Solution Consultant demos.

## Stack
- Backend: FastAPI + SQLite (sandbox) / httpx proxy (real UAT)
- Frontend: React (Postman-style UI with environment switcher)
- Automation: pytest + async Playwright + direct SQLite assertions

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

Open the URL Vite prints, normally `http://127.0.0.1:5174`.

## Demo Capabilities

### Sandbox API Console

The **Sandbox** environment is a local stateful API on port `8001`. It supports the end-to-end embedded payment demonstration flow:

- Get a mock OAuth access token.
- Get an FX rate.
- List all corporate currency accounts or retrieve one account by reference.
- List default beneficiaries or create a beneficiary.
- Create a payment instruction and retrieve it by reference.
- Demonstrate validation and insufficient-balance errors.

Each sidebar endpoint has a delayed hover preview explaining its HTTP method, path, whether it reads or changes state, and its purpose. **Load sample values** creates valid, future-dated, realistic JSON for applicable POST endpoints.

Successful sandbox beneficiary and instruction writes refresh the **Sandbox DB** panel immediately. The panel shows accounts, beneficiaries, and instruction requests from the live SQLite state.

## Sandbox Coverage

The sandbox seeds active balances for 26 account-holding currencies: `AUD`, `USD`,
`GBP`, `EUR`, `CAD`, `SGD`, `HKD`, `NZD`, `JPY`, `CHF`, `SEK`, `NOK`, `DKK`, `PLN`,
`CZK`, `HUF`, `RON`, `BGN`, `HRK`, `MXN`, `ZAR`, `AED`, `SAR`, `QAR`, `BHD`, and `KWD`.

It provides practical test rates for `AUD -> USD`, `AUD -> GBP`, `USD -> GBP`,
`EUR -> USD`, `AUD -> AED`, and `AUD -> SGD`. **Load sample values** creates a
future-dated payload using one of these pairs and a unique payment reference.

### Reset Behavior

**Reset Sandbox** removes sandbox-created beneficiaries, FX rates, and instruction requests, then restores all 26 seeded currency accounts at their original balances plus the default beneficiaries:

- `BEN-001` — Acme Corp, USD
- `BEN-002` — Global Trade, GBP

For example, an AUD payment deducts from `ACC-001`; resetting restores `ACC-001` to `125,000.00 AUD`.

## Connection Settings

Use the settings icon in the upper-right header to change the sandbox URL, local UAT proxy URL, and displayed UAT API URL for the current browser session. Values remain in React memory only.

Connection Settings also provides:

- **Export to Postman** — downloads the active Postman environment JSON, including available token and recent IDs.
- **Export JUnit XML** — runs the isolated RPA suite and downloads `results.xml`, which is compatible with GitHub Actions, Jenkins, Azure DevOps, and Jira.
- **Open documentation** — opens the configured Sokin API documentation link in a new browser tab.

The app remembers the current Sandbox request session when switching to Real UAT and back: selected endpoint, JSON body, response/error, and Sandbox token are restored. UAT tokens are cleared when leaving UAT.

## Real UAT

The **Real UAT** environment sends requests only through the local proxy on port `8002`. The browser never receives client credentials; the proxy injects them only for the OAuth request and permits only the endpoints represented in this UI.

Use **Test UAT endpoints** in the Real UAT view to try only configured HTTPS candidate hosts. The proxy reports HTTP results without returning credentials or token values.

Common response status handling:

- `400` — invalid request, unsupported sandbox pair, or insufficient balance.
- `401` — a protected endpoint was requested without an access token.
- `404` — requested resource does not exist.
- `409` — duplicate instruction reference.
- `422` — payload validation failed.
- `502` — local proxy cannot reach UAT. DNS failures are identified explicitly with guidance to check the configured base URL and network connection.

## RPA Tests

The async Playwright runner starts isolated sandbox, proxy, and frontend servers on ports `8101`, `8102`, and `3000`. It uses its own temporary SQLite database, records a browser video, and verifies writes directly against SQLite. It never calls Real UAT.

The 10 database-verified scenarios are:

1. Reset sandbox
2. Get mock OAuth token
3. Get AUD/USD FX rate
4. List accounts
5. Get `ACC-001`
6. List beneficiaries
7. Create beneficiary
8. Create AUD payment instruction and confirm balance deduction
9. Get the created instruction
10. Submit an insufficient-balance instruction and confirm no row is written

Run it from the terminal:

```bash
pip install -r tests/requirements.txt
playwright install chromium
pytest -q tests/rpa_runner.py -s
```

Video artifacts are saved locally in `tests/recordings/` and excluded from Git. The detailed automation reference is [RPA_Runner.md](RPA_Runner.md).

### RPA Monitor

Click **Run RPA walkthrough** in the main app header to open the separate Sandbox RPA monitor. It launches the isolated, database-verified Playwright suite under the bonnet while replaying the same endpoint selections, request JSON, and send actions visibly in the embedded Sandbox UI. The monitor displays the active Sandbox host, scenario progress, and the final pass/fail log.

To produce a CI-compatible JUnit XML report manually:

```bash
pytest tests/rpa_runner.py --junitxml=reports/results.xml
```

The Settings **Export JUnit XML** action runs this command locally and downloads the generated `results.xml` file. The local `reports/` directory is ignored by Git.

## Test Commands

```bash
# Frontend regressions and production build
cd frontend
npm test -- --run
npm run build

# Backend API tests
cd ..
pytest backend/ -q

# Full browser RPA walkthrough
pytest -q tests/rpa_runner.py -s
```

## Security Boundaries

- Put real credentials only in `backend/.env`; it is ignored by Git.
- Do not add credentials to frontend source, Postman exports, or browser storage.
- Tokens are held in React state only for the active session.
- The local sandbox, UAT proxy, RPA database, recordings, reports, and UAT credentials are intentionally separate.

## Disclaimer
This is an independent developer tool and is not affiliated with or
endorsed by Sokin. No proprietary API credentials or data are included.