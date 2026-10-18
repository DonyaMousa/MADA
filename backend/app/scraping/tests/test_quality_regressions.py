import json
from pathlib import Path
import pytest
from app.scraping.core.requirement_extractor import classify, extract_requirements, extract_documents
from app.scraping.core.normalizer import parse_deadlines
from app.scraping.core.courses import extract_epos_courses
from app.scraping.cli import ROOT


@pytest.mark.parametrize('text', [
    'Your application cannot be considered, if you have been resident in Germany for longer than 15 months at the application deadline.',
    'You have not resided in Germany for more than 15 months prior to the application deadline.'])
def test_residence_is_not_language(block, text):
    r, _ = classify(block(text))
    assert r.category == 'residence' and r.value == 15 and r.unit == 'month'


@pytest.mark.parametrize('text,heading', [
    ('List of grades and degree certificates must be uploaded.', 'Application documents'),
    ('A monthly payment of 992 euros is granted.', 'Value'),
    ('The DAAD does not cover tuition fees.', 'Value'),
    ('Please check if the following criteria are fulfilled:', 'What requirements must be met?'),
    ("Please note: Funding for a Master's degree programme that has already started in Germany cannot be granted.", 'What requirements must be met?')])
def test_documents_benefits_and_boilerplate_are_not_eligibility(block, text, heading):
    assert not extract_requirements([block(text, 'Application requirements', heading)])['structured_requirements']


def test_conditional_mandatory_preserves_both_dimensions(block):
    r, _ = classify(block('If the course is in German, a B1 certificate is required unless an exemption applies.'))
    assert r.obligation == 'mandatory' and r.conditions and r.exceptions


def test_duplicate_statements_merge_evidence(block):
    text = 'Applicants must have above-average academic performance.'
    result = extract_requirements([block(text, 'Application requirements', 'Eligibility'),
        block(text, 'Overview', 'Who can apply?')])
    assert len(result['structured_requirements']) == 1
    assert len(result['structured_requirements'][0].evidence_references) == 2


@pytest.mark.parametrize('text', [
    'The application deadlines are updated annually in the second quarter.',
    'Please read all information about the application deadline.',
    'Late or incomplete applications cannot be considered.',
    'Depending on the chosen course, please check its website.',
    'Applicants resident in Germany for longer than 15 months at the application deadline cannot be considered.'])
def test_non_timing_statements_do_not_become_deadlines(block, text):
    assert parse_deadlines([block(text, 'Application Procedure', 'Application deadline')]) == []


def test_two_events_in_one_paragraph(block):
    ds = parse_deadlines([block('Selection in January 2027 for funding starting from September 2027', 'Application Procedure', 'Application deadline')])
    assert [(d.kind, d.year_month) for d in ds] == [('selection','2027-01'), ('scholarship_start','2027-09')]
    assert all(d.date is None for d in ds)


def test_relative_opening_deduplicates_with_evidence(block):
    text = 'The access to the DAAD portal opens at least 6 weeks before the application deadline.'
    ds = parse_deadlines([block(text, 'Application Procedure', 'Deadline'), block(text, 'Submitting an application', 'Portal')])
    assert len(ds) == 1 and ds[0].kind == 'opening' and ds[0].date_precision == 'relative'
    assert ds[0].date is None and len(ds[0].evidence_references) == 2


def test_postdoc_rule_not_assigned_to_doctoral_scope(block):
    rows = [block('Postdocs: You should not have completed your doctorate more than 4 years before the application deadline.')]
    assert not extract_requirements(rows, 'Doctoral candidates/PhD students')['structured_requirements']
    assert len(extract_requirements(rows, 'Postdoctoral researchers')['structured_requirements']) == 1


def test_actual_epos_pdf_course_rows_and_embedded_links():
    baseline = json.loads((ROOT/'data/scraping/reports/daad_quality_baseline.json').read_text(encoding='utf-8'))
    epos = next(r for r in baseline if r['daad_program_id'] == '50076777')
    evidence = next(e for e in epos['evidence'] if 'daad_epos_deadlines.pdf' in e['url'])
    courses = extract_epos_courses(Path(evidence['local_path']).read_bytes(), evidence['url'])
    assert len(courses) == 25 and len({c['course_id'] for c in courses}) == 25
    assert all(c['institution'] and c['official_course_websites'] and c['application_deadline'] is None for c in courses)
    assert any(c['intake_condition'] for c in courses)
    assert any('Helwan' in c['institution'] for c in courses)


def test_publication_document_is_postdoctoral_and_not_academic_eligibility(block):
    text = 'list of your published publications (max. 10 pages); mandatory for postdocs)'
    rows = [block(text, 'Application Procedure', 'Application documents')]
    assert extract_documents(rows, 'Doctoral candidates/PhD students') == []
    doc = extract_documents(rows, 'Postdoctoral researchers')[0]
    assert doc.document_type == 'publication_list' and doc.mandatory is True
    assert not extract_requirements(rows)['structured_requirements']


def test_employment_certificate_does_not_become_optional_because_guarantee_is_preferred(block):
    text = "Certificate(s) of Employment showing at least two years of work experience and if possible, a guarantee of re-employment."
    doc = extract_documents([block(text, 'Application Procedure', 'Application documents')])[0]
    assert doc.mandatory is True and 'if possible' in doc.instructions


def test_motivation_not_conditional_on_upload_heading(block):
    docs = extract_documents([block('1. B) Documents to be uploaded to the DAAD portal:', 'Application Procedure', 'Application documents'),
        block('Letter of Motivation stating your reasons (1 - 3 pages).', 'Application Procedure', 'Application documents')])
    assert docs[0].document_type == 'motivation_letter' and docs[0].mandatory is True


def test_duplicate_document_preserves_references(block):
    text = 'A letter of motivation is required.'
    docs = extract_documents([block(text, 'Application Procedure', 'Application documents'),
        block(text, 'Submitting an application', 'Documents to upload')])
    assert len(docs) == 1 and len(docs[0].evidence_references) == 2


def test_funding_subconditions_stay_out_of_eligibility(block):
    rows = [block('A period outside Germany is only funded under the following conditions:'),
        block('- The study visit is essential for achievement of the scholarship objective,'),
        block('- the visit does not take place in the home country, and'),
        block('- it is no longer than a quarter of the scholarship period. Longer periods cannot be funded.')]
    assert not extract_requirements(rows)['structured_requirements']
