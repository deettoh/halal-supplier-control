"""Explicit service opt-ins and isolated API databases."""

import os
from collections.abc import Generator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, delete, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema

from backend import db, main
from backend.startup import bootstrap_database


def pytest_addoption(parser: pytest.Parser) -> None:
    """Add the --run-live flag."""
    parser.addoption(
        "--run-live",
        action="store_true",
        help="run tests marked live, which call the RunPod endpoint",
    )
    parser.addoption(
        "--run-db",
        action="store_true",
        help="run PostgreSQL tests using TEST_DATABASE_URL",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Skip tests marked live unless --run-live is given."""
    skip_live = pytest.mark.skip(reason="needs --run-live")
    skip_db = pytest.mark.skip(reason="needs --run-db")
    for item in items:
        if "live" in item.keywords and not config.getoption("--run-live"):
            item.add_marker(skip_live)
        if "integration" in item.keywords and not config.getoption("--run-db"):
            item.add_marker(skip_db)


def bootstrap_workflow_database(engine: Engine) -> None:
    """Seed reference data, then start each workflow scenario with no history.

    Only called for the in-memory database or disposable api test schema below.
    Production startup/reset seed preservation is tested separately in test_db.
    """
    bootstrap_database(engine)
    with Session(engine) as session, session.begin():
        session.execute(delete(db.ActivityLog))
        session.execute(delete(db.Delivery))


@pytest.fixture(
    params=[
        pytest.param("sqlite", id="sqlite"),
        pytest.param("postgres", id="postgres", marks=pytest.mark.integration),
    ]
)
def api_engine(
    request: pytest.FixtureRequest,
) -> Generator[Engine, None, None]:
    if request.param == "sqlite":
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection: object, _: object) -> None:
            from sqlite3 import Connection

            assert isinstance(connection, Connection)
            connection.execute("PRAGMA foreign_keys=ON")

        bootstrap_workflow_database(engine)
        try:
            yield engine
        finally:
            engine.dispose()
        return
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("--run-db requires TEST_DATABASE_URL")
    admin = db.create_db_engine(url)
    schema = f"halal_api_test_{uuid4().hex}"
    with admin.begin() as connection:
        connection.execute(CreateSchema(schema))
    isolated = admin.execution_options(schema_translate_map={None: schema})
    try:
        bootstrap_workflow_database(isolated)
        yield isolated
    finally:
        with admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin.dispose()


@pytest.fixture
def api_client(
    api_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    def database() -> Generator[Session, None, None]:
        with Session(api_engine, expire_on_commit=False) as session:
            yield session

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(
        db, "utc_now", lambda: datetime(2026, 10, 22, tzinfo=UTC)
    )
    main.app.dependency_overrides[main.database] = database
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.pop(main.database, None)
