from __future__ import annotations

import sqlite3


def assert_account_balance(db: sqlite3.Connection, reference: str, expected_balance: float) -> float:
    row = db.execute("SELECT balance FROM accounts WHERE reference = ?", (reference,)).fetchone()
    assert row is not None, f"Account {reference} does not exist."
    actual_balance = float(row[0])
    assert actual_balance == expected_balance, f"Account {reference}: expected {expected_balance}, got {actual_balance}."
    return actual_balance


def assert_instruction_exists(db: sqlite3.Connection, reference: str, expected_status: str) -> dict[str, object]:
    row = db.execute(
        "SELECT instruction_reference, status, sell_amount, sell_currency FROM instruction_requests WHERE instruction_reference = ?",
        (reference,),
    ).fetchone()
    assert row is not None, f"Instruction {reference} does not exist."
    assert row[1] == expected_status, f"Instruction {reference}: expected {expected_status}, got {row[1]}."
    return {"reference": row[0], "status": row[1], "sellAmount": row[2], "sellCurrency": row[3]}


def assert_beneficiary_exists(db: sqlite3.Connection, beneficiary_id: str, expected_status: str) -> dict[str, object]:
    row = db.execute("SELECT id, name, status, currency FROM beneficiaries WHERE id = ?", (beneficiary_id,)).fetchone()
    assert row is not None, f"Beneficiary {beneficiary_id} does not exist."
    assert row[2] == expected_status, f"Beneficiary {beneficiary_id}: expected {expected_status}, got {row[2]}."
    return {"id": row[0], "name": row[1], "status": row[2], "currency": row[3]}


def assert_fx_rate_exists(db: sqlite3.Connection, rate_id: str) -> dict[str, object]:
    row = db.execute(
        "SELECT rate_id, rate, sell_currency, buy_currency FROM fx_rates WHERE rate_id = ?",
        (rate_id,),
    ).fetchone()
    assert row is not None, f"Rate {rate_id} does not exist."
    return {"rateId": row[0], "rate": row[1], "sellCurrency": row[2], "buyCurrency": row[3]}