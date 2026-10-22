"""Tests for the label extraction schema and RunPod extractor."""

import base64
import json
from collections.abc import Callable
from typing import Any

import httpx2
import pytest
from openai import APIStatusError, APITimeoutError, OpenAI
from pydantic import ValidationError

from backend.extract import (
    LABEL_JSON_SCHEMA,
    MAX_RETRIES,
    TIMEOUT_SECONDS,
    ExtractionError,
    LabelExtraction,
    extract_label,
)

LABEL_FIELDS = {"product_name", "brand", "manufacturer", "halal_mark_present"}
IMAGE = b"\x89PNG fake image bytes"
LABEL = {
    "product_name": "Kicap Manis",
    "brand": "Seri Melur",
    "manufacturer": "Kilang Kicap Contoh Sdn Bhd",
    "halal_mark_present": True,
}

RequestBody = dict[str, Any]
Handler = Callable[[httpx2.Request], httpx2.Response]


def mock_client(handle: Handler) -> OpenAI:
    """Return a client whose requests go to handle."""
    return OpenAI(
        base_url="https://runpod.test/v1",
        api_key="test-key",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handle)),
    )


def fake_client(
    content: str | None,
) -> tuple[OpenAI, list[httpx2.Request]]:
    """Return a client whose endpoint replies with fixed content.

    Args:
        content: Message content of every chat completion reply.

    Returns:
        Client on a mock transport and each request in send order.
    """
    requests: list[httpx2.Request] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        return httpx2.Response(
            httpx2.codes.OK,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "test",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": content},
                    }
                ],
            },
        )

    return mock_client(handle), requests


def sent_request() -> RequestBody:
    """Return the JSON body extract_label sends for IMAGE."""
    client, requests = fake_client(json.dumps(LABEL))
    extract_label(IMAGE, client=client)
    body: RequestBody = json.loads(requests[0].content)
    return body


def test_model_accepts_all_nulls() -> None:
    label = LabelExtraction.model_validate(dict.fromkeys(LABEL_FIELDS))
    assert label.brand is None


def test_model_rejects_extra_key() -> None:
    payload = dict.fromkeys(LABEL_FIELDS) | {"verdict": "covered"}
    with pytest.raises(ValidationError):
        LabelExtraction.model_validate(payload)


def test_model_rejects_missing_key() -> None:
    with pytest.raises(ValidationError):
        LabelExtraction.model_validate({"brand": "Bunga Mawar"})


def test_model_cannot_be_mutated() -> None:
    label = LabelExtraction.model_validate(LABEL)
    with pytest.raises(ValidationError):
        label.brand = "Other Brand"


def test_request_constrains_output_to_label_schema() -> None:
    response_format = sent_request()["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["schema"] == LABEL_JSON_SCHEMA


def test_request_sets_temperature_zero() -> None:
    assert sent_request()["temperature"] == 0


def test_request_attaches_image_as_base64_data_url() -> None:
    urls = [
        part["image_url"]["url"]
        for message in sent_request()["messages"]
        if isinstance(message["content"], list)
        for part in message["content"]
        if part["type"] == "image_url"
    ]
    assert len(urls) == 1
    header, data = urls[0].split(",", 1)
    assert header.startswith("data:image/")
    assert header.endswith(";base64")
    assert base64.b64decode(data) == IMAGE


def test_returns_label_from_response() -> None:
    client, _ = fake_client(json.dumps(LABEL))
    label = extract_label(IMAGE, client=client)
    assert label == LabelExtraction.model_validate(LABEL)


def test_request_uses_timeout_limit() -> None:
    client, requests = fake_client(json.dumps(LABEL))
    extract_label(IMAGE, client=client)
    assert requests[0].extensions["timeout"]["read"] == TIMEOUT_SECONDS


def test_timeout_raises_extraction_error_without_retry() -> None:
    requests: list[httpx2.Request] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        raise httpx2.ReadTimeout("endpoint cold", request=request)

    with pytest.raises(ExtractionError, match="APITimeoutError") as caught:
        extract_label(IMAGE, client=mock_client(handle))
    assert isinstance(caught.value.__cause__, APITimeoutError)
    assert len(requests) == MAX_RETRIES + 1


def test_error_status_raises_extraction_error() -> None:
    client = mock_client(
        lambda _: httpx2.Response(httpx2.codes.SERVICE_UNAVAILABLE)
    )
    with pytest.raises(ExtractionError) as caught:
        extract_label(IMAGE, client=client)
    assert isinstance(caught.value.__cause__, APIStatusError)


def test_rejects_response_missing_field() -> None:
    client, _ = fake_client(json.dumps({"brand": LABEL["brand"]}))
    with pytest.raises(ExtractionError) as caught:
        extract_label(IMAGE, client=client)
    assert isinstance(caught.value.__cause__, ValidationError)


def test_rejects_response_without_content() -> None:
    client, _ = fake_client(None)
    with pytest.raises(ExtractionError, match="no content"):
        extract_label(IMAGE, client=client)


def test_rejects_empty_image_before_request() -> None:
    client, requests = fake_client(json.dumps(LABEL))
    with pytest.raises(ValueError, match="empty"):
        extract_label(b"", client=client)
    assert requests == []


def test_missing_api_key_names_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUNPOD_ENDPOINT_URL", "https://runpod.test/v1")
    monkeypatch.delenv("RUNPOD_API_KEY", raising=False)
    with pytest.raises(ValidationError, match="RUNPOD_API_KEY"):
        extract_label(IMAGE)
