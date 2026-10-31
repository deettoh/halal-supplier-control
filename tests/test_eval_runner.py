"""Exercise the saved-prediction evaluator through its CLI."""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

RUNNER = Path(__file__).parent / "eval" / "run_eval.py"
LABEL: dict[str, Any] = {
    "product_name": "Flour",
    "brand": "SAMPLE BRAND",
    "manufacturer": "SAMPLE MAKER",
    "halal_mark_present": True,
}


def case(case_id: str = "C01", /, **fields: Any) -> dict[str, Any]:
    return {
        "case_id": case_id,
        "proposed_expected_extraction": {**LABEL, **fields},
        "proposed_expected_verdict": "covered",
        "proposed_expected_initial_status": "auto_accepted",
    }


def run_cli(
    tmp_path: Path,
    cases: list[dict[str, Any]],
    rows: list[dict[str, Any]],
    *,
    mode: Any = "stub",
    output_is_input: bool = False,
    link_output_to: str | None = None,
) -> tuple[subprocess.CompletedProcess[str], dict[str, Any]]:
    expected = tmp_path / "expected.json"
    predictions = tmp_path / "predictions.json"
    output = expected if output_is_input else tmp_path / "report.json"
    expected.write_text(
        json.dumps({"member_5_approval": "pending", "cases": cases}),
        encoding="utf-8",
    )
    predictions.write_text(
        json.dumps({"mode": mode, "predictions": rows}), encoding="utf-8"
    )
    if link_output_to is not None:
        output.hardlink_to(
            expected if link_output_to == "expected" else predictions
        )
    result = subprocess.run(
        [
            sys.executable,
            str(RUNNER),
            "--expected",
            str(expected),
            "--predictions",
            str(predictions),
            "--output",
            str(output),
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    report: dict[str, Any] = (
        json.loads(output.read_text(encoding="utf-8"))
        if output.exists() and not output_is_input
        else {}
    )
    return result, report


def test_cli_scores_normalized_text_separately_from_literal_text(
    tmp_path: Path,
) -> None:
    # separate scores show how exact and normalized matching differ
    result, report = run_cli(
        tmp_path,
        [case()],
        [
            {
                "case_id": "C01",
                "extracted": {
                    **LABEL,
                    "brand": "  sample  brand ",
                    "manufacturer": "sample maker",
                },
            }
        ],
    )
    assert result.returncode == 0, result.stderr
    metrics = report["metrics"]
    assert metrics["text_literal_accuracy"]["correct"] == 1
    assert metrics["text_normalized_accuracy"]["correct"] == 3
    assert metrics["field_accuracy"] == {
        "correct": 4,
        "total": 4,
        "percent": 100.0,
    }
    assert report["mode"] == "stub"
    assert report["source"] == "saved_predictions"
    assert report["live_inference_verified"] is False
    assert report["dataset_approved"] is False


def test_missing_predictions_stay_in_denominators(tmp_path: Path) -> None:
    # dropping the absent C02 would inflate both accuracies
    result, report = run_cli(
        tmp_path,
        [case(), case("C02")],
        [
            {
                "case_id": "C01",
                "extracted": {
                    **LABEL,
                    "brand": "CHANGED BRAND",
                    "halal_mark_present": False,
                },
                "verdict": "needs_human",
                "status": "pending_review",
            }
        ],
    )
    assert result.returncode == 0, result.stderr
    assert report["metrics"]["field_accuracy"] == {
        "correct": 2,
        "total": 8,
        "percent": 25.0,
    }
    assert report["metrics"]["verdict_accuracy"]["total"] == 2
    assert report["metrics"]["verdict_accuracy"]["correct"] == 0
    assert report["metrics"]["schema_success"]["correct"] == 1
    assert report["counts"]["missing_predictions"] == 1
    assert "missing_prediction" in report["cases"][1]["issues"]


def test_null_abstention_does_not_inflate_visible_accuracy(
    tmp_path: Path,
) -> None:
    gold = {
        "product_name": None,
        "manufacturer": None,
        "halal_mark_present": None,
    }
    result, report = run_cli(
        tmp_path,
        [case(**gold), case("C02", **gold)],
        [
            {"case_id": "C01", "extracted": {**LABEL, **gold}},
            {
                "case_id": "C02",
                "extracted": {
                    **LABEL,
                    "manufacturer": None,
                    "product_name": "Guessed text",
                },
            },
        ],
    )
    assert result.returncode == 0, result.stderr
    assert report["metrics"]["field_accuracy"]["total"] == 2
    assert report["metrics"]["unreadable_abstention"] == {
        "correct": 4,
        "total": 6,
        "percent": 66.67,
    }
    assert report["counts"]["unreadable_guesses"] == 2
    assert (
        report["metrics"]["whole_readable_label_accuracy"]["percent"] is None
    )


@pytest.mark.parametrize("invalid", ["wrong_type", "missing_key"])
def test_invalid_extractions_cannot_earn_field_credit(
    tmp_path: Path, invalid: str
) -> None:
    label = dict(LABEL)
    if invalid == "wrong_type":
        label["halal_mark_present"] = "true"
    else:
        del label["manufacturer"]
    result, report = run_cli(
        tmp_path, [case()], [{"case_id": "C01", "extracted": label}]
    )
    assert result.returncode == 0, result.stderr
    assert report["metrics"]["schema_success"]["correct"] == 0
    assert report["metrics"]["field_accuracy"]["correct"] == 0
    assert report["metrics"]["field_accuracy"]["total"] == 4


def test_errors_are_counted_without_copying_raw_error_text(
    tmp_path: Path,
) -> None:
    secret = "do-not-copy-this-example-credential"
    result, report = run_cli(
        tmp_path,
        [case()],
        [{"case_id": "C01", "extracted": LABEL, "error": secret}],
    )
    assert result.returncode == 0, result.stderr
    assert report["counts"]["upstream_errors"] == 1
    assert report["metrics"]["field_accuracy"]["correct"] == 0
    assert secret not in json.dumps(report) + result.stdout + result.stderr


def test_absent_verdicts_are_unavailable_not_fabricated(
    tmp_path: Path,
) -> None:
    result, report = run_cli(
        tmp_path, [case()], [{"case_id": "C01", "extracted": LABEL}]
    )
    assert result.returncode == 0, result.stderr
    for key in ["verdict_accuracy", "initial_status_accuracy"]:
        assert report["metrics"][key] == {
            "correct": None,
            "total": None,
            "percent": None,
        }


def test_invalid_verdict_is_an_attempted_failure(tmp_path: Path) -> None:
    result, report = run_cli(
        tmp_path,
        [case()],
        [{"case_id": "C01", "extracted": LABEL, "verdict": "invented"}],
    )
    assert result.returncode == 0, result.stderr
    assert report["metrics"]["field_accuracy"]["correct"] == 4
    assert report["metrics"]["verdict_accuracy"]["correct"] == 0
    assert "invalid_verdict" in report["cases"][0]["issues"]


@pytest.mark.parametrize("kind", ["duplicate", "unknown", "mixed"])
def test_ambiguous_or_mixed_prediction_sets_are_rejected(
    tmp_path: Path, kind: str
) -> None:
    rows: list[dict[str, Any]] = [{"case_id": "C01", "extracted": LABEL}]
    if kind == "duplicate":
        rows.append(dict(rows[0]))
    elif kind == "unknown":
        rows[0]["case_id"] = "UNKNOWN"
    else:
        rows[0]["mode"] = "live"
    result, report = run_cli(tmp_path, [case()], rows)
    assert result.returncode == 2
    assert kind in result.stderr.lower()
    assert report == {}


def test_output_cannot_overwrite_input(tmp_path: Path) -> None:
    result, _ = run_cli(tmp_path, [case()], [], output_is_input=True)
    assert result.returncode == 2
    assert "overwrite" in result.stderr.lower()
    assert "cases" in json.loads(
        (tmp_path / "expected.json").read_text(encoding="utf-8")
    )


@pytest.mark.parametrize("link_to", ["expected", "predictions"])
def test_output_hardlink_cannot_destroy_inputs(
    tmp_path: Path, link_to: str
) -> None:
    result, _ = run_cli(tmp_path, [case()], [], link_output_to=link_to)
    assert result.returncode == 2
    assert "overwrite" in result.stderr.lower()
    expected = json.loads(
        (tmp_path / "expected.json").read_text(encoding="utf-8")
    )
    predictions = json.loads(
        (tmp_path / "predictions.json").read_text(encoding="utf-8")
    )
    assert expected["cases"][0]["case_id"] == "C01"
    assert predictions == {"mode": "stub", "predictions": []}


def test_empty_scoring_denominators_are_not_perfect_scores(
    tmp_path: Path,
) -> None:
    gold = dict.fromkeys(LABEL)
    result, report = run_cli(
        tmp_path, [case(**gold)], [{"case_id": "C01", "extracted": gold}]
    )
    assert result.returncode == 0, result.stderr
    assert report["metrics"]["field_accuracy"]["total"] == 0
    assert report["metrics"]["field_accuracy"]["percent"] is None
    assert report["metrics"]["unreadable_abstention"]["correct"] == 4


@pytest.mark.parametrize(
    "mode", ["live", "cache"], ids=["saved-live", "saved-cache"]
)
def test_declared_modes_never_claim_verified_live_inference(
    tmp_path: Path, mode: str
) -> None:
    result, report = run_cli(
        tmp_path,
        [case()],
        [{"case_id": "C01", "extracted": LABEL}],
        mode=mode,
    )
    assert result.returncode == 0, result.stderr
    assert report["mode"] == mode
    assert report["live_inference_verified"] is False


@pytest.mark.parametrize("mode", [None, [], {}, "unknown"])
def test_malformed_mode_is_a_clean_input_error(
    tmp_path: Path, mode: Any
) -> None:
    result, report = run_cli(tmp_path, [case()], [], mode=mode)
    assert result.returncode == 2
    assert "mode must be" in result.stderr
    assert "Traceback" not in result.stderr
    assert report == {}


def test_duplicate_expected_cases_are_rejected(tmp_path: Path) -> None:
    result, report = run_cli(tmp_path, [case(), case()], [])
    assert result.returncode == 2
    assert "duplicate" in result.stderr.lower()
    assert report == {}
