import re


from .timing import parse_deadlines


def application_status(blocks):
    # Explicit portal evidence, not comparison with a future deadline.
    for b in blocks:
        if b.section == "Submitting an application" and re.search(r"currently you cannot apply|currently not possible|applications? (?:are|is) closed", b.text, re.I):
            return "closed", b.text
    for b in blocks:
        if b.section == "Submitting an application" and re.search(r"you can now apply|applications? (?:are|is) now open|application portal is (?:now )?open", b.text, re.I):
            return "open", b.text
    return "unknown", None


def extract_funding(blocks):
    from .requirement_extractor import funding_rule_blocks
    relevant = [b for b in blocks if any(re.search(r"value|duration.*fund|what can be funded", x, re.I) for x in b.heading_path)]
    relevant.extend(b for b in funding_rule_blocks(blocks) if b not in relevant)
    exclusions = [b.text for b in blocks if re.search(r"(?:not|cannot|no).*(?:cover|fund|reimburs)|tuition fees.*not", b.text, re.I)]
    text = " ".join(b.text for b in relevant)
    stipends = []
    for b in relevant:
        if not re.search(r"monthly|per month", b.text, re.I):
            continue
        for match in re.finditer(r"(\d{1,3}(?:[,.]\d{3})+|\d+(?:[,.]\d{1,2})?)\s*(?:euros?|EUR|€)", b.text, re.I):
            raw = match[1]
            if re.fullmatch(r"\d{1,3}(?:[,.]\d{3})+", raw):
                raw = raw.replace(",", "").replace(".", "")
            else:
                raw = raw.replace(",", ".")
            stipends.append({"amount": float(raw), "currency": "EUR", "period": "month", "conditions": b.text,
                "source_url": b.source_url, "requires_human_review": True})
    tuition_excluded = any(re.search(r"does not cover tuition|not.*tuition fees|tuition fees.*not", x, re.I) for x in exclusions)
    return {"funding_type": "partial" if tuition_excluded else "unknown", "monthly_stipends": stipends,
        "tuition_coverage": False if tuition_excluded else None,
        "covered_costs": [name for name, pattern in [("insurance", "insurance"), ("travel", "travel allowance"),
            ("language_courses", "language course"), ("study_allowance", "study allowance")] if re.search(pattern, text, re.I)],
        "conditional_benefits": [b.text for b in relevant if re.search(r"under certain|upon application|if necessary|subsid|family|rent", b.text, re.I)],
        "excluded_costs": exclusions, "duration_statements": [b.text for b in relevant if any("duration" in x.lower() for x in b.heading_path)],
        "raw_statements": [b.model_dump(mode="json") for b in relevant]}


def aggregate_egypt(variants):
    if any(v.selection_confirmed and v.application_procedure_loaded and v.eligibility_classification == "supported_for_egypt" for v in variants):
        return "supported_for_egypt"
    if variants and all(v.eligibility_classification == "unsupported_for_egypt" for v in variants):
        return "unsupported_for_egypt"
    return "needs_verification"
