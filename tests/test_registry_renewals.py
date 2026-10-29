"""Registry renewal workflow through the public API, with no model calls."""

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event, text
from sqlalchemy.orm import Session

from backend import db

BAKERY = "Sunrise Bakery SAMPLE"
CATERER = "Crescent Caterer SAMPLE"


def identity(role: str, tenant: str, person: int) -> dict[str, str]:
    return {
        "X-Demo-Role": role,
        "X-Demo-Tenant": tenant,
        "X-Demo-Person": str(person),
    }


SUPPLIER = identity("supplier", "1", 5)
REVIEWER = identity("reviewer", "registry", 7)


def submit(client: TestClient, number: str = "SAMPLE-RENEWAL") -> Any:
    return client.post(
        "/api/certificates",
        headers=SUPPLIER,
        data={
            "issuer": "SAMPLE Food Certification Council",
            "cert_no": number,
            "holder_name": "Golden Grain Supplies SAMPLE",
            "expiry_date": "2027-12-31",
            "scope": json.dumps(
                [{"product_name": "Wheat Flour", "brand": "GoldenMill"}]
            ),
        },
    )


def coverage(client: TestClient) -> list[list[dict[str, Any]]]:
    return [
        client.get(
            "/api/materials", headers=identity("staff", tenant, person)
        ).json()
        for tenant, person in ((BAKERY, 1), (CATERER, 3))
    ]


def test_pending_renewal_leaves_both_smes_unchanged(
    api_client: TestClient,
) -> None:
    before = coverage(api_client)
    response = submit(api_client)
    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    assert coverage(api_client) == before
    certificates = api_client.get("/api/certificates", headers=SUPPLIER).json()
    assert (
        next(row for row in certificates if row["id"] == 1)["status"]
        == "active"
    )


@pytest.mark.parametrize("decision", ["verify", "reject"])
def test_reviewer_decision_updates_coverage_and_named_logs(
    api_client: TestClient, decision: str
) -> None:
    before = coverage(api_client)
    renewal = submit(api_client).json()
    pending = api_client.get("/api/registry/renewals", headers=REVIEWER)
    assert pending.status_code == 200
    assert pending.json()[0]["renewal"]["id"] == renewal["id"]
    assert pending.json()[0]["current"]["id"] == 1
    response = api_client.post(
        f"/api/registry/renewals/{renewal['id']}/decision",
        headers=REVIEWER,
        json={"decision": decision, "note": " Checked documents "},
    )
    assert response.status_code == 200
    saved = response.json()
    assert saved["status"] == (
        "active" if decision == "verify" else "rejected"
    )
    assert saved["review_note"] == "Checked documents"
    assert saved["reviewed_by"] == "Nadia"
    after = coverage(api_client)
    if decision == "reject":
        assert after == before
    else:
        for rows in after:
            assert rows[0]["coverage_status"] == "covered"
            assert rows[0]["certificate_expiry_date"] == "2027-12-31"
    for tenant, person in ((BAKERY, 2), (CATERER, 4)):
        events = api_client.get(
            "/api/activity", headers=identity("supervisor", tenant, person)
        ).json()
        assert [
            (row["actor"], row["action"], row["reason"]) for row in events
        ] == [
            (
                "Nadia",
                "certificate_renewed"
                if decision == "verify"
                else "certificate_rejected",
                "Checked documents",
            ),
            ("Hakim", "certificate_submitted", None),
        ]
    assert (
        api_client.get("/api/registry/renewals", headers=REVIEWER).json() == []
    )


