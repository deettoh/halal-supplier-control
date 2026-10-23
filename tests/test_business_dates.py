"""Use the Malaysian calendar for expiry checks, retaining UTC audit times."""

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from backend import db, extract
from backend.schemas import LabelExtraction

TENANT = "Sunrise Bakery SAMPLE"


@pytest.mark.parametrize(
    ("instant", "expected"),
    [
        ("2026-10-21T15:59:59+00:00", date(2026, 10, 21)),
        ("2026-10-21T16:00:00+00:00", date(2026, 10, 22)),
        ("2026-12-31T16:00:00+00:00", date(2027, 1, 1)),
    ],
)
def test_business_today_at_local_midnight(
    monkeypatch: pytest.MonkeyPatch, instant: str, expected: date
) -> None:
    monkeypatch.setattr(db, "utc_now", lambda: datetime.fromisoformat(instant))
    assert db.business_today() == expected


@pytest.mark.parametrize(
    ("hour", "coverage", "verdict"),
    [(15, "expiring", "expiring"), (16, "not_covered", "not_covered")],
)
def test_reads_and_delivery_rules_share_malaysian_date(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    hour: int,
    coverage: str,
    verdict: str,
) -> None:
    from pathlib import Path

    instant = datetime(2026, 10, 21, hour, 59, tzinfo=UTC)
    monkeypatch.setattr(db, "utc_now", lambda: instant)
    monkeypatch.setattr(
        extract,
        "extract_label",
        lambda _: LabelExtraction(
            product_name="Wheat Flour",
            brand="GoldenMill",
            manufacturer="Golden Grain Foods",
            halal_mark_present=True,
        ),
    )
    with Session(api_engine) as session:
        cert = session.get(db.Certificate, 1)
        assert cert is not None
        cert.expiry_date = date(2026, 10, 21)
        session.commit()
    headers = {"X-Demo-Role": "staff", "X-Demo-Tenant": TENANT}
    materials = api_client.get("/api/materials", headers=headers).json()
    assert materials[0]["coverage_status"] == coverage
    image = (
        Path(__file__).parent / "fixtures/synthetic_label.png"
    ).read_bytes()
    response = api_client.post(
        "/api/deliveries",
        headers=headers,
        data={"material_id": "1"},
        files={"image": ("label.png", image, "image/png")},
    )
    assert response.status_code == 201
    assert response.json()["verdict"] == verdict
    with Session(api_engine) as session:
        row = session.get(db.Delivery, response.json()["id"])
        assert row is not None
        stamp = row.created_at
        if stamp.tzinfo is None:  # SQLite drops timezone metadata.
            stamp = stamp.replace(tzinfo=UTC)
        assert stamp == instant
