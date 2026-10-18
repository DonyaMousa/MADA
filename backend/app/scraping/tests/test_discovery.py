import json
import pytest
from app.scraping.core.discovery import program_id, parse_catalogue_data, deduplicate, paginate, select_programs, catalogue_script_url


@pytest.mark.parametrize("url,expected", [
    ("https://www2.daad.de/x?detail=57135743#prozess", "57135743"),
    ("https://daad.de/go/en/stipa57135743", "57135743"),
    ("https://evil.example/?detail=57135743", None), ("https://www2.daad.de/x?detail=abc", None)])
def test_program_id(url, expected):
    assert program_id(url) == expected


def test_json_catalogue_parse_and_dedup():
    row = {"sapProgid": 57135743, "programmnameEn": "Music", "isDaad": 1, "status": [3]}
    records = parse_catalogue_data("var scholarships = TAFFY(" + json.dumps([row, row]) + ");")
    assert len(records) == 1 and records[0]["daad_program_id"] == "57135743"


def test_pagination_has_no_gaps():
    rows = list(range(13))
    assert sum([paginate(rows, n) for n in (1, 2, 3)], []) == rows
    assert paginate(rows, 4) == []


def test_invalid_pagination():
    with pytest.raises(ValueError):
        paginate([], 0)


def test_no_javascript_execution():
    with pytest.raises((ValueError, json.JSONDecodeError)):
        parse_catalogue_data("var scholarships = TAFFY(run_evil());")


def test_script_url_is_discovered():
    html = '<script src="/bundles/x/data/a/js/scholarships.js?cb=1&amp;x=2"></script>'
    assert catalogue_script_url(html).endswith("?cb=1&x=2")


def test_selection_never_invents_programs():
    rows = [{"daad_program_id": "12345678", "title": "Research fixture", "provider_is_daad": True, "status_ids": [2]}]
    assert select_programs(rows, 5) == rows
