import pymupdf
import pytest
from app.scraping.core.pdf_parser import parse_pdf


def test_pdf_page_text_and_evidence():
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((50, 50), "Application deadline: 24.09.2026")
        data = pdf.tobytes()
    blocks = parse_pdf(data, "https://static.daad.de/fixture.pdf")
    assert blocks and blocks[0].source_url.endswith("#page=1")
    assert "24.09.2026" in blocks[0].text


def test_pdf_page_limit():
    with pymupdf.open() as pdf:
        for i in range(3):
            pdf.new_page().insert_text((50, 50), f"Page {i}")
        data = pdf.tobytes()
    assert len(parse_pdf(data, "https://static.daad.de/fixture.pdf", max_pages=1)) == 1


def test_pdf_signature_validation():
    with pytest.raises(ValueError, match="signature"):
        parse_pdf(b"<html>not a PDF</html>", "https://static.daad.de/fixture.pdf")
