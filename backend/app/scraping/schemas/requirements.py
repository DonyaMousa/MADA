from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class Requirement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requirement_id: str
    category: str
    original_text: str
    normalized_meaning: str
    rule_type: Literal["numeric", "categorical", "qualitative", "conditional", "descriptive"]
    requirement_strength: Literal["mandatory", "preferred", "conditional", "informational", "uncertain"]
    operator: str | None = None
    value: Any = None
    unit: str | None = None
    conditions: list[str] = Field(default_factory=list)
    exceptions: list[str] = Field(default_factory=list)
    obligation: Literal["mandatory", "preferred", "informational", "uncertain"] = "uncertain"
    evidence_references: list[dict[str, str]] = Field(default_factory=list)
    applies_to_applicant_status: str | None = None
    country_of_application: str | None = None
    source_url: str
    source_section: str
    evidence_excerpt: str
    extraction_method: str = "deterministic_rules_v1"
    interpretation_confidence: float = Field(ge=0, le=1)
    requires_human_review: bool = True


class RequiredDocument(BaseModel):
    name: str
    document_type: str
    mandatory: bool | None = None
    conditions: list[str] = Field(default_factory=list)
    submission_stage: str | None = None
    required_format: str | None = None
    translation_requirements: str | None = None
    certification_requirements: str | None = None
    number_of_references: int | None = None
    instructions: str
    applicant_status: str | None = None
    evidence_url: str
    source_section: str
    requires_human_review: bool = True
    evidence_references: list[dict[str, str]] = Field(default_factory=list)
