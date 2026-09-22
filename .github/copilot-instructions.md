# GitHub Copilot Instructions — sokin-tester

Local sandbox and Postman-style UAT testing console for the **Sokin Embedded API** (`api-uat.sokin.com`).
API docs: https://api-docs.sokin.com/
Stack: FastAPI + SQLite (SQLAlchemy) backend · React 19 + Vite frontend.

---

## Backend (Python / FastAPI)

- Python 3.9 venv. Always add `from __future__ import annotations` at the top of every file.
- Use `Optional[X]` from `typing` for all Pydantic model fields — **never `X | None`** — it crashes Python 3.9 Pydantic at class-definition time even with the future import.
- Use `timezone.utc` from `datetime`, not `datetime.UTC` — that attribute only exists on Python 3.11+.
- Pydantic currency fields must validate as 3-letter uppercase ISO 4217 codes: `Annotated[str, Field(pattern=r'^[A-Z]{3}$')]`.
- Date fields must validate `YYYY-MM-DD` format: `Annotated[str, Field(pattern=r'^\d{4}-\d{2}-\d{2}$')]`.
- Country code fields must be 2-letter uppercase: `Annotated[str, Field(pattern=r'^[A-Z]{2}$')]`.
- SQLite engine uses `check_same_thread=False`; acceptable for single-threaded dev, but don't add concurrent write paths without switching to async SQLAlchemy or connection pooling.
- All proxy endpoints in `main.py` whitelist paths via regex before forwarding — any new endpoint must be added to the whitelist.

### Ruff lint — known suppressions (do not "fix" these)

`ruff check backend/` raises three rule classes that conflict with mandatory project conventions.
Suppress them with inline `# noqa` comments, not by changing the code:

| Rule | Trigger | Why we suppress |
|------|---------|-----------------|
| `B008` | `Depends(get_db)` as a default argument | FastAPI's DI pattern — ruff doesn't understand it |
| `UP045` | `Optional[X]` | ruff wants `X \| None`; mandatory `Optional[X]` for Python 3.9 |
| `UP007` | `Optional[X]` (same reason) | same as above |

Add `# noqa: B008` on each `Depends(...)` default. Add `# noqa: UP045,UP007` on `Optional` fields if ruff flags them. Do **not** convert `Optional[X]` to `X | None`.

## Frontend (React / JavaScript)

- Always check `response.ok` **before** calling `response.json()` — a non-OK response may return non-JSON (e.g. an HTML 502 page) and `.json()` would throw a misleading parse error instead of the real HTTP error.
  Pydantic 422 responses return `detail` as an **array** of `{msg, loc, type}` objects — join them: `detail.map(d => d.msg).join(', ')`.

  ```js
  // WRONG
  const data = await response.json()
  if (!response.ok) throw new Error(data.detail)   // crashes on non-JSON body; shows "[object Object]" for 422

  // RIGHT
  if (!response.ok) {
    const text = await response.text()
    let detail
    try { detail = JSON.parse(text).detail } catch { detail = text || 'The request failed.' }
    throw new Error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail)
  }
  const data = await response.json()
  ```

- Two existing warnings in `ExportButton.jsx` from `npm run lint` are pre-existing and non-blocking — do not refactor that file to silence them unless asked.

- Loading state must be reset in a `finally` block, not only in the catch path.

  ```js
  // WRONG: spinner never clears on success
  } catch (e) { setError(e.message); setLoading(false) }

  // RIGHT
  } finally { setLoading(false) }
  ```

- Never use a bare `catch` that discards the error object — always bind it: `catch (e)`.
- Endpoint path comparisons are exact strings — don't add or omit trailing slashes inconsistently.
- Array element access like `arr[arr.length - 1].prop` must guard against null/undefined elements: use `arr.at(-1)?.prop ?? ''`.
- OAuth token expiry uses `expiresAt - Date.now()` — always clamp to `Math.max(0, ...)` and document the unit (ms).
- Tokens are intentionally held only in React state (not localStorage) for security — don't suggest persisting them.

## General

- This is a local-only dev tool; no production deployment. Don't add CORS wildcard or disable auth for "convenience".
- The Vite proxy (`/api` → `http://127.0.0.1:8000`) eliminates CORS in dev — don't add a second proxy or change the port without updating both configs.
- Sandbox environment uses `sandbox.py` (stateful mock of the Sokin API). Real UAT proxies through `main.py` to `api-uat.sokin.com`. Keep these paths strictly separate — sandbox endpoints must never call the real Sokin host.
- Export functionality (`ExportButton.jsx`) generates Postman environment JSON — maintain the schema structure when adding new variables.
