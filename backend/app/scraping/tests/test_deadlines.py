from app.scraping.core.normalizer import parse_deadlines, application_status, extract_funding


def test_multiple_deadlines_preserved(block):
    rows = [block("24.09.2026", "Application Procedure", "Application deadline"),
        block("30.09.2026", "Application Procedure", "Application deadline")]
    assert [d.date for d in parse_deadlines(rows)] == ["2026-09-24", "2026-09-30"]


def test_date_only_does_not_invent_time_zone(block):
    d = parse_deadlines([block("24.09.2026", "Application Procedure", "Application deadline")])[0]
    assert d.deadline_at is None and d.timezone is None


def test_cet_end_of_day_observes_dst(block):
    blocks = [block("24.09.2026", "Application Procedure", "Application deadline"),
        block("The portal closes at 24.00 hrs. (CET or CEST).", "Application Procedure", "Please note")]
    d = parse_deadlines(blocks)[0]
    assert d.deadline_at.isoformat() == "2026-09-25T00:00:00+02:00"


def test_yearless_deadline_not_promoted_to_current_cycle(block):
    d = parse_deadlines([block("Applications are due annually on 24 September.", "Application Procedure", "Application deadline")])[0]
    assert d.date is None and d.deadline_at is None and d.certainty == "typical_cycle"


def test_future_deadline_not_proof_of_open(block):
    assert application_status([block("24.09.2030", "Application Procedure", "Application deadline")])[0] == "unknown"


def test_explicit_closed_portal(block):
    assert application_status([block("Currently you cannot apply for this programme.", "Submitting an application", "General information")])[0] == "closed"


def test_funding_exclusion_not_full_funding(block):
    funding = extract_funding([block("A monthly payment of 992 euros", "Overview", "Value"),
        block("The DAAD does not cover tuition fees.", "Overview", "Value")])
    assert funding["funding_type"] == "partial" and funding["tuition_coverage"] is False


def test_thousands_and_multiple_stipend_variants(block):
    funding = extract_funding([block("Depending on academic level, monthly payments of 992 euros for graduates or 1,300 euros (1,400 euros beginning with February 2026) for doctoral candidates", "Overview", "Value"),
        block("monthly scholarship payments of 1.400 euros", "Overview", "Value")])
    assert [x["amount"] for x in funding["monthly_stipends"]] == [992, 1300, 1400, 1400]
