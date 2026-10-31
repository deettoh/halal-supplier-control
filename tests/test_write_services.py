"""Integration tests for writes with mocked model calls."""

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI
from sqlalchemy import Engine, event, func, select
from sqlalchemy.orm import Session

from backend import db, extract, images, services
from backend.extract import extract_label as real_extract_label
from backend.schemas import LabelExtraction

BAKERY = "Sunrise Bakery SAMPLE"
CATERER = "Crescent Caterer SAMPLE"
PNG = (Path(__file__).parent / "fixtures/synthetic_label.png").read_bytes()
JPEG = images.as_jpeg(PNG)


def headers(role: str = "staff", tenant: str = BAKERY) -> dict[str, str]:
    result = {"X-Demo-Role": role, "X-Demo-Tenant": tenant}
    if role == "supplier":
        result["X-Demo-Person"] = "6" if tenant == "2" else "5"
    if role in {"staff", "supervisor"}:
        result["X-Demo-Person"] = str(
            (1 if role == "staff" else 2) + (2 if tenant == CATERER else 0)
        )
    return result


def label(brand: str = "GoldenMill") -> LabelExtraction:
    return LabelExtraction(
        product_name="Wheat Flour",
        brand=brand,
        manufacturer="Golden Grain Foods",
        halal_mark_present=True,
    )


@pytest.fixture(autouse=True)
def mock_extractor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(extract, "extract_label", lambda _: label())


def upload(
    client: TestClient,
    *,
    material_id: int = 1,
    tenant: str = BAKERY,
    payload: bytes = PNG,
) -> httpx2.Response:
    return client.post(
        "/api/deliveries",
        headers=headers(tenant=tenant),
        data={"material_id": str(material_id)},
        files={"image": ("label.png", payload, "image/png")},
    )


def counts(engine: Engine) -> tuple[int, int]:
    with Session(engine) as session:
        deliveries = session.scalar(
            select(func.count()).select_from(db.Delivery)
        )
        logs = session.scalar(select(func.count()).select_from(db.ActivityLog))
        assert deliveries is not None and logs is not None
        return deliveries, logs


