import json
from datetime import date, datetime
from rapidfuzz import fuzz

# Fictional issuer used only for the hackathon demo.
RECOGNISED_ISSUERS = {
    "SAMPLE Food Certification Council"
}

MATCH_THRESHOLD = 90
EXPIRY_WARNING_DAYS = 60


def normalize(value):
    """Normalize text for comparisons."""
    if not isinstance(value, str):
        return ""
    return " ".join(value.casefold().split())


def parse_date(value):
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


def parse_scope(value):
    """Read the certificate's JSON-list scope."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return []

    if not isinstance(value, list):
        return []

    return [
        normalize(item)
        for item in value
        if isinstance(item, str)
    ]


def evaluate(label, material, certificate, today):
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

    if isinstance(label, str):
        try:
            label = json.loads(label)
        except (ValueError, TypeError):
            label = None

    today = parse_date(today)
    if today is None:
        raise ValueError("today must be a valid ISO date")

    material = material or {}
    certificate = certificate or {}

    checks = []

    def add(rule, passed, detail):
        checks.append({
            "rule": rule,
            "passed": passed,
            "detail": detail
        })

    # R1 - Required label fields and valid JSON
    required = ("product_name", "brand", "manufacturer")

    r1 = (
        isinstance(label, dict)
        and all(
            isinstance(label.get(field), str)
            and bool(label[field].strip())
            for field in required
        )
        and (
            label.get("halal_mark_present") is None
            or isinstance(label.get("halal_mark_present"), bool)
        )
    )

    add(
        "R1", r1,
        "Required label fields are readable and valid."
        if r1 else
        "Invalid or incomplete label extraction; human review required."
    )

    # R2 - Brand and manufacturer matching
    if r1:
        brand_score = fuzz.ratio(
            normalize(label["brand"]),
            normalize(material.get("approved_brand"))
        )
        manufacturer_score = fuzz.ratio(
            normalize(label["manufacturer"]),
            normalize(material.get("approved_manufacturer"))
        )

        r2 = (
            brand_score >= MATCH_THRESHOLD
            and manufacturer_score >= MATCH_THRESHOLD
        )

        add(
            "R2", r2,
            f"Brand score: {brand_score:.1f}; "
            f"manufacturer score: {manufacturer_score:.1f}. "
            f"Both must be >= {MATCH_THRESHOLD}."
        )
    else:
        r2 = None
        add("R2", None, "Not evaluated: label information incomplete.")

    # R3 - Product must appear in certificate scope
    scope = parse_scope(certificate.get("scope"))

    if r1:
        product = normalize(label["product_name"])
        r3 = product in scope
        add(
            "R3", r3,
            "Product is included in certificate scope."
            if r3 else
            "Product is not included in certificate scope."
        )
    else:
        r3 = None
        add("R3", None, "Not evaluated: product name unavailable.")

    # R4 - Certificate must not have expired
    expiry_date = parse_date(certificate.get("expiry_date"))

    r4 = expiry_date is not None and expiry_date >= today

    add(
        "R4", r4,
        f"Certificate expiry: {expiry_date.isoformat()}."
        if expiry_date else
        "Certificate expiry date is missing or invalid."
    )

    # R5 - Recognised certification issuer
    issuer = normalize(certificate.get("issuer"))
    r5 = issuer in RECOGNISED_ISSUERS

    add(
        "R5", r5,
        "Issuer is on the demo recognised list."
        if r5 else
        "Issuer is not on the demo recognised list."
    )

    # First failing rule determines the verdict.
    if not r1:
        verdict = "needs_human"
    elif not r2:
        verdict = "substitution"
    elif not r3:
        verdict = "not_covered"
    elif not r4:
        verdict = "not_covered"
    elif not r5:
        verdict = "not_covered"
    else:
        days_remaining = (expiry_date - today).days
        verdict = (
            "expiring"
            if days_remaining <= EXPIRY_WARNING_DAYS
            else "covered"
        )

    return {
        "verdict": verdict,
        "rule_results": checks
    }
