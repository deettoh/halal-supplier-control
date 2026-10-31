"""Collect live label predictions for the evaluation set."""

import argparse
import hashlib
import subprocess
import time
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from openai import OpenAI
from pydantic import BaseModel

# run with PYTHONPATH=src since only pytest adds src to the path
from backend import extract, rules
from backend.schemas import LabelExtraction, Verdict

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_PATH = Path(__file__).with_name("expected_results.json")


class Fixture(BaseModel):
    """Per-case material and certificate copies and evaluation date."""

    material: dict[str, object]
    certificate: dict[str, object]
    today: date


class Case(BaseModel):
    """Evaluation case fields the collector reads."""

    case_id: str
    image_path: Path
    evaluation_fixture: Fixture


class ExpectedResults(BaseModel):
    """Expected-results file with the evaluation cases."""

    cases: list[Case]


class Prediction(BaseModel):
    """Live extraction and offline rules verdict for one case."""

    case_id: str
    image_sha256: str
    extracted: LabelExtraction | None
    verdict: Verdict | None
    error: str | None
    extraction_seconds: float
    rules_seconds: float | None


class PredictionFile(BaseModel):
    """Saved predictions in the run_eval.py input shape."""

    mode: Literal["live"] = "live"
    model: str = extract.MODEL_ID
    temperature: float = extract.TEMPERATURE
    prompt_sha256: str = hashlib.sha256(
        extract.EXTRACTION_PROMPT.encode()
    ).hexdigest()
    run_id: str
    expected_sha256: str
    code_revision: str
    code_sha256: dict[str, str]
    started_at: str
    completed_at: str | None = None
    timing_scope: str = (
        "extraction_seconds includes preprocessing, client setup, network, "
        "queue/cold-start wait, inference and response validation; "
        "rules_seconds measures offline rules only; file reading excluded"
    )
    predictions: list[Prediction]


def predict(case: Case, client: OpenAI | None = None) -> Prediction:
    """Return the live prediction for case.

    Args:
        case: Evaluation case with its image path and fixture copies.
        client: Endpoint client or None for the RunPod endpoint.

    Returns:
        Extraction and its rules verdict against the fixture. If the
        request or reply fails, both are None and error has the reason.

    Raises:
        ValueError: If the case image is empty or not a readable image.
        pydantic.ValidationError: If a RunPod environment variable is
            invalid.
    """
    image = (REPO_ROOT / case.image_path).read_bytes()
    image_sha256 = hashlib.sha256(image).hexdigest()
    started = time.perf_counter()
    try:
        label = extract.extract_label(image, client=client, cache={})
    except extract.ExtractionError as exc:
        return Prediction(
            case_id=case.case_id,
            image_sha256=image_sha256,
            extracted=None,
            verdict=None,
            error=str(exc),
            extraction_seconds=time.perf_counter() - started,
            rules_seconds=None,
        )
    extraction_seconds = time.perf_counter() - started
    fixture = case.evaluation_fixture
    rule_started = time.perf_counter()
    evaluation = rules.evaluate(
        label, fixture.material, fixture.certificate, fixture.today
    )
    return Prediction(
        case_id=case.case_id,
        image_sha256=image_sha256,
        extracted=label,
        verdict=evaluation["verdict"],
        error=None,
        extraction_seconds=extraction_seconds,
        rules_seconds=time.perf_counter() - rule_started,
    )


def main() -> None:
    """Write live predictions for every expected case to --output."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=Path, default=EXPECTED_PATH)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    expected = ExpectedResults.model_validate_json(args.expected.read_bytes())
    # fail before paid requests if the output file already exists
    args.output.parent.mkdir(parents=True, exist_ok=True)
    code_paths = [
        "src/backend/extract.py",
        "src/backend/images.py",
        "src/backend/rules.py",
        "src/backend/settings.py",
        "src/seed/seed.json",
        "src/backend/schemas.py",
        "tests/eval/collect_predictions.py",
    ]
    collected = PredictionFile(
        run_id=str(uuid4()),
        expected_sha256=hashlib.sha256(args.expected.read_bytes()).hexdigest(),
        code_revision=subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True
        ).strip(),
        code_sha256={
            name: hashlib.sha256((REPO_ROOT / name).read_bytes()).hexdigest()
            for name in code_paths
        },
        started_at=datetime.now(UTC).isoformat(),
        predictions=[],
    )
    with args.output.open("x", encoding="utf-8") as stream:
        stream.write(collected.model_dump_json(indent=2) + "\n")
    for case in expected.cases:
        prediction = predict(case)
        collected.predictions.append(prediction)
        args.output.write_text(
            collected.model_dump_json(indent=2) + "\n", encoding="utf-8"
        )
        print(
            f"{case.case_id}: {prediction.error or prediction.verdict} "
            f"({prediction.extraction_seconds:.3f}s extraction)",
            flush=True,
        )
    collected.completed_at = datetime.now(UTC).isoformat()
    args.output.write_text(
        collected.model_dump_json(indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
