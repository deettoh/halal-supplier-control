"""Validated seed-file boundary; inserts only into empty tables."""

from datetime import date
from pathlib import Path
from typing import Any, Literal

from pydantic import AwareDatetime, Field, field_validator, model_validator
from sqlalchemy import Table, func, select, text
from sqlalchemy.orm import Session

from backend import db
from backend.schemas import (
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

DEFAULT_SEED_PATH = Path(__file__).resolve().parents[1] / "seed" / "seed.json"
ImageType = Literal["image/jpeg", "image/png", "image/webp"]


class SeedImage(APIModel):
    image: str | None = None
    image_file: NonEmptyText | None = None
    image_content_type: ImageType | None = None

    @model_validator(mode="after")
    def check_image_pair(self) -> "SeedImage":
        if (self.image_file is None) != (self.image_content_type is None):
            raise ValueError(
                "image_file and image_content_type must be paired"
            )
        return self


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
    rule_results: list[RuleResult] = Field(min_length=5, max_length=5)
    verdict: Verdict
    status: DeliveryStatus
    error: str | None = None
    decided_by: str | None = None
    reason: str | None = None
    created_at: AwareDatetime = Field(default_factory=db.utc_now)

    @model_validator(mode="after")
    def check_checklist(self) -> "DeliverySeed":
        if [item.rule for item in self.rule_results] != [
            "R1",
            "R2",
            "R3",
            "R4",
            "R5",
        ]:
            raise ValueError("rule_results must contain R1 to R5 in order")
        return self


class ActivitySeed(APIModel):
    id: RecordId
    tenant: NonEmptyText
    actor: NonEmptyText
    role: DemoRole
    action: NonEmptyText
    delivery_id: RecordId | None = None
    reason: str | None = None
    created_at: AwareDatetime = Field(default_factory=db.utc_now)


class SeedData(APIModel):
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
        return self


def load_seed(path: Path) -> SeedData | None:
    if not path.exists():
        return None
    return SeedData.model_validate_json(path.read_text(encoding="utf-8-sig"))


def _image_values(row: SeedImage, base: Path, table: str) -> dict[str, Any]:
    values = row.model_dump(exclude={"image_file"})
    if row.image_file is not None:
        root = base.resolve()
        image_path = (root / row.image_file).resolve()
        if not image_path.is_relative_to(root):
            raise ValueError("Seed images must be inside the seed directory")
        payload = image_path.read_bytes()
        if not payload:
            raise ValueError("Seed image must not be empty")
        values["image_bytes"] = payload
        values["image"] = row.image or f"/api/{table}/{values['id']}/image"
    if table == "deliveries" and not values.get("image"):
        raise ValueError("Seed deliveries require image or image_file")
    return values


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
    session: Session, seed: SeedData, base: Path
) -> dict[str, int]:
    """Caller owns the transaction and startup lock. Never overwrite rows."""
    counts: dict[str, int] = {}
    models: list[type[db.Base]] = [
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
                _image_values(row, base, name)
                if isinstance(row, SeedImage)
                else row.model_dump()
            )
            session.add(model(**values))
        session.flush()
        table = db.Base.metadata.tables[name]
        _advance_sequence(session, table)
        counts[name] = len(rows)
    return counts
