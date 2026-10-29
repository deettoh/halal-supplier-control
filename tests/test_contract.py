"""Exercise the published contract without a database or model endpoint."""

from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend import db
from backend.extract import LabelExtraction as ExtractLabel
from backend.main import app, database
from backend.schemas import (
    ActivityResponse,
    CertificateResponse,
    DeliveryDecisionRequest,
    DeliveryResponse,
    LabelExtraction,
)
from backend.seed import ActivitySeed

client = TestClient(app)
PNG = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()


@pytest.mark.parametrize(
    "action",
    [
        "auto_accepted",
        "pending_review",
        "accepted",
        "rejected",
        "certificate_renewed",
        "cert_renewed",
        "delivery_checked",
        "invented",
    ],
)
def test_activity_action_contract_and_seed(action: str) -> None:
    payload = {
        "id": 1,
        "actor": "staff",
        "role": "staff",
        "action": action,
        "delivery_id": None,
        "reason": None,
        "created_at": datetime.now(UTC),
    }
    valid = {
        "auto_accepted",
        "pending_review",
        "accepted",
        "rejected",
        "certificate_renewed",
    }
    for model, values in (
        (ActivityResponse, payload),
        (ActivitySeed, {**payload, "tenant": "bakery"}),
    ):
        if action in valid:
            assert model.model_validate(values).action == action
        else:
            with pytest.raises(ValidationError):
                model.model_validate(values)


def test_openapi_lists_only_five_activity_actions() -> None:
    spec = client.get("/openapi.json").json()
    action = spec["components"]["schemas"]["ActivityResponse"]["properties"][
        "action"
    ]
    assert set(action["enum"]) == {
        "auto_accepted",
        "pending_review",
        "accepted",
        "rejected",
        "certificate_renewed",
    }


