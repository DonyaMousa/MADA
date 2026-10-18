"""Map captured evidence to the additive detail schema; no fetching or database writes."""
import re
from urllib.parse import parse_qs, urlsplit
from uuid import uuid5
from .json_repository import content_hash

DETAIL_TABLES = ("scholarship_snapshots", "scholarship_variants", "scholarship_requirements",
    "scholarship_language_requirements", "scholarship_required_documents", "scholarship_deadlines",
    "scholarship_funding", "scholarship_evidence")


def snapshot_id(record, run_id, namespace):
    return str(uuid5(namespace, f"snapshot:{record.daad_program_id}:{run_id}:{content_hash(record.model_dump(mode='json'))}"))


def page_limits(text):
    span = re.search(r"\b(\d+)\s*[-–]\s*(\d+)\s*pages?", text, re.I)
    maximum = re.search(r"(?:max(?:imum)?\.?\s*|up to\s*)(\d+)\s*pages?", text, re.I)
    return (int(span[1]), int(span[2])) if span else (None, int(maximum[1])) if maximum else (None, None)


def language_details(text):
    """Conservative published scores, accepted alternatives, and explicit certificate age."""
    tests = list(re.finditer(r"\b(TOEFL\s+(?:iBT|Essentials|home edition)|IELTS\s+indicator|TOEFL|IELTS|PTE\s+Academic|onSET|Test[ -]?DaF|DSH)\b", text, re.I))
    age = re.search(r"(?:not older than|no older than|no more than)\s+(\d+|three)\s+years?", text, re.I)
    max_age = (3 if age[1].lower() == "three" else int(age[1])) * 12 if age else None
    rows = []
    for i, match in enumerate(tests):
        name = re.sub(r"\s+", " ", match[1])
        tail = text[match.end():tests[i+1].start() if i+1 < len(tests) else len(text)]
        head = text[max(0, match.start()-20):match.start()]
        if name.upper() == "TOEFL" and re.search(r"institutional\s*$", head, re.I):
            name = "TOEFL institutional"
        number = re.match(r"\s*(?:(?:min(?:imum)?\.?|at least|score(?: of)?|level(?: of)?)\s*)*(\d+(?:[.,]\d+)?)\b", tail, re.I)
        cefr = re.match(r"\s*(?:(?:min(?:imum)?\.?|at least|level(?: of)?)\s*)*([ABC][12])\b", tail, re.I)
        excluded = bool(re.search(r"(?:is|are) not accepted", tail[:60], re.I))
        language = "German" if re.fullmatch(r"Test[ -]?DaF|DSH", name, re.I) else "English"
        stage = "before_course_start" if language == "German" and re.search(r"before the start", text, re.I) else "application" if re.search(r"application|submitted", text, re.I) else None
        rows.append({"language": language, "test_name": name, "minimum_score": float(number[1].replace(',', '.')) if number and not excluded else None,
            "score_scale": "test score/level as published" if number else None, "cefr_level": cefr[1] if cefr and not excluded else None,
            "operator": ">=" if number and re.search(r"min(?:imum)?\.?|at least", tail[:number.end()], re.I) else "=" if number else None,
            "requirement_stage": stage, "accepted": not excluded, "certificate_max_age_months": max_age})
    # A single published CEFR level can be represented separately. Multi-stage B2/C1/B1
    # statements remain original text until reviewed, rather than flattening all to one threshold.
    levels = set(re.findall(r"\b[ABC][12]\b", text))
    if len(levels) == 1 and not any(r["cefr_level"] for r in rows):
        rows.append({"language": "German" if re.search(r"\bGerman\b", text, re.I) else "English" if re.search(r"\bEnglish\b", text, re.I) else "unspecified",
            "test_name": None, "minimum_score": None, "score_scale": None, "cefr_level": levels.pop(), "operator": None,
            "requirement_stage": "application" if re.search(r"application|submitted", text, re.I) else None,
            "accepted": None, "certificate_max_age_months": max_age})
    if not rows:
        languages = [x for x in ("German", "English") if re.search(r"\b" + x + r"\b", text, re.I)] or ["unspecified"]
        rows = [{"language": language, "test_name": None, "minimum_score": None, "score_scale": None, "cefr_level": None,
            "operator": None, "requirement_stage": None, "accepted": None, "certificate_max_age_months": max_age} for language in languages]
    return rows


