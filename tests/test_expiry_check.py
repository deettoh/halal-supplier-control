"""Manual reviewer expiry checks, tenant windows and durable idempotency."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, event, func, select, text
from sqlalchemy.orm import Session

from backend import db

BAKERY = "Sunrise Bakery SAMPLE"
CATERER = "Crescent Caterer SAMPLE"
ENDPOINT = "/api/registry/expiry-check"
REVIEWER = {
    "X-Demo-Role": "reviewer",
    "X-Demo-Tenant": "registry",
    "X-Demo-Person": "7",
}


def logs(engine: Engine) -> list[tuple[str, str, str | None, str]]:
    with Session(engine) as session:
        return [
            (r.tenant, r.actor, r.actor_title, r.action)
            for r in session.scalars(
                select(db.ActivityLog).order_by(db.ActivityLog.id)
            )
        ]


@pytest.mark.parametrize(
    "days, expected_tenants",
    [
        (-1, set()),
        (0, {BAKERY, CATERER}),
        (45, {BAKERY, CATERER}),
        (46, {BAKERY}),
        (60, {BAKERY}),
        (61, set()),
    ],
)
def test_sme_windows_and_repeat_clicks(
    api_client: TestClient,
    api_engine: Engine,
    days: int,
    expected_tenants: set[str],
) -> None:
    today = db.business_today()
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        certificate.expiry_date = today + timedelta(days=days)
        session.commit()
    response = api_client.post(ENDPOINT, headers=REVIEWER)
    assert response.status_code == 200
    assert response.json() == {
        "certificates_checked": 2,
        "requests_created": int(bool(expected_tenants)),
    }
    events = logs(api_engine)
    assert {r[0] for r in events} == expected_tenants
    assert len(events) == len(expected_tenants)
    assert all(
        r[1:] == ("Nadia", "Registry reviewer", "renewal_requested")
        for r in events
    )
    with Session(api_engine) as session:
        cert = session.get(db.Certificate, 1)
        assert cert is not None
        assert cert.renewal_requested_on == (
            today if expected_tenants else None
        )
        assert cert.status == "active"
        assert (
            session.scalar(select(func.count()).select_from(db.Certificate))
            == 4
        )
        for row in session.scalars(select(db.ActivityLog)):
            assert row.supplier_name == "Golden Grain Supplies SAMPLE"
            assert row.material_name is None
            assert row.verdict is None
            assert row.delivery_id is None
            assert "SAMPLE-GGS-2026-001" in (row.reason or "")
    assert api_client.post(ENDPOINT, headers=REVIEWER).json() == {
        "certificates_checked": 2,
        "requests_created": 0,
    }
    assert logs(api_engine) == events
    supplier = {
        "X-Demo-Role": "supplier",
        "X-Demo-Tenant": "1",
        "X-Demo-Person": "5",
    }
    certificates = api_client.get("/api/certificates", headers=supplier).json()
    active = next(c for c in certificates if c["id"] == 1)
    assert active["renewal_requested_on"] == (
        today.isoformat() if expected_tenants else None
    )
    assert (
        api_client.get("/api/registry/renewals", headers=REVIEWER).json() == []
    )


@pytest.mark.parametrize(
    "role, tenant, person, expected",
    [
        ("staff", BAKERY, "1", 403),
        ("supervisor", BAKERY, "2", 403),
        ("supplier", "1", "5", 403),
        ("reviewer", BAKERY, "7", 403),
        ("reviewer", "registry", "1", 403),
        ("reviewer", "registry", "999", 403),
        ("reviewer", "registry", None, 422),
    ],
)
def test_only_valid_reviewer_can_run_check(
    api_client: TestClient,
    api_engine: Engine,
    role: str,
    tenant: str,
    person: str | None,
    expected: int,
) -> None:
    headers = {"X-Demo-Role": role, "X-Demo-Tenant": tenant}
    if person is not None:
        headers["X-Demo-Person"] = person
    assert api_client.post(ENDPOINT, headers=headers).status_code == expected
    assert logs(api_engine) == []
    with Session(api_engine) as session:
        assert all(
            c.renewal_requested_on is None
            for c in session.scalars(select(db.Certificate))
        )


def test_empty_active_registry_returns_zero(
    api_client: TestClient, api_engine: Engine
) -> None:
    with Session(api_engine) as session:
        for row in session.scalars(select(db.Certificate)):
            row.status = "superseded"
        session.commit()
    assert api_client.post(ENDPOINT, headers=REVIEWER).json() == {
        "certificates_checked": 0,
        "requests_created": 0,
    }
    assert logs(api_engine) == []


def test_unlinked_supplier_is_checked_without_request(
    api_client: TestClient, api_engine: Engine
) -> None:
    with Session(api_engine) as session:
        session.execute(
            delete(db.Material).where(db.Material.supplier_id == 1)
        )
        session.commit()
    assert api_client.post(ENDPOINT, headers=REVIEWER).json() == {
        "certificates_checked": 2,
        "requests_created": 0,
    }
    assert logs(api_engine) == []


def test_global_request_marker_skips_later_sme_window(
    api_client: TestClient, api_engine: Engine
) -> None:
    with Session(api_engine) as session:
        cert = session.get(db.Certificate, 1)
        assert cert is not None
        cert.expiry_date = db.business_today() + timedelta(days=50)
        session.commit()
    assert (
        api_client.post(ENDPOINT, headers=REVIEWER).json()["requests_created"]
        == 1
    )
    assert {r[0] for r in logs(api_engine)} == {BAKERY}
    with Session(api_engine) as session:
        policy = session.scalar(
            select(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        assert policy is not None
        policy.expiry_warning_days = 60
        session.commit()
    assert (
        api_client.post(ENDPOINT, headers=REVIEWER).json()["requests_created"]
        == 0
    )
    assert {r[0] for r in logs(api_engine)} == {BAKERY}


def test_missing_sme_policy_rolls_back_request(
    api_client: TestClient, api_engine: Engine
) -> None:
    with Session(api_engine) as session:
        session.execute(
            delete(db.SMESettings).where(db.SMESettings.tenant == CATERER)
        )
        session.commit()
    assert api_client.post(ENDPOINT, headers=REVIEWER).status_code == 503
    assert logs(api_engine) == []
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        assert certificate.renewal_requested_on is None


def test_request_date_uses_malaysian_calendar(
    api_client: TestClient, api_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        db, "utc_now", lambda: datetime(2026, 10, 21, 16, tzinfo=UTC)
    )
    assert (
        api_client.post(ENDPOINT, headers=REVIEWER).json()["requests_created"]
        == 1
    )
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        assert certificate.renewal_requested_on is not None
        assert certificate.renewal_requested_on.isoformat() == "2026-10-22"


def test_failed_log_write_cannot_mark_request(
    api_client: TestClient, api_engine: Engine
) -> None:
    def fail_log(session: Session, *_: object) -> None:
        if any(isinstance(row, db.ActivityLog) for row in session.new):
            raise RuntimeError("Simulated failed activity write")

    event.listen(Session, "before_flush", fail_log)
    try:
        with pytest.raises(RuntimeError, match="Simulated"):
            api_client.post(ENDPOINT, headers=REVIEWER)
    finally:
        event.remove(Session, "before_flush", fail_log)
    assert logs(api_engine) == []
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        assert certificate.renewal_requested_on is None


def test_postgres_upgrade_preserves_records_and_widens_action(
    api_client: TestClient, api_engine: Engine
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL startup migration")
    with api_engine.begin() as connection:
        certs = db.qualified_table_name(connection, "certificates")
        activity = db.qualified_table_name(connection, "activity_log")
        connection.execute(
            text(f"ALTER TABLE {certs} DROP COLUMN renewal_requested_on")
        )
        connection.execute(
            text(f"ALTER TABLE {activity} DROP CONSTRAINT ck_activity_action")
        )
        old = db.ACTIVITY_ACTION_CHECK.replace(", 'renewal_requested'", "")
        connection.execute(
            text(
                f"ALTER TABLE {activity} ADD CONSTRAINT ck_activity_action "
                f"CHECK ({old})"
            )
        )
    db.init_db(api_engine)
    db.init_db(api_engine)
    assert api_client.post(ENDPOINT, headers=REVIEWER).json() == {
        "certificates_checked": 2,
        "requests_created": 1,
    }
    assert len(logs(api_engine)) == 2


def test_concurrent_reviewer_clicks_create_one_request(
    api_client: TestClient, api_engine: Engine
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock behavior")

    def run(_: int) -> int:
        response = api_client.post(ENDPOINT, headers=REVIEWER)
        assert response.status_code == 200
        return int(response.json()["requests_created"])

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(run, [1, 2])) == [0, 1]
    assert len(logs(api_engine)) == 2