@pytest.fixture(autouse=True)
def contract_database() -> Generator[None, None, None]:
    """Validation/OpenAPI tests need no configured production database."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db.init_db(engine)

    def session() -> Generator[Session, None, None]:
        with Session(engine) as current:
            yield current

    app.dependency_overrides[database] = session
    try:
        yield
    finally:
        app.dependency_overrides.pop(database, None)
        engine.dispose()


def headers(role: str = "supervisor") -> dict[str, str]:
    return {
        "X-Demo-Role": role,
        "X-Demo-Tenant": "1" if role == "supplier" else "bakery",
    }


def delivery_payload() -> dict[str, Any]:
    return {
        "id": 1,
        "material_id": 1,
        "image": "/images/label-1.png",
        "extracted": None,
        "rule_results": [
            {"rule": "R1", "passed": False, "detail": "Extraction timed out"},
            *[
                {"rule": f"R{i}", "passed": None, "detail": "Not evaluated"}
                for i in range(2, 7)
            ],
        ],
        "verdict": "needs_human",
        "status": "pending_review",
        "error": "Extraction timed out",
        "decided_by": None,
        "reason": None,
        "created_at": datetime.now(UTC).isoformat(),
    }


def test_extractor_uses_the_shared_model() -> None:
    assert ExtractLabel is LabelExtraction


@pytest.mark.parametrize("reason", ["", " ", "\n\t"])
def test_decision_rejects_blank_reason(reason: str) -> None:
    response = client.post(
        "/api/deliveries/1/decision",
        headers=headers(),
        json={"decision": "accept", "reason": reason},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"decision": "accept"},
        {"decision": "approve", "reason": "Checked"},
        {"decision": "accept", "reason": "Checked", "tenant": "other"},
    ],
)
def test_decision_request_rejects_invalid_input(
    payload: dict[str, str],
) -> None:
    with pytest.raises(ValidationError):
        DeliveryDecisionRequest.model_validate(payload)


@pytest.mark.parametrize("role", ["staff", "supplier"])
def test_only_supervisor_can_decide(role: str) -> None:
    response = client.post(
        "/api/deliveries/1/decision",
        headers=headers(role),
        json={"decision": "reject", "reason": "Wrong brand"},
    )
    assert response.status_code == 403


def test_valid_decision_for_unknown_delivery_returns_404() -> None:
    response = client.post(
        "/api/deliveries/1/decision",
        headers=headers(),
        json={"decision": "reject", "reason": "Wrong brand"},
    )
    assert response.status_code == 404


def test_upload_accepts_flat_multipart_fields() -> None:
    response = client.post(
        "/api/deliveries",
        headers=headers("staff"),
        data={"material_id": "1"},
        files={"image": ("label.png", PNG, "image/png")},
    )
    assert response.status_code == 404  # Valid form; unknown material.


@pytest.mark.parametrize("material_id", ["0", "-1", "abc"])
def test_upload_rejects_invalid_material_id(material_id: str) -> None:
    response = client.post(
        "/api/deliveries",
        headers=headers("staff"),
        data={"material_id": material_id},
        files={"image": ("label.png", b"fake image", "image/png")},
    )
    assert response.status_code == 422


def test_upload_requires_an_image() -> None:
    response = client.post(
        "/api/deliveries",
        headers=headers("staff"),
        data={"material_id": "1"},
    )
    assert response.status_code == 422


def certificate_form() -> dict[str, str]:
    return {
        "issuer": "SAMPLE Issuer",
        "cert_no": "SAMPLE-001",
        "holder_name": "SAMPLE Supplier",
        "expiry_date": "2027-12-31",
        "scope": '[{"product_name":"Flour","brand":"SAMPLE Brand"}]',
    }


@pytest.mark.parametrize("with_image", [False, True])
def test_certificate_form_accepts_json_scope_and_optional_image(
    with_image: bool,
) -> None:
    files = (
        {"image": ("certificate.png", PNG, "image/png")}
        if with_image
        else None
    )
    response = client.post(
        "/api/certificates",
        headers=headers("supplier"),
        data=certificate_form(),
        files=files,
    )
    assert response.status_code == 404  # Valid form; unknown supplier.


@pytest.mark.parametrize("scope", ["not JSON", "[]", '[{"brand":"Only"}]'])
def test_certificate_form_rejects_invalid_scope(scope: str) -> None:
    response = client.post(
        "/api/certificates",
        headers=headers("supplier"),
        data={**certificate_form(), "scope": scope},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("role", ["staff", "supervisor"])
def test_only_supplier_can_renew(role: str) -> None:
    response = client.post(
        "/api/certificates",
        headers=headers(role),
        data=certificate_form(),
    )
    assert response.status_code == 403


def test_stretch_extract_accepts_image() -> None:
    response = client.post(
        "/api/certificates/extract",
        headers=headers("supplier"),
        files={"image": ("certificate.png", b"fake image", "image/png")},
    )
    assert response.status_code == 501


@pytest.mark.parametrize(
    "request_headers",
    [{}, headers("owner"), {**headers(), "X-Demo-Tenant": " "}],
)
def test_required_demo_headers_are_validated(
    request_headers: dict[str, str],
) -> None:
    assert (
        client.get("/api/materials", headers=request_headers).status_code
        == 422
    )


def test_queue_rejects_unknown_status() -> None:
    assert (
        client.get(
            "/api/deliveries?status=accepted", headers=headers()
        ).status_code
        == 422
    )


def test_delivery_response_supports_failed_extraction() -> None:
    delivery = DeliveryResponse.model_validate(delivery_payload())
    assert delivery.extracted is None
    assert delivery.rule_results[-1].passed is None


def test_response_requires_complete_ordered_checklist() -> None:
    payload = delivery_payload()
    payload["rule_results"].reverse()
    with pytest.raises(ValidationError, match="R1 to R6"):
        DeliveryResponse.model_validate(payload)
    payload["rule_results"] = []
    with pytest.raises(ValidationError):
        DeliveryResponse.model_validate(payload)


def test_response_requires_timezone() -> None:
    with pytest.raises(ValidationError):
        DeliveryResponse.model_validate(
            {**delivery_payload(), "created_at": "2026-10-21T12:00:00"}
        )


def test_response_scope_is_json_array_not_encoded_string() -> None:
    certificate = CertificateResponse.model_validate(
        {
            **certificate_form(),
            "id": 1,
            "supplier_id": 1,
            "image": None,
            "status": "active",
            "scope": [{"product_name": "Flour", "brand": None}],
        }
    )
    assert isinstance(certificate.model_dump(mode="json")["scope"], list)


def test_openapi_documents_all_eight_business_routes() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    expected = {
        ("/api/materials", "get"),
        ("/api/deliveries", "post"),
        ("/api/deliveries", "get"),
        ("/api/deliveries/{id}/decision", "post"),
        ("/api/activity", "get"),
        ("/api/certificates", "get"),
        ("/api/certificates", "post"),
        ("/api/certificates/extract", "post"),
    }
    actual = {
        (path, method)
        for path, methods in spec["paths"].items()
        for method in methods
        if path != "/api/health" and not path.endswith("/image")
    }
    assert actual == expected
    for path, method in expected:
        operation = spec["paths"][path][method]
        header_names = {
            p["name"] for p in operation["parameters"] if p["in"] == "header"
        }
        assert header_names == {"X-Demo-Role", "X-Demo-Tenant"}
        assert ("501" in operation["responses"]) == (
            path == "/api/certificates/extract"
        )
        success = (
            operation["responses"].get("201") or operation["responses"]["200"]
        )
        assert "application/json" in success["content"]
    for path in ["/api/deliveries", "/api/certificates"]:
        content = spec["paths"][path]["post"]["requestBody"]["content"]
        assert "multipart/form-data" in content
    for path in ["/api/deliveries/{id}/image", "/api/certificates/{id}/image"]:
        operation = spec["paths"][path]["get"]
        assert "image/jpeg" in operation["responses"]["200"]["content"]
    assert client.get("/docs").status_code == 200
    assert client.get("/api/health").json() == {
        "status": "ok",
        "contract_version": "0.1.0",
    }
