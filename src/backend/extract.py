"""RunPod extractor using the shared label schema."""

import base64
import os

from openai import APIError, OpenAI
from openai.types.chat import ChatCompletionUserMessageParam
from openai.types.shared_params import ResponseFormatJSONSchema
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    SecretStr,
    ValidationError,
)

from backend.schemas import LabelExtraction

__all__ = [
    "LABEL_JSON_SCHEMA",
    "ExtractionError",
    "LabelExtraction",
    "extract_label",
]


class ExtractionError(Exception):
    """Label extraction failure with a message safe to store."""


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
MODEL_ID = "qwen/qwen3-vl-8b-instruct"
IMAGE_MIME_TYPE = "image/png"
TEMPERATURE = 0
TIMEOUT_SECONDS = 180
MAX_RETRIES = 0
EXTRACTION_PROMPT = (
    "Read this delivery label. Return the product name, brand, "
    "manufacturer, and whether a halal mark is printed on it. Use null "
    "for any field you cannot read."
)


def _runpod_client() -> OpenAI:
    """Return a client built from the RunPod environment variables."""
    config = RunPodConfig.model_validate(dict(os.environ))
    return OpenAI(
        base_url=str(config.endpoint_url),
        api_key=config.api_key.get_secret_value(),
    )


def _label_message(image: bytes) -> ChatCompletionUserMessageParam:
    """Return the user message carrying image and the prompt."""
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
            {"type": "text", "text": EXTRACTION_PROMPT},
        ],
    }


def extract_label(
    image: bytes, *, client: OpenAI | None = None
) -> LabelExtraction:
    """Send image to the RunPod endpoint and return the label fields.

    Args:
        image: Delivery label photo.
        client: Endpoint client or None for the RunPod endpoint.

    Returns:
        Fields parsed from the model's JSON reply.

    Raises:
        ValueError: If image is empty.
        ExtractionError: If the request fails or the reply is invalid.
        pydantic.ValidationError: If a RunPod environment variable is
            missing or invalid.
    """
    if not image:
        raise ValueError("label image is empty")
    endpoint = _runpod_client() if client is None else client
    try:
        completion = endpoint.with_options(
            timeout=TIMEOUT_SECONDS, max_retries=MAX_RETRIES
        ).chat.completions.create(
            model=MODEL_ID,
            messages=[_label_message(image)],
            response_format=RESPONSE_FORMAT,
            temperature=TEMPERATURE,
        )
    except APIError as exc:
        raise ExtractionError(
            f"RunPod request failed: {type(exc).__name__}"
        ) from exc
    if not completion.choices:
        raise ExtractionError("model reply has no choices")
    content = completion.choices[0].message.content
    if content is None:
        raise ExtractionError("model reply has no content")
    try:
        return LabelExtraction.model_validate_json(content)
    except ValidationError as exc:
        raise ExtractionError("model reply failed the label schema") from exc
