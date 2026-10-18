"""Inspect actual saved scrape artifacts; no network requests or database writes."""
import json
import hashlib
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from app.scraping.cli import ROOT, MIGRATION
from app.scraping.schemas.scholarship import Scholarship
from app.scraping.core.discovery import program_id
from app.scraping.core.html_parser import selection_confirmed
from app.scraping.storage.json_repository import content_hash, save_json, utcnow
from app.scraping.storage.supabase_mapper import validate_payloads


def main():
    base = ROOT / "data/scraping"
    raw_records = json.loads((base / "normalized/daad_scholarships.json").read_text(encoding="utf-8"))
    records = [Scholarship.model_validate(r) for r in raw_records]
    discovered = json.loads((base / "reports/daad_discovery.json").read_text(encoding="utf-8"))
    identifiers = {r["daad_program_id"] for r in discovered["programs"]}
    assert len(records) == 5 and len({r.daad_program_id for r in records}) == 5
    checks = 1
    for r in records:
        assert r.daad_program_id in identifiers and program_id(r.official_program_url) == r.daad_program_id
        assert r.verification_state == "needs_review"
        checks += 2
        for evidence in r.evidence:
            path = Path(evidence.local_path)
            if not path.is_absolute():
                path = ROOT / path
            assert content_hash(path.read_bytes()) == evidence.sha256, str(path)
            checks += 1
        for v in r.applicant_status_variants:
            if v.eligibility_classification == "supported_for_egypt":
                assert v.egypt_selectable and v.selection_confirmed and v.application_procedure_loaded
                body = {"origin": v.selected_country_value, "status": v.applicant_status_value}
                def matches(e):
                    params = e.request_data or {k: values[0] for k, values in parse_qs(urlsplit(e.url).query).items()}
                    return e.status_code == 200 and all(params.get(k) == value for k, value in body.items())
                candidates = [e for e in r.evidence if matches(e)]
                assert candidates, f"No real selection response for {r.daad_program_id} / {v.applicant_status}"
                assert any(selection_confirmed(Path(e.local_path).read_text(encoding="utf-8"), r.daad_program_id,
                    v.selected_country_value, v.applicant_status_value) for e in candidates)
                checks += 3
            elif v.eligibility_classification == "unsupported_for_egypt":
                assert v.country_options and not any(c["label"].casefold() == "egypt" for c in v.country_options)
                checks += 1
        assert r.academic_eligibility.get("explicit_minimum_gpa") is None or any(x.unit == "GPA" for x in r.structured_requirements)
        checks += 1
    payload = json.loads((base / "database_ready/daad_supabase_payloads.json").read_text(encoding="utf-8"))
    validate_payloads(payload, MIGRATION)
    for row in payload["scholarships"]:
        full = next(x["normalized_payload"] for x in payload["scholarship_snapshots"] if x["id"] == row["latest_snapshot_id"])
        assert full == next(r for r in raw_records if r["daad_program_id"] == row["source_record_id"])
        checks += 1
    report = {"passed": True, "checks": checks, "checked_at": utcnow().isoformat(), "programs": len(records),
        "scope": "Saved live records, exact archived response hashes, returned Egypt/status evidence and actual migration payload mapping", "database_writes": 0, "network_requests": 0}
    save_json(base / "reports/daad_artifact_validation.json", report)
    test_results = {}
    for label in ("offline", "live"):
        xml_path = base / f"reports/pytest_{label}.xml"
        if xml_path.exists():
            suites = ET.parse(xml_path).getroot().findall(".//testsuite")
            test_results[label] = {key: sum(int(s.attrib.get(key, 0)) for s in suites)
                for key in ("tests", "failures", "errors", "skipped")}
    validation_path = base / "reports/daad_validation_report.json"
    validation = json.loads(validation_path.read_text(encoding="utf-8"))
    validation["artifact_validation"] = report
    validation["executed_test_results"] = test_results
    sql_path = base / 'reports/daad_sql_payload_validation.json'
    if sql_path.exists():
        sql = json.loads(sql_path.read_text(encoding='utf-8'))
        assert sql['passed'] and sql['counts'] == {table: len(rows) for table, rows in payload.items()}
        assert sql['payload_sha256'] == hashlib.sha256((base / 'database_ready/daad_supabase_payloads.json').read_bytes()).hexdigest()
        validation['local_postgresql_validation'] = sql
    save_json(validation_path, validation)
    summary_path = base / "reports/daad_run_summary.md"
    summary = summary_path.read_text(encoding="utf-8").split("\n## Executed verification\n")[0]
    summary += "\n## Executed verification\n\n"
    summary += f"Saved-artifact checks: {checks} passed. These check actual response hashes and country/status results without making new requests or database writes.\n\n"
    summary += "\n".join(f"- {label}: {r['tests']} tests, {r['failures']} failures, {r['errors']} errors, {r['skipped']} skipped." for label, r in test_results.items()) + "\n"
    summary_path.write_text(summary, encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
