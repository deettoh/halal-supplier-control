import json
from collections.abc import Mapping
from datetime import date, datetime
from typing import TypedDict

from pydantic import ValidationError
from rapidfuzz import fuzz

from backend.schemas import (
    CertificateScopeItem,
    LabelExtraction,
    RuleName,
    Verdict,
)

# Fictional issuer used only for the hackathon demo.
RECOGNISED_ISSUERS = {"sample food certification council"}

MATCH_THRESHOLD = 90
EXPIRY_WARNING_DAYS = 60


class RuleCheck(TypedDict):
    rule: RuleName
    passed: bool | None
    detail: str


class Evaluation(TypedDict):
    verdict: Verdict
    rule_results: list[RuleCheck]


def normalize(value: object) -> str:
    """Normalize text for comparisons."""
    if not isinstance(value, str):
        return ""
    return " ".join(value.casefold().split())


def parse_date(value: object) -> date | None:
    """Accept ISO date strings, dates, and datetimes."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    return None


def parse_scope(value: object) -> list[CertificateScopeItem]:
    """Read API scope objects, accepting older string-list fixtures too."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return []

    if not isinstance(value, list):
        return []

    try:
        return [
            CertificateScopeItem.model_validate(
                {"product_name": item, "brand": None}
                if isinstance(item, str)
                else item
            )
            for item in value
        ]
    except ValidationError:
        return []


def evaluate(
    label: object,
    material: Mapping[str, object] | None,
    certificate: Mapping[str, object] | None,
    today: str | date,
) -> Evaluation:
    """
    Evaluate document coverage for one delivery.

    Returns:
        {
            "verdict": str,
            "rule_results": [
                {"rule": str, "passed": bool|None, "detail": str}
            ]
        }

    passed=None means a rule could not be evaluated.
    The first failed rule determines the verdict.
    """

    if isinstance(label, LabelExtraction):
        label = label.model_dump()
    elif isinstance(label, str):
        try:
            label = json.loads(label)
        except (ValueError, TypeError):
            label = None

    evaluation_date = parse_date(today)
    if evaluation_date is None:
        raise ValueError("today must be a valid ISO date")

    material = material or {}
    certificate = certificate or {}

    checks: list[RuleCheck] = []

    def add(rule: RuleName, passed: bool | None, detail: str) -> None:
        checks.append({"rule": rule, "passed": passed, "detail": detail})

    label_fields = label if isinstance(label, dict) else {}

    # R1 - Required label fields and valid JSON
    required = ("product_name", "brand", "manufacturer")

    r1 = (
        isinstance(label, dict)
        and all(
            isinstance(label_fields.get(field), str)
            and bool(label_fields[field].strip())
            for field in required
        )
        and (
            label_fields.get("halal_mark_present") is None
            or isinstance(label_fields.get("halal_mark_present"), bool)
        )
    )

    add(
        "R1",
        r1,
        "Required label fields are readable and valid."
        if r1
        else "Invalid or incomplete label extraction; human review required.",
    )

    # R2 - Brand and manufacturer matching
    if r1:
        brand_score = fuzz.ratio(
            normalize(label_fields["brand"]),
            normalize(material.get("approved_brand")),
        )
        manufacturer_score = fuzz.ratio(
            normalize(label_fields["manufacturer"]),
            normalize(material.get("approved_manufacturer")),
        )

        r2 = (
            brand_score >= MATCH_THRESHOLD
            and manufacturer_score >= MATCH_THRESHOLD
        )

        add(
            "R2",
            r2,
            f"Brand score: {brand_score:.1f}; "
            f"manufacturer score: {manufacturer_score:.1f}. "
            f"Both must be >= {MATCH_THRESHOLD}.",
        )
    else:
        r2 = None
        add("R2", None, "Not evaluated: label information incomplete.")

    # R3 - Match product and any explicit certificate brand restriction.
    scope = parse_scope(certificate.get("scope"))

    if r1:
        product = normalize(label_fields["product_name"])
        brand = normalize(label_fields["brand"])
        r3 = any(
            normalize(item.product_name) == product
            and (item.brand is None or normalize(item.brand) == brand)
            for item in scope
        )
        add(
            "R3",
            r3,
            "Product and any brand restriction match certificate scope."
            if r3
            else "Product or brand is not included in certificate scope.",
        )
    else:
        r3 = None
        add("R3", None, "Not evaluated: product name unavailable.")

    # R4 - Certificate must not have expired
    expiry_date = parse_date(certificate.get("expiry_date"))

    r4 = expiry_date is not None and expiry_date >= evaluation_date

    add(
        "R4",
        r4,
        f"Certificate expiry: {expiry_date.isoformat()}."
        if expiry_date
        else "Certificate expiry date is missing or invalid.",
    )

    # R5 - Recognised certification issuer
    issuer = normalize(certificate.get("issuer"))
    r5 = issuer in RECOGNISED_ISSUERS

    add(
        "R5",
        r5,
        "Issuer is on the demo recognised list."
        if r5
        else "Issuer is not on the demo recognised list.",
    )

    # First failing rule determines the verdict.
    verdict: Verdict
    if not r1:
        verdict = "needs_human"
    elif not r2:
        verdict = "substitution"
    elif not r3:
        verdict = "not_covered"
    elif not r4 or expiry_date is None:
        verdict = "not_covered"
    elif not r5:
        verdict = "not_covered"
    else:
        days_remaining = (expiry_date - evaluation_date).days
        verdict = (
            "expiring" if days_remaining <= EXPIRY_WARNING_DAYS else "covered"
        )

    return {"verdict": verdict, "rule_results": checks}
