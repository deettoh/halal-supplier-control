"""Tenant-scoped reads, delivery checks and atomic workflow writes."""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend import db, extract, images, rules
from backend.schemas import (
    RULE_ORDER,
    ActivityResponse,
    CertificateCreateRequest,
    CertificateExtractResponse,
    CertificateResponse,
    Coverage,
    DeliveryDecisionRequest,
    DeliveryResponse,
    DemoContext,
    LabelExtraction,
    MaterialResponse,
    NamedDemoContext,
    RenewalDecisionRequest,
    RenewalResponse,
    RuleResult,
)

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024
# Internal marker while the durable evidence is being extracted. The row is
# hidden from review until extraction finishes or its deadline passes. After
# a crashed worker, the stored fallback is still reviewable at that deadline.
INCOMPLETE_EXTRACTION = (
    "Extraction did not complete before its deadline; human review required."
)


def read_photo(upload: UploadFile) -> bytes:
    """Bound uploads; preserve source bytes for main's demo-cache hashes."""
    payload = upload.file.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Photo must be at most 10 MiB")
    is_png = payload.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpeg = payload.startswith(b"\xff\xd8\xff")
    if not is_png and not is_jpeg:
        raise HTTPException(422, "Upload must be a nonempty PNG or JPEG image")
    return payload


def _stored_photo(payload: bytes) -> bytes:
    try:
        return images.as_jpeg(payload)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None


def _processing_cutoff() -> datetime:
    return db.utc_now() - timedelta(seconds=extract.TIMEOUT_SECONDS)


def _aware(value: datetime) -> datetime:
    # PostgreSQL retains timezone information; SQLite test storage does not.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def delivery_response(row: db.Delivery) -> DeliveryResponse:
    values = {
        field: getattr(row, field) for field in DeliveryResponse.model_fields
    }
    values["created_at"] = _aware(row.created_at)
    return DeliveryResponse.model_validate(values)


def certificate_response(row: db.Certificate) -> CertificateResponse:
    return CertificateResponse.model_validate(row, from_attributes=True)


def _certificate_values(row: db.Certificate | None) -> dict[str, object]:
    if row is None:
        return {}
    return {
        "scope": row.scope,
        "expiry_date": row.expiry_date,
        "issuer": row.issuer,
    }


def _material_values(row: db.Material) -> dict[str, object]:
    return {
        "name": row.name,
        "approved_brand": row.approved_brand,
        "approved_manufacturer": row.approved_manufacturer,
    }


def materials(
    session: Session, context: DemoContext
) -> list[MaterialResponse]:
    rows = session.execute(
        select(db.Material, db.Supplier, db.Certificate)
        .join(db.Supplier, db.Supplier.id == db.Material.supplier_id)
        .outerjoin(
            db.Certificate,
            (db.Certificate.supplier_id == db.Supplier.id)
            & (db.Certificate.status == "active"),
        )
        .where(db.Material.tenant == context.tenant)
        .order_by(db.Material.id)
    )
    result = []
    today = db.business_today()
    for material, supplier, certificate in rows:
        verdict = rules.evaluate(
            {
                "product_name": material.name,
                "brand": material.approved_brand,
                "manufacturer": material.approved_manufacturer,
                # coverage ignores the halal mark
                "halal_mark_present": True,
            },
            _material_values(material),
            _certificate_values(certificate),
            today,
        )["verdict"]
        coverage: Coverage = "not_covered"
        if verdict == "covered":
            coverage = "covered"
        elif verdict == "expiring":
            coverage = "expiring"
        result.append(
            MaterialResponse(
                id=material.id,
                name=material.name,
                supplier_id=supplier.id,
                supplier_name=supplier.name,
                approved_brand=material.approved_brand,
                approved_manufacturer=material.approved_manufacturer,
                coverage_status=coverage,
                certificate_expiry_date=(
                    certificate.expiry_date if certificate else None
                ),
            )
        )
    return result


def delivery_queue(
    session: Session, context: DemoContext, status: str = "pending_review"
) -> list[DeliveryResponse]:
    rows = session.scalars(
        select(db.Delivery)
        .where(
            db.Delivery.tenant == context.tenant,
            db.Delivery.status == status,
            or_(
                db.Delivery.error.is_(None),
                db.Delivery.error != INCOMPLETE_EXTRACTION,
                db.Delivery.created_at <= _processing_cutoff(),
            ),
        )
        .order_by(db.Delivery.created_at.desc(), db.Delivery.id.desc())
    )
    return [delivery_response(row) for row in rows]


