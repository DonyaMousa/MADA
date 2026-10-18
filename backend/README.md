# Mada scholarship scraper

This standalone Python tool discovers programs from DAAD's official public catalogue, submits the official country/status form, extracts evidence-backed requirements and writes local JSON. It has no database-writing client and never reads Supabase credentials. Payloads now use the additive scholarship-detail migration; the frontend and hosted database are unchanged.

## Install

Run from the repository root. Python 3.11+ is required; this implementation was exercised on CPython 3.14.0. With the installed `uv` tool:

```powershell
uv venv backend/.venv --python 3.14 --cache-dir .cache/uv
uv pip install --python backend/.venv/Scripts/python.exe --cache-dir .cache/uv -r backend/requirements.txt
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/ms-playwright'
backend/.venv/Scripts/python.exe -m playwright install chromium
```

The dependency versions in `requirements.txt` are those used for this run. `tzdata` provides Europe/Berlin daylight-saving rules on Windows. Virtual environments, browser binaries and caches are ignored by Git.

## Execute the five-program test crawl

```powershell
$env:PYTHONIOENCODING = 'utf-8'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/ms-playwright'
backend/.venv/Scripts/python.exe backend/scrape.py --mode test --max-depth 1 --linked-pages 3
```

This discovers the catalogue without an Egypt filter, selects five distinct DAAD programs and processes requests serially at least 1.25 seconds apart. Retries are bounded and use exponential backoff for transient transport/server failures. Country selection happens separately on each program's own application-procedure form. Every available relevant graduate/doctoral/research applicant status is processed independently.

The inspected site loads its 148-entry catalogue through a public `scholarships.js` TAFFY dataset and paginates it in the browser, five records per page. Discovery parses the JSON argument without evaluating JavaScript and walks the dataset's pages with stable `sapProgid` IDs. This avoids both a global country filter and redundant catalogue requests. If DAAD changes this mechanism, discovery stops rather than inventing IDs.

The detail form's HTML IDs are misleading: `select-status-detail` contains countries and `select-country-detail` contains academic statuses. The adapter identifies their semantic `name="origin"` and `name="status"` attributes. It sends the same inspected form action, hidden fields and `ref=prozess` as the Application Procedure button and checks the returned country, status, program ID, procedure content and removal of the selection form. A URL fragment alone never establishes successful procedure retrieval.

Direct public HTTP form submission is the default because it reliably reproduces this interface. Playwright is a fallback for changed/dynamic form behavior. It clicks the tab and visible Chosen dropdown controls, verifies the native selected values and waits for the returned DAAD selection state. `--force-browser` explicitly selects this path; it is intended for diagnostics and was separately tested on the Music program. Do not use a browser to bypass a 403, CAPTCHA, robots prohibition or other access restriction.

`--resume` reuses records from an interrupted run's checkpoint. It preserves the original retrieval timestamps and reports how many checkpoint records were reused. For a fresh check, omit this flag. Each run also saves a uniquely identified snapshot, so the current normalized output is not the only copy of prior results.

Full-catalogue support uses the same adapter, paginated discovery, bounded linked crawling, checkpoints, stable IDs and semantic snapshot comparisons. It requires both `--mode full` and `--execute-full`. **A full crawl was not executed for this assignment.** No scheduler is installed.

## Inspect results

The paths below are relative to the repository root:

| Output | Purpose |
| --- | --- |
| `data/scraping/normalized/daad_scholarships.json` | Five normalized Pydantic records, with country/status variants, evidence and review issues |
| `data/scraping/database_ready/daad_supabase_payloads.json` | Schema-compatible rows for scholarships, sources, fetch runs, change history and eight detail tables; no writes |
| `data/scraping/reports/daad_discovery.json` | Actual discovered IDs, source script URL, pagination and selected programs |
| `data/scraping/reports/daad_validation_report.json` | Per-program extraction coverage, Egypt outcomes, dates, gaps and payload validation |
| `data/scraping/reports/daad_run_summary.md` | Human-readable actual execution table and deadline evidence |
| `data/scraping/reports/daad_schema_gap_report.md` | Mapping decisions, preserved richer metadata and future additive options |
| `data/scraping/reports/daad_request_log.json` | Request method/body, URL, HTTP status, retrieval time and archived-body hash |
| `data/scraping/reports/daad_changes.json` | Semantic changes versus a compatible previous extractor snapshot, with old/new evidence |
| `data/scraping/reports/daad_database_mapping_report.json` | Re-preparation of captured records for the current schema, without a new crawl |
| `data/scraping/reports/daad_sql_payload_validation.json` | Actual prepared-row validation against disposable PostgreSQL; no remote writes |
| `data/scraping/raw/` | Content-addressed HTML/JS/PDF response bodies and browser screenshots/HTML |
| `data/scraping/runs/` | Historical run snapshots |
| `data/scraping/checkpoints/daad.json` | Explicit-resume checkpoint |

