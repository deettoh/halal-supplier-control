"""The destructive reset is explicit, manual and has no startup/API hook."""

from pathlib import Path

import pytest
from sqlalchemy.exc import SQLAlchemyError

from backend import db, reset_demo
from backend.seed import SeedData


def test_reset_cli_requires_confirmation_before_database_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(**_: object) -> dict[str, int]:
        pytest.fail("Unconfirmed command must never access the database")

    monkeypatch.setattr(reset_demo, "reset_demo_database", forbidden)
    with pytest.raises(SystemExit) as error:
        reset_demo.main([])
    assert error.value.code == 2


def test_confirmed_reset_cli_reports_counts(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    calls: list[Path] = []

    def fake_reset(*, seed_path: Path) -> dict[str, int]:
        calls.append(seed_path)
        return {"suppliers": 2, "deliveries": 0}

    monkeypatch.setattr(reset_demo, "reset_demo_database", fake_reset)
    assert (
        reset_demo.main(["--confirm-reset-demo", "--seed", "custom.json"]) == 0
    )
    assert calls == [Path("custom.json")]
    assert "suppliers=2, deliveries=0" in capsys.readouterr().out


def test_reset_cli_does_not_print_private_error_details(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def broken(**_: object) -> dict[str, int]:
        raise SQLAlchemyError("private-value")

    monkeypatch.setattr(reset_demo, "reset_demo_database", broken)
    assert reset_demo.main(["--confirm-reset-demo"]) == 1
    output = capsys.readouterr()
    assert "no record replacement was committed" in output.err
    assert "private-value" not in output.err


@pytest.mark.parametrize(
    "failure",
    [ValueError("Broken PNG: bad.png"), OSError("Cannot read bad.png")],
)
def test_reset_cli_prints_seed_error_details(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    failure: Exception,
) -> None:
    def broken(**_: object) -> dict[str, int]:
        raise failure

    monkeypatch.setattr(reset_demo, "reset_demo_database", broken)
    assert reset_demo.main(["--confirm-reset-demo"]) == 1
    output = capsys.readouterr()
    assert str(failure) in output.err
    assert "no record replacement was committed" in output.err


def test_reset_cli_names_missing_seed_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def forbidden() -> None:
        pytest.fail("Missing seed must not open a database connection")

    monkeypatch.setattr(db, "get_engine", forbidden)
    monkeypatch.setattr(db, "dispose_db", lambda: None)
    path = tmp_path / "missing.json"
    assert reset_demo.main(["--confirm-reset-demo", "--seed", str(path)]) == 1
    assert str(path) in capsys.readouterr().err


def test_reset_cli_redacts_invalid_seed_input(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def broken(**_: object) -> dict[str, int]:
        SeedData.model_validate({"suppliers": "private-value"})
        raise AssertionError("Validation should fail")

    monkeypatch.setattr(reset_demo, "reset_demo_database", broken)
    assert reset_demo.main(["--confirm-reset-demo"]) == 1
    output = capsys.readouterr()
    assert "Invalid seed JSON" in output.err
    assert "private-value" not in output.err
