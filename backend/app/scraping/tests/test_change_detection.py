from copy import deepcopy
from app.scraping.core.change_detector import compare_snapshots


def test_deadline_change_retains_evidence():
    old = {"official_program_url": "https://www2.daad.de/test", "deadlines": [{"date": "2026-09-24"}], "evidence": ["old"]}
    new = {**old, "deadlines": [{"date": "2026-09-25"}], "evidence": ["new"]}
    changes = compare_snapshots(old, new)
    assert len(changes) == 1 and changes[0]["old_evidence"] == ["old"] and changes[0]["new_evidence"] == ["new"]


def test_layout_whitespace_not_semantic_change():
    old = {"official_program_url": "https://www2.daad.de/test", "academic_eligibility": {"normalized_meaning": "Excellent academic performance"}}
    new = {**old, "academic_eligibility": {"normalized_meaning": "Excellent  academic\nperformance"}}
    assert compare_snapshots(old, new) == []


def test_retrieval_metadata_not_change():
    old = {"official_program_url": "https://www2.daad.de/test", "funding": {"amount": 992, "source_url": "old"}}
    new = {**old, "funding": {"amount": 992, "source_url": "new"}}
    assert compare_snapshots(old, new) == []


def test_qualitative_requirement_change_detected():
    old = {"official_program_url": "https://www2.daad.de/test", "academic_eligibility": {"requirements": [{"normalized_meaning": "Good academic performance"}]}}
    new = deepcopy(old); new["academic_eligibility"]["requirements"][0]["normalized_meaning"] = "Excellent academic performance"
    assert compare_snapshots(old, new)[0]["field_name"] == "academic_eligibility"


def test_extractor_upgrade_not_claimed_as_scholarship_change():
    old = {"official_program_url": "https://www2.daad.de/test", "extractor_version": "1", "funding": {"amount": 1.4}}
    new = {**old, "extractor_version": "2", "funding": {"amount": 1400}}
    assert compare_snapshots(old, new) == []