def map_details(record, scholarship_id, run_id, source_id, namespace):
    output = {name: [] for name in DETAIL_TABLES}
    sid = snapshot_id(record, run_id, namespace)
    full = record.model_dump(mode="json")
    output["scholarship_snapshots"].append({"id": sid, "scholarship_id": scholarship_id, "source_id": source_id,
        "fetch_run_id": run_id, "provider_record_id": record.daad_program_id, "schema_version": record.schema_version,
        "extractor_version": record.extractor_version, "retrieved_at": record.retrieval_timestamp.isoformat(),
        "normalized_payload": full, "payload_sha256": content_hash(full)})
    variants = {v.applicant_status: str(uuid5(namespace, sid + ":variant:" + v.applicant_status)) for v in record.applicant_status_variants}
    status_values = {v.applicant_status_value: v.applicant_status for v in record.applicant_status_variants}
    def scope(status=None):
        return {"scholarship_id": scholarship_id, "snapshot_id": sid, "variant_id": variants.get(status)}
    def emit(table, row):
        row["requires_human_review"] = True
        row["id"] = str(uuid5(namespace, table + ":" + sid + ":" + content_hash(row)))
        if not any(x["id"] == row["id"] for x in output[table]):
            output[table].append(row)
    def url_status(url):
        return status_values.get(parse_qs(urlsplit(url).query).get("status", [None])[0])
    for v in record.applicant_status_variants:
        output["scholarship_variants"].append({"id": variants[v.applicant_status], "scholarship_id": scholarship_id,
            "snapshot_id": sid, "applicant_status": v.applicant_status, "provider_status_value": v.applicant_status_value,
            "country_of_application": "Egypt", "provider_country_value": v.selected_country_value,
            "country_semantics": v.country_semantics, "egypt_selectable": v.egypt_selectable,
            "egypt_support_status": v.eligibility_classification, "selection_confirmed": v.selection_confirmed,
            "procedure_loaded": v.application_procedure_loaded, "application_procedure": v.application_procedure,
            "application_status": v.application_status, "application_status_evidence": v.application_status_evidence,
            "extraction_quality": v.extraction_status, "interaction_method": v.interaction_method,
            "country_options": v.country_options, "status_options": v.status_options, "evidence_urls": v.evidence_urls,
            "error_detail": v.error, "requires_human_review": True})
    groups = {}
    for collection in ("structured_requirements", "selection_criteria", "conditional_requirements", "unresolved_requirements"):
        for requirement in getattr(record, collection):
            item = groups.setdefault(requirement.requirement_id, {"requirement": requirement, "collections": []})
            item["collections"].append(collection)
    for item in groups.values():
        r = item["requirement"]
        gpa = r.value if r.unit == "GPA" and isinstance(r.value, dict) else {}
        months = int(r.value * (12 if r.unit == "year" else 1)) if r.category == "professional_experience" and isinstance(r.value, (int, float)) and r.operator == ">=" and r.unit in ("year", "month") else None
        rank = re.search(r"upper third|top performance third|top third", r.original_text, re.I)
        publications = re.search(r"at least\s+(\d+)\s+(?:published\s+)?publications", r.original_text, re.I)
        emit("scholarship_requirements", {**scope(r.applies_to_applicant_status),
            "source_requirement_id": r.requirement_id, "category": r.category,
            "collections": item["collections"], "original_text": r.original_text, "normalized_meaning": r.normalized_meaning,
            "rule_type": r.rule_type, "requirement_strength": r.requirement_strength, "operator": r.operator,
            "value": r.value, "unit": r.unit, "minimum_gpa": gpa.get("minimum"), "gpa_scale": gpa.get("scale"),
            "academic_rank": rank[0] if rank and r.category == "academic_performance" else None,
            "minimum_experience_months": months,
            "maximum_years_since_graduation": r.value if r.category == "graduation_recency" and r.unit == "year" and r.operator == "<=" else None,
            "minimum_publications": int(publications[1]) if publications else None, "is_hard_requirement": False,
            "conditions": r.conditions, "exceptions": r.exceptions, "applicant_status": r.applies_to_applicant_status,
            "country_of_application": r.country_of_application, "source_url": r.source_url, "source_section": r.source_section,
            "evidence_excerpt": r.evidence_excerpt, "extraction_method": r.extraction_method, "interpretation_confidence": r.interpretation_confidence})
    # Raw sections plus status-specific rules cover original and additional-status procedures.
    statements = [(b.text, b.source_url, " > ".join(b.heading_path), url_status(b.source_url)) for b in record.raw_sections]
    statements.extend((x["requirement"].original_text, x["requirement"].source_url, x["requirement"].source_section,
        x["requirement"].applies_to_applicant_status) for x in groups.values())
    for text, url, section, status in dict.fromkeys(statements):
        if not re.search(r"language skills|language proficiency|language abilities|language of instruction|\bIELTS\b|\bTOEFL\b|\bTest[ -]?DaF\b|\bDSH\b", text, re.I):
            continue
        if not re.search(r"Application requirements|Application Procedure|Language skills", section, re.I):
            continue  # Benefits reimbursing a test are not language eligibility requirements.
        conditional = bool(re.search(r"\bif\b|for courses|for study courses|depending", text, re.I))
        for details in language_details(text):
            group = content_hash([text, status, details["requirement_stage"]])[:24]
            emit("scholarship_language_requirements", {**scope(status), **details, "alternative_group": group,
                "applicant_status": status, "country_of_application": "Egypt" if variants.get(status) else None,
                "requirement_strength": "conditional" if conditional else "uncertain", "conditions": [text] if conditional else [],
                "exceptions": [text] if re.search(r"except|not accepted|exempt", text, re.I) else [],
                "original_text": text, "source_url": url, "source_section": section})
    for d in record.required_documents:
        minimum, maximum = page_limits(d.instructions)
        emit("scholarship_required_documents", {**scope(d.applicant_status), "name": d.name, "document_type": d.document_type,
            "mandatory": d.mandatory, "conditions": d.conditions, "submission_stage": d.submission_stage,
            "required_format": d.required_format, "translation_requirements": d.translation_requirements,
            "certification_requirements": d.certification_requirements, "number_of_references": d.number_of_references,
            "minimum_pages": minimum, "maximum_pages": maximum, "applicant_status": d.applicant_status,
            "instructions": d.instructions, "source_url": d.evidence_url, "source_section": d.source_section})
    seen_publications = set()
    for text, url, section, status in dict.fromkeys(statements):
        if re.search(r"list of.*publications", text, re.I) and "Application documents" in section:
            applicable = [s for s in variants if "postdoc" in s.lower()] if "postdoc" in text.lower() else [status]
            for target in applicable or [None]:
                if any(d.document_type == 'publication_list' and d.applicant_status == target and d.instructions == text for d in record.required_documents):
                    continue
                if (target, text) in seen_publications:
                    continue
                seen_publications.add((target, text))
                minimum, maximum = page_limits(text)
                emit("scholarship_required_documents", {**scope(target), "name": "List of publications", "document_type": "publication_list",
                    "mandatory": True if "mandatory" in text.lower() else None, "conditions": [text], "submission_stage": "application",
                    "required_format": None, "translation_requirements": None, "certification_requirements": None,
                    "number_of_references": None, "minimum_pages": minimum, "maximum_pages": maximum,
                    "applicant_status": target, "instructions": text, "source_url": url, "source_section": section})
    for d in record.deadlines:
        emit("scholarship_deadlines", {**scope(d.applicant_status), "kind": d.kind, "date": d.date,
            "deadline_at": d.deadline_at.isoformat() if d.deadline_at else None, "timezone": d.timezone,
            "cycle_label": None, "year_explicit": d.year_explicit, "certainty": d.certainty,
            "applicant_status": d.applicant_status, "original_text": d.original_text,
            "source_url": d.source_url, "source_section": d.source_section})
    for stipend in record.funding.get("monthly_stipends", []):
        text = stipend["conditions"]
        emit("scholarship_funding", {**scope(), "benefit_type": "monthly_stipend", "coverage": "conditional" if "depending" in text.lower() else "included",
            "amount": stipend["amount"], "currency": stipend["currency"], "payment_period": stipend.get("period"),
            "duration_text": None, "applicant_status": None, "conditions": [text], "original_text": text,
            "source_url": stipend["source_url"], "source_section": "Overview > Value"})
    for b in record.funding.get("raw_statements", []):
        text = b["text"]
        if re.search(r"duration", " ".join(b["heading_path"]), re.I):
            benefit, coverage = "duration", "unknown"
        elif text in record.funding.get("excluded_costs", []):
            benefit, coverage = "tuition" if "tuition" in text.lower() else "excluded_cost", "excluded"
        else:
            benefit = next((name for name, pattern in [("insurance", "insurance"), ("travel", "travel allowance"),
                ("accommodation", "rent"), ("family_allowance", "family"), ("language_course", "language course"),
                ("study_allowance", "study allowance")] if re.search(pattern, text, re.I)), None)
            if not benefit:
                continue
            coverage = "conditional" if re.search(r"if|under certain|upon application|subsid", text, re.I) else "included"
        emit("scholarship_funding", {**scope(), "benefit_type": benefit, "coverage": coverage, "amount": None, "currency": None,
            "payment_period": None, "duration_text": text if benefit == "duration" else None, "applicant_status": None,
            "conditions": [text] if coverage == "conditional" else [], "original_text": text,
            "source_url": b["source_url"], "source_section": " > ".join(b["heading_path"])})
    for e in record.evidence:
        row = {"scholarship_id": scholarship_id, "snapshot_id": sid, "url": e.url, "method": e.method,
            "retrieved_at": e.retrieved_at.isoformat(), "status_code": e.status_code, "content_sha256": e.sha256,
            "content_type": e.content_type, "request_data": e.request_data, "archive_storage_path": None}
        row["id"] = str(uuid5(namespace, "evidence:" + sid + ":" + content_hash(row)))
        output["scholarship_evidence"].append(row)
    return output
