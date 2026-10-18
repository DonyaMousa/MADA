from uuid import uuid4
import pytest
from app.scraping.cli import MIGRATION
from app.scraping.schemas.scholarship import Scholarship
from app.scraping.storage.json_repository import utcnow
from app.scraping.storage.supabase_mapper import map_scholarship, build_payloads, validate_payloads, schema_columns


def test_existing_migration_columns_are_read():
    columns = schema_columns(MIGRATION)
    assert {"eligibility_rules", "source_id", "last_fetch_run_id"} <= columns["scholarships"]
    assert "importer_version" in columns["fetch_runs"]


def test_payload_matches_real_schema(record):
    payload, validation = build_payloads([record], str(uuid4()), utcnow(), {}, MIGRATION)
    assert validation["passed"] and payload["fetch_runs"][0]["imported_count"] == 0
    row = payload["scholarships"][0]
    assert not row["published"] and row["verification_state"] == "needs_review"
    assert payload["scholarship_snapshots"][0]["normalized_payload"]["daad_program_id"] == record.daad_program_id
    assert not any(r.get("category") == "source_context" for r in row["eligibility_rules"])
    assert row["official_application_url"].endswith("#bewerbung")


def test_upcoming_status_preserved_without_invalid_db_enum(record):
    record.application_status = "upcoming"
    row = map_scholarship(record, str(uuid4()))
    assert row["open_status"] == "unknown"
    assert row["application_status"] == "upcoming"


def test_unknown_column_is_rejected(record):
    payload, _ = build_payloads([record], str(uuid4()), utcnow(), {}, MIGRATION)
    payload["scholarships"][0]["imaginary_column"] = True
    with pytest.raises(ValueError, match="Unknown"):
        validate_payloads(payload, MIGRATION)


def test_failed_records_not_mapped(record):
    record.extraction_quality = "failed"
    assert map_scholarship(record, str(uuid4())) is None


def test_json_roundtrip(record):
    assert Scholarship.model_validate_json(record.model_dump_json()) == record
