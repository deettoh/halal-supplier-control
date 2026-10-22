"""Regression checks for rule evaluation and recognized demo issuers."""

from datetime import date, timedelta

import pytest

from backend.rules import evaluate
from backend.schemas import Verdict

LABEL = {
    "product_name": "Wheat Flour",
    "brand": "GoldenMill",
    "manufacturer": "Golden Grain Foods",
    "halal_mark_present": True,
}
MATERIAL = {
    "approved_brand": "GoldenMill",
    "approved_manufacturer": "Golden Grain Foods",
}
TODAY = date(2026, 10, 22)


@pytest.mark.parametrize(
    ("days_remaining", "expected"),
    [(-1, "not_covered"), (0, "expiring"), (60, "expiring"), (61, "covered")],
)
def test_expiry_boundaries(days_remaining: int, expected: Verdict) -> None:
    result = evaluate(
        LABEL,
        MATERIAL,
        {
            "scope": ["Wheat Flour"],
            "expiry_date": TODAY + timedelta(days=days_remaining),
            "issuer": "SAMPLE Food Certification Council",
        },
        TODAY,
    )
    assert result["verdict"] == expected
    assert [check["rule"] for check in result["rule_results"]] == [
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
    ]
    assert result["rule_results"][4]["passed"] is True


@pytest.mark.parametrize("label", [None, "not JSON", "[]", {}, {"brand": 42}])
def test_invalid_label_needs_human_review(label: object) -> None:
    result = evaluate(label, MATERIAL, None, TODAY.isoformat())
    assert result["verdict"] == "needs_human"
    assert [check["passed"] for check in result["rule_results"][:3]] == [
        False,
        None,
        None,
    ]


def test_unknown_issuer_is_not_covered() -> None:
    result = evaluate(
        LABEL,
        MATERIAL,
        {
            "scope": '["Wheat Flour"]',
            "expiry_date": "2027-12-31",
            "issuer": "Unknown SAMPLE issuer",
        },
        TODAY,
    )
    assert result["verdict"] == "not_covered"
    assert result["rule_results"][4]["passed"] is False


def test_invalid_evaluation_date_is_rejected() -> None:
    with pytest.raises(ValueError, match="today must be a valid ISO date"):
        evaluate(LABEL, MATERIAL, None, "invalid")


@pytest.mark.parametrize(
    "scope",
    [
        ["Wheat Flour"],
        [{"product_name": "Wheat Flour", "brand": None}],
        '[{"product_name":"Wheat Flour","brand":null}]',
    ],
)
def test_scope_formats_share_product_matching(scope: object) -> None:
    result = evaluate(
        LABEL,
        MATERIAL,
        {
            "scope": scope,
            "expiry_date": "2027-12-31",
            "issuer": "SAMPLE Food Certification Council",
        },
        TODAY,
    )
    assert result["verdict"] == "covered"
    assert result["rule_results"][2]["passed"] is True
