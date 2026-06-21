"""Tests for the tealtiger-redteam CLI."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tealtiger_redteam.cli import main

FIXTURES = Path(__file__).parent / "fixtures"


def test_cli_returns_one_for_vulnerable_pipeline(capsys: pytest.CaptureFixture[str]) -> None:
    """Vulnerable scans print terminal output and return exit code 1."""
    code = main(["scan", str(FIXTURES / "vulnerable_pipeline.py")])
    captured = capsys.readouterr()

    assert code == 1
    assert "VULNERABLE:" in captured.out
    assert "TealTigerGuardComponent" in captured.out


def test_cli_returns_zero_for_safe_pipeline(capsys: pytest.CaptureFixture[str]) -> None:
    """Safe scans print a safe terminal result and return exit code 0."""
    code = main(["scan", str(FIXTURES / "safe_pipeline.py")])
    captured = capsys.readouterr()

    assert code == 0
    assert "SAFE:" in captured.out


def test_cli_json_and_output_file(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """JSON output is printed and written when requested."""
    output = tmp_path / "report.json"
    code = main(
        [
            "scan",
            str(FIXTURES / "vulnerable_pipeline.py"),
            "--json",
            "--output",
            str(output),
        ]
    )
    captured = capsys.readouterr()
    printed = json.loads(captured.out)
    written = json.loads(output.read_text(encoding="utf-8"))

    assert code == 1
    assert printed == written
    assert printed["summary"]["findings_total"] == 5


def test_cli_returns_two_for_missing_file(capsys: pytest.CaptureFixture[str]) -> None:
    """Invalid input returns scanner usage-style exit code 2."""
    code = main(["scan", str(FIXTURES / "missing.py")])
    captured = capsys.readouterr()

    assert code == 2
    assert "file not found" in captured.err
