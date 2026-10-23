"""The destructive reset is explicit, manual and has no startup/API hook."""

from pathlib import Path

import pytest

from backend import reset_demo


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
        raise ValueError("private-value")

    monkeypatch.setattr(reset_demo, "reset_demo_database", broken)
    assert reset_demo.main(["--confirm-reset-demo"]) == 1
    output = capsys.readouterr()
    assert "no record replacement was committed" in output.err
    assert "private-value" not in output.err
