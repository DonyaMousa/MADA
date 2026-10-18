from typing import Protocol
from ..schemas.scholarship import Scholarship


class SourceAdapter(Protocol):
    def discover(self, max_pages: int): ...
    def scrape(self, candidate: dict) -> Scholarship: ...
