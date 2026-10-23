"""Tests for the live prediction collector."""

import importlib.util
import json
from pathlib import Path
from types import ModuleType

import httpx2
from openai import OpenAI

from backend.schemas import LabelExtraction

EVAL_DIR = Path(__file__).parent / "eval"


def load_collector() -> ModuleType:
    """Return the collector script loaded as a module."""
    path = EVAL_DIR / "collect_predictions.py"
    spec = importlib.util.spec_from_file_location("collect_predictions", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


collector = load_collector()
CASES = {
    case.case_id: case
    for case in collector.ExpectedResults.model_validate_json(
        (EVAL_DIR / "expected_results.json").read_bytes()
    ).cases
}
COCOA_LABEL = {
    "product_name": "Cocoa Powder",
    "brand": "SilverCocoa",
    "manufacturer": "Silver Valley Foods",
    "halal_mark_present": True,
}


def client_replying(status: int, content: str | None = None) -> OpenAI:
    """Return a client whose endpoint answers every request the same."""

    def handle(request: httpx2.Request) -> httpx2.Response:
        if status != httpx2.codes.OK:
            return httpx2.Response(status)
        message = {"role": "assistant", "content": content}
        return httpx2.Response(
            status,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "test",
                "choices": [
                    {"index": 0, "finish_reason": "stop", "message": message}
                ],
            },
        )

    return OpenAI(
        base_url="https://runpod.test/v1",
        api_key="test-key",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handle)),
    )


def test_verdict_uses_case_certificate_copy() -> None:
    client = client_replying(httpx2.codes.OK, json.dumps(COCOA_LABEL))
    prediction = collector.predict(CASES["L06"], client=client)
    assert prediction.extracted == LabelExtraction.model_validate(COCOA_LABEL)
    # L06's certificate copy is expired but the shared seed's isn't
    assert prediction.verdict == "not_covered"


def test_failed_request_records_error_without_cached_label() -> None:
    client = client_replying(httpx2.codes.SERVICE_UNAVAILABLE)
    prediction = collector.predict(CASES["L01"], client=client)
    assert prediction.extracted is None
    assert prediction.error.startswith("RunPod request failed")
    # else a failed call scores as correct for the needs_human cases
    assert prediction.verdict is None
