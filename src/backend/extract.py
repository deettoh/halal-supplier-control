"""Stub extractor; LabelExtraction is re-exported for existing callers."""

from backend.schemas import LabelExtraction

__all__ = ["STUB_LABEL", "LabelExtraction", "extract_label"]


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
