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

from backend import db, images
from backend.db import ActivityLog, Certificate, Delivery, Material, Supplier
from backend.reset_demo import reset_demo_database
from backend.rules import evaluate
from backend.schemas import CertificateResponse
from backend.seed import DEFAULT_SEED_PATH, SeedData
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
        action="pending_review",
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
            action="pending_review",
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


@pytest.mark.parametrize(
    "action",
    [
        "auto_accepted",
        "pending_review",
        "accepted",
        "rejected",
        "certificate_renewed",
        "invented",
        "cert_renewed",
        "delivery_checked",
    ],
)
def test_activity_action_database_constraint(
    session: Session,
    action: str,
) -> None:
    session.add(
        ActivityLog(
            tenant="bakery",
            actor="staff",
            role="staff",
            action=action,
        )
    )
    if action in {"invented", "cert_renewed", "delivery_checked"}:
        with pytest.raises(IntegrityError):
            session.flush()
    else:
        session.flush()


@pytest.mark.parametrize("unknown", [False, True])
@pytest.mark.parametrize("verdict", ["needs_human", "covered", "expiring"])
def test_existing_postgres_activity_upgrade(
    engine: Engine,
    unknown: bool,
    verdict: str,
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL startup constraint upgrade")
    with Session(engine) as session:
        _, material = catalog(session)
        item = delivery(
            material.id,
            status="accepted",
            decided_by="supervisor",
            reason="Reviewed",
            verdict=verdict,
        )
        session.add(item)
        session.flush()
        item_id = item.id
        session.commit()
    with engine.begin() as connection:
        table = db.qualified_table_name(connection, "activity_log")
        connection.execute(
            text(f"ALTER TABLE {table} DROP CONSTRAINT ck_activity_action")
        )
    old_actions = [
        "delivery_checked",
        "delivery_accepted",
        "delivery_rejected",
        "certificate_renewed",
    ]
    if unknown:
        old_actions.append("unexpected")
    with Session(engine) as session:
        session.add_all(
            [
                ActivityLog(
                    tenant="bakery",
                    actor="staff",
                    role="staff",
                    action=action,
                    delivery_id=item_id,
                )
                for action in old_actions
            ]
        )
        session.commit()
    if unknown:
        with pytest.raises(ValueError, match="unsupported actions"):
            db.init_db(engine)
        expected = old_actions
    else:
        db.init_db(engine)
        db.init_db(engine)
        expected = [
            "auto_accepted"
            if verdict in {"covered", "expiring"}
            else "pending_review",
            "accepted",
            "rejected",
            "certificate_renewed",
        ]
    with Session(engine) as session:
        assert (
            list(
                session.scalars(
                    select(ActivityLog.action).order_by(ActivityLog.id)
                )
            )
            == expected
        )
        if not unknown:
            session.add(
                ActivityLog(
                    tenant="bakery",
                    actor="staff",
                    role="staff",
                    action="unexpected",
                )
            )
            with pytest.raises(IntegrityError):
                session.flush()


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
    payload = images.as_jpeg(photo.read_bytes())
    with Session(engine) as session:
        supplier, material = catalog(session)
        cert = certificate(supplier.id, image_bytes=payload)
        item = delivery(material.id, image_bytes=payload)
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
        assert "image_content_type" not in inspect(Delivery).columns
        assert "image_content_type" not in inspect(Certificate).columns


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
            for column in ("image_bytes",):
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


def test_startup_converts_legacy_pngs_and_never_reencodes_jpegs(
    engine: Engine,
    tmp_path: Path,
) -> None:
    png = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()
    with Session(engine) as session:
        supplier, material = catalog(session)
        session.add(certificate(supplier.id, image_bytes=png))
        session.add(delivery(material.id, image_bytes=png))
        session.commit()
    bootstrap_database(engine, tmp_path / "missing.json")
    with Session(engine) as session:
        cert = session.scalar(select(Certificate))
        item = session.scalar(select(Delivery))
        assert cert is not None and item is not None
        stored = cert.image_bytes
        assert stored is not None and stored.startswith(b"\xff\xd8\xff")
        assert item.image_bytes == stored
        assert item.image == "/images/sample-label.png"
    bootstrap_database(engine, tmp_path / "missing.json")
    with Session(engine) as session:
        assert session.scalar(select(Certificate.image_bytes)) == stored
        assert session.scalar(select(Delivery.image_bytes)) == stored


def test_invalid_legacy_photo_rolls_back_conversion(
    engine: Engine, tmp_path: Path
) -> None:
    png = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()
    with Session(engine) as session:
        supplier, material = catalog(session)
        session.add(certificate(supplier.id, image_bytes=png))
        session.add(delivery(material.id, image_bytes=b"invalid image"))
        session.commit()
    with pytest.raises(ValueError, match="readable PNG or JPEG"):
        bootstrap_database(engine, tmp_path / "missing.json")
    with Session(engine) as session:
        assert session.scalar(select(Certificate.image_bytes)) == png


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
            }
        ],
    )
    bootstrap_database(engine, path)
    photo.unlink()  # Only a disposable test fixture; storage must stand alone.
    with Session(engine) as session:
        saved = session.get(Certificate, 20)
        assert saved is not None
        assert saved.image_bytes == images.as_jpeg(payload)
        assert saved.image == "/api/certificates/20/image"