def test_existing_postgres_schema_upgrades_without_losing_certificates(
    api_engine: Engine, api_client: TestClient
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL deployment upgrade")
    before = api_client.get("/api/certificates", headers=SUPPLIER).json()
    with api_engine.begin() as connection:
        certs = db.qualified_table_name(connection, "certificates")
        log = db.qualified_table_name(connection, "activity_log")
        for column in ("review_note", "reviewed_by", "created_at"):
            connection.execute(
                text(f"ALTER TABLE {certs} DROP COLUMN {column}")
            )
        connection.execute(
            text(f"ALTER TABLE {certs} DROP CONSTRAINT ck_certificate_status")
        )
        connection.execute(
            text(
                f"ALTER TABLE {certs} ADD CONSTRAINT ck_certificate_status "
                "CHECK (status IN ('active', 'superseded'))"
            )
        )
        connection.execute(
            text(f"ALTER TABLE {log} DROP CONSTRAINT ck_activity_action")
        )
        connection.execute(
            text(
                f"ALTER TABLE {log} ADD CONSTRAINT ck_activity_action "
                "CHECK (action IN ('auto_accepted', 'pending_review', "
                "'accepted', 'rejected', 'certificate_renewed'))"
            )
        )
        connection.execute(
            text(f"ALTER TABLE {log} DROP CONSTRAINT ck_activity_role")
        )
        connection.execute(
            text(
                f"ALTER TABLE {log} ADD CONSTRAINT ck_activity_role "
                "CHECK (role IN ('staff', 'supervisor', 'supplier'))"
            )
        )
    db.init_db(api_engine)
    db.init_db(api_engine)
    assert (
        api_client.get("/api/certificates", headers=SUPPLIER).json() == before
    )
    renewal = submit(api_client)
    assert renewal.status_code == 201
    assert (
        api_client.post(
            f"/api/registry/renewals/{renewal.json()['id']}/decision",
            headers=REVIEWER,
            json={"decision": "verify", "note": "Upgraded database"},
        ).status_code
        == 200
    )


def test_duplicate_submission_and_repeat_decision_conflict(
    api_client: TestClient,
) -> None:
    renewal = submit(api_client).json()
    response = submit(api_client, "SAMPLE-SECOND")
    assert response.status_code == 409
    assert response.json() == {
        "detail": "A renewal is already waiting for review"
    }
    path = f"/api/registry/renewals/{renewal['id']}/decision"
    body = {"decision": "reject", "note": "Wrong document"}
    assert (
        api_client.post(path, headers=REVIEWER, json=body).status_code == 200
    )
    response = api_client.post(path, headers=REVIEWER, json=body)
    assert response.status_code == 409
    assert response.json() == {"detail": "Renewal already reviewed"}
    assert submit(api_client, "SAMPLE-RETRY").status_code == 201


@pytest.mark.parametrize(
    "headers",
    [
        identity("staff", BAKERY, 1),
        identity("supervisor", BAKERY, 2),
        SUPPLIER,
        identity("reviewer", BAKERY, 7),
        identity("reviewer", "registry", 5),
        identity("reviewer", "registry", 999),
    ],
)
def test_only_valid_reviewer_can_read_or_decide(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    renewal = submit(api_client).json()
    before = coverage(api_client)
    assert (
        api_client.get("/api/registry/renewals", headers=headers).status_code
        == 403
    )
    response = api_client.post(
        f"/api/registry/renewals/{renewal['id']}/decision",
        headers=headers,
        json={"decision": "verify", "note": "Forbidden"},
    )
    assert response.status_code == 403
    if headers["X-Demo-Role"] == "reviewer":
        assert response.json() == {"detail": "Demo person not permitted"}
    assert coverage(api_client) == before
    assert (
        len(api_client.get("/api/registry/renewals", headers=REVIEWER).json())
        == 1
    )


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "verify"},
        {"decision": "reject", "note": " "},
        {"decision": "accept", "note": "Wrong decision"},
        {"decision": "verify", "note": "Okay", "tenant": BAKERY},
    ],
)
def test_invalid_review_does_not_change_coverage_or_log(
    api_client: TestClient, body: dict[str, str]
) -> None:
    renewal = submit(api_client).json()
    before = coverage(api_client)
    logs = api_client.get(
        "/api/activity", headers=identity("supervisor", BAKERY, 2)
    ).json()
    assert (
        api_client.post(
            f"/api/registry/renewals/{renewal['id']}/decision",
            headers=REVIEWER,
            json=body,
        ).status_code
        == 422
    )
    assert coverage(api_client) == before
    assert (
        api_client.get(
            "/api/activity", headers=identity("supervisor", BAKERY, 2)
        ).json()
        == logs
    )


def test_missing_renewal_and_nonpending_certificate(
    api_client: TestClient,
) -> None:
    body = {"decision": "verify", "note": "Checked"}
    assert (
        api_client.post(
            "/api/registry/renewals/999/decision", headers=REVIEWER, json=body
        ).status_code
        == 404
    )
    assert (
        api_client.post(
            "/api/registry/renewals/1/decision", headers=REVIEWER, json=body
        ).status_code
        == 409
    )


def test_person_is_required_and_cannot_impersonate_another_supplier(
    api_client: TestClient,
) -> None:
    for headers, status in [
        ({"X-Demo-Role": "supplier", "X-Demo-Tenant": "1"}, 422),
        (identity("supplier", "1", 6), 403),
        (identity("supplier", "2", 5), 403),
        (identity("supplier", "1", 999), 403),
    ]:
        assert (
            api_client.get("/api/certificates", headers=headers).status_code
            == status
        )
    assert (
        api_client.get(
            "/api/registry/renewals",
            headers={"X-Demo-Role": "reviewer", "X-Demo-Tenant": "registry"},
        ).status_code
        == 422
    )


