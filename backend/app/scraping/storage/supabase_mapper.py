import json
import re
from pathlib import Path
from uuid import UUID, uuid5
from ..core.discovery import CATALOGUE
from ..storage.json_repository import utcnow
from .detail_mapper import DETAIL_TABLES, map_details, snapshot_id

NAMESPACE = UUID("a3c55ba0-729b-4b20-8a37-0b7f785496da")
SOURCE_ID = str(uuid5(NAMESPACE, "daad-scholarship-database"))


def schema_columns(migration: Path):
    """Read actual migration CREATE TABLE and ADD COLUMN declarations; no invented columns."""
    paths = sorted(migration.glob('*.sql')) if migration.is_dir() else sorted(migration.parent.glob('*.sql')) if migration.parent.name == 'migrations' else [migration]
    text = "\n".join(p.read_text(encoding="utf-8") for p in paths)
    tables = {}
    for table, body in re.findall(r"create table public\.(\w+)\s*\((.*?)\n\);", text, re.S | re.I):
        tables[table] = {m.group(1) for m in re.finditer(r"^\s{2}(\w+)\s+(?:uuid|text|jsonb|boolean|integer|bigint|numeric|date|timestamptz|tsvector)\b", body, re.M | re.I)}
    for table, body in re.findall(r"alter table public\.(\w+)\s+(.*?);", text, re.S | re.I):
        tables.setdefault(table, set()).update(re.findall(r"add column (\w+)\s", body, re.I))
    return tables


def map_scholarship(record, run_id):
    if record.extraction_quality == "failed" or not record.title or not record.provider:
        return None
    explicit = [d for d in record.deadlines if d.kind == "application" and d.deadline_at and d.year_explicit]
    distinct = {d.deadline_at.isoformat() for d in explicit}
    deadline = explicit[0] if len(distinct) == 1 and not record.is_umbrella_programme else None
    identifier = str(uuid5(NAMESPACE, "daad:" + record.daad_program_id))
    return {"id": identifier, "slug": "daad-" + record.daad_program_id,
        "title": record.title, "provider": record.provider,
        "destination_countries": record.destination_countries, "supported_degrees": record.supported_degrees,
        "fields": record.fields_of_study, "funding_type": record.funding.get("funding_type", "unknown"),
        "covered_costs": record.funding.get("covered_costs", []),
        "deadline_at": deadline.deadline_at.isoformat() if deadline else None,
        "deadline_timezone": deadline.timezone if deadline else None,
        "deadline_certainty": "confirmed" if deadline else "unknown",
        "open_status": record.application_status if record.application_status in ("open", "closed") else "unknown",
        "eligibility_summary": f"Country-of-application outcome: {record.egypt_support_status}. Source-derived requirements require human review; no student-specific eligibility has been computed.",
        "eligibility_rules": [r.model_dump(mode="json") for r in record.structured_requirements],
        "required_documents": [d.model_dump(mode="json") for d in record.required_documents],
        "official_application_url": record.official_application_url or record.official_program_url + "#bewerbung",
        "official_source_url": record.official_program_url,
        "last_verified_at": None, "verification_state": "needs_review", "data_label": "official_source_scrape_unreviewed",
        "missing_data_notes": record.issues + (["Applicant-status deadlines differ; see preserved variants"] if len(distinct) > 1 else []),
        "retrieval_date": record.retrieval_timestamp.date().isoformat(), "source_url": record.official_program_url,
        "body_text": "\n".join(" > ".join(b.heading_path) + "\n" + b.text for b in record.raw_sections),
        "published": False, "source_id": SOURCE_ID, "last_fetch_run_id": run_id,
        "source_record_id": record.daad_program_id, "source_checked_at": record.retrieval_timestamp.isoformat(),
        "category": record.scholarship_category, "description": record.description,
        "program_objectives": record.program_objectives, "eligible_academic_disciplines": record.eligible_academic_disciplines,
        "application_portals": record.application_portals, "egypt_support_status": record.egypt_support_status,
        "application_status": record.application_status, "application_status_evidence": record.application_status_evidence,
        "extraction_quality": record.extraction_quality, "extracted_at": record.retrieval_timestamp.isoformat(),
        "latest_snapshot_id": snapshot_id(record, run_id, NAMESPACE)}


