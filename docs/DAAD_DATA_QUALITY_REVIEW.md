# Five-program DAAD quality review

The review replays the original five-program HTTP captures from 18 October 2026. Each response is checked against its saved SHA256. Retrieval timestamps stay unchanged; the report records a separate reprocessing timestamp. This is an extraction correction, not a claim that DAAD changed its rules. A separate fresh browser integration test checks real Egypt/status submission.

## Corrections

- Residence conditions use residence vocabulary and cannot match language simply because they mention Germany. Language names require word boundaries.
- Application documents, portal instructions, benefits and funding restrictions are separate from academic eligibility. Transcripts do not imply a grade threshold. Introductory headings are not rules.
- Conditions and exceptions retain literal wording. `obligation` distinguishes mandatory/preferred wording from conditional applicability. All interpretations still require review; qualitative academic standards never imply a numeric GPA.
- Timing records require an actual calendar expression, explicit time, or relative constraint. Selection and funding starts are separate events, including when DAAD puts both in one paragraph. Month dates have no invented day. Yearless openings have no invented year. Relative document/opening constraints have no invented absolute date.
- Repeated requirements, documents and timing statements are deduplicated within applicant scope and retain evidence references. Doctoral and postdoctoral scopes stay separate; status-specific degree-age rules are filtered appropriately.
- The EPOS PDF is parsed as a table, using row geometry to associate embedded official website links. Its 25 rows retain course names, institutions, languages, degrees, duration, intake information and original deadline cells. The grouped NRM/IWRM/REM row remains grouped. Every scholarship-deadline cell says “see website of the course”; exact dates remain null.
- Publication lists are documents: the Research Grants list is mandatory for postdoctoral applicants, with its published maximum of ten pages. General upload/translation instructions do not become separate required documents. Optional additional documents remain optional.

## Egypt and remaining uncertainty

All six relevant applicant-status variants are reconciled against the captured Application Procedure form and returned selection evidence. Music, Architecture, Research Grants (doctoral and postdoctoral), and EPOS support Egypt as a country of residence/application. Master Studies for All Academic Disciplines excludes Egypt from its complete authoritative list and publishes an exclusion instruction. These outcomes do not establish citizenship eligibility or individual student eligibility.

Course websites have not been fetched in these captures, so all 25 EPOS course dates need individual verification. Qualitative grades, university-specific language standards, exceptions and document applicability remain for editorial review. Past dates are retained as published. None is rolled forward.

## Existing schema mapping

Existing scholarship, snapshot, variant, requirement, language, document, timing, funding and evidence tables are used. Complete course records, month/relative timing metadata, obligation and merged references are preserved in `scholarship_snapshots.normalized_payload`. The existing schema has no course table; this review does not create one or flatten course dates into the umbrella record. Typed tables retain their supported columns and original evidence text. No SQL migration changed.

All five scholarships have `published=false`, `verification_state=needs_review`, and no editorial verification timestamp. Detail rows require human review. There is no importer invocation or remote database write.

## Reproduce

Run from the repository root in PowerShell:

```powershell
$env:PYTHONIOENCODING='utf-8'
backend/.venv/Scripts/python.exe backend/reprocess_captured.py
backend/.venv/Scripts/python.exe backend/prepare_payloads.py
backend/.venv/Scripts/python.exe -m pytest backend/app/scraping/tests -q -p no:cacheprovider --junitxml=data/scraping/reports/pytest_offline.xml
node supabase/tests/validate-scholarship-payloads.mjs
backend/.venv/Scripts/python.exe backend/validate_outputs.py
```

The SQL check uses a disposable embedded PostgreSQL 17 database, applies the exact migrations, and rolls back all prepared-row inserts. It has no remote connection configuration. The JSON report includes executed test counts, per-program evidence reconciliation, before/after counts, form outcomes, remaining uncertainty, and local SQL validation.
