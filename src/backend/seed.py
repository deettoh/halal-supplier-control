"""Validated seed rows and startup backfill of missing certificate PNGs."""

from datetime import date
from pathlib import Path
from typing import Any

from pydantic import AwareDatetime, Field, field_validator, model_validator
from sqlalchemy import Table, func, select, text
from sqlalchemy.orm import Session, undefer

from backend import db, images
from backend.schemas import (
    RULE_ORDER,
    RULE_ORDER_ERROR,
    ActivityAction,
    APIModel,
    CertificateScopeItem,
    CertificateStatus,
    DeliveryStatus,
    DemoRole,
    LabelExtraction,
    NonEmptyText,
    RecordId,
    RuleResult,
    Verdict,
)
from backend.settings import RuleSettings

DEFAULT_SEED_PATH = Path(__file__).resolve().parents[1] / "seed" / "seed.json"


class SeedImage(APIModel):
    image: str | None = None
    image_file: NonEmptyText | None = None


class SupplierSeed(APIModel):
    id: RecordId
    name: NonEmptyText


class CertificateSeed(SeedImage):
    id: RecordId
    supplier_id: RecordId
    issuer: NonEmptyText
    cert_no: NonEmptyText
    holder_name: NonEmptyText
    expiry_date: date
    scope: list[CertificateScopeItem] = Field(min_length=1)
    status: CertificateStatus = "active"

    @field_validator("scope", mode="before")
    @classmethod
    def normalize_product_scope(cls, value: Any) -> Any:
        """Keep the merged seed's product lists compatible with API scope."""
        if not isinstance(value, list):
            return value
        return [
            {"product_name": item, "brand": None}
            if isinstance(item, str)
            else item
            for item in value
        ]


class PersonSeed(APIModel):
    id: RecordId
    name: NonEmptyText
    title: NonEmptyText
    role: DemoRole
    tenant: NonEmptyText


class SMESettingsSeed(RuleSettings):
    id: RecordId
    tenant: NonEmptyText


class MaterialSeed(APIModel):
    id: RecordId
    tenant: NonEmptyText
    name: NonEmptyText
    supplier_id: RecordId
    approved_brand: NonEmptyText
    approved_manufacturer: NonEmptyText


class DeliverySeed(SeedImage):
    id: RecordId
    tenant: NonEmptyText
    material_id: RecordId
    extracted: LabelExtraction | None
    rule_results: list[RuleResult] = Field(
        min_length=len(RULE_ORDER), max_length=len(RULE_ORDER)
    )
    verdict: Verdict
    status: DeliveryStatus
    error: str | None = None
    next_step: str | None = None
    decided_by: str | None = None
    reason: str | None = None
    created_at: AwareDatetime = Field(default_factory=db.utc_now)

    @model_validator(mode="after")
    def check_checklist(self) -> "DeliverySeed":
        if tuple(item.rule for item in self.rule_results) != RULE_ORDER:
            raise ValueError(RULE_ORDER_ERROR)
        allowed = {"request_certificate", "request_product_details"}
        if self.status == "on_hold":
            if (
                self.next_step not in allowed
                or not self.decided_by
                or not self.reason
            ):
                raise ValueError(
                    "Held delivery needs actor, reason and next_step"
                )
        elif self.next_step is not None:
            raise ValueError("next_step is only valid for on_hold")
        return self


class ActivitySeed(APIModel):
    actor_title: str | None = None
    material_name: str | None = None
    verdict: Verdict | None = None
    supplier_name: str | None = None
    id: RecordId
    tenant: NonEmptyText
    actor: NonEmptyText
    role: DemoRole
    action: ActivityAction
    delivery_id: RecordId | None = None
    reason: str | None = None
    created_at: AwareDatetime = Field(default_factory=db.utc_now)


class SeedData(APIModel):
    sme_settings: list[SMESettingsSeed] = Field(default_factory=list)
    people: list[PersonSeed] = Field(default_factory=list)
    suppliers: list[SupplierSeed] = Field(default_factory=list)
    certificates: list[CertificateSeed] = Field(default_factory=list)
    materials: list[MaterialSeed] = Field(default_factory=list)
    deliveries: list[DeliverySeed] = Field(default_factory=list)
    activity_log: list[ActivitySeed] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_unique_ids(self) -> "SeedData":
        for name in type(self).model_fields:
            ids = [row.id for row in getattr(self, name)]
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate IDs in seed table {name}")
        tenants = [row.tenant for row in self.sme_settings]
        if len(tenants) != len(set(tenants)):
            raise ValueError("Duplicate SME settings tenants")
        return self


def load_seed(path: Path) -> SeedData | None:
    if not path.exists():
        return None
    return SeedData.model_validate_json(path.read_text(encoding="utf-8-sig"))


