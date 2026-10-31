"""Score saved predictions without credentials or model calls."""

import argparse
import hashlib
import json
import sys
import unicodedata
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter, ValidationError

# support direct execution without installing the sources
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from backend.schemas import (
    DeliveryStatus,
    LabelExtraction,
    Verdict,
)

TEXT_FIELDS = ("product_name", "brand", "manufacturer")
FIELDS = (*TEXT_FIELDS, "halal_mark_present")
MODES = {"live", "stub", "cache"}
VERDICT = TypeAdapter(Verdict)
STATUS = TypeAdapter(DeliveryStatus)


def metric(correct: int | None, total: int | None) -> dict[str, Any]:
    """Keep unavailable and empty populations distinct from perfect scores."""
    return {
        "correct": correct,
        "total": total,
        "percent": (
            round(100 * correct / total, 2)
            if correct is not None and total
            else None
        ),
    }


def normalized(value: str) -> str:
    """Return NFC casefolded text with collapsed whitespace."""
    return " ".join(unicodedata.normalize("NFC", value).casefold().split())


def indexed_rows(
    document: dict[str, Any], key: str, *, require_rows: bool = False
) -> dict[str, dict[str, Any]]:
    rows = document.get(key)
    if not isinstance(rows, list) or (require_rows and not rows):
        raise ValueError(f"{key} must be an array with valid case records")
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise TypeError("Case records must be JSON objects")
        case_id = row.get("case_id")
        if not isinstance(case_id, str) or not case_id.strip():
            raise ValueError("Every record needs a nonempty case_id")
        if case_id in indexed:
            raise ValueError("Duplicate case_id in input")
        indexed[case_id] = row
    return indexed


def target_outcome(
    case: dict[str, Any], key: str, adapter: TypeAdapter[Any]
) -> str | None:
    value = case.get(key)
    if value is None:
        return None
    try:
        result: str = adapter.validate_python(value, strict=True)
        return result
    except ValidationError:
        raise ValueError(
            "Expected outcome violates the shared contract"
        ) from None


