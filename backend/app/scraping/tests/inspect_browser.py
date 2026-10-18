"""Explicit diagnostic: inspect public select-widget markup without submitting anything."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57135743", wait_until="domcontentloaded")
        page.get_by_role("link", name="Application Procedure", exact=True).click()
        form = page.locator("#select-application-info-form")
        form.wait_for(state="visible")
        print(form.locator('select[name="status"]').evaluate("e => e.nextElementSibling.outerHTML"))
        browser.close()
