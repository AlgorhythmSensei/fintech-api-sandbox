from __future__ import annotations

import os
import re
import socket
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

load_dotenv()

BASE_URL = (os.getenv("SOKIN_BASE_URL") or os.getenv("REAL_BASE_URL", "https://api-uat.sokin.com")).rstrip("/")
CLIENT_ID = os.getenv("SOKIN_CLIENT_ID") or os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("SOKIN_CLIENT_SECRET") or os.getenv("CLIENT_SECRET")
DEFAULT_UAT_CANDIDATES = (
    "https://api-uat.sokin.com",
    "https://api.uat.sokin.com",
    "https://uat-api.sokin.com",
    "https://uat.sokin.com",
)
UAT_CANDIDATES = tuple(
    candidate.strip().rstrip("/")
    for candidate in os.getenv("SOKIN_UAT_CANDIDATES", ",".join(DEFAULT_UAT_CANDIDATES)).split(",")
    if candidate.strip()
)
ALLOWED_UAT_HOSTS = frozenset(urlparse(candidate).hostname for candidate in UAT_CANDIDATES)
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
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RPA_REPORT_PATH = PROJECT_ROOT / "reports" / "results.xml"

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
    body: Optional[dict[str, Any]] = None
    token: Optional[str] = None


class CredentialTestRequest(BaseModel):
    target_url: str = Field(min_length=1, max_length=2_048)


def is_allowed_path(path: str) -> bool:
    return any(pattern.fullmatch(path) for pattern in ALLOWED_PATHS)


def is_allowed_uat_candidate(candidate: str) -> bool:
    parsed_url = urlparse(candidate)
    return (
        parsed_url.scheme == "https"
        and bool(parsed_url.hostname)
        and parsed_url.hostname in ALLOWED_UAT_HOSTS
        and candidate.rstrip("/") in UAT_CANDIDATES
    )


def request_error_detail(error: httpx.RequestError) -> str:
    current_error: Optional[BaseException] = error
    while current_error is not None:
        if isinstance(current_error, socket.gaierror):
            return "DNS lookup failed. Check the configured Sokin UAT base URL and network connection."
        current_error = current_error.__cause__ or current_error.__context__
    return f"Network request failed: {error}"


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


@app.post("/api/v1/run-rpa")
def run_rpa() -> dict[str, object]:
    """Run the isolated local Playwright walkthrough and return its safe summary."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "tests/rpa_runner.py", "-s"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=504, detail="The local RPA walkthrough timed out.") from error

    output = f"{result.stdout}\n{result.stderr}".strip()
    return {"passed": result.returncode == 0, "output": output[-12000:]}


@app.post("/api/v1/export-rpa-junit")
def export_rpa_junit() -> FileResponse:
    """Run the local RPA suite and download a CI-compatible JUnit XML report."""
    RPA_REPORT_PATH.parent.mkdir(exist_ok=True)
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/rpa_runner.py", f"--junitxml={RPA_REPORT_PATH}"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=504, detail="The local RPA JUnit export timed out.") from error

    if not RPA_REPORT_PATH.exists():
        raise HTTPException(status_code=500, detail="The RPA suite did not produce a JUnit XML report.")

    return FileResponse(
        RPA_REPORT_PATH,
        media_type="application/xml",
        filename="results.xml",
        headers={"X-RPA-Passed": str(result.returncode == 0).lower()},
    )


@app.post("/api/v1/test-uat-endpoints")
async def test_uat_endpoints() -> dict[str, list[dict[str, object]]]:
    """Try configured Sokin UAT token endpoints without returning sensitive data."""
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="CLIENT_ID and CLIENT_SECRET must be configured in backend/.env.",
        )

    results: list[dict[str, object]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for candidate in UAT_CANDIDATES:
            if not is_allowed_uat_candidate(candidate):
                continue
            try:
                response = await client.post(
                    f"{candidate}/oauth/token",
                    headers={"Accept": "application/json"},
                    json={
                        "grant_type": "client_credentials",
                        "client_id": CLIENT_ID,
                        "client_secret": CLIENT_SECRET,
                    },
                )
                token_created = False
                if response.is_success:
                    try:
                        token_created = bool(response.json().get("access_token"))
                    except ValueError:
                        pass
                results.append({
                    "baseUrl": candidate,
                    "status": response.status_code,
                    "tokenCreated": token_created,
                })
            except httpx.RequestError:
                results.append({"baseUrl": candidate, "status": "unreachable", "tokenCreated": False})

    return {"results": results}


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
                detail="CLIENT_ID and CLIENT_SECRET must be configured in backend/.env.",
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
        raise HTTPException(status_code=502, detail=request_error_detail(error)) from error

    try:
        data: Any = response.json()
    except ValueError:
        data = response.text

    return {"status": response.status_code, "data": data}