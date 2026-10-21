"""Tests for the label extraction schema and stub extractor."""

import pytest
from pydantic import ValidationError

from backend.extract import LabelExtraction, extract_label

LABEL_FIELDS = {"product_name", "brand", "manufacturer"}


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


def test_stub_returns_fully_populated_label() -> None:
    label = extract_label(b"\x89PNG fake image bytes")
    assert set(label.model_dump()) == LABEL_FIELDS
    assert all(value is not None for value in label.model_dump().values())


def test_stub_rejects_empty_image() -> None:
    with pytest.raises(ValueError, match="empty"):
        extract_label(b"")


def test_stub_label_cannot_be_mutated_by_caller() -> None:
    label = extract_label(b"\x89PNG fake image bytes")
    with pytest.raises(ValidationError):
        label.brand = "Other Brand"
