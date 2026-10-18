# Detailed scholarship schema

`supabase/migrations/20261018200000_scholarship_details.sql` extends the existing initial schema. It preserves all 29 existing tables and adds eight related tables, bringing the total to 37. No hosted schema/data has been changed. The original initial migration is unchanged by this expansion.

## Direct scholarship fields

New fields on `scholarships` are `category`, `description`, `program_objectives`, `eligible_academic_disciplines`, `application_portals`, `egypt_support_status`, `application_status`, `application_status_evidence`, `extraction_quality`, `extracted_at` and `latest_snapshot_id`.

`application_status` supports open/closed/upcoming/unknown. The existing three-state `open_status` is retained for compatibility, with a consistency check: upcoming corresponds to old open_status=unknown; other values agree. A null application_status permits existing manually curated rows to keep their old behavior.

Country-of-application support remains independent of nationality, personal eligibility and whether applications are currently open. Extraction quality is independent of editorial verification. Scraped parents remain unpublished and needs_review.

## Related tables

| Table | Purpose and queryable details |
| --- | --- |
| `scholarship_snapshots` | Full historical normalized extraction, source/fetch-run identifiers, provider record ID, schema/extractor versions, capture time and canonical payload hash |
| `scholarship_variants` | Applicant status and provider status value, evaluated country, actual selection flags, country semantics, Egypt support, procedure text, open status, extraction status, option lists and evidence URLs |
| `scholarship_requirements` | Original/normalized wording, category, rule type/strength, operator/value/unit, conditions/exceptions, collection membership, source section, evidence excerpt, method/confidence and review status |
| `scholarship_language_requirements` | Language, named test, minimum score, score scale, CEFR level, operator, submission stage, accepted/excluded flag, alternative-test group, maximum certificate age, applicant scope and original conditions |
| `scholarship_required_documents` | Document name/type, nullable mandatory flag, conditions, submission stage, format, translation/certification instructions, reference count, minimum/maximum pages, applicant scope and source evidence |
| `scholarship_deadlines` | Deadline kind, source calendar date, exact closing timestamp where supported, timezone, optional cycle label, explicit-year flag, certainty, applicant scope, original wording and source evidence |
| `scholarship_funding` | Benefit type, included/excluded/conditional/unknown coverage, amount/currency, payment period, duration text, conditions, applicant scope and evidence |
| `scholarship_evidence` | Actual request URL/method/status, retrieval time, response content hash, MIME type, request parameters and an optional future archive Storage key |

Academic criteria have dedicated typed columns on `scholarship_requirements`: `minimum_gpa`, `gpa_scale`, `academic_rank`, `minimum_experience_months`, `maximum_years_since_graduation` and `minimum_publications`. Unpublished values are null. These coexist with original wording and generic rule values so new criteria remain representable without inventing thresholds.

`collections` preserves distinctions between structured requirements, selection criteria, conditional requirements and unresolved interpretations. It is not necessary to duplicate a rule into four rows when it belongs to several collections. No automatically extracted rule is marked `is_hard_requirement=true`. A trusted review must explicitly authorize hard eligibility; a selection criterion cannot become a hard requirement through that flag.

Tests in the same `alternative_group` and stage represent alternatives, not a requirement to pass every test. Application-stage B1 evidence and pre-course DSH/TestDaF evidence have different stage/group contexts. The source statement is retained for exceptions and university-specific admission requirements. General multi-stage B2/C1/B1 statements are not flattened to an invented single threshold.

Document page limits are independent of publication counts. “Publication list, max. 10 pages, mandatory for postdocs” becomes a postdoctoral `publication_list` document with maximum_pages=10; it does not become minimum_publications=10. Quantified publication minima are populated only when explicitly stated.

## Relationships and import ordering

Every detail belongs to a scholarship and an exact source snapshot. Optional variant references must match **both the same scholarship and the same snapshot**. Snapshots must match the scholarship's source and a fetch run belonging to that source. `latest_snapshot_id` must point to the same scholarship.

A future importer should use a transaction in this order:

1. Resolve/upsert the source and record a running fetch run.
2. Resolve/upsert the scholarship using its existing `(source_id, source_record_id)` identity.
3. Append the normalized snapshot.
4. Insert applicant variants and their scoped requirement/document/language/deadline/funding rows and evidence.
5. Set the parent's latest snapshot, write actual change history, and complete fetch-run counters.

The latest-snapshot foreign key is initially deferred to allow prepared parent pointers before their snapshot row is inserted. It is validated at commit. New code must resolve real existing UUIDs rather than assume a deterministic local UUID equals the ID already stored remotely. Repeating an identical snapshot uses insert/on-conflict-do-nothing; snapshots/evidence are append-only for the service role.

