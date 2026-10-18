import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from uuid import uuid4
from .core.fetcher import Fetcher
from .core.discovery import select_programs
from .core.change_detector import compare_snapshots
from .schemas.scholarship import Scholarship
from .sources.daad import DaadAdapter
from .storage.json_repository import save_json, utcnow
from .storage.supabase_mapper import build_payloads

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261018171637_initial_mada_schema.sql"


def report(records, discovered, payload_validation, failures, run_id, started, resume_count=0):
    rows = [{"daad_program_id": r.daad_program_id, "title": r.title, "egypt_eligibility": r.egypt_support_status,
        "applicant_statuses": [v.applicant_status for v in r.applicant_status_variants],
        "application_procedures_loaded": all(v.application_procedure_loaded for v in r.applicant_status_variants) if r.applicant_status_variants else False,
        "requirements_found": len(r.structured_requirements), "selection_criteria_found": len(r.selection_criteria),
        "conditional_requirements_found": len(r.conditional_requirements), "required_documents_found": len(r.required_documents),
        "deadline_evidence": [d.model_dump(mode="json") for d in r.deadlines],
        "extraction_quality": r.extraction_quality, "verification_state": r.verification_state,
        "issues": r.issues, "official_url": r.official_program_url} for r in records]
    quality = Counter(r.extraction_quality for r in records)
    egypt = Counter(r.egypt_support_status for r in records)
    return {"run_id": run_id, "started_at": started.isoformat(), "finished_at": utcnow().isoformat(),
        "mode": "local_only", "remote_database_writes": 0, "programs_discovered": discovered.get("discovered_count", 0),
        "programs_attempted": len(records), "successfully_extracted": quality["complete"],
        "partially_extracted": quality["partial"], "failed": quality["failed"],
        "supported_for_egypt": egypt["supported_for_egypt"], "unsupported_for_egypt": egypt["unsupported_for_egypt"],
        "needs_verification": egypt["needs_verification"], "checkpoint_records_reused": resume_count,
        "database_payload_validation": payload_validation, "network_failures": failures, "programs": rows}


