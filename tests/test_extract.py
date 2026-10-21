"""Tests for the label extraction schema."""

import pytest
from pydantic import ValidationError

from backend.extract import LabelExtraction

LABEL_FIELDS = {"product_name", "brand", "manufacturer", "halal_mark_present"}


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
