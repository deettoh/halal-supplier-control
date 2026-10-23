"""Tests for the label extraction schema and RunPod extractor."""

import base64
import hashlib
import io
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx2
import pytest
from openai import APIStatusError, APITimeoutError, OpenAI
from PIL import ExifTags, Image
from pydantic import ValidationError

from backend.extract import (
    LABEL_JSON_SCHEMA,
    MAX_IMAGE_SIDE,
    MAX_RETRIES,
    TIMEOUT_SECONDS,
    ExtractionError,
    LabelExtraction,
    _runpod_client,
    extract_label,
    load_demo_cache,
)

LABEL_FIELDS = {"product_name", "brand", "manufacturer", "halal_mark_present"}
IMAGE_SIZE = (64, 32)
LARGE_PHOTO_SIZE = (3000, 2000)
EXIF_ROTATED_90 = 6
LABEL = {
    "product_name": "Kicap Manis",
    "brand": "Seri Melur",
    "manufacturer": "Kilang Kicap Contoh Sdn Bhd",
    "halal_mark_present": True,
}

RequestBody = dict[str, Any]
Handler = Callable[[httpx2.Request], httpx2.Response]


def png(size: tuple[int, int], mode: str = "RGB") -> bytes:
    """Return a blank PNG of size in mode."""
    buffer = io.BytesIO()
    Image.new(mode, size).save(buffer, format="PNG")
    return buffer.getvalue()


IMAGE = png(IMAGE_SIZE)
CACHED_LABEL = LabelExtraction.model_validate(LABEL | {"brand": "Cached"})
DEMO_CACHE = {hashlib.sha256(IMAGE).hexdigest(): CACHED_LABEL}


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


def sent_request(image: bytes = IMAGE) -> RequestBody:
    """Return the JSON body extract_label sends for image."""
    client, requests = fake_client(json.dumps(LABEL))
    extract_label(image, client=client)
    body: RequestBody = json.loads(requests[0].content)
    return body


def image_urls(body: RequestBody) -> list[str]:
    """Return the image URLs in a chat completion request body."""
    return [
        part["image_url"]["url"]
        for message in body["messages"]
        if isinstance(message["content"], list)
        for part in message["content"]
        if part["type"] == "image_url"
    ]


def sent_image(image: bytes) -> Image.Image:
    """Return the image extract_label sends for image."""
    data = image_urls(sent_request(image))[0].split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(data)))


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
    urls = image_urls(sent_request())
    assert len(urls) == 1
    header, data = urls[0].split(",", 1)
    assert header.startswith("data:image/")
    assert header.endswith(";base64")
    assert Image.open(io.BytesIO(base64.b64decode(data))).size == IMAGE_SIZE


def test_sent_image_format_matches_data_url_type() -> None:
    url = image_urls(sent_request())[0]
    mime_type = url.removeprefix("data:").split(";", 1)[0]
    sent_format = sent_image(IMAGE).format
    assert sent_format is not None
    assert Image.MIME[sent_format] == mime_type


def test_large_photo_is_scaled_to_max_side() -> None:
    width, height = sent_image(png(LARGE_PHOTO_SIZE)).size
    assert max(width, height) == MAX_IMAGE_SIDE
    assert round(width / height, 2) == round(
        LARGE_PHOTO_SIZE[0] / LARGE_PHOTO_SIZE[1], 2
    )


def test_photo_is_turned_upright_from_exif_orientation() -> None:
    exif = Image.Exif()
    exif[ExifTags.Base.Orientation] = EXIF_ROTATED_90
    buffer = io.BytesIO()
    Image.new("RGB", IMAGE_SIZE).save(buffer, format="JPEG", exif=exif)
    assert sent_image(buffer.getvalue()).size == IMAGE_SIZE[::-1]


def test_transparent_png_is_sent_without_alpha() -> None:
    assert sent_image(png(IMAGE_SIZE, "RGBA")).mode == "RGB"


