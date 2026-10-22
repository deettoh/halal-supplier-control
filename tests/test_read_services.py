"""Exercise real read routes against isolated SQLite/PostgreSQL databases."""

from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from backend import db

BAKERY = "Sunrise Bakery SAMPLE"
CATERER = "Crescent Caterer SAMPLE"
PNG = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()
CERTIFICATE_PNG = (
    Path(__file__).parents[1] / "src/seed/certificates/cert_01_expiring.png"
).read_bytes()


def headers(role: str = "supervisor", tenant: str = BAKERY) -> dict[str, str]:
    return {"X-Demo-Role": role, "X-Demo-Tenant": tenant}


def add_delivery(
    session: Session,
    tenant: str,
    material_id: int,
    *,
    day: int = 22,
    status: str = "pending_review",
) -> db.Delivery:
    row = db.Delivery(
        tenant=tenant,
        material_id=material_id,
        image="/api/deliveries/pending/image",
        image_bytes=PNG,
        extracted=None,
        rule_results=[
            {
                "rule": f"R{n}",
                "passed": False if n == 1 else None,
                "detail": "Extraction failed" if n == 1 else "Not evaluated",
            }
            for n in range(1, 6)
        ],
        verdict="needs_human",
        status=status,
        error="Label extraction timed out",
        created_at=datetime(2026, 10, day, tzinfo=UTC),
    )
    session.add(row)
    session.flush()
    row.image = f"/api/deliveries/{row.id}/image"
    return row


def test_materials_are_scoped_and_coverage_is_computed(
    api_client: TestClient,
) -> None:
    bakery = api_client.get("/api/materials", headers=headers("staff"))
    caterer = api_client.get("/api/materials", headers=headers(tenant=CATERER))
    assert bakery.status_code == caterer.status_code == 200
    assert [row["id"] for row in bakery.json()] == list(range(1, 9))
    assert [row["id"] for row in caterer.json()] == list(range(9, 17))
    assert bakery.json()[0]["coverage_status"] == "expiring"
    assert bakery.json()[0]["certificate_expiry_date"] == "2026-11-30"
    assert bakery.json()[5]["coverage_status"] == "covered"
    assert "SAMPLE" in bakery.json()[0]["supplier_name"]
    assert (
        api_client.get(
            "/api/materials", headers=headers(tenant="unknown")
        ).json()
        == []
    )


