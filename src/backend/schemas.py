"""Shared API contract. Routes in main.py expose these models through /docs.

Models describe wire data only: no database, rules, or model-server imports.
Nullable extraction fields are still required keys in the model output.
"""

from datetime import date
from typing import Annotated, Literal, get_args

from fastapi import UploadFile
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    Json,
    JsonValue,
    StringConstraints,
    model_validator,
)

NonEmptyText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1)
]
RecordId = Annotated[int, Field(gt=0)]
DemoRole = Literal["staff", "supervisor", "supplier", "reviewer"]
Coverage = Literal["covered", "expiring", "not_covered"]
Verdict = Literal[
    "covered", "expiring", "substitution", "not_covered", "needs_human"
]
DeliveryStatus = Literal[
    "auto_accepted", "pending_review", "accepted", "rejected"
]
CertificateStatus = Literal["active", "superseded", "pending", "rejected"]
ActivityAction = Literal[
    "auto_accepted",
    "pending_review",
    "accepted",
    "rejected",
    "certificate_renewed",
    "certificate_submitted",
    "certificate_rejected",
]
RuleName = Literal["R1", "R2", "R3", "R4", "R5", "R6"]
RULE_ORDER: tuple[RuleName, ...] = get_args(RuleName)
RULE_ORDER_ERROR = (
    f"rule_results must contain {RULE_ORDER[0]} to {RULE_ORDER[-1]} in order"
)


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LabelExtraction(APIModel):
    """Model output: all four keys required; unreadable values are null."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    product_name: str | None = Field(description="Product name on the label")
    brand: str | None = Field(description="Brand name on the label")
    manufacturer: str | None = Field(
        description="Manufacturer name on the label"
    )
    halal_mark_present: bool | None = Field(
        description="Presence of a halal mark on the label"
    )


class DemoContext(APIModel):
    """Parsed demo headers. This is simulated identity, not authentication."""

    role: DemoRole
    tenant: NonEmptyText = Field(
        description="SME identifier; for supplier role, the supplier ID"
    )


class NamedDemoContext(DemoContext):
    """Validated identity for certificate submissions and registry review."""

    person_id: RecordId
    name: NonEmptyText
    title: NonEmptyText


class DeliveryCreateRequest(APIModel):
    """multipart/form-data: material_id and image file."""

    material_id: RecordId
    image: UploadFile = Field(
        description="Delivered item's PNG or JPEG label photo"
    )


class DeliveryListQuery(APIModel):
    status: Literal["pending_review"] = "pending_review"


class DeliveryDecisionRequest(APIModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {"decision": "reject", "reason": "Delivered brand differs"}
            ]
        },
    )

    decision: Literal["accept", "reject"]
    reason: NonEmptyText = Field(description="Required for both decisions")


class RuleResult(APIModel):
    rule: RuleName
    passed: bool | None = Field(
        strict=True,
        description="true=pass, false=fail, null=not evaluated; explain why",
    )
    detail: NonEmptyText


class MaterialResponse(APIModel):
    id: RecordId
    name: NonEmptyText
    supplier_id: RecordId
    supplier_name: NonEmptyText
    approved_brand: NonEmptyText
    approved_manufacturer: NonEmptyText
    coverage_status: Coverage = Field(
        description="Computed from the supplier's active certificate"
    )
    certificate_expiry_date: date | None = Field(
        description="null if no active certificate exists"
    )


class DeliveryResponse(APIModel):
    id: RecordId
    material_id: RecordId
    image: NonEmptyText = Field(
        description="Image URL/path served with appropriate access checks"
    )
    extracted: LabelExtraction | None
    rule_results: Annotated[
        list[RuleResult],
        Field(min_length=len(RULE_ORDER), max_length=len(RULE_ORDER)),
    ]
    verdict: Verdict
    status: DeliveryStatus
    error: str | None = Field(
        description="Safe extraction error message, otherwise null"
    )
    decided_by: str | None
    reason: str | None
    created_at: AwareDatetime

    @model_validator(mode="after")
    def check_rule_order(self) -> "DeliveryResponse":
        if tuple(item.rule for item in self.rule_results) != RULE_ORDER:
            raise ValueError(RULE_ORDER_ERROR)
        return self


class CertificateScopeItem(APIModel):
    """One documented product; null brand means no brand restriction."""

    product_name: NonEmptyText
    brand: NonEmptyText | None = None


class CertificateCreateRequest(APIModel):
    """multipart fields; scope is a JSON-encoded list, not repeated fields."""

    issuer: NonEmptyText = Field(max_length=200)
    cert_no: NonEmptyText = Field(max_length=100)
    holder_name: NonEmptyText = Field(max_length=200)
    expiry_date: date
    scope: Json[Annotated[list[CertificateScopeItem], Field(min_length=1)]] = (
        Field(
            description="JSON text containing a nonempty array of scope items",
            examples=['[{"product_name":"Flour","brand":"SAMPLE Brand"}]'],
        )
    )
    image: UploadFile | None = Field(
        default=None,
        description="Optional certificate PNG or JPEG; stored as JPEG",
    )


class CertificateResponse(APIModel):
    id: RecordId
    supplier_id: RecordId
    issuer: NonEmptyText
    cert_no: NonEmptyText
    holder_name: NonEmptyText
    expiry_date: date
    scope: list[CertificateScopeItem]
    image: str | None
    status: CertificateStatus
    review_note: str | None = None
    reviewed_by: str | None = None


class RenewalResponse(APIModel):
    renewal: CertificateResponse
    current: CertificateResponse | None
    supplier_name: NonEmptyText


class RenewalDecisionRequest(APIModel):
    decision: Literal["verify", "reject"]
    note: NonEmptyText


class CertificateExtractRequest(APIModel):
    """Stretch endpoint: multipart certificate image upload."""

    image: UploadFile


class CertificateExtraction(APIModel):
    """Stretch model output; supplier checks/corrects before submitting."""

    issuer: str | None
    cert_no: str | None
    holder_name: str | None
    expiry_date: date | None
    scope: list[CertificateScopeItem] | None


class CertificateExtractResponse(APIModel):
    extracted: CertificateExtraction | None
    error: str | None


class ActivityResponse(APIModel):
    id: RecordId
    actor: NonEmptyText
    role: DemoRole
    action: ActivityAction = Field(
        description="Delivery status event or certificate submission/review"
    )
    delivery_id: RecordId | None
    reason: str | None
    created_at: AwareDatetime


class ErrorResponse(APIModel):
    detail: str


class ValidationIssue(BaseModel):
    """FastAPI's validation error shape, including optional error context."""

    loc: list[str | int]
    msg: str
    type: str
    input: JsonValue = None
    ctx: dict[str, JsonValue] | None = None


class ValidationErrorResponse(APIModel):
    detail: list[ValidationIssue]


class HealthResponse(APIModel):
    status: Literal["ok"] = "ok"
    contract_version: str = "0.1.0"
