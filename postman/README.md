# Postman Setup

Two files to import — the collection (requests) and the environment (variables).

## Quick start

1. **Start the sandbox server**
   ```bash
   cd backend
   uvicorn sandbox:app --port 8001 --reload
   ```

2. **Import into Postman**
   - Postman → File → Import
   - Select both files:
     - `sokin-embedded-api.postman_collection.json`
     - `sokin-sandbox.postman_environment.json`

3. **Select the environment**
   - Top-right dropdown → **Sokin SANDBOX**

4. **Run in order**
   ```
   Auth → FX Rate → Accounts → Beneficiaries → Instructions
   ```
   Run Auth first to get a token, then the rest in any order.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/oauth/token` | Returns mock token — no real credentials needed |
| POST | `/fx/rate` | Price AUD→USD conversion |
| GET | `/corporate-currency-accounts` | All 26 seeded currency accounts |
| GET | `/corporate-currency-accounts/{{account_ref}}` | Single account (default: ACC-001) |
| GET | `/beneficiaries` | Seeded + session-created beneficiaries |
| POST | `/beneficiaries` | Register a new beneficiary |
| POST | `/instruction-requests` | Create payment instruction — deducts from account balance |
| GET | `/instruction-requests/{{instruction_ref}}` | Retrieve by reference (default: INV-001) |

All requests hit `localhost:8001`. No real Sokin credentials needed.

## Reset between runs

```
POST http://localhost:8001/sandbox/reset
```

Clears session data (instructions, FX rates, created beneficiaries) and restores all 26 accounts to their original balances. Seeded beneficiaries BEN-001 and BEN-002 are also restored.
