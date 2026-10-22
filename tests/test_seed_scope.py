"""Check API-compatible seed scopes and the shared evaluation scenarios."""

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from backend.rules import evaluate
from backend.schemas import CertificateResponse, LabelExtraction, Verdict
from backend.seed import SeedData

SEED_PATH = Path(__file__).parents[1] / "src" / "seed" / "seed.json"


def test_seed_certificates_follow_api_schema() -> None:
    seed = SeedData.model_validate_json(SEED_PATH.read_text())
    for certificate in seed.certificates:
        parsed = CertificateResponse.model_validate(
            certificate.model_dump(exclude={"image_file"})
        )
        assert parsed.scope
        assert all(item.brand for item in parsed.scope)


@pytest.mark.parametrize(
    ("case_id", "expected", "first_failure"),
    [
        ("L01", "covered", None),
        ("L02", "substitution", "R2"),
        ("L03", "substitution", "R2"),
        ("L04", "needs_human", "R1"),
        ("L05", "needs_human", "R1"),
        ("L06", "not_covered", "R4"),
        ("L07", "not_covered", "R3"),
        ("L08", "expiring", None),
    ],
)
def test_seed_evaluation_cases(
    case_id: str, expected: Verdict, first_failure: str | None
) -> None:
    seed = json.loads(SEED_PATH.read_text())
    material_id, certificate_id = (1, 1) if case_id == "L08" else (6, 3)
    material = next(
        item for item in seed["materials"] if item["id"] == material_id
    )
    certificate = deepcopy(
        next(
            item
            for item in seed["certificates"]
            if item["id"] == certificate_id
        )
    )
    label: dict[str, Any] = {
        "product_name": material["name"],
        "brand": material["approved_brand"],
        "manufacturer": material["approved_manufacturer"],
        "halal_mark_present": True,
    }
    if case_id == "L02":
        label["brand"] = "ALT SAMPLE BRAND"
    elif case_id == "L03":
        label["manufacturer"] = "ALT SAMPLE MAKER"
    elif case_id == "L04":
        label = dict.fromkeys(label)
    elif case_id == "L05":
        label["manufacturer"] = None
    elif case_id == "L06":
        certificate["expiry_date"] = "2026-10-20"
    elif case_id == "L07":
        certificate["scope"] = [
            item
            for item in certificate["scope"]
            if item["product_name"] != "Cocoa Powder"
        ]
    result = evaluate(label, material, certificate, "2026-10-21")
    assert result["verdict"] == expected
    assert (
        next(
            (
                item["rule"]
                for item in result["rule_results"]
                if item["passed"] is False
            ),
            None,
        )
        == first_failure
    )
    # First-failure priority remains R2 even when the brand also fails R3.
    if case_id == "L02":
        assert result["rule_results"][2]["passed"] is False
    elif case_id == "L03":
        assert result["rule_results"][2]["passed"] is True


@pytest.mark.parametrize("manufacturer", ["Silver Valley Foods", None])
def test_extractor_model_matches_dictionary_input(
    manufacturer: str | None,
) -> None:
    seed = json.loads(SEED_PATH.read_text())
    material = next(item for item in seed["materials"] if item["id"] == 6)
    certificate = next(
        item for item in seed["certificates"] if item["id"] == 3
    )
    label = LabelExtraction(
        product_name="Cocoa Powder",
        brand="SilverCocoa",
        manufacturer=manufacturer,
        halal_mark_present=True,
    )
    result = evaluate(label, material, certificate, "2026-10-21")
    assert result == evaluate(
        label.model_dump(), material, certificate, "2026-10-21"
    )
    assert result["verdict"] == ("covered" if manufacturer else "needs_human")


def test_every_material_matches_its_active_certificate_scope() -> None:
    seed = json.loads(SEED_PATH.read_text())
    for material in seed["materials"]:
        certificate = next(
            item
            for item in seed["certificates"]
            if item["supplier_id"] == material["supplier_id"]
            and item["status"] == "active"
        )
        result = evaluate(
            {
                "product_name": material["name"],
                "brand": material["approved_brand"],
                "manufacturer": material["approved_manufacturer"],
                "halal_mark_present": True,
            },
            material,
            certificate,
            "2026-10-21",
        )
        assert result["rule_results"][2]["passed"] is True


@pytest.mark.parametrize(
    ("scope", "matches"),
    [
        ([{"product_name": " cocoa   powder ", "brand": None}], True),
        ([{"product_name": "Cocoa Powder"}], True),
        ([{"product_name": "Cocoa Powder", "brand": " silvercocoa "}], True),
        ([{"product_name": "Cocoa Powder", "brand": "Other Brand"}], False),
        ([{"product_name": "Other Product", "brand": None}], False),
        ('[{"product_name":"Cocoa Powder","brand":null}]', True),
        (["Cocoa Powder"], True),
        ('["Cocoa Powder"]', True),
        ([{"product_name": "Cocoa Powder", "brand": 42}], False),
        ([{"product_name": "Cocoa Powder", "brand": ""}], False),
        ([{"product_name": ""}], False),
        ("not JSON", False),
    ],
)
def test_scope_brand_restrictions(scope: object, matches: bool) -> None:
    result = evaluate(
        {
            "product_name": "Cocoa Powder",
            "brand": "SilverCocoa",
            "manufacturer": "Silver Valley Foods",
            "halal_mark_present": True,
        },
        {
            "approved_brand": "SilverCocoa",
            "approved_manufacturer": "Silver Valley Foods",
        },
        {
            "scope": scope,
            "expiry_date": "2027-09-30",
            "issuer": "SAMPLE Food Certification Council",
        },
        "2026-10-21",
    )
    assert result["rule_results"][2]["passed"] is matches
    assert result["verdict"] == ("covered" if matches else "not_covered")
