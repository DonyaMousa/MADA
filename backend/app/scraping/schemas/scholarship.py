from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .requirements import Requirement, RequiredDocument

EgyptStatus = Literal["supported_for_egypt", "unsupported_for_egypt", "needs_verification"]


class Block(BaseModel):
    section: str
    heading_path: list[str]
    kind: str
    text: str
    source_url: str
    order: int


class Evidence(BaseModel):
    url: str
    method: str
    retrieved_at: datetime
    status_code: int
    sha256: str
    local_path: str
    request_data: dict[str, str] | None = None
    content_type: str | None = None


class Deadline(BaseModel):
    original_text: str
    date: str | None = None
    deadline_at: datetime | None = None
    timezone: str | None = None
    kind: Literal["application", "supporting_documents", "portfolio", "opening", "intake", "selection", "scholarship_start", "other"] = "application"
    certainty: Literal["confirmed", "typical_cycle", "unknown"] = "unknown"
    source_url: str
    source_section: str
    applicant_status: str | None = None
    year_explicit: bool = False
    requires_human_review: bool = True
    date_precision: Literal["day", "month", "yearless", "relative", "time_only"] | None = None
    year_month: str | None = None
    relative_constraint: str | None = None
    evidence_references: list[dict[str, str]] = Field(default_factory=list)


class Variant(BaseModel):
    applicant_status: str
    applicant_status_value: str
    selected_country: str | None = None
    selected_country_value: str | None = None
    egypt_selectable: bool | None = None
    country_semantics: str = "country of residence and application; not citizenship"
    country_options: list[dict[str, str]] = Field(default_factory=list)
    status_options: list[dict[str, str]] = Field(default_factory=list)
    selection_confirmed: bool = False
    eligibility_classification: EgyptStatus = "needs_verification"
    application_procedure_loaded: bool = False
    application_procedure: str | None = None
    application_status: Literal["open", "closed", "upcoming", "unknown"] = "unknown"
    application_status_evidence: str | None = None
    deadlines: list[Deadline] = Field(default_factory=list)
    required_documents: list[RequiredDocument] = Field(default_factory=list)
    evidence_urls: list[str] = Field(default_factory=list)
    extraction_status: Literal["complete", "partial", "failed"] = "failed"
    interaction_method: str = "http_form"
    error: str | None = None


class Scholarship(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: str = "mada.daad.v1"
    extractor_version: str = "mada-deterministic-0.2.0"
    is_umbrella_programme: bool = False
    courses: list[dict] = Field(default_factory=list)
    daad_program_id: str
    title: str | None = None
    provider: str | None = None
    scholarship_category: str | None = None
    description: str | None = None
    destination_countries: list[str] = Field(default_factory=list)
    supported_degrees: list[str] = Field(default_factory=list)
    fields_of_study: list[str] = Field(default_factory=list)
    eligible_academic_disciplines: list[str] = Field(default_factory=list)
    official_program_url: str
    official_application_url: str | None = None
    application_portals: list[str] = Field(default_factory=list)
    program_objectives: list[str] = Field(default_factory=list)
    academic_eligibility: dict = Field(default_factory=dict)
    nationality_and_residence: dict = Field(default_factory=dict)
    languages: dict = Field(default_factory=dict)
    work_and_research_experience: dict = Field(default_factory=dict)
    funding: dict = Field(default_factory=dict)
    application_process: list[Block] = Field(default_factory=list)
    raw_sections: list[Block] = Field(default_factory=list)
    raw_requirements: list[Block] = Field(default_factory=list)
    structured_requirements: list[Requirement] = Field(default_factory=list)
    selection_criteria: list[Requirement] = Field(default_factory=list)
    required_documents: list[RequiredDocument] = Field(default_factory=list)
    conditional_requirements: list[Requirement] = Field(default_factory=list)
    unresolved_requirements: list[Requirement] = Field(default_factory=list)
    applicant_status_variants: list[Variant] = Field(default_factory=list)
    egypt_support_status: EgyptStatus = "needs_verification"
    deadlines: list[Deadline] = Field(default_factory=list)
    application_status: Literal["open", "closed", "upcoming", "unknown"] = "unknown"
    application_status_evidence: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    linked_pages: list[dict] = Field(default_factory=list)
    retrieval_timestamp: datetime
    extraction_quality: Literal["complete", "partial", "failed"] = "failed"
    verification_state: Literal["draft", "in_review", "verified", "needs_review", "archived"] = "needs_review"
    issues: list[str] = Field(default_factory=list)
