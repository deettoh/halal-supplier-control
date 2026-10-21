"""Label extraction schema and stub extractor."""

from pydantic import BaseModel, ConfigDict, Field


class LabelExtraction(BaseModel):
    """Fields printed on one delivery label, null if unreadable."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    product_name: str | None = Field(description="Product name on the label")
    brand: str | None = Field(description="Brand name on the label")
    manufacturer: str | None = Field(
        description="Manufacturer name on the label"
    )
    halal_mark_present: bool | None = Field(
        description="Presence of a halal mark on the label"
    )


STUB_LABEL = LabelExtraction(
    product_name="Tepung Gandum Serbaguna",
    brand="Bunga Mawar",
    manufacturer="Kilang Tepung Contoh Sdn Bhd",
    halal_mark_present=True,
)


def extract_label(image: bytes) -> LabelExtraction:
    """Return the fictional stub label.

    Args:
        image: Image of one delivery label.

    Returns:
        STUB_LABEL, independent of the image content.

    Raises:
        ValueError: If image is empty.
    """
    if not image:
        raise ValueError("label image is empty")
    return STUB_LABEL