def failed_upload(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> dict[str, object]:
    def broken(_: bytes) -> LabelExtraction:
        raise extract.ExtractionError("RunPod request failed: APITimeoutError")

    monkeypatch.setattr(extract, "extract_label", broken)
    response = upload(client)
    assert response.status_code == 201
    result: dict[str, object] = response.json()
    return result


def renewal_form(number: str = "SAMPLE-RENEWED") -> dict[str, str]:
    return {
        "issuer": "SAMPLE Food Certification Council",
        "cert_no": number,
        "holder_name": "Golden Grain Supplies SAMPLE",
        "expiry_date": "2027-12-31",
        "scope": json.dumps(
            [
                {"product_name": "Wheat Flour", "brand": "GoldenMill"},
                {"product_name": "Bread Flour", "brand": "GoldenMill"},
            ]
        ),
    }


def test_upload_stores_photo_checks_and_audit(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    response = upload(api_client)
    assert response.status_code == 201
    result = response.json()
    assert result["verdict"] == "expiring"
    assert result["status"] == "auto_accepted"
    assert result["error"] is None
    assert result["extracted"] == label().model_dump()
    assert all(check["passed"] for check in result["rule_results"])
    assert counts(api_engine) == (1, 1)
    image = api_client.get(result["image"], headers=headers())
    assert image.content == JPEG
    with Session(api_engine) as session:
        row = session.get(db.Delivery, result["id"])
        assert row is not None and row.image_bytes == JPEG
        log = session.scalar(select(db.ActivityLog))
        assert log is not None and log.action == "auto_accepted"
        assert log.delivery_id == row.id and log.tenant == BAKERY
        assert log.reason is None


@pytest.mark.parametrize("rule", ["R1", "R2", "R3", "R4", "R5", "R6"])
def test_flagged_check_log_identifies_first_failed_rule(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    rule: str,
) -> None:
    extracted = label()
    if rule == "R1":
        extracted = extracted.model_copy(update={"manufacturer": None})
    elif rule == "R2":
        extracted = label("Other brand")
    elif rule == "R6":
        extracted = extracted.model_copy(update={"halal_mark_present": False})
    with Session(api_engine) as session:
        certificate = session.get(db.Certificate, 1)
        assert certificate is not None
        if rule == "R3":
            certificate.scope = [{"product_name": "Rice Flour", "brand": None}]
        elif rule == "R4":
            certificate.expiry_date = db.business_today() - timedelta(days=1)
        elif rule == "R5":
            certificate.issuer = "Unknown SAMPLE issuer"
        session.commit()
    monkeypatch.setattr(extract, "extract_label", lambda _: extracted)
    response = upload(api_client)
    assert response.status_code == 201
    result = response.json()
    assert result["status"] == "pending_review"
    failed = next(c for c in result["rule_results"] if c["passed"] is False)
    assert failed["rule"] == rule
    events = api_client.get(
        "/api/activity", headers=headers("supervisor")
    ).json()
    assert len(events) == 1
    assert events[0]["reason"] == f"{rule}: {failed['detail']}"


def test_jpeg_delivery_upload_is_stored_as_jpeg(
    api_client: TestClient,
) -> None:
    result = upload(api_client, payload=JPEG)
    assert result.status_code == 201
    photo = api_client.get(result.json()["image"], headers=headers())
    assert photo.headers["content-type"] == "image/jpeg"
    assert photo.content.startswith(b"\xff\xd8\xff")


def test_timeout_demo_cache_uses_original_upload_not_stored_jpeg(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cached = {hashlib.sha256(PNG).hexdigest(): label()}
    monkeypatch.setattr(extract, "load_demo_cache", lambda: cached)

    def cached_reply(source: bytes) -> LabelExtraction:
        assert source == PNG
        deadline = db.utc_now() + timedelta(seconds=extract.TIMEOUT_SECONDS)
        transport = httpx2.MockTransport(lambda _: httpx2.Response(503))
        with OpenAI(
            base_url="https://runpod.test/v1",
            api_key="test-only",
            http_client=httpx2.Client(transport=transport),
        ) as client:
            result = real_extract_label(source, client=client)
        monkeypatch.setattr(db, "utc_now", lambda: deadline)
        return result

    monkeypatch.setattr(extract, "extract_label", cached_reply)
    result = upload(api_client)
    assert result.status_code == 201
    assert result.json()["status"] == "auto_accepted"
    assert result.json()["extracted"] == label().model_dump()
    assert result.json()["error"] is None
    with Session(api_engine) as session:
        assert session.scalar(select(db.Delivery.image_bytes)) == JPEG


@pytest.mark.parametrize("failure", ["timeout", "reply", "value", "config"])
def test_extraction_failures_are_saved_for_review(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    def broken(_: bytes) -> LabelExtraction:
        if failure == "timeout":
            raise TimeoutError("PRIVATE-SECRET")
        if failure == "reply":
            raise extract.ExtractionError(
                "model reply failed the label schema"
            )
        if failure == "value":
            raise ValueError("PRIVATE-SECRET")
        return LabelExtraction.model_validate({"PRIVATE-SECRET": "token"})

    monkeypatch.setattr(extract, "extract_label", broken)
    response = upload(api_client)
    assert response.status_code == 201
    result = response.json()
    assert result["verdict"] == "needs_human"
    assert result["status"] == "pending_review"
    assert result["extracted"] is None and result["error"]
    assert "PRIVATE-SECRET" not in response.text
    assert result["rule_results"][0]["passed"] is False
    assert all(check["passed"] is None for check in result["rule_results"][1:])
    assert (
        api_client.get(
            "/api/deliveries", headers=headers("supervisor")
        ).json()[0]["id"]
        == result["id"]
    )
    assert counts(api_engine) == (1, 1)


def test_empty_model_choices_use_saved_human_review_fallback(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def no_choices(image: bytes) -> LabelExtraction:
        transport = httpx2.MockTransport(
            lambda _: httpx2.Response(
                200,
                json={
                    "id": "test",
                    "object": "chat.completion",
                    "created": 0,
                    "model": "test",
                    "choices": [],
                },
            )
        )
        with OpenAI(
            base_url="https://runpod.test/v1",
            api_key="test-only",
            http_client=httpx2.Client(transport=transport),
        ) as client:
            return real_extract_label(image, client=client)

    monkeypatch.setattr(extract, "extract_label", no_choices)
    response = upload(api_client)
    assert response.status_code == 201
    assert response.json()["status"] == "pending_review"
    assert response.json()["verdict"] == "needs_human"
    assert response.json()["error"] == "model reply has no choices"
    assert counts(api_engine) == (1, 1)


def test_wrong_material_and_invalid_png_do_not_write(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(_: bytes) -> LabelExtraction:
        pytest.fail("Invalid uploads must never call the model")

    monkeypatch.setattr(extract, "extract_label", forbidden)
    assert upload(api_client, material_id=9).status_code == 404
    assert upload(api_client, material_id=999).status_code == 404
    assert upload(api_client, payload=b"not a PNG").status_code == 422
    assert upload(api_client, payload=b"").status_code == 422
    monkeypatch.setattr(services, "MAX_IMAGE_BYTES", 8)
    assert upload(api_client).status_code == 413
    assert counts(api_engine) == (0, 0)


def test_in_progress_photo_is_durable_but_not_reviewable(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def inspecting(_: bytes) -> LabelExtraction:
        with Session(api_engine) as session:
            row = session.scalar(select(db.Delivery))
            assert row is not None and row.image_bytes == JPEG
            row_id = row.id
        assert (
            api_client.get(
                "/api/deliveries", headers=headers("supervisor")
            ).json()
            == []
        )
        decision = api_client.post(
            f"/api/deliveries/{row_id}/decision",
            headers=headers("supervisor"),
            json={"decision": "accept", "reason": "Too early"},
        )
        assert decision.status_code == 409
        assert counts(api_engine) == (1, 0)
        return label()

    monkeypatch.setattr(extract, "extract_label", inspecting)
    assert upload(api_client).json()["status"] == "auto_accepted"
    assert counts(api_engine) == (1, 1)


def test_deadline_releases_fallback_and_late_reply_cannot_undo_decision(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def late(_: bytes) -> LabelExtraction:
        deadline = db.utc_now() + timedelta(seconds=extract.TIMEOUT_SECONDS)
        monkeypatch.setattr(db, "utc_now", lambda: deadline)
        queue = api_client.get(
            "/api/deliveries", headers=headers("supervisor")
        ).json()
        assert len(queue) == 1 and queue[0]["verdict"] == "needs_human"
        decision = api_client.post(
            f"/api/deliveries/{queue[0]['id']}/decision",
            headers=headers("supervisor"),
            json={"decision": "reject", "reason": "Could not verify"},
        )
        assert decision.status_code == 200
        return label()

    monkeypatch.setattr(extract, "extract_label", late)
    result = upload(api_client).json()
    assert result["status"] == "rejected"
    assert result["reason"] == "Could not verify"
    assert result["extracted"] is None
    assert counts(api_engine) == (1, 2)
    with Session(api_engine) as session:
        original = session.scalar(
            select(db.ActivityLog).order_by(db.ActivityLog.id)
        )
        assert original is not None
        assert original.reason == f"R1: {services.INCOMPLETE_EXTRACTION}"


@pytest.mark.parametrize("decision", ["accept", "reject"])
def test_supervisor_decides_once_with_atomic_audit(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    decision: str,
) -> None:
    result = failed_upload(api_client, monkeypatch)
    path = f"/api/deliveries/{result['id']}/decision"
    for role in ("staff", "supplier"):
        assert (
            api_client.post(
                path,
                headers=headers(role),
                json={"decision": decision, "reason": "Checked"},
            ).status_code
            == 403
        )
    assert (
        api_client.post(
            path,
            headers=headers("supervisor", CATERER),
            json={"decision": decision, "reason": "Checked"},
        ).status_code
        == 404
    )
    for body in (
        {"decision": decision},
        {"decision": decision, "reason": " "},
    ):
        assert (
            api_client.post(
                path, headers=headers("supervisor"), json=body
            ).status_code
            == 422
        )
    assert counts(api_engine) == (1, 1)
    response = api_client.post(
        path,
        headers=headers("supervisor"),
        json={"decision": decision, "reason": " Checked manually "},
    )
    assert response.status_code == 200
    assert response.json()["status"] == (
        "accepted" if decision == "accept" else "rejected"
    )
    assert response.json()["reason"] == "Checked manually"
    assert response.json()["decided_by"] == "Farid"
    assert (
        api_client.post(
            path,
            headers=headers("supervisor"),
            json={"decision": decision, "reason": "Again"},
        ).status_code
        == 409
    )
    assert counts(api_engine) == (1, 2)
    assert (
        api_client.get("/api/deliveries", headers=headers("supervisor")).json()
        == []
    )


def test_substitution_is_pending_and_auto_accepted_is_not_decidable(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clean = upload(api_client).json()
    assert (
        api_client.post(
            f"/api/deliveries/{clean['id']}/decision",
            headers=headers("supervisor"),
            json={"decision": "reject", "reason": "Already automatic"},
        ).status_code
        == 409
    )
    monkeypatch.setattr(
        extract, "extract_label", lambda _: label("Other Brand")
    )
    flagged = upload(api_client).json()
    assert flagged["verdict"] == "substitution"
    assert flagged["status"] == "pending_review"


@pytest.mark.parametrize("image_format", ["PNG", "JPEG", None])
def test_renewal_supersedes_and_updates_both_smes(
    api_client: TestClient,
    api_engine: Engine,
    image_format: str | None,
) -> None:
    source = JPEG if image_format == "JPEG" else PNG
    response = api_client.post(
        "/api/certificates",
        headers=headers("supplier", "1"),
        data=renewal_form(),
        files={"image": ("certificate", source, "application/octet-stream")}
        if image_format is not None
        else None,
    )
    assert response.status_code == 201
    renewed = response.json()
    assert renewed["supplier_id"] == 1 and renewed["status"] == "pending"
    reviewed = api_client.post(
        f"/api/registry/renewals/{renewed['id']}/decision",
        headers={
            "X-Demo-Role": "reviewer",
            "X-Demo-Tenant": "registry",
            "X-Demo-Person": "7",
        },
        json={"decision": "verify", "note": "Matches certificate"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "active"
    if image_format is not None:
        assert api_client.get(
            renewed["image"], headers=headers("supplier", "1")
        ).content == images.as_jpeg(source)
    else:
        assert renewed["image"] is None
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None and old.status == "superseded"
        active = list(
            session.scalars(
                select(db.Certificate).where(
                    db.Certificate.supplier_id == 1,
                    db.Certificate.status == "active",
                )
            )
        )
        assert [row.id for row in active] == [renewed["id"]]
        logs = list(session.scalars(select(db.ActivityLog)))
        assert {row.tenant for row in logs} == {BAKERY, CATERER}
        assert len(logs) == 4
        assert {(row.action, row.actor) for row in logs} == {
            ("certificate_submitted", "Hakim"),
            ("certificate_renewed", "Nadia"),
        }
    for tenant in (BAKERY, CATERER):
        material = api_client.get(
            "/api/materials", headers=headers(tenant=tenant)
        ).json()[0]
        assert material["coverage_status"] == "covered"
        assert material["certificate_expiry_date"] == "2027-12-31"


def test_invalid_renewal_does_not_supersede_or_log(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    for role in ("staff", "supervisor"):
        assert (
            api_client.post(
                "/api/certificates", headers=headers(role), data=renewal_form()
            ).status_code
            == 403
        )
    assert (
        api_client.post(
            "/api/certificates",
            headers=headers("supplier", "1"),
            data=renewal_form(),
            files={"image": ("bad.png", b"bad", "image/png")},
        ).status_code
        == 422
    )
    assert (
        api_client.post(
            "/api/certificates",
            headers=headers("supplier", "1"),
            data={**renewal_form(), "scope": "[]"},
        ).status_code
        == 422
    )
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None and old.status == "active"
        assert (
            session.scalar(select(func.count()).select_from(db.Certificate))
            == 4
        )
    assert counts(api_engine) == (0, 0)


@pytest.mark.parametrize(
    ("field", "limit"),
    [("issuer", 200), ("cert_no", 100), ("holder_name", 200)],
)
def test_overlong_renewal_fields_fail_validation_without_writes(
    api_client: TestClient,
    api_engine: Engine,
    field: str,
    limit: int,
) -> None:
    response = api_client.post(
        "/api/certificates",
        headers=headers("supplier", "1"),
        data={**renewal_form(), field: "x" * (limit + 1)},
    )
    assert response.status_code == 422
    assert counts(api_engine) == (0, 0)
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None and old.status == "active"
        assert (
            session.scalar(select(func.count()).select_from(db.Certificate))
            == 4
        )


def test_renewal_rolls_back_if_audit_write_fails(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    def fail_audit(session: Session, _: object, __: object) -> None:
        if any(isinstance(row, db.ActivityLog) for row in session.new):
            raise RuntimeError("test audit failure")

    event.listen(Session, "before_flush", fail_audit)
    try:
        with pytest.raises(RuntimeError, match="test audit failure"):
            api_client.post(
                "/api/certificates",
                headers=headers("supplier", "1"),
                data=renewal_form(),
            )
    finally:
        event.remove(Session, "before_flush", fail_audit)
    with Session(api_engine) as session:
        old = session.get(db.Certificate, 1)
        assert old is not None and old.status == "active"
        assert (
            session.scalar(select(func.count()).select_from(db.Certificate))
            == 4
        )
    assert counts(api_engine) == (0, 0)


def test_concurrent_decisions_have_one_winner(
    api_client: TestClient,
    api_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock behavior")
    result = failed_upload(api_client, monkeypatch)

    def decide(decision: str) -> int:
        return api_client.post(
            f"/api/deliveries/{result['id']}/decision",
            headers=headers("supervisor"),
            json={"decision": decision, "reason": "Concurrent review"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(decide, ["accept", "reject"])) == [200, 409]
    assert counts(api_engine) == (1, 2)


def test_concurrent_renewals_keep_one_active_certificate(
    api_client: TestClient,
    api_engine: Engine,
) -> None:
    if api_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock behavior")

    def renew(number: str) -> int:
        return api_client.post(
            "/api/certificates",
            headers=headers("supplier", "1"),
            data=renewal_form(number),
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(renew, ["SAMPLE-A", "SAMPLE-B"])) == [201, 409]
    with Session(api_engine) as session:
        active = list(
            session.scalars(
                select(db.Certificate).where(
                    db.Certificate.supplier_id == 1,
                    db.Certificate.status == "active",
                )
            )
        )
        assert len(active) == 1
        assert (
            session.scalar(select(func.count()).select_from(db.ActivityLog))
            == 2
        )