def validate_payloads(payloads, migration):
    columns = schema_columns(migration)
    required = {"scholarships": {"slug", "title", "provider", "funding_type", "eligibility_summary", "official_application_url", "official_source_url", "source_url"},
        "scholarship_sources": {"name", "source_url", "source_type"}, "fetch_runs": {"source_id", "importer_version"},
        "scholarship_change_history": {"scholarship_id", "field_name"}}
    required.update({table: {"id", "scholarship_id", "snapshot_id"} for table in DETAIL_TABLES if table != "scholarship_snapshots"})
    required["scholarship_snapshots"] = {"id", "scholarship_id", "source_id", "fetch_run_id", "normalized_payload", "payload_sha256"}
    for table, rows in payloads.items():
        if table not in required:
            raise ValueError(f"Unknown payload table: {table}")
        for row in rows:
            unknown = set(row) - columns.get(table, set())
            if unknown:
                raise ValueError(f"Unknown {table} columns: {sorted(unknown)}")
            if not required[table] <= row.keys():
                raise ValueError(f"Missing required {table} fields")
            if table == "scholarships":
                if row["open_status"] not in ("open", "closed", "unknown") or row["funding_type"] not in ("full", "partial", "unknown"):
                    raise ValueError("Invalid scholarship enum")
                if row["deadline_certainty"] == "confirmed" and not row["deadline_at"]:
                    raise ValueError("Confirmed deadline lacks timestamp")
                if row["published"] or row["verification_state"] != "needs_review":
                    raise ValueError("Scraped data must remain unpublished and unreviewed")
                if not isinstance(row["eligibility_rules"], list) or not isinstance(row["required_documents"], list):
                    raise ValueError("JSON arrays expected")
                if any(r.get("category") == "source_context" for r in row["eligibility_rules"]):
                    raise ValueError("Source snapshots must not be hidden in eligibility_rules")
            if table == "fetch_runs" and row["imported_count"] + row["rejected_count"] > row["fetched_count"]:
                raise ValueError("Invalid import counters")
    source_ids = {r["id"] for r in payloads["scholarship_sources"]}
    runs = {r["id"]: r["source_id"] for r in payloads["fetch_runs"]}
    for row in payloads["scholarships"]:
        if row["source_id"] not in source_ids or runs.get(row["last_fetch_run_id"]) != row["source_id"]:
            raise ValueError("Invalid source/fetch foreign keys")
    scholarship_ids = {r["id"] for r in payloads["scholarships"]}
    snapshots = {r["id"]: r for r in payloads.get("scholarship_snapshots", [])}
    variants = {r["id"]: r for r in payloads.get("scholarship_variants", [])}
    for row in payloads.get("scholarship_snapshots", []):
        if row["scholarship_id"] not in scholarship_ids or row["source_id"] not in source_ids or runs.get(row["fetch_run_id"]) != row["source_id"]:
            raise ValueError("Invalid snapshot provenance")
    for row in payloads["scholarships"]:
        if snapshots.get(row["latest_snapshot_id"], {}).get("scholarship_id") != row["id"]:
            raise ValueError("Latest snapshot belongs to another scholarship")
    for table in DETAIL_TABLES:
        if table == "scholarship_snapshots":
            continue
        for row in payloads.get(table, []):
            snapshot = snapshots.get(row["snapshot_id"], {})
            if snapshot.get("scholarship_id") != row["scholarship_id"]:
                raise ValueError("Detail snapshot belongs to another scholarship")
            variant = variants.get(row.get("variant_id"))
            if row.get("variant_id") and (not variant or (variant["scholarship_id"], variant["snapshot_id"]) != (row["scholarship_id"], row["snapshot_id"])):
                raise ValueError("Variant belongs to another scholarship or snapshot")
            if table != "scholarship_evidence" and row["requires_human_review"] is not True:
                raise ValueError("Automatically mapped details must remain unreviewed")
    return {"passed": True, "validation": "actual migration columns/enums/required fields/local provenance FKs; no database writes",
        "counts": {k: len(v) for k, v in payloads.items() if isinstance(v, list)}}


def build_payloads(records, run_id, started_at, changes, migration):
    rows = [row for r in records if (row := map_scholarship(r, run_id)) is not None]
    complete = sum(r.extraction_quality == "complete" for r in records)
    state = "succeeded" if complete == len(records) and records else "partial" if rows else "failed"
    payload = {"scholarship_sources": [{"id": SOURCE_ID, "name": "DAAD official scholarship database", "source_url": CATALOGUE,
        "source_type": "official_site", "enabled": True, "fetch_interval_hours": 24}],
        "fetch_runs": [{"id": run_id, "source_id": SOURCE_ID, "status": state, "started_at": started_at.isoformat(),
            "finished_at": utcnow().isoformat(), "fetched_count": len(records), "imported_count": 0,
            "rejected_count": len(records) - len(rows), "http_status": None, "importer_version": "mada-daad-0.1.0",
            "error_detail": {"execution_mode": "local_payload_only", "prepared_records": len(rows),
                "complete_extractions": complete, "remote_writes": 0}}], "scholarships": rows, "scholarship_change_history": []}
    payload.update({name: [] for name in DETAIL_TABLES})
    for record in records:
        row = next((r for r in rows if r["source_record_id"] == record.daad_program_id), None)
        if row:
            for table, details in map_details(record, row["id"], run_id, SOURCE_ID, NAMESPACE).items():
                payload[table].extend(details)
    for identifier, diffs in changes.items():
        for change in diffs:
            payload["scholarship_change_history"].append({"scholarship_id": str(uuid5(NAMESPACE, "daad:" + identifier)),
                "field_name": change["field_name"], "old_value": json.dumps(change["old_value"], ensure_ascii=False),
                "new_value": json.dumps(change["new_value"], ensure_ascii=False), "source_url": change["source_url"], "review_status": "needs_review"})
    return payload, validate_payloads(payload, migration)