def write_summary(root, validation):
    lines = ["# DAAD scraper: actual execution report", "", f"Run `{validation['run_id']}`; started {validation['started_at']}; completed {validation['finished_at']}.",
        "", f"Discovered: {validation['programs_discovered']}; attempted: {validation['programs_attempted']}; complete: {validation['successfully_extracted']}; partial: {validation['partially_extracted']}; failed: {validation['failed']}.",
        f"Egypt: supported {validation['supported_for_egypt']}; unsupported {validation['unsupported_for_egypt']}; needs verification {validation['needs_verification']}.",
        f"Database payload validation: {validation['database_payload_validation']['passed']}. Remote writes: 0.", "",
        "Extraction quality describes retrieval coverage. All records remain needs_review and unpublished; country-of-application support is not individual student eligibility.", "",
        "| DAAD ID | Program | Applicant status | Egypt | Explicit application dates | Requirements / selection / documents | Procedure | Quality | Verification |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for p in validation["programs"]:
        dates = sorted({d["date"] for d in p["deadline_evidence"] if d.get("date") and d["kind"] == "application"})
        lines.append(f"| {p['daad_program_id']} | {p['title']} | {', '.join(p['applicant_statuses'])} | {p['egypt_eligibility']} | {', '.join(dates) or 'Unknown; see evidence'} | {p['requirements_found']} / {p['selection_criteria_found']} / {p['required_documents_found']} | {p['application_procedures_loaded']} | {p['extraction_quality']} | {p['verification_state']} |")
    for p in validation["programs"]:
        lines += ["", f"## {p['daad_program_id']}: {p['title']}", "", f"Official source: {p['official_url']}",
            "", "Missing/uncertain information:"]
        lines += ["- " + issue for issue in p["issues"]] or ["- No retrieval gaps detected; interpretation still requires human review."]
        lines += ["- Deterministic classifications and qualitative conditions require review; unlisted values stay null.", "", "Actual deadline text:"]
        for text in dict.fromkeys(d["original_text"] for d in p["deadline_evidence"]):
            lines.append("- " + text)
    lines += ["", "## Access failures", ""]
    if validation.get("fatal_error"):
        lines.append("Run blocker: " + validation["fatal_error"])
    lines += [f"- {x['url']}: {x['error']}" for x in validation["network_failures"]] or ["No network failures recorded."]
    if validation.get('quality_review'):
        quality = validation['quality_review']
        lines += ['', '## Data quality corrections', '', quality['method'], '',
            '| Programme ID | Eligibility rules before / after | Timing records before / after | Course rows |',
            '| --- | --- | --- | --- |']
        lines += [f"| {c['daad_program_id']} | {c['requirements_before']} / {c['requirements_after']} | {c['deadlines_before']} / {c['deadlines_after']} | {c['courses_after']} |" for c in quality['changes']]
        lines += ['', 'Remaining uncertainties:', ''] + ['- ' + item for item in quality['remaining_uncertainties']]
    (root / "reports/daad_run_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    gaps = """# DAAD / Mada schema gap report

The versioned initial and scholarship-detail migrations were inspected. No remote schema or data was changed.

- Scholarships retain their original directory fields and JSON compatibility fields. New category, description, objectives, disciplines, application portals, Egypt support, full application status and extraction quality fields are mapped directly.
- Eight additive tables hold snapshots, applicant variants, academic/selection requirements, language requirements, required documents, deadline evidence, funding benefits and HTTP evidence. Complete captured records go into admin-only scholarship_snapshots.normalized_payload; new payloads contain no source_context wrapper inside eligibility_rules.
- Queryable fields include GPA/scale when explicit, academic rank, experience months, publication counts when explicit, named language tests and scores, CEFR, certificate age, document page limits, applicant status and deadline stages. Unknown values stay null. All automatic detail rows require review and is_hard_requirement is false.
- `body_text` preserves ordered heading/text blocks. `official_application_url` falls back to the official submitting-application tab when no active portal is published; this is recorded in missing-data notes, not represented as an invented portal.
- The existing open_status retains its three-state contract. A new application_status field supports upcoming, with a constraint keeping both fields consistent. All status-specific dates are stored in scholarship_deadlines; the scalar deadline stays null when variants disagree. No date is assigned a current cycle without evidence.
- Automated extraction never sets published=true, verified, or last_verified_at. Prepared records are schema-compatible drafts, not editorially verified imports.
- Local fetch_runs payloads have imported_count=0. `prepared_records` is separate from actual imports. A future approved importer must update counters and use the existing source/run foreign keys.
- scholarship_change_history is empty for a first snapshot. Incremental runs produce changes only from semantic comparisons against previous normalized records; supporting old/new evidence remains in daad_changes.json. History actor is left null for a trusted service import.
- Apply 20261018200000_scholarship_details.sql after the original initial migration when deployment is approved. This is an additive schema: no existing tables or columns are replaced. All child records are constrained to the same scholarship and snapshot as their optional variant. Parent pointers are deferred to allow transactional import ordering.
- Publication of a parent does not expose unreviewed or historical child rows. Public details require published=true, the current snapshot, and requires_human_review=false; snapshots and request evidence remain admin/service-only. Imported details are service-written; snapshot/evidence rows are append-only. Current detail changes update the scholarship revision to invalidate cached matches.
- Full extraction quality does not guarantee interpretation accuracy. Nationality, residence/application country and open/closed state remain separate; positive country-list support is not proof every applicant qualifies.
- EPOS individual course rows, institution names, website links and course deadline evidence are preserved in scholarship_snapshots.normalized_payload.courses. The existing schema has no dedicated course table. No course deadline is flattened into the umbrella scholarship deadline. Month precision, relative timing, obligation and merged evidence references are also preserved in the snapshot; typed detail rows retain supported columns and literal source text.

Next integration step: review the five normalized records and evidence, then implement a service-only transactional importer: resolve source IDs, record a running fetch_run, upsert scholarships, append snapshots, insert variants and detailed child rows, set latest_snapshot_id, write change history, and record actual import counts. Resolve existing scholarship UUIDs before linking children; do not assume existing rows use deterministic local IDs. New snapshots must not be upserted with UPDATE; use insert/on-conflict-do-nothing. Keep review/publication separate. Payload preparation itself has no database client.
"""
    (root / "reports/daad_schema_gap_report.md").write_text(gaps, encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description="DAAD local-only scholarship scraper")
    parser.add_argument("--mode", choices=["test", "full"], default="test")
    parser.add_argument("--execute-full", action="store_true", help="Explicit opt-in; do not use for the initial five-program task")
    parser.add_argument("--max-discovery-pages", type=int, default=30)
    parser.add_argument("--max-depth", type=int, default=1)
    parser.add_argument("--linked-pages", type=int, default=3)
    parser.add_argument("--delay", type=float, default=1.25)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--force-browser", action="store_true")
    parser.add_argument("--no-browser-fallback", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "data/scraping")
    args = parser.parse_args(argv)
    if args.mode == "full" and not args.execute_full:
        parser.error("Full mode requires explicit --execute-full; initial execution must use --mode test")
    if args.max_depth < 0 or args.linked_pages < 0 or args.max_discovery_pages < 1:
        parser.error("Invalid crawl bounds")
    root = args.output
    for folder in ("normalized", "database_ready", "reports", "raw", "checkpoints", "runs"):
        (root / folder).mkdir(parents=True, exist_ok=True)
    old_path = root / "normalized/daad_scholarships.json"
    previous = {x["daad_program_id"]: x for x in json.loads(old_path.read_text(encoding="utf-8"))} if old_path.exists() else {}
    run_id, started, records, reused = str(uuid4()), utcnow(), [], 0
    checkpoint_path = root / "checkpoints/daad.json"
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8")) if args.resume and checkpoint_path.exists() else {"records": {}}
    fetcher = Fetcher(root / "raw", delay=args.delay)
    adapter = DaadAdapter(fetcher, args.max_depth, args.linked_pages, not args.no_browser_fallback, args.force_browser)
    discovery = {"discovered_count": 0, "programs": []}
    try:
        candidates, discovery = adapter.discover(args.max_discovery_pages)
        selected = select_programs(candidates, 5) if args.mode == "test" else [x for x in candidates if x["provider_is_daad"] and any(s in (2, 3, 4) for s in x["status_ids"])]
        discovery.update({"run_id": run_id, "retrieved_at": utcnow().isoformat(), "selected_programs": selected})
        save_json(root / "reports/daad_discovery.json", discovery)
        for candidate in selected:
            identifier = candidate["daad_program_id"]
            if identifier in checkpoint["records"] and checkpoint["records"][identifier].get("extractor_version") == Scholarship.model_fields["extractor_version"].default:
                record = Scholarship.model_validate(checkpoint["records"][identifier])
                reused += 1
            else:
                print(f"Attempting {identifier}: {candidate['title']}", flush=True)
                record = adapter.scrape(candidate)
            records.append(record)
            checkpoint["records"][identifier] = record.model_dump(mode="json")
            save_json(checkpoint_path, checkpoint)
            print(f"  {record.extraction_quality}; {record.egypt_support_status}; {len(record.structured_requirements)} requirements", flush=True)
    except Exception as exc:
        discovery["fatal_error"] = f"{type(exc).__name__}: {exc}"
        print(discovery["fatal_error"], file=sys.stderr, flush=True)
    finally:
        fetcher.close()
    normalized = [r.model_dump(mode="json") for r in records]
    changes = {r.daad_program_id: compare_snapshots(previous[r.daad_program_id], r.model_dump(mode="json"))
        for r in records if r.daad_program_id in previous}
    payloads, payload_validation = build_payloads(records, run_id, started, changes, MIGRATION)
    validation = report(records, discovery, payload_validation, fetcher.failures, run_id, started, reused)
    validation["baseline_comparison"] = {
        "skipped_extractor_version_mismatch": [r.daad_program_id for r in records if r.daad_program_id in previous
            and previous[r.daad_program_id].get("extractor_version") != r.extractor_version],
        "note": "Extractor upgrades are not reported as changes to source scholarship conditions."}
    if "fatal_error" in discovery:
        validation["fatal_error"] = discovery["fatal_error"]
    save_json(root / "normalized/daad_scholarships.json", normalized)
    save_json(root / "database_ready/daad_supabase_payloads.json", payloads)
    save_json(root / "reports/daad_discovery.json", discovery)
    save_json(root / "reports/daad_validation_report.json", validation)
    save_json(root / "reports/daad_changes.json", changes)
    save_json(root / f"runs/{run_id}.json", {"validation": validation, "records": normalized})
    write_summary(root, validation)
    print(json.dumps({k: validation[k] for k in ("programs_discovered", "programs_attempted", "successfully_extracted", "partially_extracted", "failed", "supported_for_egypt")}, indent=2), flush=True)
    return 0 if len(records) == 5 and args.mode == "test" and not validation["failed"] else 2 if args.mode == "test" else 0
