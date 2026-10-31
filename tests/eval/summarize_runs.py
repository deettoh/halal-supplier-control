"""Combine three completed live runs without making endpoint calls."""

import argparse
import hashlib
import json
import math
from pathlib import Path
from statistics import median
from typing import Any

from run_eval import evaluate, indexed_rows, metric, normalized, read_document


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def latency(values: list[float]) -> dict[str, Any]:
    """Summarize seconds with a nearest-rank p95."""
    if not values:
        return {
            "count": 0,
            "median": None,
            "p95": None,
            "min": None,
            "max": None,
        }
    ordered = sorted(values)
    return {
        "count": len(values),
        "median": median(values),
        "p95": ordered[math.ceil(0.95 * len(values)) - 1],
        "min": ordered[0],
        "max": ordered[-1],
    }


def combine(expected_path: Path, paths: list[Path]) -> dict[str, Any]:
    """Validate provenance and count failed attempts as incorrect."""
    if len(paths) != 3 or len({p.resolve() for p in paths}) != 3:
        raise ValueError("Provide three distinct prediction paths")
    expected = read_document(expected_path)
    gold = indexed_rows(expected, "cases", require_rows=True)
    docs = [read_document(p) for p in paths]
    if (
        not all(d.get("run_id") for d in docs)
        or len({d.get("run_id") for d in docs}) != 3
    ):
        raise ValueError("Provide three distinct run IDs")
    rows = [indexed_rows(d, "predictions") for d in docs]
    reports = [evaluate(expected, d) for d in docs]
    for doc, run_rows, report in zip(docs, rows, reports, strict=True):
        if doc.get("mode") != "live" or not doc.get("completed_at"):
            raise ValueError("Only completed live runs can be combined")
        if doc.get("expected_sha256") != digest(expected_path):
            raise ValueError("Expected answers hash mismatch")
        if run_rows.keys() != gold.keys():
            raise ValueError("Every run must include all cases")
        for key in ("model", "temperature", "prompt_sha256", "code_sha256"):
            if doc.get(key) is None or doc[key] != docs[0].get(key):
                raise ValueError(f"Incompatible setting: {key}")
        for case_id, row in run_rows.items():
            if row.get("image_sha256") != gold[case_id]["image_sha256"]:
                raise ValueError(f"Image hash mismatch: {case_id}")
            for key in ("extraction_seconds", "rules_seconds"):
                value = row.get(key)
                if (
                    key == "rules_seconds"
                    and row.get("error")
                    and value is None
                ):
                    continue
                if (
                    not isinstance(value, (float, int))
                    or isinstance(value, bool)
                    or not math.isfinite(value)
                    or value < 0
                ):
                    raise ValueError(f"Invalid timing: {case_id} {key}")
        report["metrics"]["verdict_accuracy"] = metric(
            sum(c["verdict_correct"] is True for c in report["cases"]),
            len(gold),
        )
    cases: list[dict[str, Any]] = []
    successful: list[float] = []
    failed: list[float] = []
    rules_times: list[float] = []
    for case_id, truth in gold.items():
        observations = [run[case_id] for run in rows]
        scored = [
            next(c for c in r["cases"] if c["case_id"] == case_id)
            for r in reports
        ]
        complete = all(
            s["schema_valid"] and not s["error_present"] for s in scored
        )
        labels = [row.get("extracted") for row in observations]
        canonical = [
            {
                k: normalized(v) if isinstance(v, str) else v
                for k, v in label.items()
            }
            if isinstance(label, dict)
            else None
            for label in labels
        ]
        verdicts = [row.get("verdict") for row in observations]
        mismatches = []
        for row, score in zip(observations, scored, strict=True):
            fields = row.get("extracted") or {}
            wrong = []
            for key, wanted in truth["proposed_expected_extraction"].items():
                actual = fields.get(key)
                equivalent = (
                    normalized(actual) == normalized(wanted)
                    if isinstance(actual, str) and isinstance(wanted, str)
                    else actual == wanted
                )
                if not score["schema_valid"] or not equivalent:
                    wrong.append(key)
            mismatches.append(wrong)
            (failed if row.get("error") else successful).append(
                row["extraction_seconds"]
            )
            if row.get("rules_seconds") is not None:
                rules_times.append(row["rules_seconds"])
        cases.append(
            {
                "case_id": case_id,
                "scenario": truth["scenario"],
                "expected": truth["proposed_expected_extraction"],
                "observed": labels,
                "expected_verdict": truth["proposed_expected_verdict"],
                "verdicts": verdicts,
                "errors": [r.get("error") for r in observations],
                "incorrect_fields_by_run": mismatches,
                "verdict_correct_by_run": [
                    s["verdict_correct"] is True for s in scored
                ],
                "extraction_seconds": [
                    r["extraction_seconds"] for r in observations
                ],
                "literal_extraction_consistent": complete
                and labels[0] == labels[1] == labels[2],
                "normalized_extraction_consistent": complete
                and canonical[0] == canonical[1] == canonical[2],
                "verdict_consistent": complete
                and verdicts[0] == verdicts[1] == verdicts[2],
            }
        )
    pooled = {}
    for name in reports[0]["metrics"]:
        scores = [r["metrics"][name] for r in reports]
        pooled[name] = (
            metric(
                sum(s["correct"] for s in scores),
                sum(s["total"] for s in scores),
            )
            if all(s["total"] is not None for s in scores)
            else metric(None, None)
        )
    categories = {}
    for kind in sorted({c["scenario"] for c in cases}):
        subset = [c for c in cases if c["scenario"] == kind]
        categories[kind] = metric(
            sum(sum(c["verdict_correct_by_run"]) for c in subset),
            3 * len(subset),
        )
    return {
        "dataset_id": expected["dataset_id"],
        "unique_cases": len(gold),
        "attempts": 3 * len(gold),
        "sample_counts": expected["sample_counts"],
        "expected_sha256": digest(expected_path),
        "settings": {
            k: docs[0][k]
            for k in (
                "model",
                "temperature",
                "prompt_sha256",
                "code_revision",
                "code_sha256",
            )
        },
        "runs": [
            {
                "path": p.as_posix(),
                "sha256": digest(p),
                "run_id": d["run_id"],
                "started_at": d["started_at"],
                "completed_at": d["completed_at"],
                "counts": r["counts"],
                "metrics": r["metrics"],
            }
            for p, d, r in zip(paths, docs, reports, strict=True)
        ],
        "pooled_attempt_metrics": pooled,
        "category_verdicts": categories,
        "consistency": {
            key: metric(sum(c[key] for c in cases), len(cases))
            for key in (
                "literal_extraction_consistent",
                "normalized_extraction_consistent",
                "verdict_consistent",
            )
        },
        "latency_seconds": {
            "successful_extractions": latency(successful),
            "failed_extractions": latency(failed),
            "offline_rules": latency(rules_times),
        },
        "target_revision": "ef451fd",
        "null_target_policy": (
            "Per user revision, absent and hidden marks both target null. "
            "Legacy unreadable_abstention scores all null targets, including "
            "clearly absent marks. mark_accuracy covers present marks only."
        ),
        "timing_scope": docs[0]["timing_scope"],
        "cases": cases,
        "limitations": [
            (
                "Repeated synthetic cases are correlated; "
                "not real delivery accuracy."
            ),
            (
                "Saved live mode is not independently attested "
                "by the offline scorer."
            ),
            (
                "No full delivery API, supervisor workflow "
                "or initial status measured."
            ),
            "Targets were revised after observing a previous experiment.",
            (
                "These results are development/regression evidence, "
                "not a holdout."
            ),
        ],
    }


