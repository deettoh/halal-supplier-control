"""Tests for serving the frontend build from FastAPI."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.main import mount_frontend

INDEX_HTML = "<!doctype html><title>app</title>"
SCRIPT = "console.info('app')"


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    """Return a client for an app serving a build in tmp_path."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(INDEX_HTML)
    (tmp_path / "assets" / "app.js").write_text(SCRIPT)
    app = FastAPI()
    mount_frontend(app, tmp_path)
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/review"])
def test_page_path_serves_index(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 200
    assert response.text == INDEX_HTML


def test_built_asset_is_served_as_is(client: TestClient) -> None:
    assert client.get("/assets/app.js").text == SCRIPT


def test_unknown_api_path_stays_json_404(client: TestClient) -> None:
    response = client.get("/api/missing")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
