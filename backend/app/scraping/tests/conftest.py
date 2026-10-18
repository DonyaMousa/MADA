from pathlib import Path
import pytest
from app.scraping.schemas.scholarship import Block, Scholarship
from app.scraping.storage.json_repository import utcnow

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def form_html():
    return (FIXTURES / "form.html").read_text(encoding="utf-8")


@pytest.fixture
def selected_html():
    return (FIXTURES / "selected.html").read_text(encoding="utf-8")


@pytest.fixture
def block():
    def make(text, section="Application requirements", heading="What requirements must be met?"):
        return Block(section=section, heading_path=[section, heading], kind="li", text=text,
            source_url="https://www2.daad.de/fixture#voraussetzungen", order=0)
    return make


@pytest.fixture
def record():
    return Scholarship(daad_program_id="57135743", title="Fixture Music", provider="DAAD",
        official_program_url="https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57135743",
        retrieval_timestamp=utcnow(), extraction_quality="partial", funding={"funding_type": "unknown"})
