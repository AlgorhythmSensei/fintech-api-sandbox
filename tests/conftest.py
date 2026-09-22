from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Generator

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
RPA_DATABASE = Path(__file__).with_name("rpa_sandbox.db")
SANDBOX_URL = "http://127.0.0.1:8101"
PROXY_URL = "http://127.0.0.1:8102"
UI_URL = "http://127.0.0.1:3000"


def wait_for(url: str) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        try:
            if httpx.get(url, timeout=1.0).is_success:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.2)
    raise RuntimeError(f"Service did not start: {url}")


@pytest.fixture(scope="session", autouse=True)
def rpa_services() -> Generator[dict[str, str], None, None]:
    RPA_DATABASE.unlink(missing_ok=True)
    recordings = Path(__file__).with_name("recordings")
    recordings.mkdir(exist_ok=True)
    environment = {**os.environ, "SOKIN_SANDBOX_DATABASE_URL": f"sqlite:///{RPA_DATABASE}"}
    commands = [
        [sys.executable, "-m", "uvicorn", "sandbox:app", "--host", "127.0.0.1", "--port", "8101"],
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8102"],
        ["npm", "--prefix", str(ROOT / "frontend"), "run", "dev", "--", "--host", "127.0.0.1", "--port", "3000", "--strictPort"],
    ]
    processes = [
        subprocess.Popen(command, cwd=BACKEND_DIR if command[3] in {"sandbox:app", "main:app"} else ROOT, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for command in commands
    ]
    try:
        wait_for(f"{SANDBOX_URL}/health")
        wait_for(f"{PROXY_URL}/health")
        wait_for(UI_URL)
        yield {"sandbox": SANDBOX_URL, "proxy": PROXY_URL, "ui": UI_URL, "database": str(RPA_DATABASE)}
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        RPA_DATABASE.unlink(missing_ok=True)