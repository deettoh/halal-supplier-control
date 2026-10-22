"""Run the same persistence checks on SQLite and opt-in PostgreSQL."""

import json
import os
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import (
    Engine,
    create_engine,
    event,
    func,
    inspect,
    select,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.schema import CreateSchema, DropSchema

from backend import db
from backend.db import ActivityLog, Certificate, Delivery, Material, Supplier
from backend.seed import SeedData
from backend.startup import bootstrap_database


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


def seed_file(tmp_path: Path, **updates: Any) -> Path:
    data = {
        "suppliers": [{"id": 20, "name": "SAMPLE Supplier"}],
        "materials": [
            {
                "id": 20,
                "tenant": "bakery",
                "name": "Flour",
                "supplier_id": 20,
                "approved_brand": "SAMPLE Brand",
                "approved_manufacturer": "SAMPLE Maker",
            }
        ],
        **updates,
    }
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_binary_photos_survive_new_session(engine: Engine) -> None:
    photo = Path(__file__).parent / "fixtures" / "synthetic_label.png"
    payload = photo.read_bytes()
    with Session(engine) as session:
        supplier, material = catalog(session)
        cert = certificate(
            supplier.id, image_bytes=payload, image_content_type="image/png"
        )
        item = delivery(
            material.id, image_bytes=payload, image_content_type="image/png"
        )
        session.add_all([cert, item])
        session.commit()
        ids = (cert.id, item.id)
    with Session(engine) as session:
        saved_cert = session.get(Certificate, ids[0])
        saved_delivery = session.get(Delivery, ids[1])
        assert saved_cert is not None and saved_delivery is not None
        # Bulk list queries do not eagerly retrieve photo payloads.
        assert "image_bytes" in inspect(saved_delivery).unloaded
        assert saved_delivery.image_bytes == payload
        assert saved_cert.image_bytes == payload
        assert saved_delivery.image_content_type == "image/png"


def test_legacy_image_column_upgrade_preserves_records(engine: Engine) -> None:
    with Session(engine) as session:
        supplier, material = catalog(session)
        session.add(delivery(material.id))
        session.add(certificate(supplier.id))
        session.commit()
    # Simulate the previous committed schema in this test-only database/schema.
    with engine.begin() as connection:
        for table in ("certificates", "deliveries"):
            name = db.qualified_table_name(connection, table)
            for column in ("image_bytes", "image_content_type"):
                connection.execute(
                    text(f"ALTER TABLE {name} DROP COLUMN {column}")
                )
    db.init_db(engine)
    db.init_db(engine)
    with Session(engine) as session:
        item = session.scalar(select(Delivery))
        assert item is not None
        assert item.image == "/images/sample-label.png"
        assert item.image_bytes is None
        assert (
            session.scalar(select(func.count()).select_from(Certificate)) == 1
        )


def test_bootstrap_creates_empty_database(
    engine: Engine, tmp_path: Path
) -> None:
    # Only the isolated fixture's own tables are dropped here.
    db.Base.metadata.drop_all(engine)
    assert bootstrap_database(engine, tmp_path / "missing.json") == {}
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 0


def test_seed_is_repeatable_and_does_not_overwrite(
    engine: Engine, tmp_path: Path
) -> None:
    path = seed_file(tmp_path)
    assert bootstrap_database(engine, path)["suppliers"] == 1
    with Session(engine) as session:
        supplier = session.get(Supplier, 20)
        assert supplier is not None
        supplier.name = "Keep edited name"
        session.commit()
    assert bootstrap_database(engine, path)["suppliers"] == 0
    with Session(engine) as session:
        assert session.scalar(select(Supplier.name)) == "Keep edited name"
        assert session.scalar(select(func.count()).select_from(Material)) == 1


def test_seed_advances_ids_for_later_writes(
    engine: Engine, tmp_path: Path
) -> None:
    bootstrap_database(engine, seed_file(tmp_path))
    with Session(engine) as session:
        new_supplier = Supplier(name="Another supplier")
        session.add(new_supplier)
        session.commit()
        assert new_supplier.id > 20


def test_invalid_foreign_key_rolls_back_entire_seed(
    engine: Engine, tmp_path: Path
) -> None:
    path = seed_file(
        tmp_path,
        materials=[
            {
                "id": 1,
                "tenant": "bakery",
                "name": "Flour",
                "supplier_id": 999,
                "approved_brand": "Brand",
                "approved_manufacturer": "Maker",
            }
        ],
    )
    with pytest.raises(IntegrityError):
        bootstrap_database(engine, path)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 0


def test_seed_photos_are_copied_into_postgresql(
    engine: Engine, tmp_path: Path
) -> None:
    photo = tmp_path / "sample.png"
    payload = (
        Path(__file__).parent / "fixtures" / "synthetic_label.png"
    ).read_bytes()
    photo.write_bytes(payload)
    path = seed_file(
        tmp_path,
        certificates=[
            {
                "id": 20,
                "supplier_id": 20,
                "issuer": "SAMPLE",
                "cert_no": "SAMPLE-001",
                "holder_name": "SAMPLE Supplier",
                "expiry_date": "2027-12-31",
                "scope": [{"product_name": "Flour"}],
                "image_file": "sample.png",
                "image_content_type": "image/png",
            }
        ],
    )
    bootstrap_database(engine, path)
    photo.unlink()  # Only a disposable test fixture; storage must stand alone.
    with Session(engine) as session:
        saved = session.get(Certificate, 20)
        assert saved is not None
        assert saved.image_bytes == payload
        assert saved.image == "/api/certificates/20/image"


def test_missing_seed_image_rolls_back_inserts(
    engine: Engine, tmp_path: Path
) -> None:
    path = seed_file(
        tmp_path,
        certificates=[
            {
                "id": 20,
                "supplier_id": 20,
                "issuer": "SAMPLE",
                "cert_no": "SAMPLE-001",
                "holder_name": "SAMPLE Supplier",
                "expiry_date": "2027-12-31",
                "scope": [{"product_name": "Flour"}],
                "image_file": "absent.png",
                "image_content_type": "image/png",
            }
        ],
    )
    with pytest.raises(FileNotFoundError):
        bootstrap_database(engine, path)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 0


def test_concurrent_postgres_startup_does_not_duplicate_seed(
    engine: Engine, tmp_path: Path
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL advisory-lock behavior")
    path = seed_file(tmp_path)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(bootstrap_database, engine, path) for _ in range(2)
        ]
        counts = [future.result(timeout=15) for future in futures]
    assert sum(result["suppliers"] for result in counts) == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 1


def test_seed_rejects_duplicate_ids() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Duplicate IDs"):
        SeedData.model_validate(
            {"suppliers": [{"id": 1, "name": "A"}, {"id": 1, "name": "B"}]}
        )
