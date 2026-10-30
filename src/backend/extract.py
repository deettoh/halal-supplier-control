"""RunPod extractor for delivery labels and halal certificates."""

import base64
import functools
import hashlib
import logging
import os
import ssl
from collections.abc import Mapping
from pathlib import Path
from types import MappingProxyType
from typing import Annotated

import certifi
from openai import APIError, DefaultHttpx2Client, OpenAI
from openai.types.chat import ChatCompletionUserMessageParam
from openai.types.shared_params import ResponseFormatJSONSchema
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    SecretStr,
    StringConstraints,
    TypeAdapter,
    ValidationError,
)

from backend.images import IMAGE_FORMAT as IMAGE_FORMAT
from backend.images import JPEG_QUALITY as JPEG_QUALITY
from backend.images import as_jpeg
from backend.schemas import CertificateExtraction, LabelExtraction

__all__ = [
    "CERTIFICATE_JSON_SCHEMA",
    "LABEL_JSON_SCHEMA",
    "CertificateExtraction",
    "ExtractionError",
    "LabelExtraction",
    "extract_certificate",
    "extract_label",
    "load_demo_cache",
]

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Extraction failure with a message safe to store or return."""


class RunPodConfig(BaseModel):
    """RunPod endpoint settings from the environment."""

    model_config = ConfigDict(frozen=True)

    endpoint_url: HttpUrl = Field(
        alias="RUNPOD_ENDPOINT_URL",
        description="OpenAI-compatible base URL of the endpoint",
    )
    api_key: SecretStr = Field(
        alias="RUNPOD_API_KEY", description="RunPod API key"
    )


LABEL_JSON_SCHEMA = LabelExtraction.model_json_schema()
RESPONSE_FORMAT: ResponseFormatJSONSchema = {
    "type": "json_schema",
    "json_schema": {"name": "label_extraction", "schema": LABEL_JSON_SCHEMA},
}
CERTIFICATE_JSON_SCHEMA = CertificateExtraction.model_json_schema()
CERTIFICATE_RESPONSE_FORMAT: ResponseFormatJSONSchema = {
    "type": "json_schema",
    "json_schema": {
        "name": "certificate_extraction",
        "schema": CERTIFICATE_JSON_SCHEMA,
    },
}
MODEL_ID = "qwen/qwen3-vl-8b-instruct"
IMAGE_MIME_TYPE = "image/jpeg"
TEMPERATURE = 0
TIMEOUT_SECONDS = 180
MAX_RETRIES = 0
MAX_IMAGE_SIDE = 1280
EXTRACTION_PROMPT = (
    "Read this delivery label. Return the product name, brand, "
    "manufacturer, and whether a halal mark is printed on it. The "
    "manufacturer is the company that made or packed the product, not "
    "a customer or a 'Supplied to' name. Use null for any field you "
    "cannot read."
)
CERTIFICATE_PROMPT = (
    "Read this halal certificate. Return the issuing body, the "
    "certificate or reference number, the holder company name, the "
    "valid-until date as YYYY-MM-DD, and every product with its brand "
    "from the scope table. Use null for any field you cannot read."
)


ImageDigest = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
DEMO_CACHE_PATH = Path(__file__).with_name("demo_cache.json")
_DEMO_CACHE = TypeAdapter(dict[ImageDigest, LabelExtraction])


@functools.cache
def load_demo_cache(
    path: Path = DEMO_CACHE_PATH,
) -> Mapping[str, LabelExtraction]:
    """Return cached labels keyed by the SHA-256 hex of photo bytes.

    Args:
        path: JSON file of cached labels.

    Returns:
        Read-only mapping from image digest to label.

    Raises:
        pydantic.ValidationError: If a key is not a SHA-256 hex digest
            or a label fails the label schema.
    """
    return MappingProxyType(_DEMO_CACHE.validate_json(path.read_bytes()))


def _runpod_client() -> OpenAI:
    """Return a client built from the RunPod environment variables."""
    config = RunPodConfig.model_validate(dict(os.environ))
    return OpenAI(
        base_url=str(config.endpoint_url),
        api_key=config.api_key.get_secret_value(),
        # fixed roots since Replit's SSL_CERT_DIR lacks RunPod's root CA
        http_client=DefaultHttpx2Client(
            verify=ssl.create_default_context(cafile=certifi.where())
        ),
    )


def _compressed(image: bytes) -> bytes:
    """Return image as an upright, downscaled JPEG.

    Args:
        image: Label or certificate photo readable by Pillow.

    Returns:
        JPEG bytes with the longest side at most MAX_IMAGE_SIDE.

    Raises:
        ValueError: If Pillow cannot identify image as a picture.
    """
    try:
        return as_jpeg(image, max_side=MAX_IMAGE_SIDE)
    except ValueError as error:
        raise ValueError("image is not a readable image") from error


def _image_message(
    image: bytes, prompt: str
) -> ChatCompletionUserMessageParam:
    """Return the user message carrying image and prompt."""
    encoded = base64.b64encode(image).decode("ascii")
    return {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{IMAGE_MIME_TYPE};base64,{encoded}"
                },
            },
            {"type": "text", "text": prompt},
        ],
    }


def _cached_label(
    image: bytes,
    cache: Mapping[str, LabelExtraction] | None,
    failure: APIError,
) -> LabelExtraction:
    """Return the cached label for image after a failed request.

    Args:
        image: Delivery label photo.
        cache: Labels by image digest or None for the demo cache file.
        failure: Error of the failed endpoint request.

    Returns:
        Label stored under the SHA-256 hex digest of image.

    Raises:
        ExtractionError: If the cache holds no label for image.
        pydantic.ValidationError: If the demo cache file is invalid.
    """
    labels = load_demo_cache() if cache is None else cache
    cached = labels.get(hashlib.sha256(image).hexdigest())
    reason = type(failure).__name__
    if cached is None:
        raise ExtractionError(f"RunPod request failed: {reason}") from failure
    logger.warning("RunPod request failed (%s); serving cached label", reason)
    return cached


def _completion(
    image: bytes,
    prompt: str,
    response_format: ResponseFormatJSONSchema,
    client: OpenAI | None,
) -> str:
    """Send image with prompt to the endpoint and return the reply.

    Args:
        image: Photo to read.
        prompt: Instruction sent after the image.
        response_format: Structured output format for the reply.
        client: Endpoint client or None for the RunPod endpoint.

    Returns:
        Message content of the first reply choice.

    Raises:
        ValueError: If image is empty or not a readable image.
        openai.APIError: If the request fails.
        ExtractionError: If the reply has no choices or no content.
        pydantic.ValidationError: If a RunPod environment variable is
            invalid.
    """
    if not image:
        raise ValueError("image is empty")
    message = _image_message(_compressed(image), prompt)
    endpoint = _runpod_client() if client is None else client
    completion = endpoint.with_options(
        timeout=TIMEOUT_SECONDS, max_retries=MAX_RETRIES
    ).chat.completions.create(
        model=MODEL_ID,
        messages=[message],
        response_format=response_format,
        temperature=TEMPERATURE,
    )
    if not completion.choices:
        raise ExtractionError("model reply has no choices")
    content = completion.choices[0].message.content
    if content is None:
        raise ExtractionError("model reply has no content")
    return content


def extract_label(
    image: bytes,
    *,
    client: OpenAI | None = None,
    cache: Mapping[str, LabelExtraction] | None = None,
) -> LabelExtraction:
    """Send image to the RunPod endpoint and return the label fields.

    Args:
        image: Delivery label photo.
        client: Endpoint client or None for the RunPod endpoint.
        cache: Labels by image digest or None for the demo cache file.

    Returns:
        Fields parsed from the model's JSON reply or the cached label
        for image if the request fails.

    Raises:
        ValueError: If image is empty or not a readable image.
        ExtractionError: If the request fails with no cached label or
            the reply is invalid.
        pydantic.ValidationError: If a RunPod environment variable or
            the demo cache file is invalid.
    """
    try:
        content = _completion(
            image, EXTRACTION_PROMPT, RESPONSE_FORMAT, client
        )
    except APIError as exc:
        return _cached_label(image, cache, exc)
    try:
        return LabelExtraction.model_validate_json(content)
    except ValidationError as exc:
        raise ExtractionError("model reply failed the label schema") from exc


def extract_certificate(
    image: bytes, *, client: OpenAI | None = None
) -> CertificateExtraction:
    """Send image to RunPod and return the certificate fields.

    Args:
        image: Halal certificate photo.
        client: Endpoint client or None for the RunPod endpoint.

    Returns:
        Fields parsed from the model's JSON reply.

    Raises:
        ValueError: If image is empty or not a readable image.
        ExtractionError: If the request fails or the reply is invalid.
        pydantic.ValidationError: If a RunPod environment variable is
            invalid.
    """
    try:
        content = _completion(
            image, CERTIFICATE_PROMPT, CERTIFICATE_RESPONSE_FORMAT, client
        )
    except APIError as exc:
        reason = type(exc).__name__
        raise ExtractionError(f"RunPod request failed: {reason}") from exc
    try:
        return CertificateExtraction.model_validate_json(content)
    except ValidationError as exc:
        raise ExtractionError(
            "model reply failed the certificate schema"
        ) from exc
