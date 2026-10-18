import re
from collections import deque
from urllib.parse import urljoin, urldefrag, urlsplit
from bs4 import BeautifulSoup
from .fetcher import ALLOWED_HOSTS
from .html_parser import parse_blocks
from .pdf_parser import parse_pdf
from .courses import extract_epos_courses


def relevant_links(html, base):
    soup = BeautifulSoup(html, "lxml")
    scope = soup.select_one("#ifa-stipendien-detail") or soup.select_one("main") or soup
    found = []
    for anchor in scope.select("a[href]"):
        url = urldefrag(urljoin(base, anchor["href"]))[0]
        label = anchor.get_text(" ", strip=True)
        if urlsplit(url).hostname not in ALLOWED_HOSTS or urlsplit(url).scheme != "https":
            continue
        if any(x in url.lower() for x in ("?detail=", "scholarship-database.pdf", "/login", "/register", "how-do-i-register")):
            continue
        if re.search(r"extra.?info|additional information|specific|portfolio|work sample|list of.*courses|course overview|application documents|application procedure|selection criteria", label + " " + url, re.I):
            priority = 0 if re.search("extra.?info|additional information", label + url, re.I) else 1
            found.append((priority, url, label))
    return [(u, label) for _, u, label in sorted(set(found))]


def crawl_links(fetcher, html, base_url, max_depth=1, max_pages=3):
    queue = deque((url, label, 1) for url, label in relevant_links(html, base_url))
    visited, pages, blocks = set(), [], []
    while queue and len(pages) < max_pages:
        url, label, depth = queue.popleft()
        if depth > max_depth or url in visited:
            continue
        visited.add(url)
        try:
            response = fetcher.fetch(url)
            if "application/pdf" in response.headers.get("content-type", "") or response.content.startswith(b"%PDF"):
                extracted = parse_pdf(response.content, str(response.url))
                for block in extracted:
                    block.heading_path.insert(1, label)
            else:
                soup = BeautifulSoup(response.text, "lxml")
                for node in soup.select("nav, header, footer, script, style, form"):
                    node.decompose()
                root = soup.select_one("main") or soup.select_one(".page-main") or soup.body or soup
                extracted = parse_blocks(root, "Linked official guidance: " + label, str(response.url))
                if depth < max_depth:
                    queue.extend((u, l, depth+1) for u, l in relevant_links(response.text, str(response.url)))
            blocks.extend(extracted)
            if not extracted:
                raise ValueError("No extractable text in linked guidance; review selector or scanned PDF/OCR needs")
            page_info = {"url": url, "depth": depth, "label": label, "status": "retrieved", "block_count": len(extracted)}
            if 'daad_epos_deadlines.pdf' in url:
                page_info['courses'] = extract_epos_courses(response.content, str(response.url))
            pages.append(page_info)
        except Exception as exc:
            pages.append({"url": url, "depth": depth, "label": label, "status": "failed", "error": str(exc)})
    return blocks, pages