def test_reviewer_can_read_images_but_not_sme_data(
    api_client: TestClient,
) -> None:
    response = api_client.get("/api/certificates/1/image", headers=REVIEWER)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "no-store"
    for path in (
        "/api/materials",
        "/api/deliveries",
        "/api/activity",
        "/api/certificates",
    ):
        assert api_client.get(path, headers=REVIEWER).status_code == 403
    assert (
        api_client.get(
            "/api/certificates/1/image",
            headers=identity("reviewer", "registry", 5),
        ).status_code
        == 403
    )


def test_queue_includes_no_current_and_supplier_sees_rejection(
    api_client: TestClient, api_engine: Engine
) -> None:
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None
        old.status = "superseded"
        session.commit()
    renewal = submit(api_client).json()
    entries = api_client.get("/api/registry/renewals", headers=REVIEWER).json()
    assert entries[0]["current"] is None
    assert entries[0]["supplier_name"] == "Golden Grain Supplies SAMPLE"
    api_client.post(
        f"/api/registry/renewals/{renewal['id']}/decision",
        headers=REVIEWER,
        json={"decision": "reject", "note": "Unreadable"},
    )
    rows = api_client.get("/api/certificates", headers=SUPPLIER).json()
    assert rows[0]["status"] == "rejected"
    assert rows[0]["review_note"] == "Unreadable"
    assert all(
        row["supplier_id"] == 2
        for row in api_client.get(
            "/api/certificates", headers=identity("supplier", "2", 6)
        ).json()
    )


def test_review_rolls_back_with_audit_failure(api_client: TestClient) -> None:
    renewal = submit(api_client).json()
    before = coverage(api_client)

    def fail_audit(session: Session, _: object, __: object) -> None:
        if any(isinstance(row, db.ActivityLog) for row in session.new):
            raise RuntimeError("test audit failure")

    event.listen(Session, "before_flush", fail_audit)
    try:
        with pytest.raises(RuntimeError, match="test audit failure"):
            api_client.post(
                f"/api/registry/renewals/{renewal['id']}/decision",
                headers=REVIEWER,
                json={"decision": "verify", "note": "Checked"},
            )
    finally:
        event.remove(Session, "before_flush", fail_audit)
    assert coverage(api_client) == before
    assert (
        api_client.get("/api/registry/renewals", headers=REVIEWER).json()[0][
            "renewal"
        ]["status"]
        == "pending"
    )


def test_concurrent_reviews_have_one_winner(
    api_client: TestClient, api_engine: Engine
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row locks")
    renewal = submit(api_client).json()

    def decide(decision: str) -> int:
        return api_client.post(
            f"/api/registry/renewals/{renewal['id']}/decision",
            headers=REVIEWER,
            json={"decision": decision, "note": "Concurrent review"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(decide, ["verify", "reject"])) == [200, 409]
    for tenant, person in ((BAKERY, 2), (CATERER, 4)):
        assert (
            len(
                api_client.get(
                    "/api/activity",
                    headers=identity("supervisor", tenant, person),
                ).json()
            )
            == 2
        )


def test_queue_is_oldest_first_even_when_ids_have_opposite_order(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    from datetime import UTC, datetime

    first = submit(api_client).json()
    second = api_client.post(
        "/api/certificates",
        headers=identity("supplier", "2", 6),
        data={
            "issuer": "SAMPLE Food Certification Council",
            "cert_no": "SAMPLE-SUPPLIER-2",
            "holder_name": "Silver Valley Ingredients SAMPLE",
            "expiry_date": "2027-12-31",
            "scope": json.dumps(
                [{"product_name": "Cocoa Powder", "brand": "SilverCocoa"}]
            ),
        },
    ).json()
    with Session(api_engine) as session:
        row = session.get(db.Certificate, second["id"])
        assert row is not None
        row.created_at = datetime(2020, 1, 1, tzinfo=UTC)
        session.commit()
    queue = api_client.get("/api/registry/renewals", headers=REVIEWER).json()
    assert [entry["renewal"]["id"] for entry in queue] == [
        second["id"],
        first["id"],
    ]


def test_verifying_first_certificate_covers_previously_uncovered_smes(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None
        old.status = "superseded"
        session.commit()
    assert all(
        rows[0]["coverage_status"] == "not_covered"
        for rows in coverage(api_client)
    )
    renewal = submit(api_client).json()
    assert (
        api_client.get("/api/registry/renewals", headers=REVIEWER).json()[0][
            "current"
        ]
        is None
    )
    response = api_client.post(
        f"/api/registry/renewals/{renewal['id']}/decision",
        headers=REVIEWER,
        json={"decision": "verify", "note": "First verified certificate"},
    )
    assert response.status_code == 200
    assert all(
        rows[0]["coverage_status"] == "covered"
        for rows in coverage(api_client)
    )
