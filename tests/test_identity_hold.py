"""Named identity, audit context and Hold on isolated databases."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from backend import db, extract
from backend.schemas import LabelExtraction

BAKERY = "Sunrise Bakery SAMPLE"
PNG = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()


def identity(role: str, person: int, tenant: str = BAKERY) -> dict[str, str]:
    return {
        "X-Demo-Role": role,
        "X-Demo-Tenant": tenant,
        "X-Demo-Person": str(person),
    }


def test_public_people_and_protected_reads(api_client: TestClient) -> None:
    people = api_client.get("/api/people")
    assert people.status_code == 200
    assert [p["id"] for p in people.json()] == list(range(1, 8))
    for path in [
        "/api/materials",
        "/api/activity",
        "/api/deliveries",
        "/api/deliveries/1/image",
        "/api/certificates/1/image",
    ]:
        assert (
            api_client.get(path, headers=identity("supervisor", 4)).status_code
            == 403
        )
        assert (
            api_client.get(
                path,
                headers={"X-Demo-Role": "supervisor", "X-Demo-Tenant": BAKERY},
            ).status_code
            == 422
        )


def test_hold_resolve_and_historical_log(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        extract,
        "extract_label",
        lambda _: LabelExtraction(
            product_name="Wheat Flour",
            brand="Other brand",
            manufacturer="Golden Grain Foods",
            halal_mark_present=True,
        ),
    )
    created = api_client.post(
        "/api/deliveries",
        headers=identity("staff", 1),
        data={"material_id": "1"},
        files={"image": ("label.png", PNG, "image/png")},
    )
    assert created.status_code == 201
    row = created.json()
    route = f"/api/deliveries/{row['id']}/decision"
    decision = {
        "decision": "hold",
        "reason": "Need documents",
        "next_step": "request_certificate",
    }
    assert (
        api_client.post(
            route, headers=identity("staff", 1), json=decision
        ).status_code
        == 403
    )
    held = api_client.post(
        route, headers=identity("supervisor", 2), json=decision
    )
    assert held.status_code == 200
    assert held.json()["status"] == "on_hold"
    assert held.json()["decided_by"] == "Farid"
    assert held.json()["next_step"] == "request_certificate"
    assert (
        api_client.post(
            route, headers=identity("supervisor", 2), json=decision
        ).status_code
        == 409
    )
    queue = api_client.get(
        "/api/deliveries?status=on_hold", headers=identity("supervisor", 2)
    ).json()
    assert [d["id"] for d in queue] == [row["id"]]
    assert not api_client.get(
        "/api/deliveries", headers=identity("supervisor", 2)
    ).json()
    resolved = api_client.post(
        route,
        headers=identity("supervisor", 2),
        json={"decision": "accept", "reason": "Documents checked"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["next_step"] is None
    assert resolved.json()["verdict"] == "substitution"
    logs = api_client.get(
        "/api/activity", headers=identity("supervisor", 2)
    ).json()
    assert {entry["action"] for entry in logs} == {
        "pending_review",
        "on_hold",
        "accepted",
    }
    assert {entry["material_name"] for entry in logs} == {"Wheat Flour"}
    assert {entry["verdict"] for entry in logs} == {"substitution"}
    assert {entry["actor_title"] for entry in logs} == {
        "Receiving staff",
        "Halal supervisor",
    }
    with Session(api_engine) as session:
        assert {
            entry.actor for entry in session.scalars(select(db.ActivityLog))
        } == {
            "Aina",
            "Farid",
        }


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "hold", "reason": "Need info"},
        {"decision": "hold", "reason": "Need info", "next_step": "other"},
        {"decision": "accept", "reason": "OK", "next_step": None},
        {
            "decision": "reject",
            "reason": "No",
            "next_step": "request_certificate",
        },
    ],
)
def test_invalid_next_step(
    api_client: TestClient, body: dict[str, object]
) -> None:
    assert (
        api_client.post(
            "/api/deliveries/1/decision",
            headers=identity("supervisor", 2),
            json=body,
        ).status_code
        == 422
    )


def test_hold_isolation_for_caterer(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant = "Crescent Caterer SAMPLE"
    monkeypatch.setattr(
        extract,
        "extract_label",
        lambda _: LabelExtraction(
            product_name="Wheat Flour",
            brand="Wrong",
            manufacturer="Golden Grain Foods",
            halal_mark_present=True,
        ),
    )
    row = api_client.post(
        "/api/deliveries",
        headers=identity("staff", 3, tenant),
        data={"material_id": "9"},
        files={"image": ("label.png", PNG, "image/png")},
    ).json()
    path = f"/api/deliveries/{row['id']}/decision"
    body = {
        "decision": "hold",
        "reason": "Need details",
        "next_step": "request_product_details",
    }
    assert (
        api_client.post(
            path, headers=identity("supervisor", 2), json=body
        ).status_code
        == 404
    )
    assert (
        api_client.post(
            path, headers=identity("supervisor", 4, tenant), json=body
        ).status_code
        == 200
    )
    assert (
        api_client.get(
            "/api/deliveries?status=on_hold", headers=identity("supervisor", 2)
        ).json()
        == []
    )


@pytest.mark.integration
def test_upgrade_old_schema_preserves_legacy_actor(api_engine: Engine) -> None:
    from sqlalchemy import inspect, text

    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL migration")
    with api_engine.begin() as connection:
        activity = db.qualified_table_name(connection, "activity_log")
        delivery = db.qualified_table_name(connection, "deliveries")
        connection.execute(
            text(
                f"INSERT INTO {activity} "
                "(tenant,actor,role,action,created_at) "
                "VALUES ('legacy','staff','staff','pending_review',"
                "CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                f"ALTER TABLE {delivery} DROP CONSTRAINT ck_delivery_next_step"
            )
        )
        for table, names in [
            (delivery, ["next_step", "received_by", "received_title"]),
            (
                activity,
                ["actor_title", "material_name", "verdict", "supplier_name"],
            ),
        ]:
            for name in names:
                connection.execute(
                    text(f"ALTER TABLE {table} DROP COLUMN {name}")
                )
    db.init_db(api_engine)
    db.init_db(api_engine)
    with api_engine.connect() as connection:
        schema = db.database_schema(connection)
        assert "next_step" in {
            c["name"]
            for c in inspect(connection).get_columns("deliveries", schema)
        }
        activity = db.qualified_table_name(connection, "activity_log")
        row = connection.execute(
            text(
                f"SELECT actor,actor_title FROM {activity} "
                "WHERE tenant='legacy'"
            )
        ).one()
        assert tuple(row) == ("staff", None)
