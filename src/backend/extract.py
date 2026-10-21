"""Schema for vision-model output of delivery label fields."""

from pydantic import BaseModel, ConfigDict, Field


class LabelExtraction(BaseModel):
    """Fields printed on one delivery label, null if unreadable."""

    model_config = ConfigDict(extra="forbid")

    product_name: str | None = Field(description="Product name on the label")
    brand: str | None = Field(description="Brand name on the label")
    manufacturer: str | None = Field(
        description="Manufacturer name on the label"
    )
    halal_mark_present: bool | None = Field(
        description="Presence of a halal mark on the label"
    )
