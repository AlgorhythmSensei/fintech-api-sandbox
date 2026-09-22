from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Generator, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Float, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATABASE_URL = f"sqlite:///{Path(__file__).with_name('sokin_sandbox.db')}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    reference: Mapped[str] = mapped_column(String, unique=True)
    currency: Mapped[str] = mapped_column(String)
    balance: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    currency: Mapped[str] = mapped_column(String)
    account_number: Mapped[str] = mapped_column(String)
    routing_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bank_country: Mapped[str] = mapped_column(String)
    payment_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class InstructionRequest(Base):
    __tablename__ = "instruction_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    instruction_reference: Mapped[str] = mapped_column(String, unique=True)
    instruction_type: Mapped[str] = mapped_column(String)
    sell_currency: Mapped[str] = mapped_column(String)
    buy_currency: Mapped[str] = mapped_column(String)
    sell_amount: Mapped[float] = mapped_column(Float)
    buy_amount: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    payment_date: Mapped[str] = mapped_column(String)
    beneficiary_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class FxRate(Base):
    __tablename__ = "fx_rates"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    rate_id: Mapped[str] = mapped_column(String, unique=True)
    sell_currency: Mapped[str] = mapped_column(String)
    buy_currency: Mapped[str] = mapped_column(String)
    rate: Mapped[float] = mapped_column(Float)
    inverted_rate: Mapped[float] = mapped_column(Float)
    expires_at: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


CurrencyCode = Annotated[str, Field(pattern=r'^[A-Z]{3}$')]
IsoDate = Annotated[str, Field(pattern=r'^\d{4}-\d{2}-\d{2}$')]


class FxRatePayload(BaseModel):
    sellCurrency: CurrencyCode
    buyCurrency: CurrencyCode
    sellAmount: float = Field(gt=0)
    paymentDate: IsoDate = "2026-09-23"


class InstructionPayload(FxRatePayload):
    instructionType: str = "PAYMENT"
    beneficiaryId: str
    reference: str


class BeneficiaryPayload(BaseModel):
    name: str
    currency: CurrencyCode
    accountNumber: str
    routingNumber: Optional[str] = None
    bankCountry: Annotated[str, Field(pattern=r'^[A-Z]{2}$')]
    paymentType: Optional[str] = "REGULAR"


