from types import SimpleNamespace
from app.scraping.core.html_parser import application_form, selection_confirmed
from app.scraping.core.normalizer import aggregate_egypt
from app.scraping.schemas.scholarship import Variant
from app.scraping.sources.daad import DaadAdapter

URL = "https://www2.daad.de/x?detail=57135743"


def test_country_and_status_use_semantics_not_misleading_ids(form_html):
    form = application_form(form_html, URL)
    assert form["countries"][0] == {"value": "2", "label": "Egypt"}
    assert form["statuses"][0] == {"value": "3", "label": "Graduates"}
    assert form["action"].endswith("?detail=57135743&cd=1")
    assert "living" in form["country_semantics"]


def test_confirm_selected_country_status_and_identity(selected_html):
    assert selection_confirmed(selected_html, "57135743", "2", "3")
    assert not selection_confirmed(selected_html, "57135743", "4", "3")
    assert not selection_confirmed(selected_html, "57135744", "2", "3")


def test_remaining_form_is_not_success(selected_html, form_html):
    assert not selection_confirmed(selected_html + form_html, "57135743", "2", "3")


def test_country_procedure_retrieval(form_html, selected_html):
    calls = []
    def fetch(url, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=selected_html, url=URL)
    adapter = DaadAdapter(SimpleNamespace(fetch=fetch), browser_fallback=False)
    form = application_form(form_html, URL)
    variant, blocks, _ = adapter._retrieve_variant(form, form["statuses"][0], form_html, "57135743", URL)
    assert variant.selection_confirmed and variant.application_procedure_loaded
    assert variant.eligibility_classification == "supported_for_egypt"
    assert calls[0]["data"]["origin"] == "2" and calls[0]["data"]["ref"] == "prozess"
    assert variant.required_documents and variant.deadlines


def test_missing_egypt_authoritative_exclusion(form_html):
    html = form_html.replace('<option value="2">Egypt</option>', '')
    form = application_form(html, URL)
    variant, _, _ = DaadAdapter(None)._retrieve_variant(form, form["statuses"][0], html, "57135743", URL)
    assert variant.eligibility_classification == "unsupported_for_egypt"


def test_empty_country_list_needs_verification(form_html):
    form = application_form(form_html, URL)
    form["countries"] = []
    variant, _, _ = DaadAdapter(None)._retrieve_variant(form, form["statuses"][0], form_html, "57135743", URL)
    assert variant.eligibility_classification == "needs_verification" and variant.egypt_selectable is None


def test_failed_submission_remains_failed(form_html):
    def fetch(*args, **kwargs):
        raise OSError("offline network failure")
    adapter = DaadAdapter(SimpleNamespace(fetch=fetch), browser_fallback=False)
    form = application_form(form_html, URL)
    variant, blocks, _ = adapter._retrieve_variant(form, form["statuses"][0], form_html, "57135743", URL)
    assert variant.extraction_status == "failed" and variant.eligibility_classification == "needs_verification"
    assert "offline network failure" in variant.error and blocks == []


def test_mixed_variants_do_not_imply_exclusion():
    def variant(state):
        return Variant(applicant_status="test", applicant_status_value="3", eligibility_classification=state)
    assert aggregate_egypt([variant("unsupported_for_egypt"), variant("needs_verification")]) == "needs_verification"
    assert aggregate_egypt([variant("unsupported_for_egypt")]) == "unsupported_for_egypt"
