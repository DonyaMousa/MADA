# DAAD scraper: actual execution report

Run `9f14c25c-802d-4c3f-9757-e4a041ac5d91`; started 2026-10-18T19:50:07.260105+00:00; completed 2026-10-18T19:50:53.216467+00:00.

Discovered: 148; attempted: 5; complete: 4; partial: 1; failed: 0.
Egypt: supported 4; unsupported 1; needs verification 0.
Database payload validation: True. Remote writes: 0.

Extraction quality describes retrieval coverage. All records remain needs_review and unpublished; country-of-application support is not individual student eligibility.

| DAAD ID | Program | Applicant status | Egypt | Explicit application dates | Requirements / selection / documents | Procedure | Quality | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 57135743 | Study Scholarships - Postgraduate Studies in the Field of Music | Graduates | supported_for_egypt | 2026-09-24 | 7 / 5 / 16 | True | complete | needs_review |
| 57135744 | Study Scholarships - Postgraduate Studies in the Field of Architecture | Graduates | supported_for_egypt | 2026-09-23 | 6 / 6 / 15 | True | complete | needs_review |
| 50026200 | Study Scholarships - Master Studies for All Academic Disciplines | Graduates | unsupported_for_egypt | Unknown; see evidence | 10 / 13 / 10 | False | partial | needs_review |
| 57742121 | Research Grants in Germany | Doctoral candidates/PhD students, Postdoctoral researchers | supported_for_egypt | 2026-08-31 | 10 / 24 / 22 | True | complete | needs_review |
| 50076777 | Development-Related Postgraduate Courses (EPOS) | Graduates | supported_for_egypt | Unknown; see evidence | 10 / 4 / 12 | True | complete | needs_review |

## 57135743: Study Scholarships - Postgraduate Studies in the Field of Music

Official source: https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57135743

Missing/uncertain information:
- No active application portal URL published; database mapping uses official submitting-application tab
- Deterministic classifications and qualitative conditions require review; unlisted values stay null.

Actual deadline text:
- 24.09.2026
- Selection in February 2027
- Funding begins from October 2027
- The DAAD portal closes at 24.00 hrs. (CET or CEST) on the last application day. We recommend that you [fett|submit your application a few days before the application deadline . This ensures that you are on the safe side in the event of technical problems.
- Applications for this scholarship programme are possible between 1 June and the stated application deadline.

## 57135744: Study Scholarships - Postgraduate Studies in the Field of Architecture

Official source: https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57135744

Missing/uncertain information:
- No active application portal URL published; database mapping uses official submitting-application tab
- Deterministic classifications and qualitative conditions require review; unlisted values stay null.

Actual deadline text:
- 23.09.2026
- Selection in January 2027
- funding starting from September 2027
- Applications for this scholarship programme are possible between 1 June and the stated application deadline.
- The DAAD portal closes at 24.00 hrs. (CET or CEST) on the last application day. If possible, please submit your application a few days before the application deadline. This means you are on the safe side in the event of technical problems.

## 50026200: Study Scholarships - Master Studies for All Academic Disciplines

Official source: https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=50026200

Missing/uncertain information:
- No active application portal URL published; database mapping uses official submitting-application tab
- Graduates: Egypt absent from authoritative list
- No explicit full-date application deadline; no current cycle inferred
- Deterministic classifications and qualitative conditions require review; unlisted values stay null.

Actual deadline text:
- You yourself are responsible for ensuring your application for admission to the German university for your chosen study programme is submitted by the due date. It is therefore important that you find out about admission requirements, application and enrolment deadlines at your host university and regulations regarding entry into Germany in good time. If you have not yet received notification of admission at the time of application, you must submit this before the funding period begins. A Scholarship Award Letter from the DAAD is only valid if you have been admitted to study at the host university named in your application.
- Applications for this scholarship programme are possible between 1 June and the stated application deadline.
- Your application is only valid if you submit all the required documents to the DAAD portal by the application deadline.

## 57742121: Research Grants in Germany

Official source: https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57742121

Missing/uncertain information:
- No active application portal URL published; database mapping uses official submitting-application tab
- Deterministic classifications and qualitative conditions require review; unlisted values stay null.

Actual deadline text:
- 31.08.2026
- Selection in February 2027
- Start of funding in May 2027
- The access to the DAAD portal opens at least 6 weeks before the application deadline.
- Your application is only valid if you submit all the required documents to the DAAD portal by the application deadline.

## 50076777: Development-Related Postgraduate Courses (EPOS)

Official source: https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=50076777

Missing/uncertain information:
- EPOS umbrella: course-specific deadlines must be checked on each official course website; never use one programme deadline for all courses
- No active application portal URL published; database mapping uses official submitting-application tab
- No explicit full-date application deadline; no current cycle inferred
- Deterministic classifications and qualitative conditions require review; unlisted values stay null.

Actual deadline text:

## Access failures

No network failures recorded.

## Data quality corrections

Replay of SHA256-checked archived official responses, not a new crawl

| Programme ID | Eligibility rules before / after | Timing records before / after | Course rows |
| --- | --- | --- | --- |
| 57135743 | 77 / 7 | 13 / 5 | 0 |
| 57135744 | 69 / 6 | 12 / 5 | 0 |
| 50026200 | 50 / 10 | 12 / 3 | 0 |
| 57742121 | 90 / 10 | 34 / 10 | 0 |
| 50076777 | 47 / 10 | 36 / 0 | 25 |

Remaining uncertainties:

- All 25 EPOS course rows defer deadlines to course websites; those websites have not been fetched in this capture.
- Qualitative academic standards remain text; no numeric GPA is inferred.
- Egypt is country of residence/application, not citizenship or an individual eligibility verdict.
- Month-only selection/funding dates have no invented day; relative opening/document deadlines have no invented date.
- Generic Master Studies information is retained, but Egypt is absent from its authoritative form country list.
- All deterministic conditions and document applicability still require editorial review.

## Executed verification

Saved-artifact checks: 60 passed. These check actual response hashes and country/status results without making new requests or database writes.

- offline: 99 tests, 0 failures, 0 errors, 0 skipped.
- live: 1 tests, 0 failures, 0 errors, 0 skipped.
