"""Verify three-run summaries without model calls."""

import copy
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest

EVAL = Path(__file__).parent / "eval"
sys.path.insert(0, str(EVAL))
spec = importlib.util.spec_from_file_location(
    "summarize_runs", EVAL / "summarize_runs.py"
)
assert spec and spec.loader
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)
sys.path.remove(str(EVAL))


@pytest.fixture
def runs(tmp_path: Path) -> tuple[Path, list[Path]]:
    expected = json.loads((EVAL / "finals/expected_results.json").read_bytes())
    expected_path = tmp_path / "expected.json"
    expected_path.write_text(json.dumps(expected), encoding="utf-8")
    paths = []
    for index in range(3):
        doc = {
            "mode": "live",
            "model": "test",
            "temperature": 0,
            "run_id": str(index),
            "prompt_sha256": "test",
            "code_revision": "test",
            "code_sha256": {"rules": "test"},
            "started_at": "test",
            "completed_at": "test",
            "timing_scope": "test",
            "expected_sha256": hashlib.sha256(
                expected_path.read_bytes()
            ).hexdigest(),
            "predictions": [
                {
                    "case_id": c["case_id"],
                    "image_sha256": c["image_sha256"],
                    "extracted": copy.deepcopy(
                        c["proposed_expected_extraction"]
                    ),
                    "verdict": c["proposed_expected_verdict"],
                    "error": None,
                    "extraction_seconds": float(index + 1),
                    "rules_seconds": 0.001,
                }
                for c in expected["cases"]
            ],
        }
        path = tmp_path / f"run-{index}.json"
        path.write_text(json.dumps(doc), encoding="utf-8")
        paths.append(path)
    return expected_path, paths


def update(path: Path, change: Any) -> None:
    doc = json.loads(path.read_bytes())
    change(doc)
    path.write_text(json.dumps(doc), encoding="utf-8")


def test_scores_consistency_and_latency(runs: tuple[Path, list[Path]]) -> None:
    result = summary.combine(*runs)
    assert (
        result["pooled_attempt_metrics"]["verdict_accuracy"]["correct"] == 72
    )
    assert result["consistency"]["verdict_consistent"]["correct"] == 24
    assert result["latency_seconds"]["successful_extractions"]["median"] == 2
    assert result["latency_seconds"]["successful_extractions"]["p95"] == 3
    assert "72 attempts" in summary.markdown(result)


def test_consistently_wrong_is_not_correct(
    runs: tuple[Path, list[Path]],
) -> None:
    for path in runs[1]:
        update(
            path, lambda d: d["predictions"][0].update(verdict="substitution")
        )
    result = summary.combine(*runs)
    assert result["cases"][0]["verdict_consistent"]
    assert not any(result["cases"][0]["verdict_correct_by_run"])
    assert (
        result["pooled_attempt_metrics"]["verdict_accuracy"]["correct"] == 69
    )


def test_all_failed_run_is_not_consistent(
    runs: tuple[Path, list[Path]],
) -> None:
    def fail(doc: dict[str, Any]) -> None:
        for row in doc["predictions"]:
            row.update(
                extracted=None,
                verdict=None,
                error="timeout",
                rules_seconds=None,
            )

    update(runs[1][0], fail)
    result = summary.combine(*runs)
    assert (
        result["pooled_attempt_metrics"]["verdict_accuracy"]["correct"] == 48
    )
    assert result["pooled_attempt_metrics"]["verdict_accuracy"]["total"] == 72
    assert result["consistency"]["verdict_consistent"]["correct"] == 0
    assert result["latency_seconds"]["failed_extractions"]["count"] == 24


@pytest.mark.parametrize(
    "field,value",
    [
        ("model", "different"),
        ("expected_sha256", "wrong"),
        ("completed_at", None),
        ("code_sha256", {"rules": "different"}),
        ("run_id", "0"),
    ],
)
def test_incompatible_runs_rejected(
    runs: tuple[Path, list[Path]],
    field: str,
    value: Any,
) -> None:
    update(runs[1][1], lambda d: d.update({field: value}))
    with pytest.raises(ValueError):
        summary.combine(*runs)


@pytest.mark.parametrize("value", [-1, None, True, float("nan"), float("inf")])
def test_invalid_timings_rejected(
    runs: tuple[Path, list[Path]], value: Any
) -> None:
    update(
        runs[1][0],
        lambda d: d["predictions"][0].update(extraction_seconds=value),
    )
    with pytest.raises(ValueError, match="Invalid timing"):
        summary.combine(*runs)


def test_missing_case_hash_and_duplicate_path(
    runs: tuple[Path, list[Path]],
) -> None:
    expected, paths = runs
    with pytest.raises(ValueError):
        summary.combine(expected, [paths[0]] * 3)
    update(
        paths[0], lambda d: d["predictions"][0].update(image_sha256="wrong")
    )
    with pytest.raises(ValueError, match="Image hash"):
        summary.combine(*runs)
    update(paths[0], lambda d: d["predictions"].pop(0))
    with pytest.raises(ValueError, match="all cases"):
        summary.combine(*runs)
