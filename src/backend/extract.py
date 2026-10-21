"""RunPod extractor using the shared label schema."""

import base64
import os

from openai import OpenAI
from openai.types.shared_params import ResponseFormatJSONSchema
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, SecretStr

from backend.schemas import LabelExtraction

__all__ = ["LABEL_JSON_SCHEMA", "LabelExtraction", "extract_label"]


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
IMAGE_MIME_TYPE = "image/jpeg"
TEMPERATURE = 0
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
        ValueError: If image is empty or the reply has no content.
        pydantic.ValidationError: If a RunPod environment variable is
            missing or invalid, or the reply fails the label schema.
    """
    if not image:
        raise ValueError("label image is empty")
    endpoint = _runpod_client() if client is None else client
    encoded = base64.b64encode(image).decode("ascii")
    completion = endpoint.chat.completions.create(
        model=MODEL_ID,
        messages=[
            {
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
        ],
        response_format=RESPONSE_FORMAT,
        temperature=TEMPERATURE,
    )
    content = completion.choices[0].message.content
    if content is None:
        raise ValueError("model reply has no content")
    return LabelExtraction.model_validate_json(content)
