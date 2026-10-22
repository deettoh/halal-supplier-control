"""Database-backed API workflows; certificate extraction remains stretch."""

import logging
import os
from collections.abc import AsyncIterator, Callable, Generator
from contextlib import asynccontextmanager
from typing import Annotated, Any, NoReturn

from fastapi import (
    Depends,
    FastAPI,
    Form,
    Header,
    HTTPException,
    Path,
    Query,
    Request,
)
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend import services
from backend.db import dispose_db, get_session_factory
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
        "Reports document coverage only, never a halal ruling. Demo headers "
        "simulate identity. Certificate extraction is a stretch feature."
    ),
)

ERRORS: dict[int | str, dict[str, Any]] = {
    403: {"model": ErrorResponse, "description": "Demo role not permitted"},
    422: {"model": ValidationErrorResponse | ErrorResponse},
    503: {"model": ErrorResponse, "description": "Database unavailable"},
}


@app.exception_handler(SQLAlchemyError)
def database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
    logger.error("Database request failed (%s)", type(error).__name__)
    return JSONResponse(
        status_code=503, content={"detail": "Database unavailable"}
    )


def database() -> Generator[Session, None, None]:
    try:
        factory = get_session_factory()
    except ValueError:
        raise HTTPException(503, "Database is not configured") from None
    with factory() as session:
        yield session


Database = Annotated[Session, Depends(database)]


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
PhotoReader = Annotated[
    DemoContext, Depends(require_roles("staff", "supervisor", "supplier"))
]
DeliveryId = Annotated[int, Path(gt=0)]
CertificateId = Annotated[int, Path(gt=0)]


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
def list_materials(
    context: Reader, session: Database
) -> list[MaterialResponse]:
    """Chosen SME's masterlist with coverage computed on every read."""
    return services.materials(session, context)


@app.post(
    "/api/deliveries",
    response_model=DeliveryResponse,
    status_code=201,
    responses={
        **ERRORS,
        404: {"model": ErrorResponse},
        413: {"model": ErrorResponse, "description": "Photo exceeds 10 MiB"},
    },
    tags=["Deliveries"],
)
def create_delivery(
    context: Staff,
    request: Annotated[
        DeliveryCreateRequest, Form(media_type="multipart/form-data")
    ],
    session: Database,
) -> DeliveryResponse:
    """Photo + material_id; extraction failures will be saved for review."""
    return services.create_delivery(
        session,
        context,
        request.material_id,
        services.read_photo(request.image),
    )


@app.get(
    "/api/deliveries",
    response_model=list[DeliveryResponse],
    responses=ERRORS,
    tags=["Deliveries"],
)
def list_deliveries(
    context: Supervisor,
    query: Annotated[DeliveryListQuery, Query()],
    session: Database,
) -> list[DeliveryResponse]:
    """Pending review queue for the chosen SME."""
    return services.delivery_queue(session, context)


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
    session: Database,
) -> DeliveryResponse:
    """Accept/reject a pending delivery with a nonblank reason."""
    return services.decide_delivery(session, context, id, request)


@app.get(
    "/api/activity",
    response_model=list[ActivityResponse],
    responses=ERRORS,
    tags=["Activity"],
)
def list_activity(
    context: Supervisor, session: Database
) -> list[ActivityResponse]:
    """Chosen SME's audit activity, newest first."""
    return services.activity(session, context)


@app.get(
    "/api/certificates",
    response_model=list[CertificateResponse],
    responses={**ERRORS, 404: {"model": ErrorResponse}},
    tags=["Certificates"],
)
def list_certificates(
    context: Supplier, session: Database
) -> list[CertificateResponse]:
    """Supplier's own active and superseded certificates."""
    return services.certificates(session, context)


@app.post(
    "/api/certificates",
    response_model=CertificateResponse,
    status_code=201,
    responses={
        **ERRORS,
        404: {"model": ErrorResponse},
        413: {"model": ErrorResponse, "description": "Photo exceeds 10 MiB"},
    },
    tags=["Certificates"],
)
def renew_certificate(
    context: Supplier,
    request: Annotated[
        CertificateCreateRequest, Form(media_type="multipart/form-data")
    ],
    session: Database,
) -> CertificateResponse:
    """Renew using form fields, JSON-encoded scope, and an optional image.

    Supplier ID comes from X-Demo-Tenant, never from this form.
    """
    payload = services.read_photo(request.image) if request.image else None
    return services.renew_certificate(session, context, request, payload)


@app.post(
    "/api/certificates/extract",
    response_model=CertificateExtractResponse,
    responses={**ERRORS, 501: {"model": ErrorResponse}},
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


def jpeg_response(payload: bytes) -> Response:
    return Response(
        content=payload,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get(
    "/api/deliveries/{id}/image",
    responses={
        **ERRORS,
        404: {"model": ErrorResponse},
        200: {
            "content": {
                "image/jpeg": {
                    "schema": {"type": "string", "format": "binary"}
                }
            }
        },
    },
    response_class=Response,
    tags=["Images"],
)
def delivery_image(
    id: DeliveryId, context: Reader, session: Database
) -> Response:
    """Stored JPEG for staff/supervisor of the delivery's SME."""
    return jpeg_response(services.delivery_photo(session, context, id))


@app.get(
    "/api/certificates/{id}/image",
    responses={
        **ERRORS,
        404: {"model": ErrorResponse},
        200: {
            "content": {
                "image/jpeg": {
                    "schema": {"type": "string", "format": "binary"}
                }
            }
        },
    },
    response_class=Response,
    tags=["Images"],
)
def certificate_image(
    id: CertificateId, context: PhotoReader, session: Database
) -> Response:
    """Stored JPEG for the owning supplier or a staff/supervisor linked SME."""
    return jpeg_response(services.certificate_photo(session, context, id))
