from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from re import compile

import httpx
import pytest
from playwright.async_api import async_playwright, expect

from db_checks import assert_account_balance, assert_beneficiary_exists, assert_fx_rate_exists, assert_instruction_exists


async def report(name: str, action):
    try:
        value = await action()
        print(f"PASS {name}: {value}")
    except Exception as error:
        print(f"FAIL {name}: {error}")
        raise


@pytest.mark.asyncio
async def test_sandbox_rpa_runner(rpa_services):
    sandbox_url = rpa_services["sandbox"]
    database_path = rpa_services["database"]
    async with httpx.AsyncClient() as client:
        reset = await client.post(f"{sandbox_url}/sandbox/reset")
    assert reset.status_code == 200

    recordings = Path(__file__).with_name("recordings")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        context = await browser.new_context(record_video_dir=str(recordings), record_video_size={"width": 1440, "height": 1000})
        page = await context.new_page()
        await page.goto(rpa_services["ui"])
        await page.get_by_role("button", name="Open connection settings").click()
        await page.locator("#sandboxBaseUrl").fill(sandbox_url)
        await page.get_by_role("button", name="Apply settings").click()

        def database() -> sqlite3.Connection:
            return sqlite3.connect(database_path)

        async def scenario_1():
            async with httpx.AsyncClient() as client:
                state = (await client.get(f"{sandbox_url}/sandbox/state")).json()
            assert len(state["accounts"]) == 26
            assert state["instructionRequests"] == []
            return {"accounts": len(state["accounts"]), "instructionRequests": 0}

        async def scenario_2():
            await page.get_by_role("button", name=compile("Get access token")).click()
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("mock-token-abc123")
            return {"token": "mock-token-abc123"}

        async def scenario_3():
            await page.get_by_role("button", name=compile("Get FX rate")).click()
            await page.locator("textarea").fill(json.dumps({"sellCurrency": "AUD", "buyCurrency": "USD", "sellAmount": 1000, "paymentDate": "2026-10-15"}))
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("rateId")
            response = json.loads(await page.locator(".response-body").inner_text())
            with database() as db:
                return assert_fx_rate_exists(db, response["rateId"])

        async def scenario_4():
            await page.get_by_role("button", name=compile("List accounts")).click()
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("ACC-001")
            with database() as db:
                return {"ACC-001": assert_account_balance(db, "ACC-001", 125000.0)}

        async def scenario_get_account():
            await page.get_by_role("button", name=compile("Get account")).click()
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("ACC-001")
            with database() as db:
                return {"ACC-001": assert_account_balance(db, "ACC-001", 125000.0)}

        async def scenario_5():
            await page.get_by_role("button", name=compile("List beneficiaries")).click()
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("Acme Corp")
            with database() as db:
                return {"BEN-001": assert_beneficiary_exists(db, "BEN-001", "ACTIVE")}

        async def scenario_6():
            await page.get_by_role("button", name=compile("Create beneficiary")).click()
            await page.locator("textarea").fill(json.dumps({"name": "RPA Test Beneficiary", "currency": "USD", "accountNumber": "123456789", "routingNumber": "021000021", "bankCountry": "US", "paymentType": "REGULAR"}))
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("RPA Test Beneficiary")
            with database() as db:
                beneficiary_id = db.execute("SELECT id FROM beneficiaries WHERE name = ? ORDER BY created_at DESC LIMIT 1", ("RPA Test Beneficiary",)).fetchone()[0]
                return assert_beneficiary_exists(db, beneficiary_id, "PENDING")

        async def scenario_7():
            await page.get_by_role("button", name=compile("Create instruction")).click()
            await page.locator("textarea").fill(json.dumps({"instructionType": "PAYMENT", "sellCurrency": "AUD", "buyCurrency": "USD", "sellAmount": 10000, "paymentDate": "2026-10-15", "beneficiaryId": "BEN-001", "reference": "INV-001"}))
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("INV-001")
            with database() as db:
                instruction = assert_instruction_exists(db, "INV-001", "PENDING")
                balance = assert_account_balance(db, "ACC-001", 115000.0)
                return {"instruction": instruction, "balance": balance}

        async def scenario_8():
            await page.get_by_role("button", name=compile("Get instruction")).click()
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("INV-001")
            with database() as db:
                return assert_instruction_exists(db, "INV-001", "PENDING")

        async def scenario_9():
            await page.get_by_role("button", name=compile("Create instruction")).click()
            await page.locator("textarea").fill(json.dumps({"instructionType": "PAYMENT", "sellCurrency": "AUD", "buyCurrency": "USD", "sellAmount": 200000, "paymentDate": "2026-10-15", "beneficiaryId": "BEN-001", "reference": "INV-INSUFFICIENT"}))
            await page.get_by_role("button", name="Send request").click()
            await expect(page.locator(".response-body")).to_contain_text("Insufficient active account balance")
            with database() as db:
                assert db.execute("SELECT COUNT(*) FROM instruction_requests WHERE instruction_reference = ?", ("INV-INSUFFICIENT",)).fetchone()[0] == 0
                return {"instruction": "not created", "AUD": assert_account_balance(db, "ACC-001", 115000.0)}

        async def scenario_10():
            await page.get_by_role("button", name="Open connection settings").click()
            async with page.expect_download() as download_info:
                await page.get_by_role("button", name="Export to Postman").click()
            download = await download_info.value
            assert download.suggested_filename == "sokin-sandbox.postman_environment.json"
            download_path = await download.path()
            assert download_path is not None
            environment = json.loads(Path(download_path).read_text())
            values = {item["key"]: item["value"] for item in environment["values"]}
            assert values["instruction_ref"] == "INV-001"
            return {"file": download.suggested_filename, "instructionRef": values["instruction_ref"]}

        scenarios = [
            ("01 sandbox reset", scenario_1),
            ("02 sandbox token", scenario_2),
            ("03 AUD/USD FX rate", scenario_3),
            ("04 list accounts", scenario_4),
            ("05 get account", scenario_get_account),
            ("06 list beneficiaries", scenario_5),
            ("07 beneficiary creation", scenario_6),
            ("08 AUD instruction", scenario_7),
            ("09 get instruction", scenario_8),
            ("10 insufficient balance", scenario_9),
            ("11 Postman export", scenario_10),
        ]
        for name, scenario in scenarios:
            await report(name, scenario)
        await context.close()
        await browser.close()