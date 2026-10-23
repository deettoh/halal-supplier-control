"""Collect live label predictions for the evaluation set."""

import argparse
import hashlib
from datetime import date
from pathlib import Path
from typing import Literal

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


class PredictionFile(BaseModel):
    """Saved predictions in the run_eval.py input shape."""

    mode: Literal["live"] = "live"
    model: str = extract.MODEL_ID
    temperature: float = extract.TEMPERATURE
    prompt_sha256: str = hashlib.sha256(
        extract.EXTRACTION_PROMPT.encode()
    ).hexdigest()
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
    try:
        label = extract.extract_label(image, client=client, cache={})
    except extract.ExtractionError as exc:
        return Prediction(
            case_id=case.case_id,
            image_sha256=image_sha256,
            extracted=None,
            verdict=None,
            error=str(exc),
        )
    fixture = case.evaluation_fixture
    evaluation = rules.evaluate(
        label, fixture.material, fixture.certificate, fixture.today
    )
    return Prediction(
        case_id=case.case_id,
        image_sha256=image_sha256,
        extracted=label,
        verdict=evaluation["verdict"],
        error=None,
    )


def main() -> None:
    """Write live predictions for every expected case to --output."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=Path, default=EXPECTED_PATH)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    expected = ExpectedResults.model_validate_json(args.expected.read_bytes())
    collected = PredictionFile(
        predictions=[predict(case) for case in expected.cases]
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(collected.model_dump_json(indent=2) + "\n")


if __name__ == "__main__":
    main()