def test_returns_label_from_response() -> None:
    client, _ = fake_client(json.dumps(LABEL))
    label = extract_label(IMAGE, client=client)
    assert label == LabelExtraction.model_validate(LABEL)


def test_request_uses_timeout_limit() -> None:
    client, requests = fake_client(json.dumps(LABEL))
    extract_label(IMAGE, client=client)
    assert requests[0].extensions["timeout"]["read"] == TIMEOUT_SECONDS


def timeout_client() -> tuple[OpenAI, list[httpx2.Request]]:
    """Return a client whose endpoint times out and its requests."""
    requests: list[httpx2.Request] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        raise httpx2.ReadTimeout("endpoint cold", request=request)

    return mock_client(handle), requests


def test_timeout_raises_extraction_error_without_retry() -> None:
    client, requests = timeout_client()
    with pytest.raises(ExtractionError, match="APITimeoutError") as caught:
        extract_label(IMAGE, client=client)
    assert isinstance(caught.value.__cause__, APITimeoutError)
    assert len(requests) == MAX_RETRIES + 1


def test_timeout_serves_cached_label_for_demo_image() -> None:
    client, requests = timeout_client()
    label = extract_label(IMAGE, client=client, cache=DEMO_CACHE)
    assert label == CACHED_LABEL
    assert len(requests) == MAX_RETRIES + 1


def test_model_reply_takes_precedence_over_cached_label() -> None:
    client, _ = fake_client(json.dumps(LABEL))
    label = extract_label(IMAGE, client=client, cache=DEMO_CACHE)
    assert label == LabelExtraction.model_validate(LABEL)


def test_committed_demo_cache_is_valid() -> None:
    load_demo_cache()


def test_demo_cache_loads_labels_by_digest(tmp_path: Path) -> None:
    path = tmp_path / "demo_cache.json"
    digest = hashlib.sha256(IMAGE).hexdigest()
    path.write_text(json.dumps({digest: CACHED_LABEL.model_dump()}))
    assert load_demo_cache(path) == DEMO_CACHE


@pytest.mark.parametrize(
    "entries",
    [
        {"not-a-sha256": LABEL},
        {hashlib.sha256(IMAGE).hexdigest(): {"brand": LABEL["brand"]}},
    ],
)
def test_demo_cache_rejects_malformed_entry(
    tmp_path: Path, entries: dict[str, object]
) -> None:
    path = tmp_path / "demo_cache.json"
    path.write_text(json.dumps(entries))
    with pytest.raises(ValidationError):
        load_demo_cache(path)


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


def test_rejects_unreadable_image_before_request() -> None:
    client, requests = fake_client(json.dumps(LABEL))
    with pytest.raises(ValueError, match="not a readable image"):
        extract_label(b"not an image", client=client)
    assert requests == []


def test_missing_api_key_names_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUNPOD_ENDPOINT_URL", "https://runpod.test/v1")
    monkeypatch.delenv("RUNPOD_API_KEY", raising=False)
    with pytest.raises(ValidationError, match="RUNPOD_API_KEY"):
        extract_label(IMAGE)


def test_client_trusts_root_cas_when_cert_dir_set(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("RUNPOD_ENDPOINT_URL", "https://runpod.test/v1")
    monkeypatch.setenv("RUNPOD_API_KEY", "test-key")
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)
    # Replit's SSL_CERT_DIR lacks the root CA behind api.runpod.ai
    monkeypatch.setenv("SSL_CERT_DIR", str(tmp_path))
    transport = _runpod_client()._client._transport
    assert isinstance(transport, httpx2.HTTPTransport)
    context = transport._pool._ssl_context
    assert context is not None
    assert context.cert_store_stats()["x509_ca"] > 0


def test_rejects_response_without_choices() -> None:
    client = mock_client(
        lambda _: httpx2.Response(
            httpx2.codes.OK,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "test",
                "choices": [],
            },
        )
    )
    with pytest.raises(ExtractionError, match="no choices"):
        extract_label(IMAGE, client=client)