app = FastAPI(title="Sokin Embedded API local sandbox", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

RATE_TABLE = {("AUD", "USD"): 0.6413, ("AUD", "GBP"): 0.5212, ("USD", "GBP"): 0.7891}


def timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def account_json(account: Account) -> dict[str, object]:
    return {"reference": account.reference, "currency": account.currency, "balance": account.balance, "status": account.status, "createdAt": account.created_at}


def beneficiary_json(beneficiary: Beneficiary) -> dict[str, object]:
    return {"id": beneficiary.id, "name": beneficiary.name, "currency": beneficiary.currency, "accountNumber": beneficiary.account_number, "routingNumber": beneficiary.routing_number, "bankCountry": beneficiary.bank_country, "paymentType": beneficiary.payment_type, "status": beneficiary.status, "createdAt": beneficiary.created_at}


def instruction_json(instruction: InstructionRequest) -> dict[str, object]:
    return {"instructionReference": instruction.instruction_reference, "status": instruction.status, "instructionType": instruction.instruction_type, "sellCurrency": instruction.sell_currency, "buyCurrency": instruction.buy_currency, "sellAmount": instruction.sell_amount, "buyAmount": instruction.buy_amount, "rate": instruction.rate, "paymentDate": instruction.payment_date, "beneficiaryId": instruction.beneficiary_id, "createdAt": instruction.created_at}


def seed_data(db: Session) -> None:
    if db.scalar(select(Account.id).limit(1)):
        return
    created_at = timestamp()
    db.add_all([
        Account(id="account-001", reference="ACC-001", currency="AUD", balance=125000.00, status="ACTIVE", created_at=created_at),
        Account(id="account-002", reference="ACC-002", currency="USD", balance=48200.00, status="ACTIVE", created_at=created_at),
        Account(id="account-003", reference="ACC-003", currency="GBP", balance=12500.00, status="ACTIVE", created_at=created_at),
        Beneficiary(id="BEN-001", name="Acme Corp", currency="USD", account_number="123456789", routing_number="021000021", bank_country="US", payment_type="REGULAR", status="ACTIVE", created_at=created_at),
        Beneficiary(id="BEN-002", name="Global Trade", currency="GBP", account_number="987654321", routing_number="040004", bank_country="GB", payment_type="REGULAR", status="ACTIVE", created_at=created_at),
    ])
    db.commit()


@app.on_event("startup")
def initialise_database() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_data(db)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        yield db


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": "sandbox"}


@app.post("/oauth/token")
def token() -> dict[str, object]:
    return {"access_token": "mock-token-abc123", "token_type": "Bearer", "expires_in": 3600}


@app.post("/fx/rate")
def fx_rate(payload: FxRatePayload, db: Session = Depends(get_db)) -> dict[str, object]:
    pair = (payload.sellCurrency.upper(), payload.buyCurrency.upper())
    rate = RATE_TABLE.get(pair)
    if rate is None:
        raise HTTPException(status_code=400, detail=f"No sandbox rate is available for {pair[0]} to {pair[1]}.")
    created_at = timestamp()
    rate_id = f"RATE-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    db.add(FxRate(id=str(uuid4()), rate_id=rate_id, sell_currency=pair[0], buy_currency=pair[1], rate=rate, inverted_rate=round(1 / rate, 4), expires_at=expires_at, created_at=created_at))
    db.commit()
    return {"rateId": rate_id, "sellCurrency": pair[0], "buyCurrency": pair[1], "sellAmount": payload.sellAmount, "buyAmount": round(payload.sellAmount * rate, 2), "rate": rate, "invertedRate": round(1 / rate, 4), "paymentDate": payload.paymentDate, "expiresAt": expires_at}


@app.post("/instruction-requests")
def create_instruction(payload: InstructionPayload, db: Session = Depends(get_db)) -> dict[str, object]:
    beneficiary = db.get(Beneficiary, payload.beneficiaryId)
    if beneficiary is None:
        raise HTTPException(status_code=404, detail="Beneficiary not found.")
    account = db.scalar(select(Account).where(Account.currency == payload.sellCurrency.upper()))
    if account is None or account.status != "ACTIVE" or account.balance < payload.sellAmount:
        raise HTTPException(status_code=400, detail="Insufficient active account balance for this sell currency.")
    rate = RATE_TABLE.get((payload.sellCurrency.upper(), payload.buyCurrency.upper()))
    if rate is None:
        raise HTTPException(status_code=400, detail="No sandbox rate is available for this currency pair.")
    if db.scalar(select(InstructionRequest).where(InstructionRequest.instruction_reference == payload.reference)):
        raise HTTPException(status_code=409, detail="Instruction reference already exists.")
    instruction = InstructionRequest(id=str(uuid4()), instruction_reference=payload.reference, instruction_type=payload.instructionType, sell_currency=payload.sellCurrency.upper(), buy_currency=payload.buyCurrency.upper(), sell_amount=payload.sellAmount, buy_amount=round(payload.sellAmount * rate, 2), rate=rate, payment_date=payload.paymentDate, beneficiary_id=beneficiary.id, status="PENDING", created_at=timestamp())
    account.balance -= payload.sellAmount
    db.add(instruction)
    db.commit()
    db.refresh(instruction)
    return instruction_json(instruction)


@app.get("/instruction-requests/{instruction_reference}")
def get_instruction(instruction_reference: str, db: Session = Depends(get_db)) -> dict[str, object]:
    instruction = db.scalar(select(InstructionRequest).where(InstructionRequest.instruction_reference == instruction_reference))
    if instruction is None:
        raise HTTPException(status_code=404, detail="Instruction request not found.")
    return instruction_json(instruction)


@app.get("/corporate-currency-accounts")
def list_accounts(db: Session = Depends(get_db)) -> dict[str, list[dict[str, object]]]:
    return {"accounts": [account_json(item) for item in db.scalars(select(Account).order_by(Account.reference))]}


@app.get("/corporate-currency-accounts/{reference}")
def get_account(reference: str, db: Session = Depends(get_db)) -> dict[str, object]:
    account = db.scalar(select(Account).where(Account.reference == reference))
    if account is None:
        raise HTTPException(status_code=404, detail="Corporate currency account not found.")
    return account_json(account)


@app.get("/beneficiaries")
def list_beneficiaries(db: Session = Depends(get_db)) -> dict[str, list[dict[str, object]]]:
    return {"beneficiaries": [beneficiary_json(item) for item in db.scalars(select(Beneficiary).order_by(Beneficiary.id))]}


@app.post("/beneficiaries")
def create_beneficiary(payload: BeneficiaryPayload, db: Session = Depends(get_db)) -> dict[str, object]:
    beneficiary = Beneficiary(id=f"BEN-{uuid4().hex[:6].upper()}", name=payload.name, currency=payload.currency.upper(), account_number=payload.accountNumber, routing_number=payload.routingNumber, bank_country=payload.bankCountry.upper(), payment_type=payload.paymentType, status="PENDING", created_at=timestamp())
    db.add(beneficiary)
    db.commit()
    db.refresh(beneficiary)
    return beneficiary_json(beneficiary)


@app.post("/sandbox/reset")
def reset_sandbox(db: Session = Depends(get_db)) -> dict[str, str]:
    for model in (InstructionRequest, FxRate, Beneficiary, Account):
        db.query(model).delete()
    db.commit()
    seed_data(db)
    return {"message": "Sandbox reset to seed data."}


@app.get("/sandbox/state")
def sandbox_state(db: Session = Depends(get_db)) -> dict[str, list[dict[str, object]]]:
    return {
        "accounts": [account_json(item) for item in db.scalars(select(Account).order_by(Account.reference))],
        "beneficiaries": [beneficiary_json(item) for item in db.scalars(select(Beneficiary).order_by(Beneficiary.id))],
        "instructionRequests": [instruction_json(item) for item in db.scalars(select(InstructionRequest).order_by(InstructionRequest.created_at.desc()))],
        "fxRates": [{"rateId": item.rate_id, "sellCurrency": item.sell_currency, "buyCurrency": item.buy_currency, "rate": item.rate, "invertedRate": item.inverted_rate, "expiresAt": item.expires_at, "createdAt": item.created_at} for item in db.scalars(select(FxRate).order_by(FxRate.created_at.desc()))],
    }