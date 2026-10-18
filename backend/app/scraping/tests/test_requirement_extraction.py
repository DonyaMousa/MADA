from pydantic import ValidationError
import pytest
from app.scraping.core.html_parser import parse_sections
from app.scraping.core.requirement_extractor import classify, extract_requirements, extract_documents


def test_qualitative_academic_criteria_do_not_invent_gpa(block):
    r, _ = classify(block("Applicants should demonstrate above-average academic achievements."))
    assert r.rule_type == "qualitative" and r.value is None and r.unit is None
    assert r.requires_human_review and "above-average" in r.original_text


def test_explicit_numeric_gpa(block):
    r, _ = classify(block("A minimum GPA of at least 3.0 out of 4.0 is required."))
    assert r.value == {"minimum": 3.0, "scale": 4.0} and r.operator == ">="


def test_preferred_experience_not_mandatory(block):
    r, _ = classify(block("Relevant professional experience is desirable."))
    assert r.requirement_strength == "preferred"


def test_qualitative_language_keeps_unknown_score(block):
    r, _ = classify(block("Good knowledge of German is required."))
    assert r.rule_type == "qualitative" and r.value is None and r.requirement_strength == "mandatory"


def test_conditional_language(block):
    r, _ = classify(block("If the language of instruction is German, a B2 certificate is required."))
    assert r.requirement_strength == "conditional" and r.value == ["B2"] and r.conditions


def test_explicit_ielts_score(block):
    r, _ = classify(block("IELTS with a minimum score of 6.5 is required."))
    assert r.value == [{"test": "IELTS", "score": 6.5}]


def test_six_years_preserves_reference_date(block):
    text = "As a rule, your university degree should not date back more than 6 years at the time of the application deadline."
    r, _ = classify(block(text))
    assert r.value == 6 and r.unit == "year" and r.operator == "<="
    assert r.exceptions and "application deadline" in r.original_text


def test_selection_is_separate_from_hard_rules(block):
    result = extract_requirements([block("Excellent academic achievements are taken into account.", "Overview", "Selection")])
    assert len(result["selection_criteria"]) == 1 and result["structured_requirements"] == []


def test_inline_formatting_does_not_split_negative_sentence():
    blocks = parse_sections('<div id="ueberblick"><h3>Value</h3>The DAAD does <strong>not</strong> cover tuition fees.<br></div>', "https://www2.daad.de/fixture")
    assert [b.text for b in blocks] == ["The DAAD does not cover tuition fees."]


def test_headings_lists_tables_and_notes():
    html = '<div id="voraussetzungen"><h3>Language skills</h3><p>English is required.</p><ul><li>German is preferred.</li></ul><table><tr><td>IELTS</td><td>6.5</td></tr></table>Note: exceptions apply.</div>'
    blocks = parse_sections(html, "https://www2.daad.de/fixture")
    assert any(b.kind == "tr" and "IELTS 6.5" in b.text for b in blocks)
    assert all("Language skills" in b.heading_path for b in blocks)
    assert any("Note:" in b.text for b in blocks)


def test_required_and_conditional_documents(selected_html):
    docs = extract_documents(parse_sections(selected_html, "https://www2.daad.de/fixture"))
    cv = next(d for d in docs if d.document_type == "curriculum_vitae")
    admission = next(d for d in docs if d.document_type == "admission_letter")
    assert cv.mandatory is True and admission.mandatory is None and admission.conditions


def test_unknown_numeric_fields_stay_null(block):
    r, _ = classify(block("Applicants should have a relevant academic background."))
    assert r.value is None and r.operator is None


def test_compound_qualitative_academic_and_numeric_experience(block):
    result = extract_requirements([block("Applicants must have above-average academic results and at least two years of related professional experience after the first degree.")])
    academic = next(r for r in result["structured_requirements"] if r.category == "academic_performance")
    experience = next(r for r in result["structured_requirements"] if r.category == "professional_experience")
    assert academic.value is None and experience.value == 2 and experience.operator == ">="


def test_model_rejects_invalid_json_rule(block):
    r, _ = classify(block("Good knowledge of German is required."))
    data = r.model_dump(); data["rule_type"] = "invented"
    with pytest.raises(ValidationError):
        type(r).model_validate(data)
