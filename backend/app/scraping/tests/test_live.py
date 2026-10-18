import json
import os
from pathlib import Path
import pytest
from app.scraping.cli import ROOT
from app.scraping.core.fetcher import Fetcher
from app.scraping.core.browser import select_egypt_in_browser
from app.scraping.core.html_parser import application_form

pytestmark = pytest.mark.live


def test_live_browser_egypt_submission():
    if os.environ.get("MADA_LIVE") != "1":
        pytest.skip("Set MADA_LIVE=1 for explicit real website integration")
    discovery = json.loads((ROOT / "data/scraping/reports/daad_discovery.json").read_text(encoding="utf-8"))
    music = next(r for r in discovery["programs"] if r["daad_program_id"] == "57135743")
    fetcher = Fetcher(ROOT / "data/scraping/raw/live_browser_test")
    try:
        html = fetcher.fetch(music["url"]).text
        form = application_form(html, music["url"])
        status = next(s for s in form["statuses"] if "Graduate" in s["label"])
        _, url, options, confirmed = select_egypt_in_browser(fetcher, music["url"], music["daad_program_id"],
            status["value"], ROOT / "data/scraping/raw/live_browser_test")
        assert confirmed and url and any(c["label"] == "Egypt" for c in options["countries"])
    finally:
        fetcher.close()
