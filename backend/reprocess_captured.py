"""Replay the five real, immutable DAAD captures. No network or database access."""
import hashlib
import json
import re
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit, urldefrag
from app.scraping.cli import ROOT, report, write_summary
from app.scraping.sources.daad import DaadAdapter
from app.scraping.schemas.scholarship import Scholarship
from app.scraping.core.html_parser import selection_confirmed, application_form
from app.scraping.storage.json_repository import save_json, utcnow


class ArchiveFetcher:
    def __init__(self, record):
        self.saved = record.evidence
        self.evidence = []
        self.raw_dir = ROOT / 'data/scraping/raw'
        self.record = record

    def fetch(self, url, method='GET', data=None):
        candidates = [e for e in self.saved if urldefrag(e.url)[0] == urldefrag(url)[0] and e.status_code == 200]
        if not candidates and method == 'GET':
            redirect = next((i for i, e in enumerate(self.saved) if e.url == url and e.status_code in (301, 302, 307, 308)), None)
            if redirect is not None and redirect + 1 < len(self.saved) and self.saved[redirect + 1].status_code == 200:
                candidates = [self.saved[redirect + 1]]
        if method == 'POST':
            candidates = [e for e in self.saved if e.status_code == 200 and 'pdf' not in (e.content_type or '') and
                selection_confirmed(Path(e.local_path).read_text(encoding='utf-8'), self.record.daad_program_id,
                    data['origin'], data['status'])] if data else []
        if not candidates:
            raise ValueError(f'Not present in original capture: {method} {url}')
        evidence = candidates[-1]
        content = Path(evidence.local_path).read_bytes()
        assert hashlib.sha256(content).hexdigest() == evidence.sha256
        if evidence not in self.evidence:
            self.evidence.append(evidence)
        return SimpleNamespace(url=evidence.url, content=content, text=content.decode('utf-8', errors='replace'),
            headers={'content-type': evidence.content_type or ''})


