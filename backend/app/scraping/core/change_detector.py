import json

WATCHED = {"deadlines": "deadlines", "application_status": "application_status", "funding": "funding",
    "academic_eligibility": "academic_eligibility", "languages": "languages", "required_documents": "required_documents",
    "eligibility_conditions": "structured_requirements", "official_application_url": "official_application_url",
    "country_restrictions": "nationality_and_residence", "egypt_support_status": "egypt_support_status",
    "applicant_status_variants": "applicant_status_variants"}
VOLATILE = {"retrieval_timestamp", "retrieved_at", "requirement_id", "source_url", "evidence_url", "evidence_urls", "evidence",
    "local_path", "sha256", "original_text", "evidence_excerpt", "source_section"}


def semantic(value):
    if isinstance(value, dict):
        return {k: semantic(v) for k, v in sorted(value.items()) if k not in VOLATILE}
    if isinstance(value, list):
        return [semantic(v) for v in value]
    if isinstance(value, str):
        return " ".join(value.split())
    return value


def compare_snapshots(old, new):
    if old.get("extractor_version") != new.get("extractor_version"):
        # Parser upgrades are not evidence that the scholarship itself changed.
        return []
    changes = []
    for field, key in WATCHED.items():
        before, after = old.get(key), new.get(key)
        if semantic(before) != semantic(after):
            changes.append({"field_name": field, "old_value": before, "new_value": after,
                "old_evidence": old.get("evidence", []), "new_evidence": new.get("evidence", []),
                "source_url": new["official_program_url"]})
    return changes
