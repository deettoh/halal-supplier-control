"""Explicit opt-ins for tests needing RunPod or PostgreSQL."""

import pytest


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
