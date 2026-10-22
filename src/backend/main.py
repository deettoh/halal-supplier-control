"""Executable API contract; business routes deliberately return HTTP 501."""

import logging
import os
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any, NoReturn

from fastapi import Depends, FastAPI, Form, Header, HTTPException, Path, Query
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from backend.db import dispose_db
from backend.schemas import (
    ActivityResponse,
    CertificateCreateRequest,
    CertificateExtractRequest,
    CertificateExtractResponse,
    CertificateResponse,
    DeliveryCreateRequest,
    DeliveryDecisionRequest,
    DeliveryListQuery,
    DeliveryResponse,
    DemoContext,
    DemoRole,
    ErrorResponse,
    HealthResponse,
    MaterialResponse,
    NonEmptyText,
    ValidationErrorResponse,
)
from backend.startup import bootstrap_database

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    try:
        if os.environ.get("DATABASE_URL"):
            try:
                counts = await run_in_threadpool(bootstrap_database)
            except (OSError, ValueError, SQLAlchemyError) as exc:
                raise RuntimeError(
                    f"Database startup failed ({type(exc).__name__}). "
                    "Check connectivity, permissions "
                    "and seed data. No seed transaction was committed."
                ) from None
            logger.info("Database ready; seed rows inserted: %s", counts)
        else:
            logger.warning("DATABASE_URL unset; database startup skipped")
        yield
    finally:
        await run_in_threadpool(dispose_db)


app = FastAPI(
    lifespan=lifespan,
    title="Halal Supplier Control",
    version="0.1.0",
    description=(
        "Contract scaffold. Business endpoints return 501 until implemented. "
        "Reports document coverage only, never a halal ruling. Demo headers "
        "simulate identity. Certificate extraction is a stretch feature."
    ),
)

ERRORS: dict[int | str, dict[str, Any]] = {
    403: {"model": ErrorResponse, "description": "Demo role not permitted"},
    422: {"model": ValidationErrorResponse},
    501: {"model": ErrorResponse, "description": "Not implemented yet"},
}


def require_roles(*roles: DemoRole) -> Callable[..., DemoContext]:
    def check_headers(
        role: Annotated[DemoRole, Header(alias="X-Demo-Role")],
        tenant: Annotated[NonEmptyText, Header(alias="X-Demo-Tenant")],
    ) -> DemoContext:
        if role not in roles:
            raise HTTPException(403, "Demo role not permitted")
        return DemoContext(role=role, tenant=tenant)

    return check_headers


Staff = Annotated[DemoContext, Depends(require_roles("staff"))]
Supervisor = Annotated[DemoContext, Depends(require_roles("supervisor"))]
Supplier = Annotated[DemoContext, Depends(require_roles("supplier"))]
Reader = Annotated[DemoContext, Depends(require_roles("staff", "supervisor"))]
DeliveryId = Annotated[int, Path(gt=0)]


def not_implemented() -> NoReturn:
    raise HTTPException(501, "Contract only: business logic not implemented")


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health() -> HealthResponse:
    return HealthResponse()


@app.get(
    "/api/materials",
    response_model=list[MaterialResponse],
    responses=ERRORS,
    tags=["Materials"],
)
def list_materials(context: Reader) -> list[MaterialResponse]:
    """Chosen SME's masterlist with coverage computed on every read."""
    not_implemented()


@app.post(
    "/api/deliveries",
    response_model=DeliveryResponse,
    status_code=201,
    responses={**ERRORS, 404: {"model": ErrorResponse}},
    tags=["Deliveries"],
)
def create_delivery(
    context: Staff,
    request: Annotated[
        DeliveryCreateRequest, Form(media_type="multipart/form-data")
    ],
) -> DeliveryResponse:
    """Photo + material_id; extraction failures will be saved for review."""
    not_implemented()


@app.get(
    "/api/deliveries",
    response_model=list[DeliveryResponse],
    responses=ERRORS,
    tags=["Deliveries"],
)
def list_deliveries(
    context: Supervisor,
    query: Annotated[DeliveryListQuery, Query()],
) -> list[DeliveryResponse]:
    """Pending review queue for the chosen SME."""
    not_implemented()


@app.post(
    "/api/deliveries/{id}/decision",
    response_model=DeliveryResponse,
    responses={
        **ERRORS,
        404: {"model": ErrorResponse, "description": "Delivery not found"},
        409: {"model": ErrorResponse, "description": "Already resolved"},
    },
    tags=["Deliveries"],
)
def decide_delivery(
    id: DeliveryId,
    request: DeliveryDecisionRequest,
    context: Supervisor,
) -> DeliveryResponse:
    """Accept/reject a pending delivery with a nonblank reason."""
    not_implemented()


@app.get(
    "/api/activity",
    response_model=list[ActivityResponse],
    responses=ERRORS,
    tags=["Activity"],
)
def list_activity(context: Supervisor) -> list[ActivityResponse]:
    """Chosen SME's audit activity, newest first."""
    not_implemented()


@app.get(
    "/api/certificates",
    response_model=list[CertificateResponse],
    responses=ERRORS,
    tags=["Certificates"],
)
def list_certificates(context: Supplier) -> list[CertificateResponse]:
    """Supplier's own active and superseded certificates."""
    not_implemented()


@app.post(
    "/api/certificates",
    response_model=CertificateResponse,
    status_code=201,
    responses=ERRORS,
    tags=["Certificates"],
)
def renew_certificate(
    context: Supplier,
    request: Annotated[
        CertificateCreateRequest, Form(media_type="multipart/form-data")
    ],
) -> CertificateResponse:
    """Renew using form fields, JSON-encoded scope, and an optional image.

    Supplier ID comes from X-Demo-Tenant, never from this form.
    """
    not_implemented()


@app.post(
    "/api/certificates/extract",
    response_model=CertificateExtractResponse,
    responses=ERRORS,
    tags=["Certificates (stretch)"],
)
def extract_certificate(
    context: Supplier,
    request: Annotated[
        CertificateExtractRequest, Form(media_type="multipart/form-data")
    ],
) -> CertificateExtractResponse:
    """Stretch: pre-fill only; extraction does not submit a renewal."""
    not_implemented()
