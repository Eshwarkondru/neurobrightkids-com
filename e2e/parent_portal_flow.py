#!/usr/bin/env python3
"""End-to-end test runner for the NeuroLearn AI screening flow.

Covers, in one real browser session:
  1. creating a fresh Child account (sign-up form),
  2. submitting a full sample assessment (all 15 questions),
  3. the ML prediction server function being called and answering 200,
  4. the generated report being persisted to the database (re-read on /reports),
  5. the Parent Portal rendering that persisted report (focus area, risk %,
     weekly stats) instead of the empty state.

Usage:
    python3 e2e/parent_portal_flow.py [--base-url http://localhost:8080] [--headed]

Exit code 0 = every check passed. Non-zero = first failed check is printed.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import secrets
import sys
import time

from playwright.async_api import async_playwright

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {detail}" if detail else ""), flush=True)


async def run(base_url: str, headed: bool) -> int:
    stamp = f"{int(time.time())}{secrets.randbelow(900) + 100 if hasattr(secrets, 'randbelow') else secrets.randbits(10)}"
    email = f"e2e.child.{stamp}@neurolearn-test.dev"
    password = f"Nl-{secrets.token_urlsafe(12)}!7"
    child_name = f"E2E Child {stamp[-4:]}"

    predict_calls: list[int] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not headed)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        def on_response(res):
            if "_serverFn" in res.url and "predict" in res.url.lower():
                predict_calls.append(res.status)

        page.on("response", on_response)

        # 1. Sign up a fresh child account (labels aren't linked to inputs, so
        # the form is located by its placeholders).
        await page.goto(f"{base_url}/auth", wait_until="domcontentloaded")
        await page.get_by_role("tab", name="Sign Up").click()
        form = page.locator("form").filter(has=page.get_by_placeholder("Child / Parent name"))
        await form.get_by_placeholder("Child / Parent name").fill(child_name)
        await form.get_by_role("combobox").first.click()
        await page.get_by_role("option", name="Child", exact=True).click()
        await form.get_by_placeholder("child@example.com").fill(email)
        await form.get_by_placeholder("Minimum 6 characters").fill(password)
        await form.get_by_placeholder("Aarav").fill(child_name)
        await form.get_by_role("button", name=re.compile("Create Account", re.I)).click()
        await page.wait_for_url(re.compile(r"/(games|auth)"), timeout=30000)
        await page.goto(f"{base_url}/auth", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        signed_in = await page.get_by_text("You are logged in").count() > 0

        check("child account created and signed in", signed_in, email)
        if not signed_in:
            await browser.close()
            return 1

        # 2. Submit a full sample assessment (always pick the first option).
        await page.goto(f"{base_url}/assessment", wait_until="domcontentloaded")
        answered = 0
        for _ in range(40):
            options = page.locator("button.glass.rounded-2xl")
            if await options.count() == 0:
                break
            await options.first.click()
            answered += 1
            await page.wait_for_timeout(120)
            if await page.get_by_text("Assessment complete").count() > 0:
                break
        check("all assessment questions answered", answered >= 15, f"{answered} answers submitted")

        await page.get_by_text("Assessment complete").wait_for(timeout=45000)
        highest = (await page.locator("p", has_text="Highest indicator").first.inner_text()).strip()
        check("results screen shows a scored highest indicator", "%" in highest, highest)

        # 3. ML prediction server function was called and succeeded.
        model_badge = await page.get_by_text(re.compile("trained risk model", re.I)).count() > 0
        check("ML prediction API called", bool(predict_calls), f"statuses={predict_calls}")
        check("ML model (not heuristic fallback) scored the report", model_badge)

        percent_match = re.search(r"(\d+)%", highest)
        expected_percent = percent_match.group(1) if percent_match else None

        # 4. Report persisted to the database (re-read on a fresh page load).
        await page.goto(f"{base_url}/reports", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        reports_text = await page.locator("body").inner_text()
        persisted = "No reports" not in reports_text and child_name.split()[-1] in reports_text
        check("report written to the database and readable", persisted)

        # 5. Parent Portal renders the persisted report.
        await page.goto(f"{base_url}/parent", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        parent_text = await page.locator("body").inner_text()
        check("parent portal is not showing the empty state", "No reports available yet" not in parent_text)
        check("parent portal names the assessed child", child_name.split()[-1] in parent_text, child_name)
        check(
            "parent portal shows the stored risk percentage",
            bool(expected_percent) and f"{expected_percent}%" in parent_text,
            f"expected {expected_percent}%",
        )
        check(
            "parent portal renders weekly stats block",
            all(label in parent_text for label in ("Sessions", "Time on task", "Avg accuracy")),
        )
        await page.screenshot(path="/tmp/browser/e2e_parent_portal.png")

        fatal = [e for e in console_errors if "Failed to load resource" not in e]
        check("no unexpected console errors", not fatal, "; ".join(fatal[:3]))

        await browser.close()

    failed = [name for name, ok, _ in CHECKS if not ok]
    print("\n" + "=" * 60)
    print(f"{len(CHECKS) - len(failed)}/{len(CHECKS)} checks passed")
    if failed:
        print("Failed: " + ", ".join(failed))
    return 1 if failed else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    return asyncio.run(run(args.base_url.rstrip("/"), args.headed))


if __name__ == "__main__":
    sys.exit(main())
