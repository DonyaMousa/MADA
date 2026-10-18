import re
from urllib.parse import urlsplit, urlunsplit, urlencode
from ..core.discovery import discover
from ..core.html_parser import application_form, parse_sections, title_and_provider, selection_confirmed
from ..core.normalizer import parse_deadlines, extract_funding, application_status
from ..core.requirement_extractor import extract_requirements, extract_documents
from ..core.crawler import crawl_links
from ..core.browser import select_egypt_in_browser
from ..core.validator import validate_record
from ..schemas.scholarship import Scholarship, Variant
from ..storage.json_repository import utcnow


def evidence_url(url, identifier, origin, status):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path,
        urlencode({"detail": identifier, "origin": origin, "status": status}), ""))


class DaadAdapter:
    def __init__(self, fetcher, max_depth=1, linked_pages=3, browser_fallback=True, force_browser=False):
        self.fetcher = fetcher
        self.max_depth = max_depth
        self.linked_pages = linked_pages
        self.browser_fallback = browser_fallback
        self.force_browser = force_browser

    def discover(self, max_pages=30):
        return discover(self.fetcher, max_pages)

    def _retrieve_variant(self, form, status, html, identifier, url):
        variant = Variant(applicant_status=status["label"], applicant_status_value=status["value"],
            country_options=form["countries"], status_options=form["statuses"], country_semantics=form["country_semantics"])
        egypt = next((x for x in form["countries"] if x["label"].casefold() == "egypt"), None)
        variant.egypt_selectable = bool(egypt) if form["countries"] else None
        if not egypt:
            explicit = bool(form["countries"]) and "cannot apply for this scholarship programme" in html
            variant.eligibility_classification = "unsupported_for_egypt" if explicit else "needs_verification"
            variant.extraction_status = "partial"
            variant.error = "Egypt absent from authoritative list" if explicit else "Country list empty/unavailable"
            return variant, [], None
        variant.selected_country, variant.selected_country_value = "Egypt", egypt["value"]
        try:
            try:
                if self.force_browser:
                    raise ValueError("Browser mode explicitly requested")
                body = {**form["hidden"], "origin": egypt["value"], "status": status["value"], "ref": "prozess"}
                selected = self.fetcher.fetch(form["action"], method="POST", data=body) if form["method"] == "POST" else self.fetcher.fetch(form["action"] + "&" + urlencode(body))
                selected_html = selected.text
                if not selection_confirmed(selected_html, identifier, egypt["value"], status["value"]):
                    raise ValueError("Form response did not confirm Egypt and applicant status")
                selected_url = evidence_url(str(selected.url), identifier, egypt["value"], status["value"])
                variant.selection_confirmed = True
            except Exception as exc:
                from ..core.fetcher import AccessRestricted
                if isinstance(exc, AccessRestricted) or not self.browser_fallback:
                    raise
                selected_html, selected_url, _, confirmed = select_egypt_in_browser(self.fetcher, url, identifier,
                    status["value"], self.fetcher.raw_dir / "browser")
                variant.selection_confirmed = confirmed
                variant.interaction_method = "playwright_form"
            selected_blocks = parse_sections(selected_html, selected_url)
            procedure = [b for b in selected_blocks if b.section == "Application Procedure"]
            variant.application_procedure_loaded = bool(procedure) and variant.selection_confirmed
            variant.application_procedure = "\n".join(b.text for b in procedure)
            variant.application_status, variant.application_status_evidence = application_status(selected_blocks)
            variant.deadlines = parse_deadlines(selected_blocks, status["label"])
            variant.required_documents = extract_documents(selected_blocks, status["label"])
            variant.evidence_urls = [selected_url + "#prozess"]
            variant.eligibility_classification = "supported_for_egypt" if variant.application_procedure_loaded else "needs_verification"
            variant.extraction_status = "complete" if variant.application_procedure_loaded and variant.required_documents else "partial"
            return variant, selected_blocks, selected_html
        except Exception as exc:
            variant.error = f"{type(exc).__name__}: {exc}"
            return variant, [], None

    def scrape(self, candidate):
        identifier, url = candidate["daad_program_id"], candidate["url"]
        record = Scholarship(daad_program_id=identifier, title=candidate.get("title"), official_program_url=url,
            retrieval_timestamp=utcnow())
        evidence_start = len(self.fetcher.evidence)
        try:
            response = self.fetcher.fetch(url)
            html = response.text
            title, provider = title_and_provider(html)
            if not title or not re.search(r"jsParamdetail\s*=\s*['\"]" + re.escape(identifier), html):
                raise ValueError("Detail page identity could not be confirmed")
            record.title, record.provider = title, provider
            record.scholarship_category = "DAAD study/research scholarship"
            sections = parse_sections(html, url)
            record.raw_sections = sections
            form = application_form(html, url)
            variant_sections = []
            if not form:
                record.issues.append("Country/status selection form not present; no Egypt eligibility inferred")
            else:
                statuses = [x for x in form["statuses"] if re.search(r"graduate|doctoral|research|scientist", x["label"], re.I)]
                if not statuses:
                    record.issues.append("No relevant applicant-status option found")
                for status in statuses:
                    variant, selected_blocks, selected_html = self._retrieve_variant(form, status, html, identifier, url)
                    record.applicant_status_variants.append(variant)
                    if selected_blocks:
                        variant_sections.append((status["label"], selected_blocks))
            if variant_sections:
                # Use country-selected content rather than generic placeholders for core extraction.
                sections = variant_sections[0][1]
            linked_blocks, record.linked_pages = crawl_links(self.fetcher, html, url, self.max_depth, self.linked_pages)
            record.courses = [course for page in record.linked_pages for course in page.get('courses', [])]
            record.is_umbrella_programme = identifier == '50076777'
            if record.is_umbrella_programme:
                record.issues.append('EPOS umbrella: course-specific deadlines must be checked on each official course website; never use one programme deadline for all courses')
            record.raw_sections = sections + linked_blocks
            collection = extract_requirements(sections + linked_blocks,
                variant_sections[0][0] if variant_sections else None, "Egypt" if variant_sections else None)
            for key, value in collection.items():
                setattr(record, key, value)
            # Add different requirements from additional statuses, retaining their explicit context.
            for status, status_blocks in variant_sections[1:]:
                extra = extract_requirements(status_blocks, status, "Egypt")
                for key, value in extra.items():
                    getattr(record, key).extend(value)
            record.required_documents = [d for v in record.applicant_status_variants for d in v.required_documents] or extract_documents(sections)
            record.deadlines = [d for v in record.applicant_status_variants for d in v.deadlines] or parse_deadlines(sections)
            record.deadlines.extend(parse_deadlines(linked_blocks))
            record.funding = extract_funding(sections)
            states = {v.application_status for v in record.applicant_status_variants if v.selection_confirmed}
            if len(states) == 1 and all(v.selection_confirmed for v in record.applicant_status_variants):
                record.application_status = states.pop()
                record.application_status_evidence = record.applicant_status_variants[0].application_status_evidence
            else:
                record.application_status, record.application_status_evidence = "unknown", None
            record.program_objectives = [b.text for b in sections if "Objective" in b.heading_path]
            record.description = "\n".join(record.program_objectives) or None
            # DAAD public catalogue is explicitly for stays in Germany; title alone does not define degree.
            record.destination_countries = ["Germany"]
            degree_text = " ".join(b.text for b in sections if any(x in " ".join(b.heading_path).lower()
                for x in ("who can apply", "what can be funded", "objective")))
            record.supported_degrees = (["masters"] if re.search(r"master", degree_text, re.I) else []) + (["phd"] if re.search(r"doctoral|phd|ph\.d", degree_text, re.I) else [])
            record.fields_of_study = [field for field in ("Music", "Architecture") if re.search(r"\b" + field + r"\b", title, re.I)]
            record.eligible_academic_disciplines = [b.text for b in sections if "Who can apply?" in b.heading_path]
            record.application_process = [b for b in sections if b.section in ("Submitting an application", "Application Procedure")]
            record.academic_eligibility = {"explicit_minimum_gpa": next((r.value for r in record.structured_requirements if r.unit == "GPA"), None),
                "requirements": [r.model_dump(mode="json") for r in record.structured_requirements if r.category in
                    ("academic_performance", "graduation_recency", "previous_degree", "research", "university_admission", "portfolio")]}
            record.languages = {"requirements": [r.model_dump(mode="json") for r in record.structured_requirements if r.category == "language"],
                "unpublished_test_thresholds": None}
            record.nationality_and_residence = {"eligible_nationalities": None,
                "country_semantics": "Country in which applicant lives and from which they apply; not proof of Egyptian citizenship eligibility",
                "requirements": [r.model_dump(mode="json") for r in record.structured_requirements if r.category == "residence"]}
            record.work_and_research_experience = {"requirements": [r.model_dump(mode="json") for r in record.structured_requirements if r.category in ("professional_experience", "research")]}
            from bs4 import BeautifulSoup
            selected_soup = BeautifulSoup(variant_sections and selected_html or html, "lxml")
            record.application_portals = list(dict.fromkeys(a["href"] for a in selected_soup.select('#bewerbung a[href]')
                if re.search(r"application portal|apply now|to the portal", a.get_text(" "), re.I)))
            record.official_application_url = record.application_portals[0] if record.application_portals else None
            if record.official_application_url is None:
                record.issues.append("No active application portal URL published; database mapping uses official submitting-application tab")
        except Exception as exc:
            record.issues.append(f"{type(exc).__name__}: {exc}")
        finally:
            record.evidence = self.fetcher.evidence[evidence_start:]
        return validate_record(record)
