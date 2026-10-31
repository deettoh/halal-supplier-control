"""Prepared UI examples must remain compatible with the real backend."""

import hashlib
import json
from pathlib import Path

from backend.rules import evaluate
from backend.schemas import (
    ActivityResponse,
    CertificateResponse,
    DeliveryResponse,
    MaterialResponse,
    RenewalDecisionRequest,
    RenewalResponse,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "src/frontend/src/lib/preview/data.json"


def test_prepared_examples_validate_and_keep_three_state_checks() -> None:
    data = json.loads(DATA.read_text())
    for snapshot in data["materials"].values():
        for rows in snapshot.values():
            for row in rows:
                MaterialResponse.model_validate(row)
    for rows in data["certificates"].values():
        for row in rows:
            CertificateResponse.model_validate(row)
    for records in data["deliveries"].values():
        for row in records:
            DeliveryResponse.model_validate(row)
    partial = next(c for c in data["cases"] if c["id"] == "partial")[
        "responses"
    ]["6"]
    assert [r["passed"] for r in partial["rule_results"]] == [
        False,
        None,
        None,
        True,
        True,
        None,
    ]
    assert partial["verdict"] == "needs_human"


def test_prepared_photos_and_rule_outputs_are_reproducible() -> None:
    data = json.loads(DATA.read_text())
    for case in data["cases"]:
        image = ROOT / "src/frontend/public" / case["image"].lstrip("/")
        assert hashlib.sha256(image.read_bytes()).hexdigest() == case["sha256"]
        for material_id, response in case["responses"].items():
            material = data["source_materials"][material_id]
            cert = data["source_certificates"][str(material["supplier_id"])]
            result = evaluate(case["extracted"], material, cert, data["date"])
            assert result["verdict"] == response["verdict"]
            assert result["rule_results"] == response["rule_results"]
            DeliveryResponse.model_validate(response)


def test_renewal_snapshots_cover_both_buyers_without_browser_rules() -> None:
    data = json.loads(DATA.read_text())
    assert len(data["materials"]["00"]["Sunrise Bakery SAMPLE"]) == 8
    assert len(data["materials"]["00"]["Crescent Caterer SAMPLE"]) == 8
    assert (
        sum(
            m["coverage_status"] == "expiring"
            for m in data["materials"]["00"]["Sunrise Bakery SAMPLE"]
        )
        == 5
    )
    for tenant in ["Sunrise Bakery SAMPLE", "Crescent Caterer SAMPLE"]:
        assert all(
            m["coverage_status"] == "covered"
            for m in data["materials"]["10"][tenant]
        )
    for activity in data["initial_activity"]["Sunrise Bakery SAMPLE"]:
        # Named log enrichment is the explicitly labelled v0.2 preview target;
        # validate its existing fields against today's strict backend model.
        target_fields = {
            "actor_title",
            "material_name",
            "verdict",
            "supplier_name",
        }
        assert (
            set(activity) <= set(ActivityResponse.model_fields) | target_fields
        )
        ActivityResponse.model_validate(
            {
                k: v
                for k, v in activity.items()
                if k in ActivityResponse.model_fields
            }
        )


def test_every_prepared_delivery_uses_its_registry_snapshot() -> None:
    data = json.loads(DATA.read_text())
    for case in data["cases"]:
        for bits, responses in case["responses_by_renewal"].items():
            for material_id, response in responses.items():
                material = data["source_materials"][material_id]
                supplier_id = str(material["supplier_id"])
                cert = (
                    data["renewals"][supplier_id]
                    if bits[int(supplier_id) - 1] == "1"
                    else data["source_certificates"][supplier_id]
                )
                result = evaluate(
                    case["extracted"], material, cert, data["date"]
                )
                assert response["verdict"] == result["verdict"]
                assert response["rule_results"] == result["rule_results"]
                DeliveryResponse.model_validate(response)


def test_registry_review_examples_follow_the_backend_contract() -> None:
    examples = json.loads(DATA.with_name("renewal-review.json").read_text())
    for entry in examples["pending_queue"]:
        RenewalResponse.model_validate(entry)
    RenewalDecisionRequest.model_validate(examples["verify_request"])
    for name in ("verified_certificate", "rejected_certificate"):
        CertificateResponse.model_validate(examples[name])


def test_preview_people_and_suppliers_come_from_canonical_seed() -> None:
    data = json.loads(DATA.read_text())
    seed = json.loads((ROOT / "src/seed/seed.json").read_text())
    assert data["people"] == seed["people"]
    assert data["suppliers"] == seed["suppliers"]
    assert (
        data["initial_activity"]["Sunrise Bakery SAMPLE"][0]["actor"] == "Aina"
    )
