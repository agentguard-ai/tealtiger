"""Tests for the static Haystack red-team scanner."""

from __future__ import annotations

from pathlib import Path

from tealtiger_redteam.scanner import SCENARIOS, scan_file, scan_source

FIXTURES = Path(__file__).parent / "fixtures"


def test_vulnerable_pipeline_triggers_all_five_scenarios() -> None:
    """The vulnerable fixture maps to every issue-required scenario."""
    report = scan_file(FIXTURES / "vulnerable_pipeline.py")

    assert report.summary["status"] == "vulnerable"
    assert report.summary["findings_total"] == 5
    assert report.summary["scenarios"] == dict.fromkeys(SCENARIOS, "vulnerable")
    assert {finding.scenario for finding in report.findings} == set(SCENARIOS)


def test_safe_pipeline_has_no_findings() -> None:
    """A fixture with all TealTiger mitigations is reported safe."""
    report = scan_file(FIXTURES / "safe_pipeline.py")

    assert report.summary["status"] == "safe"
    assert report.summary["findings_total"] == 0
    assert report.findings == []
    assert report.summary["scenarios"] == dict.fromkeys(SCENARIOS, "safe")


def test_report_contains_actionable_fix_links() -> None:
    """Each vulnerability includes a component, snippet, and recipe path."""
    report = scan_file(FIXTURES / "vulnerable_pipeline.py")

    for finding in report.findings:
        payload = finding.to_dict()
        assert payload["id"].startswith("TT-HAYSTACK-")
        assert payload["status"] == "vulnerable"
        assert payload["line"] is not None
        assert payload["fix"]["component"].startswith("TealTiger")
        assert "pipeline.add_component" in payload["fix"]["snippet"]
        assert payload["fix"]["recipe"].startswith("packages/haystack-tealtiger/docs/")


def test_scanner_does_not_require_haystack_imports_to_execute() -> None:
    """Scanning parses source text and does not import Haystack."""
    source = """
from haystack import Pipeline
from haystack.components.generators import OpenAIGenerator

pipeline = Pipeline()
pipeline.add_component("generator", OpenAIGenerator(model="gpt-4o"))
"""

    report = scan_source(source)

    assert report.target == "<source>"
    assert report.summary["status"] in {"safe", "vulnerable"}
