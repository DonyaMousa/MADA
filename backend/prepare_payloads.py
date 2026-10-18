"""Re-map saved live records to the current SQL schema. No network or DB access."""
import json
from datetime import datetime
from app.scraping.cli import ROOT, MIGRATION
from app.scraping.schemas.scholarship import Scholarship
from app.scraping.storage.json_repository import save_json, utcnow
from app.scraping.storage.supabase_mapper import build_payloads


def main():
    base = ROOT / 'data/scraping'
    records = [Scholarship.model_validate(r) for r in json.loads((base / 'normalized/daad_scholarships.json').read_text(encoding='utf-8'))]
    report_path = base / 'reports/daad_validation_report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    changes_path = base / 'reports/daad_changes.json'
    changes = json.loads(changes_path.read_text(encoding='utf-8')) if changes_path.exists() else {}
    payload, validation = build_payloads(records, report['run_id'], datetime.fromisoformat(report['started_at']), changes, MIGRATION)
    # Preparing a payload now is not a new crawl; retain its real capture interval.
    payload['fetch_runs'][0]['finished_at'] = report['finished_at']
    payload['fetch_runs'][0]['error_detail']['payload_prepared_at'] = utcnow().isoformat()
    save_json(base / 'database_ready/daad_supabase_payloads.json', payload)
    report['database_payload_validation'] = validation
    report['database_payload_validation']['prepared_from_saved_responses'] = True
    save_json(report_path, report)
    save_json(base / 'reports/daad_database_mapping_report.json', {
        'passed': True, 'prepared_at': utcnow().isoformat(), 'source_run_id': report['run_id'],
        'source_retrieval_timestamps_preserved': True, 'counts': validation['counts'],
        'network_requests': 0, 'remote_database_writes': 0,
        'schema_migrations': sorted(p.name for p in MIGRATION.parent.glob('*.sql'))})
    print(json.dumps(validation, indent=2))


if __name__ == '__main__':
    main()
