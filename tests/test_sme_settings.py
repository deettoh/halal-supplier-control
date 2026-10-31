"""Check that a persisted policy affects only its own tenant."""

from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import Engine, delete, select, text
from sqlalchemy.orm import Session

from backend import db, extract, rules, services
from backend.reset_demo import reset_demo_database
from backend.schemas import LabelExtraction
from backend.seed import DEFAULT_SEED_PATH, SeedData
from backend.settings import RuleSettings, seed_rule_settings
from backend.startup import bootstrap_database

BAKERY = "Sunrise Bakery SAMPLE"
CATERER = "Crescent Caterer SAMPLE"
PHOTO = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()


def headers(tenant: str) -> dict[str, str]:
    return {
        "X-Demo-Role": "staff",
        "X-Demo-Tenant": tenant,
        "X-Demo-Person": "1" if tenant == BAKERY else "3",
    }


@pytest.mark.parametrize(
    "change",
    [
        {"match_threshold": -1},
        {"match_threshold": 101},
        {"match_threshold": float("nan")},
        {"expiry_warning_days": -1},
        {"expiry_warning_days": 1.5},
        {"expiry_warning_days": True},
        {"recognised_issuers": []},
        {"recognised_issuers": [" "]},
    ],
)
def test_policy_rejects_invalid_configuration(
    change: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        RuleSettings.model_validate(
            {**seed_rule_settings(BAKERY).model_dump(), **change}
        )


def test_seed_policy_is_unique_per_sme() -> None:
    seed = SeedData.model_validate_json(DEFAULT_SEED_PATH.read_text())
    assert {p.tenant for p in seed.sme_settings} == {BAKERY, CATERER}
    assert seed_rule_settings(BAKERY).expiry_warning_days == 60
    assert seed_rule_settings(CATERER).expiry_warning_days == 45
    with pytest.raises(
        ValidationError, match="Duplicate SME settings tenants"
    ):
        SeedData.model_validate(
            {
                "sme_settings": [
                    seed.sme_settings[0].model_dump(),
                    {**seed.sme_settings[0].model_dump(), "id": 3},
                ]
            }
        )
    with pytest.raises(ValueError):
        seed_rule_settings("Unknown SME")


@pytest.mark.parametrize("tenant, boundary", [(BAKERY, 60), (CATERER, 45)])
def test_seed_warning_window_is_inclusive(tenant: str, boundary: int) -> None:
    material = {
        "tenant": tenant,
        "name": "Wheat Flour",
        "approved_brand": "GoldenMill",
        "approved_manufacturer": "Golden Grain Foods",
    }
    label = {
        "product_name": "Wheat Flour",
        "brand": "GoldenMill",
        "manufacturer": "Golden Grain Foods",
        "halal_mark_present": True,
    }
    for days, expected in [(boundary, "expiring"), (boundary + 1, "covered")]:
        result = rules.evaluate(
            label,
            material,
            {
                "issuer": "SAMPLE Food Certification Council",
                "scope": ["Wheat Flour"],
                "expiry_date": db.business_today() + timedelta(days=days),
            },
            db.business_today(),
        )
        assert result["verdict"] == expected


@pytest.mark.parametrize("setting", ["expiry", "threshold", "issuer"])
def test_delivery_and_masterlist_use_database_policy_for_each_sme(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    setting: str,
) -> None:
    with Session(api_engine) as session:
        policy = session.scalar(
            select(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        cert = session.get(db.Certificate, 1)
        assert policy is not None and cert is not None
        cert.expiry_date = db.business_today() + timedelta(
            days=50 if setting == "expiry" else 100
        )
        if setting == "threshold":
            policy.match_threshold = 99
        elif setting == "issuer":
            policy.recognised_issuers = ["OTHER SAMPLE issuer"]
        session.commit()
    monkeypatch.setattr(
        extract,
        "extract_label",
        lambda _: LabelExtraction(
            product_name="Wheat Flour",
            brand="GoldenMill",
            manufacturer="Golden Grain Food"
            if setting == "threshold"
            else "Golden Grain Foods",
            halal_mark_present=True,
        ),
    )
    expected = {
        "expiry": ("expiring", "covered"),
        "threshold": ("covered", "substitution"),
        "issuer": ("covered", "not_covered"),
    }[setting]
    for (tenant, material_id), verdict in zip(
        [(BAKERY, 1), (CATERER, 9)], expected, strict=True
    ):
        material = api_client.get("/api/materials", headers=headers(tenant))
        assert material.status_code == 200
        assert material.json()[0]["coverage_status"] == (
            "covered" if setting == "threshold" else verdict
        )
        response = api_client.post(
            "/api/deliveries",
            headers=headers(tenant),
            data={"material_id": str(material_id)},
            files={"image": ("label.png", PHOTO, "image/png")},
        )
        assert response.status_code == 201
        assert response.json()["verdict"] == verdict
    # the materials read uses the edited database policy
    with Session(api_engine) as session:
        saved = list(
            session.scalars(select(db.Delivery).order_by(db.Delivery.id))
        )
        assert [row.verdict for row in saved] == list(expected)
        policy = session.scalar(
            select(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        assert policy is not None
        policy.expiry_warning_days = 120
        policy.recognised_issuers = ["SAMPLE Food Certification Council"]
        session.commit()
    assert (
        api_client.get("/api/materials", headers=headers(CATERER)).json()[0][
            "coverage_status"
        ]
        == "expiring"
    )


def test_missing_policy_fails_before_extracting_or_saving(
    api_client: TestClient, api_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    with Session(api_engine) as session:
        session.execute(
            delete(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        session.commit()

    def forbidden(_: bytes) -> LabelExtraction:
        pytest.fail(
            "Missing SME settings must be detected before AI extraction"
        )

    monkeypatch.setattr(extract, "extract_label", forbidden)
    response = api_client.post(
        "/api/deliveries",
        headers=headers(CATERER),
        data={"material_id": "9"},
        files={"image": ("label.png", PHOTO, "image/png")},
    )
    assert response.status_code == 503
    assert response.json() == {
        "detail": "SME rule settings are not configured"
    }
    with Session(api_engine) as session:
        assert session.scalar(select(db.Delivery)) is None


def test_startup_backfills_only_missing_policy_and_reset_restores_seed(
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        policy = session.scalar(
            select(db.SMESettings).where(db.SMESettings.tenant == BAKERY)
        )
        assert policy is not None
        policy.expiry_warning_days = 20
        session.execute(
            delete(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        session.commit()
    assert bootstrap_database(api_engine)["sme_settings"] == 1
    assert bootstrap_database(api_engine)["sme_settings"] == 0
    with Session(api_engine) as session:
        assert (
            services.rule_settings(session, BAKERY).expiry_warning_days == 20
        )
        assert (
            services.rule_settings(session, CATERER).expiry_warning_days == 45
        )
    counts = reset_demo_database(api_engine)
    assert counts["sme_settings"] == 2
    with Session(api_engine) as session:
        assert (
            services.rule_settings(session, BAKERY).expiry_warning_days == 60
        )


def test_existing_database_gains_settings_without_reset(
    api_engine: Engine,
) -> None:
    with api_engine.begin() as connection:
        table = db.qualified_table_name(connection, "sme_settings")
        connection.execute(text(f"DROP TABLE {table}"))
    assert bootstrap_database(api_engine)["sme_settings"] == 2
    with Session(api_engine) as session:
        assert session.get(db.Supplier, 1) is not None
        assert (
            services.rule_settings(session, CATERER).expiry_warning_days == 45
        )