def test_coverage_reads_latest_active_certificate_for_both_smes(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None
        old.status = "superseded"
        session.flush()
        session.add(
            db.Certificate(
                supplier_id=1,
                issuer=old.issuer,
                cert_no="SAMPLE-RENEWED",
                holder_name=old.holder_name,
                scope=old.scope,
                expiry_date=date(2027, 12, 31),
                status="active",
            )
        )
        session.commit()
    for tenant in (BAKERY, CATERER):
        rows = api_client.get(
            "/api/materials", headers=headers(tenant=tenant)
        ).json()
        supplier_rows = [row for row in rows if row["supplier_id"] == 1]
        assert supplier_rows
        assert all(
            row["coverage_status"] == "covered" for row in supplier_rows
        )
        assert all(
            row["certificate_expiry_date"] == "2027-12-31"
            for row in supplier_rows
        )


@pytest.mark.parametrize("problem", ["expired", "missing", "scope", "issuer"])
def test_materials_show_not_covered_for_invalid_certificate(
    api_client: TestClient,
    api_engine: Engine,
    problem: str,
) -> None:
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        if problem == "expired":
            certificate.expiry_date = date(2026, 10, 21)
        elif problem == "missing":
            certificate.status = "superseded"
        elif problem == "scope":
            certificate.scope = [{"product_name": "Other", "brand": None}]
        else:
            certificate.issuer = "Unknown Issuer"
        session.commit()
    row = api_client.get("/api/materials", headers=headers()).json()[0]
    assert row["coverage_status"] == "not_covered"
    if problem == "missing":
        assert row["certificate_expiry_date"] is None


@pytest.mark.parametrize(
    ("path", "role"),
    [
        ("/api/materials", "supplier"),
        ("/api/deliveries", "staff"),
        ("/api/deliveries", "supplier"),
        ("/api/activity", "staff"),
        ("/api/activity", "supplier"),
        ("/api/certificates", "staff"),
        ("/api/certificates", "supervisor"),
    ],
)
def test_read_role_gates(
    api_client: TestClient,
    path: str,
    role: str,
) -> None:
    assert api_client.get(path, headers=headers(role)).status_code == 403


def test_review_queue_is_scoped_filtered_and_newest_first(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        older = add_delivery(session, BAKERY, 1, day=20)
        newer = add_delivery(session, BAKERY, 1)
        add_delivery(session, CATERER, 9)
        add_delivery(session, BAKERY, 1, status="auto_accepted")
        expected_ids = [newer.id, older.id]
        session.commit()
    implicit = api_client.get("/api/deliveries", headers=headers())
    explicit = api_client.get(
        "/api/deliveries?status=pending_review", headers=headers()
    )
    assert implicit.status_code == explicit.status_code == 200
    assert implicit.json() == explicit.json()
    assert [row["id"] for row in implicit.json()] == expected_ids
    row = implicit.json()[0]
    assert row["error"] == "Label extraction timed out"
    assert row["verdict"] == "needs_human"
    assert row["created_at"].endswith("Z")
    assert [check["rule"] for check in row["rule_results"]] == [
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
    ]


def test_activity_is_scoped_newest_first_and_reads_do_not_write(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        for tenant, day, action in (
            (BAKERY, 20, "delivery_checked"),
            (CATERER, 22, "certificate_renewed"),
            (BAKERY, 22, "delivery_accepted"),
        ):
            session.add(
                db.ActivityLog(
                    tenant=tenant,
                    actor="supervisor",
                    role="supervisor",
                    action=action,
                    created_at=datetime(2026, 10, day, tzinfo=UTC),
                )
            )
        session.commit()
    for _ in range(2):
        rows = api_client.get("/api/activity", headers=headers()).json()
        assert [row["action"] for row in rows] == [
            "delivery_accepted",
            "delivery_checked",
        ]
    with Session(api_engine) as session:
        assert (
            session.scalar(select(func.count()).select_from(db.ActivityLog))
            == 3
        )


def test_supplier_sees_only_own_active_and_superseded_certificates(
    api_client: TestClient,
) -> None:
    response = api_client.get(
        "/api/certificates", headers=headers("supplier", "1")
    )
    assert response.status_code == 200
    rows = response.json()
    assert {row["id"] for row in rows} == {1, 2}
    assert {row["status"] for row in rows} == {"active", "superseded"}
    assert all(row["supplier_id"] == 1 for row in rows)
    assert rows[0]["image"] == "/api/certificates/2/image"


@pytest.mark.parametrize(
    ("tenant", "status"), [("abc", 422), ("0", 422), ("999", 404)]
)
def test_supplier_identity_is_validated(
    api_client: TestClient,
    tenant: str,
    status: int,
) -> None:
    assert (
        api_client.get(
            "/api/certificates", headers=headers("supplier", tenant)
        ).status_code
        == status
    )


@pytest.mark.parametrize(
    ("role", "tenant", "status"),
    [
        ("supplier", "1", 200),
        ("supplier", "2", 404),
        ("staff", BAKERY, 200),
        ("supervisor", CATERER, 200),
        ("staff", "unknown", 404),
    ],
)
def test_certificate_image_checks_supplier_or_linked_sme(
    api_client: TestClient,
    role: str,
    tenant: str,
    status: int,
) -> None:
    response = api_client.get(
        "/api/certificates/1/image", headers=headers(role, tenant)
    )
    assert response.status_code == status
    if status == 200:
        assert response.content == CERTIFICATE_PNG
        assert response.headers["content-type"] == "image/png"
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"


def test_delivery_image_checks_tenant_and_role(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        row = add_delivery(session, BAKERY, 1)
        path = row.image
        session.commit()
    for role in ("staff", "supervisor"):
        response = api_client.get(path, headers=headers(role))
        assert response.status_code == 200
        assert response.content == PNG
    assert (
        api_client.get(path, headers=headers(tenant=CATERER)).status_code
        == 404
    )
    assert (
        api_client.get(path, headers=headers("supplier", "1")).status_code
        == 403
    )


def test_missing_certificate_photo_returns_404(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        certificate.image_bytes = None
        session.commit()
    assert (
        api_client.get(
            "/api/certificates/1/image", headers=headers("supplier", "1")
        ).status_code
        == 404
    )
