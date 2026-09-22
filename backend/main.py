from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

BASE_URL = os.getenv("SOKIN_BASE_URL", "https://api-uat.sokin.com").rstrip("/")
CLIENT_ID = os.getenv("SOKIN_CLIENT_ID")
CLIENT_SECRET = os.getenv("SOKIN_CLIENT_SECRET")
ALLOWED_TEST_HOSTS = frozenset(
    host.strip().lower()
    for host in os.getenv(
        "CREDENTIAL_TEST_ALLOWED_HOSTS",
        "localhost,127.0.0.1,myinternalcompany.com",
    ).split(",")
    if host.strip()
)

ALLOWED_PATHS = (
    re.compile(r"^/oauth/token$"),
    re.compile(r"^/fx/rate$"),
    re.compile(r"^/instruction-requests$"),
    re.compile(r"^/instruction-requests/[^/]+$"),
    re.compile(r"^/corporate-currency-accounts$"),
    re.compile(r"^/corporate-currency-accounts/[^/]+$"),
    re.compile(r"^/beneficiaries$"),
)

app = FastAPI(title="Sokin Embedded API UAT test proxy", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class ProxyRequest(BaseModel):
    method: str = Field(pattern="^(GET|POST)$")
    path: str
    body: dict[str, Any] | None = None
    token: str | None = None


class CredentialTestRequest(BaseModel):
    target_url: str = Field(min_length=1, max_length=2_048)


def is_allowed_path(path: str) -> bool:
    return any(pattern.fullmatch(path) for pattern in ALLOWED_PATHS)


@app.post("/api/v1/test-credentials")
def test_credentials(request: CredentialTestRequest) -> dict[str, str]:
    """Validate a permitted test target without sending credentials or requests."""
    parsed_url = urlparse(request.target_url)
    hostname = parsed_url.hostname

    if parsed_url.scheme not in {"http", "https"} or not hostname:
        raise HTTPException(status_code=400, detail="Provide a valid HTTP or HTTPS URL.")
    if hostname.lower() not in ALLOWED_TEST_HOSTS:
        raise HTTPException(
            status_code=403,
            detail="Access denied: only explicitly allowlisted test hosts are permitted.",
        )

    return {
        "target_url": request.target_url,
        "message": f"Target {hostname} is authorized for safe simulation. No credentials were sent.",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "base_url": BASE_URL}


@app.post("/proxy")
async def proxy(request: ProxyRequest) -> dict[str, Any]:
    if not is_allowed_path(request.path):
        raise HTTPException(status_code=400, detail="This endpoint is not enabled in the UAT test client.")

    headers = {"Accept": "application/json"}
    payload = request.body

    if request.path == "/oauth/token":
        if not CLIENT_ID or not CLIENT_SECRET:
            raise HTTPException(
                status_code=500,
                detail="SOKIN_CLIENT_ID and SOKIN_CLIENT_SECRET must be configured in backend/.env.",
            )
        payload = {
            "grant_type": (request.body or {}).get("grant_type", "client_credentials"),
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }
    elif request.token:
        headers["Authorization"] = f"Bearer {request.token}"
    else:
        raise HTTPException(status_code=401, detail="Authenticate first to obtain a Bearer token.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                request.method,
                f"{BASE_URL}{request.path}",
                headers=headers,
                json=payload if request.method == "POST" else None,
            )
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail=f"Unable to reach Sokin UAT: {error}") from error

    try:
        data: Any = response.json()
    except ValueError:
        data = response.text

    return {"status": response.status_code, "data": data}