All detailed rows are tied to a snapshot, making past data distinguishable from current data. They need not be deleted to replace a current version. Changes to current details update `scholarships.updated_at`, invalidating cached matching results that track the parent revision. Changes to a historical snapshot's details do not change current public content.

The existing `eligibility_rules` and `required_documents` JSON columns remain available for compatibility. New payloads contain requirement/document summaries there, without a complete `source_context` envelope. The full lossless normalized record lives in snapshots. Legacy envelope data, if any exists elsewhere, is not destructively rewritten by the migration.

## Security and review

- All eight new tables have RLS. New rows are service-written; students and admin browsers have no detail insert/update/delete privileges.
- Published child details are publicly readable only when their parent is published, their snapshot is current and `requires_human_review=false`.
- Admins can read draft/current/historical details for inspection. Only a trusted service can approve or modify them.
- Snapshots and request evidence are never public. They are admin/service-readable. Request bodies and full normalized audit data may contain operational metadata and remain outside the public directory.
- The broad existing scholarship editor grants were replaced with column grants preserving original listing editing. They do not permit an admin browser to forge imported country support, extraction status or snapshot pointers.
- Snapshot/evidence API grants are append-only even for the service role. Parent deletions still have their declared cascades; this migration executes no data deletion.
- The private documents bucket, its four original policies, Auth/profile/application/match/CV permissions and existing relationships are unchanged.

Constraints validate GPA scales, score ranges/finite values, CEFR syntax, document page/reference limits, dates with explicit years, funding currencies, JSON containers, hashes and same-source/snapshot relationships. Every foreign key has a supporting index. Search indexes cover requirements, GPA, language tests, document type, funding and deadline timestamps.

## What was prepared from the real DAAD capture

The existing five live records were remapped without a new crawl. Their original retrieval timestamps, response bodies and hashes were retained:

| Relation | Prepared rows |
| --- | ---: |
| scholarships | 5 |
| scholarship_snapshots | 5 |
| scholarship_variants | 6 |
| scholarship_requirements | 398 |
| scholarship_language_requirements | 54 |
| scholarship_required_documents | 82 |
| scholarship_deadlines | 105 |
| scholarship_funding | 75 |
| scholarship_evidence | 23 |

There is also one source, one local fetch-run payload and no asserted source-change history. Deadline rows include unknown dates and original deadline-related instructions, not 105 confirmed dates. Detail counts preserve applicant-status-specific evidence; they are not counts of distinct scholarships or verified eligibility conditions.

The mapper now represents the Research Grants IELTS 6.5 / TOEFL iBT 79 / TOEFL 550 / PTE Academic 59 / onSET B2 alternatives and three-year certificate age. German DSH 2 / TestDaF 4 and application-stage B1 remain separately scoped. Motivation-letter page limits and the postdoctoral publication list are queryable. No numeric GPA was invented for any of the five programs. Deterministic interpretation still requires review, including qualitative rank, conditional requirements and university-specific language/admission standards.

Full HTML/PDF/screenshot bytes remain local. `archive_storage_path` is null until a future approved archive uploader exists. Original local paths may be retained inside the private snapshot for audit, not exposed as working public download URLs.

## Validation and commands

Both versioned migrations were applied by Supabase CLI 2.121.0 against clean disposable PostgreSQL 17.5 (PGlite with minimal Supabase auth/storage fixtures). All 143 schema/security/integrity checks passed. All 755 prepared rows passed real SQL inserts, foreign keys and checks in a transaction that was rolled back. The payload checks also assert correct language values, postdoctoral publication scope and absence of invented GPA minima. Python has 76 passing offline tests; saved response verification has 60 passing checks. No new live crawl was needed for this schema change.

Supabase CLI regenerated `supabase/types/database.types.ts`; it passes strict TypeScript compilation. Full Docker-backed Supabase service validation is still unavailable because Docker/Podman is not installed. No remote schema change, remote data write, reset or destructive command was executed.

Reproduce locally:

```powershell
backend/.venv/Scripts/python.exe backend/prepare_payloads.py
backend/.venv/Scripts/python.exe -m pytest backend/app/scraping/tests -q -p no:cacheprovider
backend/.venv/Scripts/python.exe backend/validate_outputs.py
node supabase/tests/validate-scholarship-payloads.mjs
node supabase/tests/generate-embedded-types.mjs
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module esnext supabase/types/database.types.ts
```

After starting Docker, a fresh local Supabase stack can apply both migrations with `npx --no-install supabase start` and `npx --no-install supabase migration up --local`. Do not reset an existing development database.

For a linked hosted project, only after deployment approval:

```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run --skip-vault
npx --no-install supabase db push --linked --skip-vault
```

An empty project receives the initial migration followed by the additive detail migration. A project that already has the initial version receives only the pending detail migration. Never apply the archived original reference SQL as another migration.
