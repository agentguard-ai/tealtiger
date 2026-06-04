"""Tests for the governance engine bridge.

These tests don't require LangChain to be installed — they test
the pure governance evaluation logic directly.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add src to path so we can import without full package resolution
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from langchain_tealtiger._types import GovernanceAction, GovernanceMode
from langchain_tealtiger._engine import GovernanceBridge


class TestGovernanceBridgeAllowlist:
    def test_allowed_tool(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "tool_allowlist", "tools": ["search", "calc"]}],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("search", {"query": "test"})
        assert decision.action == GovernanceAction.ALLOW

    def test_disallowed_tool(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "tool_allowlist", "tools": ["search"]}],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("delete_file", {"path": "/etc"})
        assert decision.action == GovernanceAction.DENY
        assert "TOOL_NOT_ALLOWED" in decision.reason_codes

    def test_no_allowlist_allows_all(self) -> None:
        engine = GovernanceBridge(
            policies=[],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("anything", {})
        assert decision.action == GovernanceAction.ALLOW


class TestGovernanceBridgeFreeze:
    def test_frozen_tool_denied(self) -> None:
        engine = GovernanceBridge(
            policies=[],
            mode=GovernanceMode.ENFORCE,
            freeze_tools={"rm_rf", "drop_db"},
        )
        decision = engine.evaluate("rm_rf", {})
        assert decision.action == GovernanceAction.DENY
        assert "FREEZE_RULE" in decision.reason_codes
        assert decision.risk_score == 100

    def test_non_frozen_tool_allowed(self) -> None:
        engine = GovernanceBridge(
            policies=[],
            mode=GovernanceMode.ENFORCE,
            freeze_tools={"rm_rf"},
        )
        decision = engine.evaluate("search", {})
        assert decision.action == GovernanceAction.ALLOW


class TestGovernanceBridgeRateLimit:
    def test_within_limit(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "rate_limit", "max_calls": 3, "window": "1h"}],
            mode=GovernanceMode.ENFORCE,
        )
        for i in range(3):
            decision = engine.evaluate("search", {"q": str(i)})
            assert decision.action == GovernanceAction.ALLOW

    def test_exceeds_limit(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "rate_limit", "max_calls": 2, "window": "1h"}],
            mode=GovernanceMode.ENFORCE,
        )
        engine.evaluate("search", {})
        engine.evaluate("search", {})
        decision = engine.evaluate("search", {})
        assert decision.action == GovernanceAction.DENY
        assert "RATE_LIMIT_EXCEEDED" in decision.reason_codes


class TestGovernanceBridgeCostLimit:
    def test_within_budget(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "cost_limit", "max_per_session": 5.00}],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("search", {})
        assert decision.action == GovernanceAction.ALLOW

    def test_over_budget(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "cost_limit", "max_per_session": 5.00}],
            mode=GovernanceMode.ENFORCE,
        )
        engine._session_cost = 5.50  # Simulate accumulated cost
        decision = engine.evaluate("search", {})
        assert decision.action == GovernanceAction.DENY
        assert "COST_LIMIT_EXCEEDED" in decision.reason_codes


class TestGovernanceBridgeModes:
    def test_monitor_mode_allows_violations(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "tool_allowlist", "tools": ["search"]}],
            mode=GovernanceMode.MONITOR,
        )
        decision = engine.evaluate("blocked_tool", {})
        # In MONITOR mode, the engine allows but records the violation.
        # The triggered_policies list captures what would have been denied.
        assert decision.action == GovernanceAction.ALLOW
        assert "tool_allowlist" in decision.triggered_policies

    def test_enforce_mode_blocks(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "tool_allowlist", "tools": ["search"]}],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("blocked_tool", {})
        assert decision.action == GovernanceAction.DENY


class TestGovernanceBridgeEvidence:
    def test_evidence_trail_populated(self) -> None:
        engine = GovernanceBridge(policies=[], mode=GovernanceMode.ENFORCE)
        engine.evaluate("tool1", {})
        engine.evaluate("tool2", {"key": "val"})

        assert len(engine.evidence) == 2
        assert engine.evidence[0].tool_name == "tool1"
        assert engine.evidence[1].tool_name == "tool2"
        assert engine.evidence[1].tool_args == {"key": "val"}

    def test_correlation_ids_are_unique(self) -> None:
        engine = GovernanceBridge(policies=[], mode=GovernanceMode.ENFORCE)
        engine.evaluate("tool1", {})
        engine.evaluate("tool2", {})

        ids = [e.correlation_id for e in engine.evidence]
        assert ids[0] != ids[1]
        assert all(len(cid) == 36 for cid in ids)  # UUID format

    def test_evaluation_time_recorded(self) -> None:
        engine = GovernanceBridge(policies=[], mode=GovernanceMode.ENFORCE)
        engine.evaluate("search", {})

        assert engine.evidence[0].evaluation_time_ms >= 0
        assert engine.evidence[0].evaluation_time_ms < 50  # Should be <5ms

    def test_session_reset_clears_evidence(self) -> None:
        engine = GovernanceBridge(policies=[], mode=GovernanceMode.ENFORCE)
        engine.evaluate("tool1", {})
        assert len(engine.evidence) == 1

        engine.reset_session()
        assert len(engine.evidence) == 0


class TestGovernanceBridgeSummary:
    def test_summary_counts(self) -> None:
        engine = GovernanceBridge(
            policies=[{"type": "tool_allowlist", "tools": ["search"]}],
            mode=GovernanceMode.ENFORCE,
        )
        engine.evaluate("search", {})  # ALLOW
        engine.evaluate("search", {})  # ALLOW
        engine.evaluate("blocked", {})  # DENY

        summary = engine.get_summary()
        assert summary.total_evaluations == 3
        assert summary.allowed == 2
        assert summary.denied == 1
        assert summary.mode == GovernanceMode.ENFORCE


class TestGovernanceBridgeMultiplePolicies:
    def test_allowlist_and_rate_limit(self) -> None:
        engine = GovernanceBridge(
            policies=[
                {"type": "tool_allowlist", "tools": ["search"]},
                {"type": "rate_limit", "max_calls": 2, "window": "1h"},
            ],
            mode=GovernanceMode.ENFORCE,
        )
        # Allowed tool, within rate limit
        d1 = engine.evaluate("search", {})
        assert d1.action == GovernanceAction.ALLOW

        # Allowed tool, within rate limit
        d2 = engine.evaluate("search", {})
        assert d2.action == GovernanceAction.ALLOW

        # Allowed tool, but rate limit hit
        d3 = engine.evaluate("search", {})
        assert d3.action == GovernanceAction.DENY
        assert "RATE_LIMIT_EXCEEDED" in d3.reason_codes

    def test_disallowed_tool_denied_before_rate_limit(self) -> None:
        engine = GovernanceBridge(
            policies=[
                {"type": "tool_allowlist", "tools": ["search"]},
                {"type": "rate_limit", "max_calls": 100, "window": "1h"},
            ],
            mode=GovernanceMode.ENFORCE,
        )
        decision = engine.evaluate("blocked_tool", {})
        assert decision.action == GovernanceAction.DENY
        assert "TOOL_NOT_ALLOWED" in decision.reason_codes
