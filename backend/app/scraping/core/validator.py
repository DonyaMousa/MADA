from .discovery import program_id
from .normalizer import aggregate_egypt


def validate_record(record):
    issues = list(record.issues)
    if program_id(record.official_program_url) != record.daad_program_id:
        issues.append("Official URL and program ID disagree")
    if not record.title or not record.provider:
        issues.append("Scholarship identity missing")
    if not record.raw_sections:
        issues.append("No main sections extracted")
    if not record.structured_requirements:
        issues.append("No requirements extracted")
    if not record.required_documents:
        issues.append("Required documents missing or unrecognized")
    if not record.funding.get("raw_statements"):
        issues.append("Funding text unavailable")
    if not record.applicant_status_variants:
        issues.append("No applicant-status variants evaluated")
    for variant in record.applicant_status_variants:
        if variant.eligibility_classification == "supported_for_egypt" and not (
            variant.selection_confirmed and variant.application_procedure_loaded):
            issues.append(f"{variant.applicant_status}: Egypt support lacks confirmed procedure")
        if variant.error:
            issues.append(f"{variant.applicant_status}: {variant.error}")
    if not any(d.date for d in record.deadlines if d.kind == "application"):
        issues.append("No explicit full-date application deadline; no current cycle inferred")
    if any(p.get("status") == "failed" for p in record.linked_pages):
        issues.append("Some relevant linked official guidance failed to load")
    record.egypt_support_status = aggregate_egypt(record.applicant_status_variants)
    record.issues = list(dict.fromkeys(issues))
    complete = (record.title and record.raw_sections and record.structured_requirements and record.required_documents
        and record.funding.get("raw_statements") and record.applicant_status_variants
        and all(v.extraction_status == "complete" for v in record.applicant_status_variants)
        and not any(p.get("status") == "failed" for p in record.linked_pages))
    record.extraction_quality = "complete" if complete else "partial" if record.title and record.raw_sections else "failed"
    # Extraction completeness never substitutes for an editorial review of eligibility.
    record.verification_state = "needs_review"
    return record
