"""Live tests of extract_label against the RunPod endpoint."""

from pathlib import Path

import pytest

from backend.extract import extract_label

LABEL_PHOTO = Path(__file__).parent / "fixtures" / "synthetic_label.png"
HIDDEN_MANUFACTURER_PHOTO = (
    Path(__file__).parent / "eval" / "finals" / "images" / "L32.png"
)


@pytest.mark.live
def test_endpoint_reads_synthetic_label() -> None:
    label = extract_label(LABEL_PHOTO.read_bytes())
    text_fields = (label.product_name, label.brand, label.manufacturer)
    assert [field and field.casefold() for field in text_fields] == [
        "sos cili pedas",
        "dapur seri",
        "syarikat makanan contoh sdn bhd",
    ]
    assert label.halal_mark_present is True


@pytest.mark.live
def test_endpoint_ignores_supplied_to_name() -> None:
    label = extract_label(HIDDEN_MANUFACTURER_PHOTO.read_bytes())
    assert label.manufacturer is None