For example:

```powershell
Get-Content -Raw -Encoding utf8 data/scraping/reports/daad_run_summary.md
$records = Get-Content -Raw -Encoding utf8 data/scraping/normalized/daad_scholarships.json | ConvertFrom-Json
$records | Select-Object daad_program_id,title,egypt_support_status,extraction_quality,application_status
```

`supported_for_egypt` means the program's form accepted Egypt as **country of residence/application** for at least one relevant status and returned the procedure. It is not a citizenship rule or a student-specific eligibility decision. `unsupported_for_egypt` requires a loaded authoritative list and its explicit exclusion instruction for every relevant status. Empty country lists, failed requests and missing controls yield `needs_verification`.

## Tests

Offline unit tests use clearly labelled synthetic fixtures and mocked HTTP transports. These are never written as real scholarship results:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/app/scraping/tests -q -p no:cacheprovider --junitxml=data/scraping/reports/pytest_offline.xml
```

The separate real browser integration test performs a live Music program selection and saves screenshots:

```powershell
$env:MADA_LIVE = '1'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/ms-playwright'
backend/.venv/Scripts/python.exe -m pytest backend/app/scraping/tests/test_live.py -m live -q -p no:cacheprovider --junitxml=data/scraping/reports/pytest_live.xml
```

Validate saved real outputs and response hashes without network or database access:

```powershell
backend/.venv/Scripts/python.exe backend/validate_outputs.py
```

To rebuild database payloads from saved real records after a mapping/schema update, preserving the actual source capture times:

```powershell
backend/.venv/Scripts/python.exe backend/prepare_payloads.py
backend/.venv/Scripts/python.exe backend/validate_outputs.py
```

This re-preparation is local and does not perform another crawl. To exercise those rows against disposable PostgreSQL with the existing local validation dependencies:

```powershell
node supabase/tests/validate-scholarship-payloads.mjs
```

Tests cover discovery, pagination, deduplication, ID parsing, country/status selectors and confirmation, missing Egypt, failed forms, qualitative/numeric rules, conditional requirements, documents, dates/timezones, funding exclusions, unknown fields, Pydantic JSON, mapping against actual migration columns, change detection, robots restrictions, access errors and network failures. JUnit files retain executed results. `inspect_browser.py` is an explicit public-page DOM diagnostic used to inspect the custom dropdown markup; it submits nothing.

## Extraction and review boundaries

- Text blocks preserve headings, DOM order, paragraphs, lists, notes, table rows and linked PDF pages. Original downloaded response bodies and SHA-256 hashes remain available for every interpretation.
- Deterministic classification preserves original wording rather than pretending to be an AI semantic parser. Conditions, exceptions and selection criteria are retained separately. Every interpretation remains reviewable. Qualitative excellence never becomes an invented GPA; unpublished IELTS/TOEFL scores stay null.
- A numeric value is extracted only when explicitly published. A bound is assigned only when wording supplies an operator. A monthly stipend is not proof of full tuition coverage. German `1.400` and English `1,400` thousands formatting are normalized, while the full funding sentence retains academic-level/effective-date conditions.
- Explicit full dates are retained as observed, including past dates. No annual deadline is rolled into another year. A timestamp is set only when the source supplies the date and its 24.00 CET/CEST closing rule; otherwise it stays null. Future deadlines do not establish an open application window. EPOS course-specific deadlines can remain unknown even when the general program and its PDF were retrieved.
- The crawler follows only selected relevant official DAAD guidance, within configurable depth/page/response-size bounds. It does not log in, solve CAPTCHAs or follow unrelated links. Robots policies are checked per origin; an actual 404/410 means no robots file, while inaccessible/ambiguous policies stop crawling that origin. Some university-specific conditions require later manual checking of the named course website. PDF tables are retained as page text blocks, not guaranteed structured course-row associations; no OCR is performed on scanned PDFs.
- Extraction quality (`complete`/`partial`/`failed`), country support, application open/closed status and database editorial verification are independent. A complete extraction still remains `needs_review`, with `published=false` and `last_verified_at=null`.
- Changing the extractor version skips source-change claims against incompatible baselines. Semantic comparison ignores retrieval timestamps, source-URL query variations and layout whitespace, but retains meaningful qualitative/quantitative changes. It is not a general semantic equivalence engine.

## Extending to another source

Implement the `SourceAdapter` protocol in `app/scraping/sources/base.py`. Reuse the fetcher's robots, rate, redirect, size and access controls; reuse normalized models, block/PDF parsing, requirement classification, validation, JSON persistence and change detection. Add a new source adapter and source-specific fixtures. Expand the official-host allowlist deliberately for that provider's public official domains. No Erasmus Mundus adapter is included.

## Implementation files

Paths below are relative to `backend/`:

| File | Purpose |
| --- | --- |
| `scrape.py`, `app/scraping/cli.py` | Runnable CLI, test/full bounds, checkpoints, incremental runs and reports |
| `validate_outputs.py` | Validate the five saved live artifacts, hashes, form responses and database payloads; append executed test results |
| `prepare_payloads.py` | Re-prepare saved live records for all current migrations without network or database access |
| `app/scraping/sources/base.py` | Reusable provider adapter protocol |
| `app/scraping/sources/daad.py` | Official DAAD detail/status/country workflow and program-level aggregation |
| `app/scraping/core/fetcher.py` | Serial HTTP, robots, rate limits, bounded retries, host/redirect/size controls and immutable response evidence |
| `app/scraping/core/browser.py` | Real tab/dropdown interactions, explicit selection confirmation, screenshots and browser fallback |
| `app/scraping/core/discovery.py` | Public catalogue parsing, pagination, IDs, deduplication and five-program selection |
| `app/scraping/core/crawler.py` | Relevant official linked-page crawling with depth/page bounds |
| `app/scraping/core/html_parser.py` | Ordered section/hierarchy/text/list/table extraction and form parsing |
| `app/scraping/core/pdf_parser.py` | Bounded, signature-checked PDF page-text extraction |
| `app/scraping/core/requirement_extractor.py` | Evidence-preserving qualitative/numeric/conditional/preferred classification and required documents |
| `app/scraping/core/normalizer.py` | Dates, CET/CEST rules, explicit application status, funding amounts and country-status aggregation |
| `app/scraping/core/validator.py` | Extraction coverage and editorial-review state |
| `app/scraping/core/change_detector.py` | Version-aware semantic comparisons with old/new values and evidence |
| `app/scraping/schemas/requirements.py` | Pydantic requirement and document models |
| `app/scraping/schemas/scholarship.py` | Pydantic evidence, blocks, deadlines, applicant variants and program models |
| `app/scraping/storage/json_repository.py` | Atomic local JSON persistence, timestamps and response hashes |
| `app/scraping/storage/supabase_mapper.py` | Versioned-schema inspection, deterministic IDs, base/detail payload preparation and validation |
| `app/scraping/storage/detail_mapper.py` | Eight related detail tables, score/CEFR alternatives, document page limits, academic fields and evidence/snapshot mapping |
| `app/scraping/tests/test_*.py`, `fixtures/` | Executed offline regression tests and a separately invoked live browser test |
| `app/scraping/tests/inspect_browser.py` | Explicit live DOM diagnostic for the inspected DAAD dropdown |
| `requirements.txt`, `pyproject.toml`, `.gitignore` | Tested dependencies, package/test configuration and ignored local environments |

The root `.gitignore` additionally ignores the project-local `.cache/` directory. The later schema expansion adds a separate versioned migration; the original initial migration and frontend remain unchanged.

## Future Supabase integration

`storage/supabase_mapper.py` reads all versioned migrations and validates column names, required fields, enum values, JSON containers and payload provenance references. `detail_mapper.py` maps snapshots, variants, academic/selection requirements, named language tests/scores/CEFR, document limits, deadline evidence, funding and HTTP evidence to eight dedicated tables. It does not create hosted tables or execute imports. The full extraction goes into `scholarship_snapshots.normalized_payload`, not a source_context envelope in eligibility_rules. The original JSON fields remain as compatibility summaries. `application_status` retains upcoming while old `open_status` conservatively uses unknown for it.

The future approved importer should resolve existing source/scholarship IDs, create a running fetch record, upsert draft listings by `(source_id, source_record_id)`, append snapshots, insert variants/details, set latest_snapshot_id, write change history and update actual imported counts in one transaction. The latest-snapshot FK is deferred for this ordering. Use insert/on-conflict-do-nothing for append-only snapshots/evidence. Local payloads have imported_count=0. Public child visibility requires a published parent, its current snapshot and explicit review completion. No remote writes, CV processing, embeddings or matching are performed by this tool. See `docs/SCHOLARSHIP_SCHEMA.md` for schema and security details.
