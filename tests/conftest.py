"""Pytest option for tests calling the RunPod endpoint."""

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    """Add the --run-live flag."""
    parser.addoption(
        "--run-live",
        action="store_true",
        help="run tests marked live, which call the RunPod endpoint",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Skip tests marked live unless --run-live is given."""
    if config.getoption("--run-live"):
        return
    skip_live = pytest.mark.skip(reason="needs --run-live")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip_live)