def main():
    base = ROOT / 'data/scraping'
    path = base / 'normalized/daad_scholarships.json'
    original = json.loads(path.read_text(encoding='utf-8'))
    before_path = base / 'reports/daad_quality_baseline.json'
    if not before_path.exists():
        save_json(before_path, original)
    previous = json.loads((base / 'reports/daad_validation_report.json').read_text(encoding='utf-8'))
    records, audits = [], []
    for raw in original:
        old = Scholarship.model_validate(raw)
        record = DaadAdapter(ArchiveFetcher(old), browser_fallback=False).scrape({
            'daad_program_id': old.daad_program_id, 'url': old.official_program_url, 'title': old.title})
        record.retrieval_timestamp = old.retrieval_timestamp
        record.evidence = old.evidence  # retain redirects/form requests and their original capture metadata
        assert record.title == old.title and record.egypt_support_status == old.egypt_support_status
        records.append(record)
        form_evidence = next(e for e in old.evidence if e.url == old.official_program_url)
        form_html = Path(form_evidence.local_path).read_text(encoding='utf-8')
        form = application_form(form_html, old.official_program_url)
        expected = [s['value'] for s in form['statuses'] if re.search(r'graduate|doctoral|research|scientist', s['label'], re.I)]
        assert expected == [v.applicant_status_value for v in record.applicant_status_variants]
        for v in record.applicant_status_variants:
            assert v.country_options == form['countries'] and v.status_options == form['statuses']
            if not v.egypt_selectable:
                assert form['countries'] and not any(c['label'].casefold() == 'egypt' for c in form['countries'])
                assert 'cannot apply for this scholarship programme' in form_html
        # All extracted interpretations must trace to literal captured official text.
        from app.scraping.core.html_parser import parse_sections
        source_texts = {b.text for b in record.raw_sections}
        for v in record.applicant_status_variants:
            if v.selection_confirmed:
                selected = ArchiveFetcher(old).fetch(form['action'], method='POST', data={'origin': v.selected_country_value, 'status': v.applicant_status_value})
                source_texts.update(b.text for b in parse_sections(selected.text, str(selected.url)))
        checked_rules = record.structured_requirements + record.selection_criteria
        assert all(r.original_text in source_texts and r.evidence_references for r in checked_rules)
        assert all(d.instructions in source_texts for d in record.required_documents)
        assert all(all(ref['excerpt'] in source_texts for ref in d.evidence_references) for d in record.deadlines)
        assert all(d.date or d.year_month or d.relative_constraint or d.date_precision == 'yearless' for d in record.deadlines)
        assert not any(r.category == 'language' and re.search(r'\bresid(?:ent|ed|ence)', r.original_text, re.I) for r in checked_rules)
        assert not any(r.unit == 'GPA' for r in checked_rules)  # none of these five sources publishes a numeric GPA
        audits.append({'daad_program_id': record.daad_program_id, 'official_url': record.official_program_url,
            'source_evidence_reconciliation': {'passed': True, 'requirements_checked': len(checked_rules),
                'documents_checked': len(record.required_documents), 'timing_records_checked': len(record.deadlines),
                'course_rows_checked': len(record.courses), 'all_values_trace_to_archived_official_text': True},
            'form_evidence_sha256': form_evidence.sha256, 'country_semantics': form['country_semantics'],
            'variants': [{'status': v.applicant_status, 'country_options_count': len(v.country_options),
                'egypt_selectable': v.egypt_selectable, 'selection_confirmed': v.selection_confirmed,
                'procedure_loaded': v.application_procedure_loaded, 'outcome': v.eligibility_classification,
                'evidence_urls': v.evidence_urls, 'exclusion_notice_present': 'cannot apply for this scholarship programme' in form_html}
                for v in record.applicant_status_variants]})
    save_json(path, [r.model_dump(mode='json') for r in records])
    discovery = json.loads((base / 'reports/daad_discovery.json').read_text(encoding='utf-8'))
    from datetime import datetime
    validation = report(records, discovery, {}, previous['network_failures'], previous['run_id'], datetime.fromisoformat(previous['started_at']))
    validation['finished_at'] = previous['finished_at']
    baseline = json.loads(before_path.read_text(encoding='utf-8'))
    validation['quality_review'] = {'reprocessed_at': utcnow().isoformat(), 'method': 'Replay of SHA256-checked archived official responses, not a new crawl',
        'network_requests': 0, 'remote_database_writes': 0, 'egypt_form_audit': audits,
        'changes': [{'daad_program_id': r.daad_program_id,
            'requirements_before': len(b['structured_requirements']), 'requirements_after': len(r.structured_requirements),
            'deadlines_before': len(b['deadlines']), 'deadlines_after': len(r.deadlines),
            'courses_before': len(b.get('courses', [])), 'courses_after': len(r.courses),
            'reclassified_requirements': [{'text': q.original_text, 'before': oldq['category'], 'after': q.category,
                'applicant_status': q.applies_to_applicant_status} for q in r.structured_requirements for oldq in b['structured_requirements']
                if q.original_text == oldq['original_text'] and q.applies_to_applicant_status == oldq['applies_to_applicant_status'] and q.category != oldq['category']]} for b, r in zip(baseline, records)],
        'mapping_notes': ['Courses, partial month dates, relative timing, obligation and merged evidence references are preserved losslessly in existing scholarship_snapshots.normalized_payload. Existing typed tables keep supported columns; no invented SQL columns or programme-wide EPOS date.',
            'Repeated statements are deduplicated within applicant scope; distinct doctoral and postdoctoral scopes remain separate.'],
        'remaining_uncertainties': ['All 25 EPOS course rows defer deadlines to course websites; those websites have not been fetched in this capture.',
            'Qualitative academic standards remain text; no numeric GPA is inferred.',
            'Egypt is country of residence/application, not citizenship or an individual eligibility verdict.',
            'Month-only selection/funding dates have no invented day; relative opening/document deadlines have no invented date.',
            'Generic Master Studies information is retained, but Egypt is absent from its authoritative form country list.',
            'All deterministic conditions and document applicability still require editorial review.']}
    save_json(base / 'reports/daad_validation_report.json', validation)
    # Payload generation fills validation before the summary is refreshed.
    print(json.dumps([{k: v for k, v in change.items() if k != 'reclassified_requirements'}
        for change in validation['quality_review']['changes']], indent=2))


if __name__ == '__main__':
    main()
