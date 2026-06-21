"""Report rendering helpers for tealtiger-redteam."""

from __future__ import annotations

import json

from tealtiger_redteam.scanner import ScanReport


def render_json(report: ScanReport) -> str:
    """Render a report as stable JSON."""
    return json.dumps(report.to_dict(), indent=2, sort_keys=True)


def render_terminal(report: ScanReport) -> str:
    """Render a compact terminal report."""
    lines = [
        f"Target: {report.target}",
        f"Status: {report.summary['status'].upper()}",
        f"Findings: {report.summary['findings_total']}",
        "",
    ]
    if not report.findings:
        lines.append("SAFE: No vulnerable Haystack red-team scenarios found.")
        return "\n".join(lines)

    for finding in report.findings:
        lines.extend(
            [
                f"VULNERABLE: {finding.message}",
                f"  ID: {finding.id}",
                f"  Scenario: {finding.scenario}",
                f"  Severity: {finding.severity}",
                f"  Line: {finding.line if finding.line is not None else 'unknown'}",
                f"  Fix: Add {finding.fix.component}",
                f"  Snippet: {finding.fix.snippet}",
                f"  Recipe: {finding.fix.recipe}",
                "",
            ]
        )
    return "\n".join(lines).rstrip()
