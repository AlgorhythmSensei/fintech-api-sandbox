# Copilot Task: Fix bugs and add tests — sokin-tester

Fix the bugs listed below in `frontend/src/App.jsx` and `backend/sandbox.py`, then
add the test files described at the bottom. Make no other changes.

---

## Bug 1 — `resetSandbox` leaves spinner running on success
**File:** `frontend/src/App.jsx` lines 76–86

The `setIsSandboxStateLoading(false)` call only happens in the `catch` branch.
On a successful reset the loading spinner never clears.

**Fix:** move the call into a `finally` block and remove it from `catch`:

```js
async function resetSandbox() {
  setIsSandboxStateLoading(true)
  try {
    const result = await fetch(`${environments.sandbox.baseUrl}/sandbox/reset`, { method: 'POST' })
    if (!result.ok) throw new Error('Unable to reset sandbox.')
    await refreshSandboxState()
  } catch (stateError) {
    setError(stateError.message)
  } finally {
    setIsSandboxStateLoading(false)
  }
}
```

---

## Bug 2 — `result.json()` called before checking `result.ok`
**File:** `frontend/src/App.jsx` lines 122–124

If the server returns a non-OK status with a non-JSON body (e.g. a 502 HTML error
page), `result.json()` throws and the catch block shows a misleading parse error
instead of the real HTTP error.

**Fix:** check `result.ok` first, read the body as text, attempt JSON parse for the
detail message, then throw. Only call `.json()` unconditionally on success:

```js
const result = await fetch(requestUrl, requestOptions)
let data
if (!result.ok) {
  const text = await result.text()
  let detail
  try { detail = JSON.parse(text).detail } catch { detail = text || 'The request failed.' }
  throw new Error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail)
}
data = await result.json()
```

Update the lines that follow to use `data` directly instead of `result.json()`:

```js
const normalizedResponse = environment.id === 'sandbox' ? { status: result.status, data } : data
```

---

## Bug 3 — Duplicate and unreachable path checks for `lastAccountRef`
**File:** `frontend/src/App.jsx` lines 132–137

Lines 136–137 are duplicates that can never produce a different result from line 132.
Line 137 uses a path with a trailing slash (`'/corporate-currency-accounts/'`) that
never matches any endpoint definition — it silently does nothing.

**Fix:** collapse to one correct block. Account-list responses carry
`payload.accounts[]`; single-account GET responses carry `payload.reference`.
Both are already handled by lines 132–133. Delete lines 136–137 entirely:

```js
// REMOVE these two lines:
if (payload?.reference && endpoint.path === '/corporate-currency-accounts') setLastAccountRef(payload.reference)
if (payload?.reference && endpoint.path === '/corporate-currency-accounts/') setLastAccountRef(payload.reference)
```

---

## Bug 4 — Pydantic models accept invalid currency codes and date strings
**File:** `backend/sandbox.py` lines 74–93

`sellCurrency`, `buyCurrency`, and `currency` accept any string. `paymentDate`
accepts any string. The sandbox should reject inputs that the real Sokin UAT API
would also reject, so test runs stay meaningful.

**Fix:** add field validators using `Annotated` + `Field(pattern=...)`:

```python
from typing import Annotated
from pydantic import BaseModel, Field

CurrencyCode = Annotated[str, Field(pattern=r'^[A-Z]{3}$')]
IsoDate = Annotated[str, Field(pattern=r'^\d{4}-\d{2}-\d{2}$')]

class FxRatePayload(BaseModel):
    sellCurrency: CurrencyCode
    buyCurrency: CurrencyCode
    sellAmount: float = Field(gt=0)
    paymentDate: IsoDate = "2026-09-23"

class BeneficiaryPayload(BaseModel):
    name: str
    currency: CurrencyCode
    accountNumber: str
    routingNumber: str | None = None
    bankCountry: Annotated[str, Field(pattern=r'^[A-Z]{2}$')]
    paymentType: str | None = "REGULAR"
```

`InstructionPayload` inherits from `FxRatePayload` so it picks up the validation
automatically — no change needed there.

---

## Tests to add

### `frontend/src/App.test.jsx`

Use **Vitest** + **@testing-library/react**. Mock `fetch` with `vi.stubGlobal`.

Cover these cases:

1. **`resetSandbox` — spinner clears on success**
   Mock `fetch` to return `{ ok: true }` for `/sandbox/reset` and
   `{ ok: true, json: () => sandboxStateFixture }` for `/sandbox/state`.
   Render `<App />`, click "Reset sandbox", assert that the loading indicator
   is gone after the async chain settles (`await waitFor(...)`).

2. **`resetSandbox` — spinner clears on failure**
   Mock `/sandbox/reset` to return `{ ok: false }`.
   Assert the spinner disappears and an error message is visible.

3. **`sendRequest` — non-JSON error body shows HTTP error text, not parse error**
   Mock `fetch` to return `{ ok: false, status: 502, text: () => '<html>Bad Gateway</html>' }`.
   Trigger a send, assert the error displayed is `'Bad Gateway'` (or contains `'502'`),
   NOT `'valid JSON'`.

4. **`sendRequest` — JSON error body extracts `.detail`**
   Mock `fetch` to return `{ ok: false, status: 400, text: () => JSON.stringify({ detail: 'Beneficiary not found.' }) }`.
   Assert the error displayed is `'Beneficiary not found.'`.

5. **`sendRequest` — Pydantic array `.detail` is joined into a readable string**
   Mock `fetch` to return `{ ok: false, status: 422, text: () => JSON.stringify({ detail: [{ msg: 'field required' }, { msg: 'invalid value' }] }) }`.
   Assert the error contains both `'field required'` and `'invalid value'`.

### `backend/test_sandbox.py`

Use **pytest** + **httpx.AsyncClient** with `transport=ASGITransport(app=app)`.
Use a fresh in-memory SQLite database per test via a `db_session` fixture that
overrides the `get_db` dependency.

Cover these cases:

1. **`POST /fx/rate` — rejects lowercase currency codes**
   Send `{ "sellCurrency": "aud", "buyCurrency": "usd", "sellAmount": 1000 }`.
   Assert `422`.

2. **`POST /fx/rate` — rejects invalid date format**
   Send `{ "sellCurrency": "AUD", "buyCurrency": "USD", "sellAmount": 1000, "paymentDate": "23-09-2026" }`.
   Assert `422`.

3. **`POST /fx/rate` — accepts valid payload**
   Send the canonical AUD→USD payload. Assert `200` and response has `rateId`.

4. **`POST /beneficiaries` — rejects invalid country code**
   Send a payload with `"bankCountry": "USA"` (3 letters, not 2).
   Assert `422`.

5. **`POST /sandbox/reset` — restores seed accounts**
   Create an instruction (to mutate state), call reset, then `GET /sandbox/state`.
   Assert `instructionRequests` is empty and `accounts` has 3 items with original balances.

6. **`POST /instruction-requests` — deducts balance from the correct account**
   Call `POST /fx/rate` then `POST /instruction-requests` with `sellAmount: 10000`.
   Call `GET /corporate-currency-accounts/ACC-001`.
   Assert balance is `115000.00` (125000 − 10000).

---

## Acceptance criteria

- All existing behaviour is preserved — no UI or API contract changes.
- `npm test` (Vitest) passes with the 5 frontend cases above.
- `pytest backend/` passes with the 6 backend cases above.
- No new linting errors (`npm run lint` clean, `ruff check backend/` clean).
