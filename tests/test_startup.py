"""Verify FastAPI lifespan starts the database before serving requests."""

import pytest
from fastapi.testclient import TestClient

from backend import main


def test_docs_can_start_without_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with TestClient(main.app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/docs").status_code == 200


def test_configured_database_bootstraps_before_serving(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def bootstrap() -> dict[str, int]:
        calls.append("initialized")
        return {}

    monkeypatch.setenv("DATABASE_URL", "postgresql://test-only")
    monkeypatch.setattr(main, "bootstrap_database", bootstrap)
    with TestClient(main.app) as client:
        assert calls == ["initialized"]
        assert client.get("/api/health").status_code == 200


def test_configured_database_failure_stops_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken_bootstrap() -> dict[str, int]:
        raise ValueError("example-private-value")

    monkeypatch.setenv("DATABASE_URL", "postgresql://test-only")
    monkeypatch.setattr(main, "bootstrap_database", broken_bootstrap)
    with (
        pytest.raises(RuntimeError, match="Database startup failed") as error,
        TestClient(main.app),
    ):
        pytest.fail("Startup must fail before serving requests")
    assert "example-private-value" not in str(error.value)