def activity(session: Session, context: DemoContext) -> list[ActivityResponse]:
    rows = session.scalars(
        select(db.ActivityLog)
        .where(db.ActivityLog.tenant == context.tenant)
        .order_by(db.ActivityLog.created_at.desc(), db.ActivityLog.id.desc())
    )
    return [
        ActivityResponse.model_validate(
            {
                **{
                    field: getattr(row, field)
                    for field in ActivityResponse.model_fields
                },
                "created_at": _aware(row.created_at),
            }
        )
        for row in rows
    ]


def supplier_id(context: DemoContext) -> int:
    try:
        value = int(context.tenant)
    except ValueError:
        raise HTTPException(
            422, "Supplier tenant must be a positive ID"
        ) from None
    if value <= 0:
        raise HTTPException(422, "Supplier tenant must be a positive ID")
    return value


def certificates(
    session: Session, context: DemoContext
) -> list[CertificateResponse]:
    owner = supplier_id(context)
    if session.get(db.Supplier, owner) is None:
        raise HTTPException(404, "Supplier not found")
    rows = session.scalars(
        select(db.Certificate)
        .where(db.Certificate.supplier_id == owner)
        .order_by(db.Certificate.id.desc())
    )
    return [certificate_response(row) for row in rows]


def delivery_photo(
    session: Session, context: DemoContext, delivery_id: int
) -> bytes:
    payload = session.scalar(
        select(db.Delivery.image_bytes).where(
            db.Delivery.id == delivery_id,
            db.Delivery.tenant == context.tenant,
        )
    )
    if payload is None:
        raise HTTPException(404, "Delivery photo not found")
    return payload


def _failed_checks(message: str) -> list[dict[str, object]]:
    return [
        RuleResult.model_validate(
            {
                "rule": rule,
                "passed": False if rule == "R1" else None,
                "detail": message
                if rule == "R1"
                else "Not evaluated: label extraction failed.",
            }
        ).model_dump()
        for rule in RULE_ORDER
    ]


def _extract_label(
    payload: bytes,
) -> tuple[LabelExtraction | None, str | None]:
    try:
        return extract.extract_label(payload), None
    except extract.ExtractionError as error:
        # The extractor explicitly guarantees these messages are safe.
        return None, str(error)
    except ValidationError:
        # Configuration validation errors can include secret input values.
        return None, "Invalid extraction configuration; human review required."
    except ValueError:
        return (
            None,
            "Empty or invalid extraction reply; human review required.",
        )
    except TimeoutError:
        return None, "Label extraction timed out; human review required."


