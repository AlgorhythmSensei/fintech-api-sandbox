from __future__ import annotations

from typing import Generator

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from sandbox import app, get_db


@pytest.fixture
def db_session(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session, sessionmaker

    from sandbox import Base, Account, Beneficiary, FxRate, InstructionRequest

    engine = create_engine(
        'sqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr('sandbox.SessionLocal', SessionLocal)
    monkeypatch.setattr('sandbox.engine', engine)

    with SessionLocal() as db:
        from sandbox import seed_data
        seed_data(db)

    yield SessionLocal
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.mark.asyncio
async def test_fx_rate_rejects_lowercase_currency_codes(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/fx/rate',
            json={'sellCurrency': 'aud', 'buyCurrency': 'usd', 'sellAmount': 1000},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_fx_rate_rejects_invalid_date_format(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/fx/rate',
            json={'sellCurrency': 'AUD', 'buyCurrency': 'USD', 'sellAmount': 1000, 'paymentDate': '23-09-2026'},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_fx_rate_accepts_valid_payload(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/fx/rate',
            json={'sellCurrency': 'AUD', 'buyCurrency': 'USD', 'sellAmount': 1000, 'paymentDate': '2026-09-23'},
        )
    assert response.status_code == 200
    assert 'rateId' in response.json()


@pytest.mark.asyncio
async def test_beneficiary_rejects_invalid_country_code(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/beneficiaries',
            json={
                'name': 'Acme Corp',
                'currency': 'USD',
                'accountNumber': '123456789',
                'routingNumber': '021000021',
                'bankCountry': 'USA',
                'paymentType': 'REGULAR',
            },
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_sandbox_reset_restores_seed_accounts(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        await client.post(
            '/instruction-requests',
            json={
                'instructionType': 'PAYMENT',
                'sellCurrency': 'AUD',
                'buyCurrency': 'USD',
                'sellAmount': 10000,
                'paymentDate': '2026-09-23',
                'beneficiaryId': 'BEN-001',
                'reference': 'INV-RESET-1',
            },
        )
        reset_response = await client.post('/sandbox/reset')
        state_response = await client.get('/sandbox/state')

    assert reset_response.status_code == 200
    assert state_response.status_code == 200
    payload = state_response.json()
    assert payload['instructionRequests'] == []
    assert len(payload['accounts']) == 3
    assert payload['accounts'][0]['balance'] == 125000.0


@pytest.mark.asyncio
async def test_instruction_request_deducts_correct_account_balance(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as client:
        rate_response = await client.post(
            '/fx/rate',
            json={'sellCurrency': 'AUD', 'buyCurrency': 'USD', 'sellAmount': 10000, 'paymentDate': '2026-09-23'},
        )
        instruction_response = await client.post(
            '/instruction-requests',
            json={
                'instructionType': 'PAYMENT',
                'sellCurrency': 'AUD',
                'buyCurrency': 'USD',
                'sellAmount': 10000,
                'paymentDate': '2026-09-23',
                'beneficiaryId': 'BEN-001',
                'reference': 'INV-001',
            },
        )
        account_response = await client.get('/corporate-currency-accounts/ACC-001')

    assert rate_response.status_code == 200
    assert instruction_response.status_code == 200
    assert account_response.status_code == 200
    assert account_response.json()['balance'] == 115000.0
