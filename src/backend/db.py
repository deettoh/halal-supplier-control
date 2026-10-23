"""SQLAlchemy models and lazy PostgreSQL access for the five MVP tables.

Importing this module never connects or creates tables. Initialise explicitly:
    uv run --env-file .env python src/backend/db.py
"""

import os
import sys
from collections.abc import Generator
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)
from sqlalchemy.schema import CreateColumn

# Serialize schema creation and seeding across simultaneous PostgreSQL workers.
STARTUP_LOCK = 0x48414C414C4442
BUSINESS_TIMEZONE = ZoneInfo("Asia/Kuala_Lumpur")
ACTIVITY_ACTION_CHECK = (
    "action IN ('auto_accepted', 'pending_review', 'accepted', "
    "'rejected', 'certificate_renewed')"
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def business_today() -> date:
    """Calendar date for certificate rules in Malaysia, independent of host."""
    return utc_now().astimezone(BUSINESS_TIMEZONE).date()


class Base(DeclarativeBase):
    pass


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class Certificate(Base):
    """Shared supplier registry; intentionally has no SME tenant column."""

    __tablename__ = "certificates"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'superseded')", name="ck_certificate_status"
        ),
        Index(
            "uq_certificate_active_supplier",
            "supplier_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), index=True
    )
    issuer: Mapped[str] = mapped_column(String(200))
    cert_no: Mapped[str] = mapped_column(String(100))
    holder_name: Mapped[str] = mapped_column(String(200))
    expiry_date: Mapped[date] = mapped_column(Date)
    scope: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    image: Mapped[str | None] = mapped_column(Text)
    image_bytes: Mapped[bytes | None] = mapped_column(
        LargeBinary, deferred=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active")


class Material(Base):
    """SME masterlist entry; coverage is calculated, never stored here."""

    __tablename__ = "materials"
    __table_args__ = (
        UniqueConstraint("id", "tenant", name="uq_material_id_tenant"),
        CheckConstraint("length(trim(tenant)) > 0", name="ck_material_tenant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(200))
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), index=True
    )
    approved_brand: Mapped[str] = mapped_column(String(200))
    approved_manufacturer: Mapped[str] = mapped_column(String(200))


class Delivery(Base):
    __tablename__ = "deliveries"
    __table_args__ = (
        ForeignKeyConstraint(
            ["material_id", "tenant"],
            ["materials.id", "materials.tenant"],
            name="fk_delivery_material_tenant",
        ),
        UniqueConstraint("id", "tenant", name="uq_delivery_id_tenant"),
        CheckConstraint("length(trim(tenant)) > 0", name="ck_delivery_tenant"),
        CheckConstraint(
            "verdict IN ('covered', 'expiring', 'substitution', "
            "'not_covered', 'needs_human')",
            name="ck_delivery_verdict",
        ),
        CheckConstraint(
            "status IN ('auto_accepted', 'pending_review', "
            "'accepted', 'rejected')",
            name="ck_delivery_status",
        ),
        CheckConstraint(
            "status NOT IN ('accepted', 'rejected') OR "
            "(decided_by IS NOT NULL AND length(trim(decided_by)) > 0 "
            "AND reason IS NOT NULL AND length(trim(reason)) > 0)",
            name="ck_delivery_decision_reason",
        ),
        Index("ix_delivery_tenant_status", "tenant", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant: Mapped[str] = mapped_column(String(100))
    material_id: Mapped[int] = mapped_column(index=True)
    image: Mapped[str] = mapped_column(Text)
    image_bytes: Mapped[bytes | None] = mapped_column(
        LargeBinary, deferred=True
    )
    extracted: Mapped[dict[str, Any] | None] = mapped_column(
        JSON(none_as_null=True), nullable=True
    )
    rule_results: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    verdict: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    error: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(String(200))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class ActivityLog(Base):
    __tablename__ = "activity_log"
    __table_args__ = (
        ForeignKeyConstraint(
            ["delivery_id", "tenant"],
            ["deliveries.id", "deliveries.tenant"],
            name="fk_activity_delivery_tenant",
        ),
        CheckConstraint("length(trim(tenant)) > 0", name="ck_activity_tenant"),
        CheckConstraint(ACTIVITY_ACTION_CHECK, name="ck_activity_action"),
        CheckConstraint(
            "role IN ('staff', 'supervisor', 'supplier')",
            name="ck_activity_role",
        ),
        Index("ix_activity_tenant_created_at", "tenant", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant: Mapped[str] = mapped_column(String(100))
    actor: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(30))
    action: Mapped[str] = mapped_column(String(100))
    # Certificate renewal writes one entry per linked SME without a delivery.
    delivery_id: Mapped[int | None] = mapped_column(index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


def create_db_engine(database_url: str | None = None) -> Engine:
    """Use the supplied URL or DATABASE_URL, preserving its SSL options."""
    raw_url = (
        os.environ.get("DATABASE_URL")
        if database_url is None
        else database_url
    )
    if not raw_url:
        raise ValueError("Set DATABASE_URL before connecting to PostgreSQL")
    try:
        url = make_url(raw_url)
    except ArgumentError:
        raise ValueError(
            "DATABASE_URL must be a valid PostgreSQL URL"
        ) from None
    if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise ValueError("DATABASE_URL must use PostgreSQL")
    return create_engine(
        url.set(drivername="postgresql+psycopg"),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
    )


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """One engine per process, created only when first requested."""
    return create_db_engine()


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency; handlers explicitly commit successful writes.

    Closing rolls back uncommitted work, including after handler exceptions.
    Routes still need role and tenant/supplier ownership checks.
    """
    with get_session_factory()() as session:
        yield session


def lock_startup(connection: Connection) -> None:
    if connection.dialect.name == "postgresql":
        connection.execute(
            text("SELECT pg_advisory_xact_lock(:key)"), {"key": STARTUP_LOCK}
        )


def database_schema(connection: Connection) -> str | None:
    schema_map = connection.get_execution_options().get("schema_translate_map")
    return schema_map.get(None) if schema_map else None


def qualified_table_name(connection: Connection, table_name: str) -> str:
    quote = connection.dialect.identifier_preparer.quote
    schema = database_schema(connection)
    return (
        f"{quote(schema)}.{quote(table_name)}"
        if schema is not None
        else quote(table_name)
    )


def _upgrade_activity_actions(connection: Connection) -> None:
    """Upgrade existing PostgreSQL audit events without deleting history."""
    if connection.dialect.name != "postgresql":
        return
    constraints = inspect(connection).get_check_constraints(
        "activity_log", schema=database_schema(connection)
    )
    if any(item["name"] == "ck_activity_action" for item in constraints):
        return
    activity = qualified_table_name(connection, "activity_log")
    deliveries = qualified_table_name(connection, "deliveries")
    # A historical check records its original automatic outcome, even when
    # a supervisor has subsequently changed the delivery's current status.
    connection.execute(
        text(
            f"UPDATE {activity} AS a SET action = CASE "
            "WHEN d.verdict IN ('covered', 'expiring') THEN 'auto_accepted' "
            "ELSE 'pending_review' END "
            f"FROM {deliveries} AS d WHERE a.action = 'delivery_checked' "
            "AND a.delivery_id = d.id AND a.tenant = d.tenant"
        )
    )
    for previous, current in (
        ("delivery_accepted", "accepted"),
        ("delivery_rejected", "rejected"),
    ):
        connection.execute(
            text(f"UPDATE {activity} SET action = :new WHERE action = :old"),
            {"new": current, "old": previous},
        )
    # Unexpected historical values need explicit correction, never deletion
    # or guessed replacement. Failure rolls the entire upgrade back.
    invalid = connection.scalar(
        text(
            f"SELECT count(*) FROM {activity} "
            f"WHERE NOT ({ACTIVITY_ACTION_CHECK})"
        )
    )
    if invalid:
        raise ValueError(
            "Activity history contains unsupported actions; "
            "correct them before restarting"
        )
    connection.execute(
        text(
            f"ALTER TABLE {activity} ADD CONSTRAINT ck_activity_action "
            f"CHECK ({ACTIVITY_ACTION_CHECK})"
        )
    )


def _initialize_schema(connection: Connection) -> None:
    lock_startup(connection)
    Base.metadata.create_all(connection)
    # Narrow additive upgrade for databases created before binary storage.
    # Existing image references/rows are retained; no conversion or reset.
    schema = database_schema(connection)
    for table_name in ("certificates", "deliveries"):
        columns = {
            column["name"]
            for column in inspect(connection).get_columns(table_name, schema)
        }
        qualified = qualified_table_name(connection, table_name)
        for column_name in ("image_bytes",):
            if column_name in columns:
                continue
            column = Base.metadata.tables[table_name].c[column_name]
            definition = str(
                CreateColumn(column).compile(dialect=connection.dialect)
            )
            connection.execute(
                text(f"ALTER TABLE {qualified} ADD COLUMN {definition}")
            )
    _upgrade_activity_actions(connection)


def init_db(engine: Engine | Connection | None = None) -> None:
    """Create tables and upgrade image columns and activity actions.

    Only the documented image/action upgrades are automatic. Other schema
    changes still require an explicit migration.
    """
    target = get_engine() if engine is None else engine
    if isinstance(target, Connection):
        _initialize_schema(target)
    else:
        with target.begin() as connection:
            _initialize_schema(connection)


def dispose_db() -> None:
    """Release cached connections at application shutdown."""
    if get_engine.cache_info().currsize:
        get_engine().dispose()
    get_session_factory.cache_clear()
    get_engine.cache_clear()


def main() -> int:
    try:
        init_db()
    except (ValueError, SQLAlchemyError) as exc:
        print(
            f"Database initialisation failed ({type(exc).__name__}). "
            "Check DATABASE_URL, PostgreSQL availability and permissions.",
            file=sys.stderr,
        )
        return 1
    print("Connected to PostgreSQL. All five tables are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