def extract_certificate(payload: bytes) -> CertificateExtractResponse:
    """Return certificate fields from a photo or the failure message.

    Args:
        payload: Uploaded certificate photo.

    Returns:
        Either the extracted fields or null fields with the message.

    Raises:
        HTTPException: 422 if payload is not a readable image.
    """
    try:
        extracted = extract.extract_certificate(payload)
    except extract.ExtractionError as error:
        # extractor messages hold no secrets or input values
        logger.warning("Certificate extraction failed: %s", error)
        return CertificateExtractResponse(extracted=None, error=str(error))
    except ValidationError:
        # config validation errors can include secret input values
        logger.warning("Certificate extraction configuration is invalid")
        return CertificateExtractResponse(
            extracted=None, error="Invalid extraction configuration."
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    return CertificateExtractResponse(extracted=extracted, error=None)


def _matches_demo_cache(payload: bytes, label: LabelExtraction) -> bool:
    try:
        cached = extract.load_demo_cache().get(
            hashlib.sha256(payload).hexdigest()
        )
    except (OSError, ValueError):
        return False
    return cached == label


def create_delivery(
    session: Session,
    context: NamedDemoContext,
    material_id: int,
    payload: bytes,
) -> DeliveryResponse:
    material = session.scalar(
        select(db.Material).where(
            db.Material.id == material_id,
            db.Material.tenant == context.tenant,
        )
    )
    if material is None:
        raise HTTPException(404, "Material not found")
    item = db.Delivery(
        tenant=context.tenant,
        material_id=material.id,
        received_by=context.name,
        received_title=context.title,
        image="/api/deliveries/pending/image",
        image_bytes=_stored_photo(payload),
        extracted=None,
        rule_results=_failed_checks(INCOMPLETE_EXTRACTION),
        verdict="needs_human",
        status="pending_review",
        error=INCOMPLETE_EXTRACTION,
        created_at=db.utc_now(),
    )
    session.add(item)
    session.flush()
    item.image = f"/api/deliveries/{item.id}/image"
    item_id = item.id
    started_at = _aware(item.created_at)
    # Persist JPEG evidence, then release the connection for the model call.
    session.commit()
    extracted, error = _extract_label(payload)
    if started_at <= _processing_cutoff() and (
        extracted is None or not _matches_demo_cache(payload, extracted)
    ):
        extracted = None
        error = "Label extraction timed out; human review required."
    material = session.get(db.Material, material_id, populate_existing=True)
    assert material is not None
    certificate = session.scalar(
        select(db.Certificate)
        .where(
            db.Certificate.supplier_id == material.supplier_id,
            db.Certificate.status == "active",
        )
        .execution_options(populate_existing=True)
    )
    evaluation = rules.evaluate(
        extracted,
        _material_values(material),
        _certificate_values(certificate),
        db.business_today(),
    )
    saved = session.get(
        db.Delivery, item_id, populate_existing=True, with_for_update=True
    )
    assert saved is not None
    # A timed-out fallback may already have been reviewed. Preserve the
    # supervisor's decision and the exact evidence they reviewed.
    if saved.status in {"accepted", "rejected", "on_hold"}:
        return delivery_response(saved)
    saved.extracted = extracted.model_dump() if extracted is not None else None
    saved.rule_results = (
        _failed_checks(error)
        if error
        else [dict(check) for check in evaluation["rule_results"]]
    )
    saved.verdict = "needs_human" if error else evaluation["verdict"]
    saved.error = error
    saved.status = (
        "auto_accepted"
        if saved.verdict in {"covered", "expiring"}
        else "pending_review"
    )
    session.add(
        db.ActivityLog(
            tenant=context.tenant,
            actor=context.name,
            actor_title=context.title,
            material_name=material.name,
            verdict=saved.verdict,
            role=context.role,
            action=saved.status,
            delivery_id=saved.id,
        )
    )
    session.commit()
    return delivery_response(saved)


def decide_delivery(
    session: Session,
    context: NamedDemoContext,
    delivery_id: int,
    request: DeliveryDecisionRequest,
) -> DeliveryResponse:
    row = session.scalar(
        select(db.Delivery)
        .where(
            db.Delivery.id == delivery_id, db.Delivery.tenant == context.tenant
        )
        .with_for_update()
    )
    if row is None:
        raise HTTPException(404, "Delivery not found")
    if row.status not in {"pending_review", "on_hold"}:
        raise HTTPException(409, "Delivery already resolved")
    if row.status == "on_hold" and request.decision == "hold":
        raise HTTPException(409, "Delivery already on hold")
    material = session.get(db.Material, row.material_id)
    assert material is not None
    if (
        row.error == INCOMPLETE_EXTRACTION
        and _aware(row.created_at) > _processing_cutoff()
    ):
        raise HTTPException(409, "Label extraction is still in progress")
    if row.error == INCOMPLETE_EXTRACTION and row.status == "pending_review":
        # Recovery for evidence left by a terminated extraction worker.
        session.add(
            db.ActivityLog(
                tenant=context.tenant,
                actor=row.received_by or "staff",
                actor_title=row.received_title,
                material_name=material.name,
                verdict=row.verdict,
                role="staff",
                action="pending_review",
                delivery_id=row.id,
            )
        )
    row.status = {
        "accept": "accepted",
        "reject": "rejected",
        "hold": "on_hold",
    }[request.decision]
    row.next_step = request.next_step if request.decision == "hold" else None
    row.decided_by = context.name
    row.reason = request.reason
    session.add(
        db.ActivityLog(
            tenant=context.tenant,
            actor=context.name,
            actor_title=context.title,
            material_name=material.name,
            verdict=row.verdict,
            role=context.role,
            action=row.status,
            delivery_id=row.id,
            reason=request.reason,
        )
    )
    session.commit()
    return delivery_response(row)


def renew_certificate(
    session: Session,
    context: NamedDemoContext,
    request: CertificateCreateRequest,
    payload: bytes | None,
) -> CertificateResponse:
    owner = supplier_id(context)
    supplier = session.scalar(
        select(db.Supplier).where(db.Supplier.id == owner).with_for_update()
    )
    if supplier is None:
        raise HTTPException(404, "Supplier not found")
    stored = _stored_photo(payload) if payload is not None else None
    if (
        session.scalar(
            select(db.Certificate.id).where(
                db.Certificate.supplier_id == owner,
                db.Certificate.status == "pending",
            )
        )
        is not None
    ):
        raise HTTPException(409, "A renewal is already waiting for review")
    row = db.Certificate(
        supplier_id=owner,
        **request.model_dump(exclude={"image"}),
        image_bytes=stored,
        status="pending",
    )
    session.add(row)
    session.flush()
    if payload is not None:
        row.image = f"/api/certificates/{row.id}/image"
    tenants = session.scalars(
        select(db.Material.tenant)
        .where(db.Material.supplier_id == owner)
        .distinct()
        .order_by(db.Material.tenant)
    )
    for tenant in tenants:
        session.add(
            db.ActivityLog(
                tenant=tenant,
                actor=context.name,
                actor_title=context.title,
                supplier_name=supplier.name,
                role=context.role,
                action="certificate_submitted",
            )
        )
    session.commit()
    return certificate_response(row)


def certificate_photo(
    session: Session, context: DemoContext, certificate_id: int
) -> bytes:
    query = select(db.Certificate.image_bytes).where(
        db.Certificate.id == certificate_id
    )
    if context.role == "supplier":
        query = query.where(db.Certificate.supplier_id == supplier_id(context))
    elif context.role != "reviewer":
        linked = select(db.Material.id).where(
            db.Material.supplier_id == db.Certificate.supplier_id,
            db.Material.tenant == context.tenant,
        )
        query = query.where(linked.exists())
    payload = session.scalar(query)
    if payload is None:
        raise HTTPException(404, "Certificate photo not found")
    return payload


def named_context(
    session: Session, context: DemoContext, person_id: int
) -> NamedDemoContext:
    """Bind a demo person to their declared role and organisation."""
    person = session.get(db.Person, person_id)
    if person is None or (person.role, person.tenant) != (
        context.role,
        context.tenant,
    ):
        raise HTTPException(403, "Demo person not permitted")
    return NamedDemoContext(
        role=context.role,
        tenant=context.tenant,
        person_id=person.id,
        name=person.name,
        title=person.title,
    )


def pending_renewals(session: Session) -> list[RenewalResponse]:
    rows = session.execute(
        select(db.Certificate, db.Supplier)
        .join(db.Supplier, db.Supplier.id == db.Certificate.supplier_id)
        .where(db.Certificate.status == "pending")
        .order_by(db.Certificate.created_at, db.Certificate.id)
    )
    result = []
    for renewal, supplier in rows:
        current = session.scalar(
            select(db.Certificate).where(
                db.Certificate.supplier_id == supplier.id,
                db.Certificate.status == "active",
            )
        )
        result.append(
            RenewalResponse(
                renewal=certificate_response(renewal),
                current=certificate_response(current) if current else None,
                supplier_name=supplier.name,
            )
        )
    return result


def decide_renewal(
    session: Session,
    context: NamedDemoContext,
    renewal_id: int,
    request: RenewalDecisionRequest,
) -> CertificateResponse:
    # Supplier locking matches submission: one lock order serializes competing
    # submissions/decisions and preserves the single active certificate.
    owner = session.scalar(
        select(db.Certificate.supplier_id).where(
            db.Certificate.id == renewal_id
        )
    )
    if owner is None:
        raise HTTPException(404, "Renewal not found")
    session.execute(
        select(db.Supplier).where(db.Supplier.id == owner).with_for_update()
    )
    row = session.scalar(
        select(db.Certificate)
        .where(db.Certificate.id == renewal_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise HTTPException(404, "Renewal not found")
    if row.status != "pending":
        raise HTTPException(409, "Renewal already reviewed")
    if request.decision == "verify":
        for old in session.scalars(
            select(db.Certificate).where(
                db.Certificate.supplier_id == owner,
                db.Certificate.status == "active",
            )
        ):
            old.status = "superseded"
        session.flush()
        row.status = "active"
    else:
        row.status = "rejected"
    row.review_note = request.note
    row.reviewed_by = context.name
    tenants = session.scalars(
        select(db.Material.tenant)
        .where(db.Material.supplier_id == owner)
        .distinct()
        .order_by(db.Material.tenant)
    )
    supplier = session.get(db.Supplier, owner)
    assert supplier is not None
    for tenant in tenants:
        session.add(
            db.ActivityLog(
                tenant=tenant,
                actor=context.name,
                actor_title=context.title,
                supplier_name=supplier.name,
                role=context.role,
                action="certificate_renewed"
                if request.decision == "verify"
                else "certificate_rejected",
                reason=request.note,
            )
        )
    session.commit()
    return certificate_response(row)