def evaluate(
    expected: dict[str, Any], predictions: dict[str, Any]
) -> dict[str, Any]:
    """Evaluate every expected case without inventing missing predictions."""
    mode = predictions.get("mode")
    if not isinstance(mode, str) or mode not in MODES:
        raise ValueError("mode must be live, stub or cache")
    gold = indexed_rows(expected, "cases", require_rows=True)
    observed = indexed_rows(predictions, "predictions")
    if observed.keys() - gold.keys():
        raise ValueError("Unknown case_id in predictions")
    if any(row.get("mode", mode) != mode for row in observed.values()):
        raise ValueError("Mixed prediction modes require separate reports")

    pairs: dict[str, list[int]] = {
        name: [0, 0]
        for name in [
            "schema_success",
            "field_accuracy",
            "text_literal_accuracy",
            "text_normalized_accuracy",
            "mark_accuracy",
            "whole_readable_label_accuracy",
            "unreadable_abstention",
        ]
    }
    per_field = {name: [0, 0] for name in FIELDS}
    outcomes: dict[str, dict[str, int]] = {
        name: {"correct": 0, "targets": 0, "present": 0}
        for name in ["verdict", "status"]
    }
    counts = {
        "expected_cases": len(gold),
        "prediction_records": len(observed),
        "missing_predictions": len(gold) - len(observed),
        "upstream_errors": 0,
        "unreadable_guesses": 0,
    }
    results: list[dict[str, Any]] = []

    for case_id, case in gold.items():
        try:
            truth = LabelExtraction.model_validate(
                case.get("proposed_expected_extraction"), strict=True
            ).model_dump()
        except ValidationError:
            raise ValueError(
                "Expected extraction violates the shared four-field schema"
            ) from None
        row = observed.get(case_id, {})
        issues: list[str] = []
        if case_id not in observed:
            issues.append("missing_prediction")
        error_present = bool(row.get("error"))
        counts["upstream_errors"] += int(error_present)
        extracted: dict[str, Any] | None = None
        if error_present:
            issues.append("upstream_error")
        else:
            try:
                extracted = LabelExtraction.model_validate(
                    row.get("extracted"), strict=True
                ).model_dump()
            except ValidationError:
                issues.append("invalid_extraction")
        schema_valid = extracted is not None
        pairs["schema_success"][0] += int(schema_valid)
        pairs["schema_success"][1] += 1
        field_results: dict[str, dict[str, bool] | None] = {}

        for field in FIELDS:
            wanted = truth[field]
            actual = extracted[field] if extracted is not None else None
            if wanted is None:
                pairs["unreadable_abstention"][1] += 1
                pairs["unreadable_abstention"][0] += int(
                    schema_valid and actual is None
                )
                counts["unreadable_guesses"] += int(
                    schema_valid and actual is not None
                )
                field_results[field] = None
                continue
            literal = schema_valid and actual == wanted
            match = literal
            if field in TEXT_FIELDS:
                match = (
                    schema_valid
                    and isinstance(actual, str)
                    and normalized(actual) == normalized(wanted)
                )
                pairs["text_literal_accuracy"][0] += int(literal)
                pairs["text_literal_accuracy"][1] += 1
                pairs["text_normalized_accuracy"][0] += int(match)
                pairs["text_normalized_accuracy"][1] += 1
            else:
                pairs["mark_accuracy"][0] += int(match)
                pairs["mark_accuracy"][1] += 1
            pairs["field_accuracy"][0] += int(match)
            pairs["field_accuracy"][1] += 1
            per_field[field][0] += int(match)
            per_field[field][1] += 1
            field_results[field] = {"literal": literal, "normalized": match}

        if all(truth[field] is not None for field in TEXT_FIELDS):
            pairs["whole_readable_label_accuracy"][1] += 1
            pairs["whole_readable_label_accuracy"][0] += int(
                schema_valid
                and all(
                    (field_results[field] or {}).get("normalized", False)
                    for field in TEXT_FIELDS
                )
            )

        outcome_results: dict[str, bool | None] = {}
        adapters: list[tuple[str, str, TypeAdapter[Any]]] = [
            ("verdict", "proposed_expected_verdict", VERDICT),
            ("status", "proposed_expected_initial_status", STATUS),
        ]
        for field, target_key, adapter in adapters:
            wanted_outcome = target_outcome(case, target_key, adapter)
            present = row.get(field) is not None
            actual_outcome: str | None = None
            if present:
                try:
                    actual_outcome = adapter.validate_python(
                        row[field], strict=True
                    )
                except ValidationError:
                    issues.append(f"invalid_{field}")
            if wanted_outcome is not None:
                outcomes[field]["targets"] += 1
                outcomes[field]["present"] += int(present)
                correct = actual_outcome == wanted_outcome
                outcomes[field]["correct"] += int(correct)
                outcome_results[field] = correct if present else None
            else:
                outcome_results[field] = None

        results.append(
            {
                "case_id": case_id,
                "schema_valid": schema_valid,
                "error_present": error_present,
                "issues": issues,
                "fields": field_results,
                "verdict_correct": outcome_results["verdict"],
                "initial_status_correct": outcome_results["status"],
            }
        )

    metrics = {name: metric(*pair) for name, pair in pairs.items()}
    for field, name in [
        ("verdict", "verdict_accuracy"),
        ("status", "initial_status_accuracy"),
    ]:
        score = outcomes[field]
        metrics[name] = (
            metric(score["correct"], score["targets"])
            if score["present"]
            else metric(None, None)
        )

    return {
        "report_version": "0.1",
        "source": "saved_predictions",
        "mode": mode,
        "live_inference_verified": False,
        "dataset_approved": expected.get("member_5_approval") == "approved",
        "limitations": [
            "Modes are declared by the input, not independently verified.",
            "Proposal or stub/cache scores are not live model accuracy.",
            "No image reading, production rules or timing are run here.",
        ],
        "counts": counts,
        "metrics": metrics,
        "per_field": {name: metric(*pair) for name, pair in per_field.items()},
        "cases": results,
    }


def read_document(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise ValueError("Input must be a readable UTF-8 JSON file") from None
    if not isinstance(document, dict):
        raise TypeError("Input must be a JSON object")
    return document


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        inputs = (args.expected, args.predictions)
        same_path = args.output.resolve() in {
            path.resolve() for path in inputs
        }
        same_file = args.output.exists() and any(
            args.output.samefile(path) for path in inputs
        )
        if same_path or same_file:
            raise ValueError("Output must not overwrite either input")
        report = evaluate(
            read_document(args.expected), read_document(args.predictions)
        )
        report["inputs"] = {
            "expected_sha256": hashlib.sha256(
                args.expected.read_bytes()
            ).hexdigest(),
            "predictions_sha256": hashlib.sha256(
                args.predictions.read_bytes()
            ).hexdigest(),
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except (ValueError, TypeError) as exc:
        print(f"Evaluation input error: {exc}", file=sys.stderr)
        return 2
    except OSError:
        print("Could not write evaluation report", file=sys.stderr)
        return 2
    print(f"Saved {report['counts']['expected_cases']} case results")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
