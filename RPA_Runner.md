# RPA Runner — Sokin API Sandbox Walkthrough

**Project:** fintech-api-sandbox  
**Purpose:** Automated end-to-end walkthrough of all Sokin Embedded API scenarios,  
driven by Playwright against the React UI, verified against SQLite database.

---

## What It Does

Launches the React UI in a real browser, executes every API scenario in sequence,
verifies each response visually and against the SQLite database, and records the
entire walkthrough as a video. Acts as both a demo runner and a regression test suite.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Playwright (Python async) | Browser automation — clicks, reads UI, waits for responses |
| SQLite (direct query) | Post-call database assertions |
| pytest | Test runner with pass/fail per scenario |
| Playwright video recording | Auto-captures full walkthrough as .mp4 |

---

## Folder Structure

```
VSCodeIDE/fintech-api-sandbox/
  tests/
    rpa_runner.py      — main Playwright script, runs all scenarios
    db_checks.py       — reusable SQLite assertion helpers
    conftest.py        — pytest fixtures (start servers, reset db before run)
    recordings/        — auto-saved video per run
```

---

## Scenario Sequence

| # | Scenario | Endpoint | DB Assertion |
|---|---|---|---|
| 1 | Reset sandbox | POST /sandbox/reset | All tables back to seed data |
| 2 | Get auth token | POST /oauth/token | Token stored in UI state |
| 3 | Get FX rate | POST /fx/rate | Row inserted in fx_rates table |
| 4 | List accounts | GET /corporate-currency-accounts | 26 accounts returned, ACC-001 balance matches seed |
| 5 | List beneficiaries | GET /beneficiaries | BEN-001 and BEN-002 returned |
| 6 | Create beneficiary | POST /beneficiaries | Created beneficiary in db with status PENDING |
| 7 | Create instruction | POST /instruction-requests | Row in instruction_requests PENDING + ACC-001 balance deducted |
| 8 | Get instruction | GET /instruction-requests/{ref} | Matches db record |
| 9 | Insufficient balance | POST /instruction-requests (amount > balance) | 400 error shown in UI |
| 10 | Export to Postman | Click Export button | .json file downloaded with correct values |

---

## Seed Values (starting state)

```
Accounts:
  26 seeded account currencies, including:
  ACC-001 | AUD | 125,000.00 | ACTIVE
  ACC-002 | USD |  48,200.00 | ACTIVE
  ACC-003 | GBP |  12,500.00 | ACTIVE
  ACC-004 | EUR |  87,500.00 | ACTIVE

Beneficiaries:
  BEN-001 | Acme Corp    | USD | ACTIVE
  BEN-002 | Global Trade | GBP | ACTIVE
```

---

## DB Assertion Helpers (db_checks.py)

```python
assert_account_balance(db, reference, expected_balance)
assert_instruction_exists(db, reference, expected_status)
assert_beneficiary_exists(db, beneficiary_id, expected_status)
assert_fx_rate_exists(db, rate_id)
```

---

## Expected Output

```
=== Sokin Sandbox RPA Walkthrough ===

✅  1. Sandbox reset — tables reseeded
✅  2. Auth — mock token acquired and stored
✅  3. FX Rate — AUD→USD rate 0.6413, rate_id RATE-001 in db
✅  4. Accounts — 26 returned, ACC-001 balance AUD 125,000
✅  5. Beneficiaries — BEN-001 Acme Corp, BEN-002 Global Trade
✅  6. Create Beneficiary — new beneficiary created, status PENDING in db
✅  7. Create Instruction — INV-001 PENDING, ACC-001 balance now AUD 115,000
✅  8. Get Instruction — INV-001 status PENDING confirmed
✅  9. Insufficient Balance — 400 error displayed correctly in UI
✅ 10. Postman Export — sokin-sandbox.postman_environment.json downloaded

══════════════════════════════════════════
10/10 passed | 0 failed
Recording saved: tests/recordings/<playwright-generated>.webm
```

---

## Running It

```bash
# Install dependencies
pip install playwright pytest pytest-asyncio
playwright install chromium

# Run the walkthrough
pytest -q tests/rpa_runner.py -s
```

---

## Video Output

Playwright records a `.webm` of the full browser session automatically.
Saved to `tests/recordings/` with a timestamp filename.
Use this as a demo video for stakeholders or interview prep.

---

## Notes

- Runs against isolated sandbox, proxy, and frontend test servers on ports 8101, 8102,
  and 3000 — never point it at real UAT
- Reset is always scenario 1 — ensures a clean, predictable starting state
- Insufficient balance test (scenario 9) runs after scenario 7 has already deducted funds
- Postman export (scenario 10) verifies the downloaded file contains the last rate_id and instruction_reference from earlier scenarios
