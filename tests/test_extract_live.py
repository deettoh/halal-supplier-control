"""Live tests of the extractors against the RunPod endpoint."""

import json
from datetime import date
from pathlib import Path

import pytest

from backend.extract import extract_certificate, extract_label

LABEL_PHOTO = Path(__file__).parent / "fixtures" / "synthetic_label.png"
HIDDEN_MANUFACTURER_PHOTO = (
    Path(__file__).parent / "eval" / "finals" / "images" / "L32.png"
)
SEED_DIR = Path(__file__).parents[1] / "src" / "seed"


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


@pytest.mark.live
def test_endpoint_reads_seed_certificate() -> None:
    seed = json.loads((SEED_DIR / "seed.json").read_text())["certificates"][0]
    certificate = extract_certificate(
        (SEED_DIR / seed["image_file"]).read_bytes()
    )
    assert certificate.cert_no == seed["cert_no"]
    assert certificate.holder_name == seed["holder_name"]
    assert certificate.expiry_date == date.fromisoformat(seed["expiry_date"])
    assert certificate.scope is not None
    assert [
        (item.product_name.casefold(), (item.brand or "").casefold())
        for item in certificate.scope
    ] == [
        (item["product_name"].casefold(), item["brand"].casefold())
        for item in seed["scope"]
    ]
