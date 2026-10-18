import re
from bs4 import BeautifulSoup, NavigableString, Tag
from ..schemas.scholarship import Block

SECTION_IDS = {"ueberblick": "Overview", "voraussetzungen": "Application requirements",
    "prozess": "Application Procedure", "bewerbung": "Submitting an application", "kontaktberatung": "Contact and Consulting"}


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def parse_sections(html, url):
    soup = BeautifulSoup(html, "lxml")
    result = []
    for identifier, name in SECTION_IDS.items():
        root = soup.find(id=identifier)
        if root:
            result.extend(parse_blocks(root, name, url + "#" + identifier))
    return result


def parse_blocks(root, section, url):
    """Preserve DOM order, hierarchy, lists, paragraphs, bare text, notes and table rows."""
    blocks, buffer, owner, path = [], [], None, [section]
    def flush():
        nonlocal buffer
        text = clean(" ".join(buffer))
        if text:
            blocks.append(Block(section=section, heading_path=list(path), kind=getattr(owner, "name", "text") or "text",
                text=text, source_url=url, order=len(blocks)))
        buffer = []
    for node in root.descendants:
        if isinstance(node, Tag) and node.name in ("script", "style"):
            continue
        if isinstance(node, Tag) and node.name in ("h2", "h3", "h4", "h5"):
            flush()
            title = clean(node.get_text(" "))
            level = int(node.name[1]) - 2
            if title.lower() != section.lower():
                path = path[:max(1, level)] + [title]
            continue
        if isinstance(node, Tag) and node.name == "br":
            flush()
            continue
        if not isinstance(node, NavigableString) or not clean(str(node)):
            continue
        if any(p.name in ("script", "style", "h1", "h2", "h3", "h4", "h5") for p in node.parents if p is not root):
            continue
        within_root = []
        for ancestor in node.parents:
            if ancestor is root:
                break
            within_root.append(ancestor)
        parent = next((p for p in within_root if p.name in ("li", "p", "tr")), root)
        if parent is not owner:
            flush()
            owner = parent
        buffer.append(str(node))
    flush()
    return blocks


def title_and_provider(html):
    soup = BeautifulSoup(html, "lxml")
    title = soup.select_one("#ifa-stipendien-detail h2.title")
    if not title:
        return None, None
    provider_node = title.find("strong")
    provider = clean(provider_node.get_text()).lstrip("• ") if provider_node else None
    if provider_node:
        provider_node.extract()
    return clean(title.get_text(" ")), provider


def parse_options(select):
    return [{"value": x.get("value", ""), "label": clean(x.get_text(" "))}
        for x in select.find_all("option") if x.get("value") and not x.has_attr("disabled")] if select else []


def application_form(html, base_url):
    from urllib.parse import urljoin
    soup = BeautifulSoup(html, "lxml")
    form = soup.find("form", id="select-application-info-form")
    if not form:
        return None
    # Inspected DAAD markup has misleading IDs: identify semantic name attributes.
    countries = parse_options(form.find("select", attrs={"name": "origin"}))
    statuses = parse_options(form.find("select", attrs={"name": "status"}))
    hidden = {x["name"]: x.get("value", "") for x in form.select('input[type="hidden"][name]')}
    return {"action": urljoin(base_url, form.get("action", "")), "method": form.get("method", "get").upper(),
        "countries": countries, "statuses": statuses, "hidden": hidden,
        "country_semantics": clean((form.select_one('.tool-tip-land') or form).get_text(" "))}


def selection_confirmed(html, program_id, country_value, status_value):
    def value(name):
        match = re.search(r"var\s+jsParam" + name + r"\s*=\s*['\"]([^'\"]*)", html)
        return match.group(1) if match else None
    soup = BeautifulSoup(html, "lxml")
    return (value("origin") == country_value and value("status") == status_value
        and value("detail") == program_id and bool(soup.select_one("#prozess"))
        and not soup.select_one("#select-application-info-form"))
