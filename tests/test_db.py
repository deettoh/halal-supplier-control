"""Run the same persistence checks on SQLite and opt-in PostgreSQL."""

import os
from collections.abc import Generator
from datetime import date
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import Engine, create_engine, event, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.schema import CreateSchema, DropSchema

from backend import db
from backend.db import ActivityLog, Certificate, Delivery, Material, Supplier


@pytest.fixture(
    params=[
        pytest.param("sqlite", id="sqlite"),
        pytest.param("postgres", id="postgres", marks=pytest.mark.integration),
    ]
)
def engine(request: pytest.FixtureRequest) -> Generator[Engine, None, None]:
    if request.param == "sqlite":
        local = create_engine("sqlite:///:memory:")

        @event.listens_for(local, "connect")
        def enable_foreign_keys(connection: Any, _: Any) -> None:
            connection.execute("PRAGMA foreign_keys=ON")

        db.init_db(local)
        try:
            yield local
        finally:
            local.dispose()
        return

    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("--run-db requires an explicit TEST_DATABASE_URL")
    admin = db.create_db_engine(url)
    # A unique namespace, never public or any existing business schema.
    schema = f"halal_test_{uuid4().hex}"
    with admin.begin() as connection:
        connection.execute(CreateSchema(schema))
    isolated = admin.execution_options(schema_translate_map={None: schema})
    try:
        db.init_db(isolated)
        yield isolated
    finally:
        with admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin.dispose()


@pytest.fixture
def session(engine: Engine) -> Generator[Session, None, None]:
    with Session(engine) as current:
        yield current


def catalog(session: Session) -> tuple[Supplier, Material]:
    supplier = Supplier(name="SAMPLE Supplier")
    session.add(supplier)
    session.flush()
    material = Material(
        tenant="bakery",
        name="Flour",
        supplier_id=supplier.id,
        approved_brand="SAMPLE Brand",
        approved_manufacturer="SAMPLE Maker",
    )
    session.add(material)
    session.flush()
    return supplier, material


def certificate(supplier_id: int, **changes: Any) -> Certificate:
    fields: dict[str, Any] = {
        "supplier_id": supplier_id,
        "issuer": "SAMPLE Issuer",
        "cert_no": "SAMPLE-001",
        "holder_name": "SAMPLE Supplier",
        "expiry_date": date(2027, 12, 31),
        "scope": [{"product_name": "Flour", "brand": "SAMPLE Brand"}],
        "status": "active",
    }
    return Certificate(**{**fields, **changes})


def delivery(material_id: int, **changes: Any) -> Delivery:
    fields: dict[str, Any] = {
        "tenant": "bakery",
        "material_id": material_id,
        "image": "/images/sample-label.png",
        "extracted": None,
        "rule_results": [
            {"rule": "R1", "passed": False, "detail": "Unreadable label"},
            *[
                {"rule": f"R{i}", "passed": None, "detail": "Not evaluated"}
                for i in range(2, 6)
            ],
        ],
        "verdict": "needs_human",
        "status": "pending_review",
        "error": "Unreadable label",
    }
    return Delivery(**{**fields, **changes})


def test_init_is_repeatable_and_preserves_data(engine: Engine) -> None:
    with Session(engine) as session:
        session.add(Supplier(name="Keep this supplier"))
        session.commit()
    db.init_db(engine)
    with Session(engine) as session:
        assert session.scalar(select(Supplier.name)) == "Keep this supplier"


def test_all_five_tables_round_trip(session: Session, engine: Engine) -> None:
    supplier, material = catalog(session)
    cert = certificate(supplier.id)
    item = delivery(material.id)
    session.add_all([cert, item])
    session.flush()
    log = ActivityLog(
        tenant="bakery",
        actor="demo:bakery:staff",
        role="staff",
        action="delivery_checked",
        delivery_id=item.id,
    )
    session.add(log)
    session.commit()
    session.expire_all()
    loaded = session.get(Delivery, item.id)
    assert loaded is not None
    assert loaded.extracted is None
    assert loaded.rule_results[1]["passed"] is None
    loaded_certificate = session.get(Certificate, cert.id)
    assert loaded_certificate is not None
    assert loaded_certificate.scope == [
        {"product_name": "Flour", "brand": "SAMPLE Brand"}
    ]
    assert session.get(ActivityLog, log.id) is not None
    if engine.dialect.name == "postgresql":
        assert loaded.created_at.utcoffset() is not None


