import json
import math
import re
from urllib.parse import parse_qs, urlsplit, urljoin
from bs4 import BeautifulSoup

CATALOGUE = "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/"


def program_id(url):
    parts = urlsplit(url)
    if parts.hostname not in {"www2.daad.de", "www.daad.de", "daad.de"}:
        return None
    value = parse_qs(parts.query).get("detail", [None])[0]
    if value and re.fullmatch(r"\d{8}", value):
        return value
    match = re.search(r"stipa(\d{8})", parts.path)
    return match.group(1) if match else None


def catalogue_script_url(html, url=CATALOGUE):
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.select("script[src]"):
        if re.search(r"/data/a/js/scholarships\.js(?:\?|$)", tag["src"]):
            return urljoin(url, tag["src"])
    return None


def parse_catalogue_data(text):
    # Parse JSON argument, never execute JavaScript from a remote page.
    match = re.search(r"\bvar\s+scholarships\s*=\s*TAFFY\s*\(", text)
    if not match:
        raise ValueError("DAAD TAFFY scholarship data declaration not found")
    rows, _ = json.JSONDecoder().raw_decode(text[match.end():].lstrip())
    if not isinstance(rows, list):
        raise ValueError("Catalogue is not an array")
    records = []
    for row in rows:
        identifier = str(row.get("sapProgid", ""))
        if re.fullmatch(r"\d{8}", identifier):
            records.append({"daad_program_id": identifier, "title": row.get("programmnameEn") or row.get("nameEn"),
                "provider_is_daad": bool(row.get("isDaad")), "status_ids": row.get("status", []),
                "subject_groups": row.get("subjectGrps", []), "url": CATALOGUE + "?detail=" + identifier})
    return deduplicate(records)


def deduplicate(records):
    return list({r["daad_program_id"]: r for r in records}.values())


def paginate(records, page=1, page_size=5):
    if page < 1 or page_size < 1:
        raise ValueError("Positive page and page_size required")
    start = (page - 1) * page_size
    return records[start:start + page_size]


def select_programs(records, limit=5):
    # Title predicates select only records actually returned by DAAD; no fallback invented IDs.
    predicates = [lambda x: x["daad_program_id"] == "57135743",
        lambda x: "postgraduate studies in the field of architecture" in x["title"].lower(),
        lambda x: "master studies for all academic disciplines" in x["title"].lower(),
        lambda x: x["title"].lower() == "research grants in germany",
        lambda x: "development-related postgraduate courses" in x["title"].lower()]
    chosen = []
    available = [r for r in records if r["provider_is_daad"] and r.get("title")]
    for predicate in predicates:
        candidate = next((r for r in available if predicate(r) and r not in chosen), None)
        if candidate:
            chosen.append(candidate)
    chosen.extend(r for r in available if r not in chosen and any(s in (2, 3, 4) for s in r["status_ids"]))
    return chosen[:limit]


def discover(fetcher, max_pages=30):
    response = fetcher.fetch(CATALOGUE)
    data_url = catalogue_script_url(response.text)
    if not data_url:
        raise ValueError("DAAD catalogue JS data URL missing; browser discovery must be inspected")
    records = parse_catalogue_data(fetcher.fetch(data_url).text)
    # The inspected site paginates an already downloaded TAFFY dataset in the browser.
    # Walk the dataset pages without issuing redundant country-filtered catalogue requests.
    pages = [paginate(records, n) for n in range(1, min(max_pages, math.ceil(len(records) / 5)) + 1)]
    walked = deduplicate([r for page in pages for r in page])
    return walked, {"catalogue_url": CATALOGUE, "data_url": data_url, "global_country_filter": None,
        "mechanism": "public TAFFY JSON dataset; client-side pagination, five results/page",
        "available_count": len(records), "discovered_count": len(walked), "pages_walked": len(pages),
        "truncated": len(walked) < len(records), "programs": walked}
