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

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


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


def init_db(engine: Engine | None = None) -> None:
    """Create missing tables only. Does not reset data or migrate tables."""
    Base.metadata.create_all(get_engine() if engine is None else engine)


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