def test_missing_seed_image_is_filled_on_later_startup(
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
            }
        ],
    )
    assert bootstrap_database(engine, path)["certificates"] == 1
    with Session(engine) as session:
        saved = session.get(Certificate, 20)
        assert saved is not None
        assert saved.image_bytes is None
        assert saved.image is None
        saved.holder_name = "Keep edited holder"
        session.commit()
    payload = (
        Path(__file__).parent / "fixtures" / "synthetic_label.png"
    ).read_bytes()
    photo = tmp_path / "absent.png"
    photo.write_bytes(payload)
    assert bootstrap_database(engine, path)["certificates"] == 0
    with Session(engine) as session:
        saved = session.get(Certificate, 20)
        assert saved is not None
        assert saved.image_bytes == images.as_jpeg(payload)
        assert saved.image == "/api/certificates/20/image"
        assert saved.holder_name == "Keep edited holder"
    # Never replace a stored photo, even when the file changes or disappears.
    photo.write_bytes(b"different file contents")
    bootstrap_database(engine, path)
    photo.unlink()
    bootstrap_database(engine, path)
    with Session(engine) as session:
        assert session.scalar(
            select(Certificate.image_bytes)
        ) == images.as_jpeg(payload)


@pytest.mark.parametrize(
    ("filename", "payload"),
    [
        ("sample.jpg", b"not a PNG"),
        ("sample.png", b"not a PNG"),
        ("../outside.png", b"not a PNG"),
    ],
)
def test_invalid_seed_photo_rolls_back_inserts(
    engine: Engine, tmp_path: Path, filename: str, payload: bytes
) -> None:
    (tmp_path / filename).write_bytes(payload)
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
                "image_file": filename,
            }
        ],
    )
    with pytest.raises(ValueError, match="Seed image"):
        bootstrap_database(engine, path)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == 0


def test_photo_backfill_does_not_touch_different_certificate(
    engine: Engine, tmp_path: Path
) -> None:
    seed = json.loads(DEFAULT_SEED_PATH.read_text())
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(seed))
    bootstrap_database(engine, path)
    with Session(engine) as session:
        saved = session.get(Certificate, 1)
        assert saved is not None
        saved.cert_no = "Different certificate"
        session.commit()
    photo = tmp_path / seed["certificates"][0]["image_file"]
    photo.parent.mkdir(parents=True)
    photo.write_bytes(
        (
            Path(__file__).parent / "fixtures" / "synthetic_label.png"
        ).read_bytes()
    )
    bootstrap_database(engine, path)
    with Session(engine) as session:
        saved = session.get(Certificate, 1)
        assert saved is not None
        assert saved.image_bytes is None


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


def test_merged_seed_matches_loader_api_and_rules(engine: Engine) -> None:
    counts = bootstrap_database(engine, DEFAULT_SEED_PATH)
    assert counts["suppliers"] == 2
    assert counts["certificates"] == 4
    assert counts["materials"] == 16
    assert all(
        count == 0
        for count in bootstrap_database(engine, DEFAULT_SEED_PATH).values()
    )
    with Session(engine) as session:
        seed = SeedData.model_validate_json(DEFAULT_SEED_PATH.read_text())
        for row in seed.certificates:
            assert row.image_file is not None
            saved = session.get(Certificate, row.id)
            assert saved is not None
            assert saved.image_bytes == images.as_jpeg(
                (DEFAULT_SEED_PATH.parent / row.image_file).read_bytes()
            )
            assert saved.image == f"/api/certificates/{row.id}/image"
        material = session.get(Material, 1)
        cert = session.get(Certificate, 1)
        assert material is not None and cert is not None
        response = CertificateResponse.model_validate(
            cert, from_attributes=True
        )
        assert response.scope[0].product_name == "Wheat Flour"
        result = evaluate(
            {
                "product_name": material.name,
                "brand": material.approved_brand,
                "manufacturer": material.approved_manufacturer,
                "halal_mark_present": True,
            },
            {
                "tenant": material.tenant,
                "name": material.name,
                "approved_brand": material.approved_brand,
                "approved_manufacturer": material.approved_manufacturer,
            },
            {
                "scope": cert.scope,
                "expiry_date": cert.expiry_date,
                "issuer": cert.issuer,
            },
            date(2026, 10, 22),
        )
        assert result["verdict"] == "expiring"
        assert all(check["passed"] for check in result["rule_results"])


