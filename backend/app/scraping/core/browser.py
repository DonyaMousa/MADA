import time
import re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from .fetcher import ALLOWED_HOSTS, AccessRestricted
from .html_parser import application_form, selection_confirmed
from ..schemas.scholarship import Evidence
from ..storage.json_repository import content_hash, utcnow


def choose_visible_option(form, name, value, label):
    native = form.locator(f'select[name="{name}"]')
    if native.is_visible():
        native.select_option(value)
    else:
        # Inspected live Chosen markup: the hidden native select is followed by
        # a chzn-container with a chzn-single trigger and active-result options.
        widget = native.locator("xpath=following-sibling::div[contains(@class,'chzn-container')][1]")
        widget.locator(".chzn-single").click()
        option = widget.locator(".chzn-results li.active-result").filter(has_text=re.compile("^" + re.escape(label) + "$"))
        option.scroll_into_view_if_needed()
        option.click()
    if native.input_value() != value:
        raise ValueError(f"{name} selector did not confirm {label}")


def select_egypt_in_browser(fetcher, url, identifier, status_value, output_dir: Path):
    """Fallback using the actual inspected form, not fragment-only navigation."""
    output_dir.mkdir(parents=True, exist_ok=True)
    permitted_libraries = {"ajax.googleapis.com", "code.jquery.com"}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 1100})
            def guard(route):
                request = route.request
                host = urlsplit(request.url).hostname
                if request.resource_type in ("image", "font", "media"):
                    return route.abort()
                if host not in ALLOWED_HOSTS and not (host in permitted_libraries and request.resource_type == "script"):
                    return route.abort()
                if request.resource_type in ("document", "xhr", "fetch"):
                    try:
                        fetcher.check_url(request.url)
                        if not fetcher._robots_allowed(request.url):
                            return route.abort()
                        time.sleep(max(0, fetcher.delay - (time.monotonic() - fetcher.last_request)))
                        fetcher.last_request = time.monotonic()
                    except Exception:
                        return route.abort()
                return route.continue_()
            context.route("**/*", guard)
            page = context.new_page()
            response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if response is None or response.status in (401, 403, 429):
                raise AccessRestricted(f"Browser denied at {url}: {response.status if response else 'no response'}")
            page.get_by_role("link", name="Application Procedure", exact=True).click()
            form = page.locator("#select-application-info-form")
            form.wait_for(state="visible")
            before = page.content()
            options = application_form(before, page.url)
            if options is None:
                raise ValueError("Applicant/country form missing in browser")
            egypt = next((x for x in options["countries"] if x["label"].casefold() == "egypt"), None)
            if not egypt:
                return before, None, options, False
            status = next(x for x in options["statuses"] if x["value"] == status_value)
            choose_visible_option(form, "status", status_value, status["label"])
            choose_visible_option(form, "origin", egypt["value"], egypt["label"])
            if form.locator('select[name="origin"]').input_value() != egypt["value"]:
                raise ValueError("Egypt select value did not change")
            page.screenshot(path=str(output_dir / f"{identifier}_{status_value}_selected.png"), full_page=True)
            form.locator('input[type="submit"]').click()
            page.wait_for_function("([country,status]) => window.jsParamorigin === country && window.jsParamstatus === status",
                arg=[egypt["value"], status_value], timeout=45000)
            page.locator("#prozess").wait_for(state="attached")
            after = page.content()
            confirmed = selection_confirmed(after, identifier, egypt["value"], status_value)
            if not confirmed:
                raise ValueError("Browser response did not confirm Egypt/status/program")
            target = output_dir / f"{identifier}_{status_value}_browser.html"
            target.write_text(after, encoding="utf-8")
            fetcher.evidence.append(Evidence(url=page.url, method="BROWSER_FORM", retrieved_at=utcnow(), status_code=200,
                sha256=content_hash(after.encode()), local_path=target.as_posix(),
                request_data={"origin": egypt["value"], "status": status_value, "ref": "prozess"}, content_type="text/html"))
            page.screenshot(path=str(output_dir / f"{identifier}_{status_value}_result.png"), full_page=True)
            return after, page.url, options, True
        finally:
            browser.close()