def _read_seed_png(
    filename: str, base: Path, *, required: bool = False
) -> bytes | None:
    root = base.resolve()
    image_path = (root / filename).resolve()
    if not image_path.is_relative_to(root):
        raise ValueError(
            f"Seed image '{filename}' must be inside the seed directory"
        )
    if image_path.suffix.lower() != ".png":
        raise ValueError(f"Seed image '{filename}' must use a PNG file")
    try:
        payload = image_path.read_bytes()
    except FileNotFoundError:
        if required:
            raise ValueError(
                f"Seed image file is missing: {image_path}"
            ) from None
        return None
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Seed image '{filename}' must have a PNG signature")
    try:
        return images.as_jpeg(payload)
    except ValueError as error:
        raise ValueError(f"Seed image '{filename}': {error}") from None


def upgrade_stored_photos(session: Session) -> None:
    """Convert legacy PNG photo bytes in place; never re-encode JPEG rows."""
    for model in (db.Certificate, db.Delivery):
        rows = session.scalars(
            select(model)
            .where(
                model.image_bytes.is_not(None),
                func.substr(model.image_bytes, 1, 3) != b"\xff\xd8\xff",
            )
            .options(undefer(model.image_bytes))
        )
        for row in rows:
            assert isinstance(row, (db.Certificate, db.Delivery))
            assert row.image_bytes is not None
            row.image_bytes = images.as_jpeg(row.image_bytes)


def _image_values(
    row: SeedImage, base: Path, table: str, *, require_images: bool = False
) -> dict[str, Any]:
    values = row.model_dump(exclude={"image_file"})
    if row.image_file is not None:
        payload = _read_seed_png(row.image_file, base, required=require_images)
        values["image_bytes"] = payload
        if payload is not None or table == "deliveries":
            values["image"] = f"/api/{table}/{values['id']}/image"
    if table == "deliveries" and not values.get("image"):
        raise ValueError("Seed deliveries require image or image_file")
    return values


def _fill_certificate_photos(
    session: Session,
    seed: SeedData,
    base: Path,
    *,
    require_images: bool = False,
) -> None:
    for row in seed.certificates:
        if row.image_file is None:
            continue
        saved = session.scalar(
            select(db.Certificate).where(
                db.Certificate.id == row.id,
                db.Certificate.supplier_id == row.supplier_id,
                db.Certificate.cert_no == row.cert_no,
                db.Certificate.image_bytes.is_(None),
            )
        )
        if saved is None:
            continue
        payload = _read_seed_png(row.image_file, base, required=require_images)
        if payload is not None:
            saved.image_bytes = payload
            saved.image = f"/api/certificates/{saved.id}/image"


def _advance_sequence(session: Session, table: Table) -> None:
    connection = session.connection()
    if connection.dialect.name != "postgresql":
        return
    qualified = db.qualified_table_name(connection, table.name)
    sequence = session.scalar(
        text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
        {"table_name": qualified},
    )
    maximum = session.scalar(select(func.max(table.c.id)))
    if sequence is not None and maximum is not None:
        session.execute(
            text(
                "SELECT setval(CAST(:sequence AS regclass), "
                "GREATEST(pg_sequence_last_value("
                "CAST(:sequence AS regclass)), "
                ":maximum), true)"
            ),
            {"sequence": sequence, "maximum": maximum},
        )


def seed_empty_tables(
    session: Session,
    seed: SeedData,
    base: Path,
    *,
    require_images: bool = False,
) -> dict[str, int]:
    """Insert empty tables, then fill missing certificate photos only.

    Caller owns the transaction and startup lock. Counts report new rows.
    Startup tolerates missing files; a reset requires referenced images.
    """
    counts: dict[str, int] = {}
    # Existing policies are retained; newly seeded SMEs are backfilled even
    # when another SME already has a policy in this database.
    counts["sme_settings"] = 0
    for policy in seed.sme_settings:
        if (
            session.scalar(
                select(db.SMESettings.id).where(
                    db.SMESettings.tenant == policy.tenant
                )
            )
            is None
        ):
            session.add(db.SMESettings(**policy.model_dump()))
            counts["sme_settings"] += 1
    session.flush()
    _advance_sequence(session, db.Base.metadata.tables["sme_settings"])
    models: list[type[db.Base]] = [
        db.Person,
        db.Supplier,
        db.Certificate,
        db.Material,
        db.Delivery,
        db.ActivityLog,
    ]
    for model in models:
        name = model.__tablename__
        rows = getattr(seed, name)
        if not rows or session.scalar(select(model).limit(1)) is not None:
            counts[name] = 0
            continue
        for row in rows:
            values = (
                _image_values(row, base, name, require_images=require_images)
                if isinstance(row, SeedImage)
                else row.model_dump()
            )
            session.add(model(**values))
        session.flush()
        table = db.Base.metadata.tables[name]
        _advance_sequence(session, table)
        counts[name] = len(rows)
    _fill_certificate_photos(
        session, seed, base, require_images=require_images
    )
    return counts