def test_demo_reset_restores_seed_photos_and_removes_workflows(
    engine: Engine,
) -> None:
    bootstrap_database(engine, DEFAULT_SEED_PATH)
    with Session(engine) as session:
        old = session.get(Certificate, 1)
        supplier = session.get(Supplier, 1)
        assert old is not None and supplier is not None
        supplier.name = "Edited during the demo"
        old.status = "superseded"
        old.image_bytes = b"old-demo-photo"
        session.flush()
        session.add(certificate(1, cert_no="SAMPLE-RENEWAL"))
        item = delivery(1, tenant="Sunrise Bakery SAMPLE")
        session.add(item)
        session.flush()
        session.add(
            ActivityLog(
                tenant=item.tenant,
                actor="staff",
                role="staff",
                action="pending_review",
                delivery_id=item.id,
            )
        )
        session.add(Supplier(name="Extra demo supplier"))
        session.commit()
    for _ in range(2):
        counts = reset_demo_database(engine)
        seed = SeedData.model_validate_json(DEFAULT_SEED_PATH.read_text())
        assert counts == {
            name: len(getattr(seed, name))
            for name in (
                "sme_settings",
                "suppliers",
                "certificates",
                "materials",
                "deliveries",
                "activity_log",
                "people",
            )
        }
        with Session(engine) as session:
            seed = SeedData.model_validate_json(DEFAULT_SEED_PATH.read_text())
            for model in (
                db.SMESettings,
                Supplier,
                Certificate,
                Material,
                Delivery,
                ActivityLog,
            ):
                assert (
                    session.scalar(select(func.count()).select_from(model))
                    == counts[model.__tablename__]
                )
            for source in seed.certificates:
                restored = session.get(Certificate, source.id)
                assert restored is not None and source.image_file is not None
                assert restored.status == source.status
                assert restored.image_bytes == images.as_jpeg(
                    (DEFAULT_SEED_PATH.parent / source.image_file).read_bytes()
                )
            for source_event in seed.activity_log:
                restored_event = session.get(ActivityLog, source_event.id)
                assert restored_event is not None
                for field in (
                    "actor",
                    "actor_title",
                    "role",
                    "action",
                    "material_name",
                    "verdict",
                    "supplier_name",
                    "delivery_id",
                    "reason",
                    "tenant",
                ):
                    assert getattr(restored_event, field) == getattr(
                        source_event, field
                    )
            saved = session.get(Supplier, 1)
            assert saved is not None and saved.name == seed.suppliers[0].name
    with Session(engine) as session:
        later = Supplier(name="New upload supplier")
        session.add(later)
        session.flush()
        assert later.id > 2


@pytest.mark.parametrize(
    "failure",
    ["missing", "empty", "photo", "corrupt_photo", "missing_photo", "fk"],
)
def test_failed_demo_reset_preserves_existing_records(
    engine: Engine,
    tmp_path: Path,
    failure: str,
) -> None:
    with Session(engine) as session:
        supplier, material = catalog(session)
        session.add(certificate(supplier.id))
        item = delivery(material.id)
        session.add(item)
        session.flush()
        session.add(
            ActivityLog(
                tenant="bakery",
                actor="staff",
                role="staff",
                action="pending_review",
                delivery_id=item.id,
            )
        )
        session.commit()
    path = tmp_path / "reset.json"
    payload = json.loads(DEFAULT_SEED_PATH.read_text())
    for source in payload["certificates"]:
        source["image_file"] = None
    if failure == "empty":
        payload = {}
    elif failure in {"photo", "corrupt_photo", "missing_photo"}:
        payload["certificates"][0]["image_file"] = "broken.png"
        if failure != "missing_photo":
            content = (
                b"not-png"
                if failure == "photo"
                else b"\x89PNG\r\n\x1a\ninvalid"
            )
            (tmp_path / "broken.png").write_bytes(content)
    elif failure == "fk":
        payload["materials"][0]["supplier_id"] = 999
    if failure != "missing":
        path.write_text(json.dumps(payload))
    with pytest.raises(
        IntegrityError if failure == "fk" else ValueError
    ) as error:
        reset_demo_database(engine, path)
    if failure in {"photo", "corrupt_photo", "missing_photo"}:
        assert "broken.png" in str(error.value)
    with Session(engine) as session:
        for model in (Supplier, Certificate, Material, Delivery, ActivityLog):
            assert session.scalar(select(func.count()).select_from(model)) == 1
        assert session.scalar(select(Supplier.name)) == "SAMPLE Supplier"
        assert session.scalar(select(Delivery.status)) == "pending_review"