def test_shared_registry_updates_both_smes(session: Session) -> None:
    supplier, _ = catalog(session)
    session.add(
        Material(
            tenant="caterer",
            name="Flour",
            supplier_id=supplier.id,
            approved_brand="SAMPLE Brand",
            approved_manufacturer="SAMPLE Maker",
        )
    )
    old = certificate(supplier.id, expiry_date=date(2026, 11, 1))
    session.add(old)
    session.flush()
    old.status = "superseded"
    session.flush()  # Release active slot before inserting the renewal.
    renewed = certificate(supplier.id, cert_no="SAMPLE-002")
    session.add(renewed)
    session.commit()
    rows = session.execute(
        select(Material.tenant, Certificate.cert_no)
        .join(Certificate, Material.supplier_id == Certificate.supplier_id)
        .where(Certificate.status == "active")
    ).all()
    assert set(rows) == {("bakery", "SAMPLE-002"), ("caterer", "SAMPLE-002")}
    assert session.get(Certificate, old.id) is old


def test_only_one_active_certificate_per_supplier(session: Session) -> None:
    supplier, _ = catalog(session)
    session.add(certificate(supplier.id))
    session.flush()
    session.add(certificate(supplier.id, cert_no="SAMPLE-002"))
    with pytest.raises(IntegrityError):
        session.flush()


def test_missing_supplier_is_rejected(session: Session) -> None:
    session.add(certificate(99999))
    with pytest.raises(IntegrityError):
        session.flush()


def test_delivery_cannot_reference_another_sme(session: Session) -> None:
    _, material = catalog(session)
    session.add(delivery(material.id, tenant="caterer"))
    with pytest.raises(IntegrityError):
        session.flush()


def test_activity_cannot_reference_another_sme(session: Session) -> None:
    _, material = catalog(session)
    item = delivery(material.id)
    session.add(item)
    session.flush()
    session.add(
        ActivityLog(
            tenant="caterer",
            actor="demo:caterer:staff",
            role="staff",
            action="delivery_checked",
            delivery_id=item.id,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_renewal_log_can_have_no_delivery(session: Session) -> None:
    session.add(
        ActivityLog(
            tenant="bakery",
            actor="demo:supplier:1",
            role="supplier",
            action="certificate_renewed",
            delivery_id=None,
        )
    )
    session.commit()
    assert session.scalar(select(ActivityLog.delivery_id)) is None
    assert session.scalar(select(func.count()).select_from(ActivityLog)) == 1


@pytest.mark.parametrize("field", ["status", "verdict"])
def test_unknown_delivery_values_are_rejected(
    session: Session, field: str
) -> None:
    _, material = catalog(session)
    session.add(delivery(material.id, **{field: "invented"}))
    with pytest.raises(IntegrityError):
        session.flush()


@pytest.mark.parametrize("reason", [None, "", "   "])
def test_decision_requires_a_recorded_reason(
    session: Session, reason: str | None
) -> None:
    _, material = catalog(session)
    session.add(
        delivery(
            material.id,
            status="rejected",
            decided_by="demo:supervisor",
            reason=reason,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_session_dependency_rolls_back_uncommitted_work(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(db, "get_session_factory", lambda: factory)
    dependency = db.get_db()
    current = next(dependency)
    current.add(Supplier(name="Uncommitted"))
    current.flush()
    dependency.close()
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 0


def test_session_dependency_preserves_explicit_commit(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(db, "get_session_factory", lambda: factory)
    dependency = db.get_db()
    current = next(dependency)
    current.add(Supplier(name="Committed"))
    current.commit()
    dependency.close()
    with factory() as session:
        assert session.scalar(select(Supplier.name)) == "Committed"


def test_url_configuration_is_lazy_and_preserves_ssl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValueError, match="DATABASE_URL"):
        db.create_db_engine()
    engine = db.create_db_engine(
        "postgresql://example:example@localhost/sample?sslmode=require"
    )
    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.query["sslmode"] == "require"
    engine.dispose()


def test_schema_does_not_persist_computed_coverage() -> None:
    assert "coverage_status" not in inspect(Material).columns
    assert "tenant" not in inspect(Certificate).columns
