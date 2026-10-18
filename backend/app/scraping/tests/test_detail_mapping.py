from copy import deepcopy
from uuid import uuid4
import pytest
from app.scraping.cli import MIGRATION
from app.scraping.storage.detail_mapper import language_details, page_limits
from app.scraping.storage.supabase_mapper import build_payloads, schema_columns, validate_payloads
from app.scraping.storage.json_repository import utcnow
from app.scraping.schemas.scholarship import Variant


def test_research_language_scores_keep_decimal_comma_and_alternatives():
    text = "Proof of English language abilities, if the doctorate is to be completed in English: Not older than 3 years at the time of the application deadline (TOEFL min. 550, TOEFL iBT min. 79, IELTS min. 6,5, onSET min. B2 or PTE Academic min. 59)."
    rows = language_details(text)
    scores = {x["test_name"]: x["minimum_score"] for x in rows}
    assert scores == {"TOEFL": 550, "TOEFL iBT": 79, "IELTS": 6.5, "onSET": None, "PTE Academic": 59}
    assert next(x for x in rows if x["test_name"] == "onSET")["cefr_level"] == "B2"
    assert all(x["certificate_max_age_months"] == 36 for x in rows)


def test_german_exams_and_application_level_are_separate():
    rows = language_details("For study courses in German: Successful passing of DSH 2 or TestDaF 4 before the start of the study course. A minimum German language level of B1 at the time of application is a requirement.")
    assert {r["test_name"]: r["minimum_score"] for r in rows if r["test_name"]} == {"DSH": 2, "TestDaF": 4}
    assert all(r["requirement_stage"] == "before_course_start" for r in rows if r["test_name"])
    assert next(r for r in rows if r["cefr_level"] == "B1")["requirement_stage"] == "application"


def test_institutional_toefl_exclusion_not_a_score():
    row = language_details("The institutional TOEFL is not accepted.")[0]
    assert row["test_name"] == "TOEFL institutional" and row["accepted"] is False and row["minimum_score"] is None


@pytest.mark.parametrize("text,expected", [("Motivation letter (1 - 3 pages)",(1,3)),
    ("Letter of motivation; max. 2 pages",(None,2)), ("publications (max. 10 pages)",(None,10)),
    ("Motivation letter required",(None,None))])
def test_document_page_limits(text, expected):
    assert page_limits(text) == expected


def test_unknown_language_score_remains_null():
    assert all(r["minimum_score"] is None for r in language_details("Proof of English language skills, according to the university requirements."))


def test_all_detail_tables_are_existing_migration_columns():
    assert {"minimum_gpa", "academic_rank", "minimum_publications"} <= schema_columns(MIGRATION)["scholarship_requirements"]
    assert "minimum_score" in schema_columns(MIGRATION)["scholarship_language_requirements"]


def test_snapshot_pointer_stays_with_parent(record):
    payload, _ = build_payloads([record], str(uuid4()), utcnow(), {}, MIGRATION)
    payload["scholarships"][0]["latest_snapshot_id"] = str(uuid4())
    with pytest.raises(ValueError, match="Latest snapshot"):
        validate_payloads(payload, MIGRATION)


def test_cross_scholarship_variant_rejected(record):
    record.applicant_status_variants = [Variant(applicant_status="Graduates", applicant_status_value="3")]
    payload, _ = build_payloads([record], str(uuid4()), utcnow(), {}, MIGRATION)
    payload["scholarship_variants"][0]["scholarship_id"] = str(uuid4())
    with pytest.raises(ValueError, match="snapshot belongs"):
        validate_payloads(payload, MIGRATION)


def test_unknown_tables_are_not_silently_ignored(record):
    payload, _ = build_payloads([record], str(uuid4()), utcnow(), {}, MIGRATION)
    payload["invented_table"] = []
    with pytest.raises(ValueError, match="Unknown payload table"):
        validate_payloads(payload, MIGRATION)