def display(score: dict[str, Any]) -> str:
    return (
        f"{score['correct']}/{score['total']} ({score['percent']}%)"
        if score["total"] is not None
        else "Not measured"
    )


def markdown(s: dict[str, Any]) -> str:
    lines = [
        "# Finals three-run evaluation",
        "",
        (
            f"Dataset: `{s['dataset_id']}`. "
            f"{s['unique_cases']} synthetic cases; "
            f"{s['attempts']} attempts. Targets revised in commit ef451fd."
        ),
        "",
        (
            f"Model: `{s['settings']['model']}`; "
            f"temperature {s['settings']['temperature']}."
        ),
        "",
        "| Metric | Run 1 | Run 2 | Run 3 | Pooled attempts |",
        "| --- | --- | --- | --- | --- |",
    ]
    for key, score in s["pooled_attempt_metrics"].items():
        values = [display(r["metrics"][key]) for r in s["runs"]]
        label = "null_target_match" if key == "unreadable_abstention" else key
        lines.append(
            f"| {label} | " + " | ".join([*values, display(score)]) + " |"
        )
    lines += [
        "",
        s["null_target_policy"],
        "",
        (
            "`null_target_match` is the legacy scorer's "
            "`unreadable_abstention` metric."
        ),
        "",
        "## Repeatability",
        "",
    ]
    lines += [
        f"- {key}: {display(value)}" for key, value in s["consistency"].items()
    ]
    lines += ["", "## Verdicts by scenario (pooled attempts)", ""]
    lines += [
        f"- {key}: {display(value)}"
        for key, value in s["category_verdicts"].items()
    ]
    lines += [
        "",
        "## Timing",
        "",
        s["timing_scope"],
        "",
        "p95 uses nearest rank; failed requests are separate.",
        "",
        "| Population | Count | Median (s) | p95 (s) | Min (s) | Max (s) |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for key, value in s["latency_seconds"].items():
        values = [
            f"{value[k]:.6f}" if value[k] is not None else "N/A"
            for k in ("median", "p95", "min", "max")
        ]
        lines.append(
            f"| {key} | {value['count']} | " + " | ".join(values) + " |"
        )
    lines += ["", "## Cases needing attention", ""]
    for c in s["cases"]:
        if any(c["incorrect_fields_by_run"]) or not all(
            c["verdict_correct_by_run"]
        ):
            lines += [
                f"### {c['case_id']} ({c['scenario']})",
                "",
                (
                    f"Expected: `{json.dumps(c['expected'])}`; "
                    f"verdict `{c['expected_verdict']}`."
                ),
                "",
            ]
            for i in range(3):
                lines.append(
                    f"- Run {i + 1}: `{json.dumps(c['observed'][i])}`; "
                    f"verdict `{c['verdicts'][i]}`; error `{c['errors'][i]}`."
                )
            lines.append("")
    lines += [
        "## Provenance and limitations",
        "",
        f"Expected input SHA-256: `{s['expected_sha256']}`.",
        (
            f"Code base: `{s['settings']['code_revision']}`; "
            "working-file hashes in JSON."
        ),
        f"Prompt SHA-256: `{s['settings']['prompt_sha256']}`.",
        "",
        (
            "See execution-notes.md for approval "
            "and the revised null-mark policy."
        ),
        "",
        *[f"- {item}" for item in s["limitations"]],
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, nargs=3, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    summary = combine(args.expected, args.predictions)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = [
        args.output_dir / "summary.json",
        args.output_dir / "summary.md",
    ]
    if any(p.exists() for p in outputs):
        raise ValueError(
            "Summary already exists; choose a new output directory"
        )
    outputs[0].write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    outputs[1].write_text(markdown(summary), encoding="utf-8")
    print(f"Saved summary for {summary['attempts']} attempts")


if __name__ == "__main__":
    main()
