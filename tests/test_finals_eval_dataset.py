"""Integrity and contract checks for the human-reviewable finals dataset."""

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image
from pydantic import TypeAdapter

from backend import rules
from backend.schemas import DeliveryStatus, LabelExtraction, Verdict

ROOT = Path(__file__).resolve().parents[1]
FINALS = ROOT / "tests/eval/finals"


def document(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FINALS / name).read_text())
    return data


def test_final_targets_preserve_the_pre_generation_plan() -> None:
    final = document("expected_results.json")
    planned = document("expected_results.planned.json")
    assert (
        final["ground_truth_plan_sha256"]
        == hashlib.sha256(
            (FINALS / "expected_results.planned.json").read_bytes()
        ).hexdigest()
    )
    assert len(final["cases"]) == len(planned["cases"]) == 24
    for case, original in zip(final["cases"], planned["cases"], strict=True):
        # ef451fd: user revised four absent-mark targets after the first
        # experiment. Preserve the original plan and permit only this delta.
        if case["case_id"] in {"L25", "L26", "L27", "L28"}:
            original["proposed_expected_extraction"]["halal_mark_present"] = (
                None
            )
        for field in (
            "case_id",
            "proposed_expected_extraction",
            "proposed_expected_verdict",
            "proposed_expected_initial_status",
            "proposed_first_failing_rule",
            "evaluation_fixture",
        ):
            assert case[field] == original[field]
        LabelExtraction.model_validate(
            case["proposed_expected_extraction"], strict=True
        )
        TypeAdapter(Verdict).validate_python(case["proposed_expected_verdict"])
        TypeAdapter(DeliveryStatus).validate_python(
            case["proposed_expected_initial_status"]
        )
    assert final["member_5_approval"] in {"pending", "approved"}
    assert final["required_ruleset"] == "API contract v0.2"


def test_every_finals_image_is_present_and_hash_identified() -> None:
    data = document("expected_results.json")
    sources = {
        row["source_id"]: row
        for row in document("source_manifest.json")["sources"]
    }
    assert {c["case_id"] for c in data["cases"]} == {
        f"L{number:02d}" for number in range(9, 33)
    }
    assert len(sources) == 11
    assert len({c["packaging_family_id"] for c in data["cases"]}) == 8
    hashes = set()
    for case in data["cases"]:
        path = ROOT / case["image_path"]
        payload = path.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        assert digest == case["image_sha256"]
        assert len(payload) == case["image_bytes"]
        assert case["source_id"] in sources
        assert (
            case["packaging_family_id"]
            == sources[case["source_id"]]["packaging_family_id"]
        )
        with Image.open(path) as image:
            assert image.format == "PNG"
            assert list(image.size) == case["image_dimensions"]
            image.verify()
        hashes.add(digest)
    assert len(hashes) == 24


def test_finals_cover_requested_missing_and_hidden_fields() -> None:
    cases = document("expected_results.json")["cases"]
    assert Counter(c["scenario"] for c in cases) == {
        "normal": 8,
        "wrong_product": 4,
        "substitution": 4,
        "absent_mark": 4,
        "hidden_mark": 2,
        "hidden_text": 2,
    }
    hidden_text = []
    for case in cases:
        fields = case["proposed_expected_extraction"]
        kind = case["scenario"]
        if kind in {"absent_mark", "hidden_mark"}:
            assert all(
                fields[name]
                for name in ("product_name", "brand", "manufacturer")
            )
            assert fields["halal_mark_present"] is None
            assert case["proposed_expected_verdict"] == "needs_human"
            assert case["proposed_first_failing_rule"] == "R6"
        elif kind == "hidden_text":
            missing = [key for key, value in fields.items() if value is None]
            assert len(missing) == 1
            hidden_text.extend(missing)
            assert fields["halal_mark_present"] is True
            assert case["proposed_first_failing_rule"] == "R1"
        elif kind == "wrong_product":
            material = case["evaluation_fixture"]["material"]
            assert fields["product_name"] != material["name"]
            assert fields["brand"] == material["approved_brand"]
            assert fields["manufacturer"] == material["approved_manufacturer"]
            assert case["proposed_expected_verdict"] == "substitution"
            assert case["proposed_first_failing_rule"] == "R2"
    assert sorted(hidden_text) == ["manufacturer", "product_name"]


def test_finals_targets_match_production_rules() -> None:
    for case in document("expected_results.json")["cases"]:
        fixture = case["evaluation_fixture"]
        result = rules.evaluate(
            case["proposed_expected_extraction"],
            fixture["material"],
            fixture["certificate"],
            fixture["today"],
        )
        assert result["verdict"] == case["proposed_expected_verdict"]
        first = next(
            (
                r["rule"]
                for r in result["rule_results"]
                if r["passed"] is False
            ),
            None,
        )
        assert first == case["proposed_first_failing_rule"]
