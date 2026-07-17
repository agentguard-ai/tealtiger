"""Tests for TealTigerCallback governance in Google ADK."""

import pytest
from tealtiger_adk import TealTigerCallback


class TestBasicGovernance:
    """Test basic governance evaluation."""

    def test_allow_normal_tool_call(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        result = cb.before_tool(None, "search", {"query": "hello"})
        assert result is None
        assert cb.decisions[-1]["action"] == "ALLOW"

    def test_deny_pii_ssn(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["ssn"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "search", {"query": "SSN: 123-45-6789"})
        assert result is not None
        assert "GOVERNANCE DENIED" in result["content"]
        assert cb.decisions[-1]["action"] == "DENY"
        assert "PII_DETECTED:ssn" in cb.decisions[-1]["reason_codes"]

    def test_deny_pii_credit_card(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["credit_card"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "process", {"card": "4111-1111-1111-1111"})
        assert result is not None
        assert cb.decisions[-1]["action"] == "DENY"
        assert "PII_DETECTED:credit_card" in cb.decisions[-1]["reason_codes"]

    def test_deny_pii_email(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["email"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "send", {"to": "user@example.com"})
        assert result is not None
        assert "PII_DETECTED:email" in cb.decisions[-1]["reason_codes"]

    def test_allow_when_no_pii(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["ssn", "credit_card"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "search", {"query": "weather today"})
        assert result is None
        assert cb.decisions[-1]["action"] == "ALLOW"


class TestToolAllowlist:
    """Test tool allowlisting."""

    def test_allow_listed_tool(self):
        cb = TealTigerCallback(
            policies=[{"type": "tool_allowlist", "allowed": ["search", "read_file"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "search", {"query": "test"})
        assert result is None

    def test_deny_unlisted_tool(self):
        cb = TealTigerCallback(
            policies=[{"type": "tool_allowlist", "allowed": ["search"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "delete_file", {"path": "/etc/passwd"})
        assert result is not None
        assert "TOOL_NOT_ALLOWED" in cb.decisions[-1]["reason_codes"]

    def test_wildcard_allowlist(self):
        cb = TealTigerCallback(
            policies=[{"type": "tool_allowlist", "allowed": ["code_*"]}],
            mode="ENFORCE",
        )
        # Should allow code_execution (matches code_*)
        result = cb.before_tool(None, "code_execution", {})
        assert result is None

        # Should deny search (doesn't match code_*)
        result = cb.before_tool(None, "search", {})
        assert result is not None


class TestCostLimit:
    """Test cost budget enforcement."""

    def test_allow_under_budget(self):
        cb = TealTigerCallback(
            policies=[{"type": "cost_limit", "max_per_session": 1.00}],
            mode="ENFORCE",
            cost_per_call=0.01,
        )
        result = cb.before_tool(None, "search", {})
        assert result is None
        assert cb.total_cost == 0.01

    def test_deny_over_budget(self):
        cb = TealTigerCallback(
            policies=[{"type": "cost_limit", "max_per_session": 0.005}],
            mode="ENFORCE",
            cost_per_call=0.002,
        )
        # First 2 calls spend 0.004 — under limit
        cb.before_tool(None, "search", {})
        cb.before_tool(None, "search", {})
        # Third call: cumulative is 0.004, still under 0.005
        cb.before_tool(None, "search", {})
        # Fourth call: cumulative is 0.006 >= 0.005 — should deny
        result = cb.before_tool(None, "search", {})
        assert result is not None
        assert "BUDGET_EXCEEDED" in cb.decisions[-1]["reason_codes"]

    def test_cost_tracking_accuracy(self):
        cb = TealTigerCallback(policies=[], mode="OBSERVE", cost_per_call=0.1)
        for _ in range(10):
            cb.before_tool(None, "tool", {})
        assert abs(cb.total_cost - 1.0) < 1e-9


class TestSecretDetection:
    """Test secret/key detection."""

    def test_deny_openai_key(self):
        cb = TealTigerCallback(
            policies=[{"type": "secret_detection"}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "run", {"code": "key = 'sk-abcdefghijklmnopqrstuvwx'"})
        assert result is not None
        assert "SECRET_DETECTED" in cb.decisions[-1]["reason_codes"]

    def test_deny_github_pat(self):
        cb = TealTigerCallback(
            policies=[{"type": "secret_detection"}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "run", {"token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"})
        assert result is not None
        assert "SECRET_DETECTED" in cb.decisions[-1]["reason_codes"]

    def test_deny_aws_key(self):
        cb = TealTigerCallback(
            policies=[{"type": "secret_detection"}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "deploy", {"key": "AKIAIOSFODNN7EXAMPLE"})
        assert result is not None

    def test_allow_normal_text(self):
        cb = TealTigerCallback(
            policies=[{"type": "secret_detection"}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "run", {"code": "x = 42"})
        assert result is None


class TestFreezeUnfreeze:
    """Test kill switch functionality."""

    def test_freeze_blocks_all(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.freeze()
        result = cb.before_tool(None, "any_tool", {})
        assert result is not None
        assert "AGENT_FROZEN" in cb.decisions[-1]["reason_codes"]

    def test_unfreeze_restores(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.freeze()
        cb.unfreeze()
        result = cb.before_tool(None, "any_tool", {})
        assert result is None

    def test_is_frozen_property(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        assert cb.is_frozen is False
        cb.freeze()
        assert cb.is_frozen is True
        cb.unfreeze()
        assert cb.is_frozen is False


class TestModes:
    """Test governance mode behavior."""

    def test_observe_never_blocks(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["ssn"]}],
            mode="OBSERVE",
        )
        result = cb.before_tool(None, "search", {"query": "SSN: 123-45-6789"})
        assert result is None  # Never blocks in OBSERVE
        assert cb.decisions[-1]["action"] == "DENY"  # But records the violation

    def test_monitor_never_blocks(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["ssn"]}],
            mode="MONITOR",
        )
        result = cb.before_tool(None, "search", {"query": "SSN: 123-45-6789"})
        assert result is None
        assert cb.decisions[-1]["action"] == "DENY"

    def test_enforce_blocks(self):
        cb = TealTigerCallback(
            policies=[{"type": "pii_block", "categories": ["ssn"]}],
            mode="ENFORCE",
        )
        result = cb.before_tool(None, "search", {"query": "SSN: 123-45-6789"})
        assert result is not None

    def test_invalid_mode_raises(self):
        with pytest.raises(ValueError, match="Invalid mode"):
            TealTigerCallback(mode="INVALID")


class TestDecisionAudit:
    """Test decision audit trail."""

    def test_decision_fields(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE", agent_id="test-agent")
        cb.before_tool(None, "search", {"query": "test"})
        d = cb.decisions[0]
        assert "correlation_id" in d
        assert "timestamp_ms" in d
        assert d["action"] == "ALLOW"
        assert d["mode"] == "ENFORCE"
        assert d["tool_name"] == "search"
        assert d["agent_id"] == "test-agent"
        assert d["risk_score"] == 0
        assert "evaluation_time_ms" in d

    def test_on_decision_callback(self):
        received = []
        cb = TealTigerCallback(
            policies=[],
            mode="ENFORCE",
            on_decision=lambda d: received.append(d),
        )
        cb.before_tool(None, "tool1", {})
        cb.before_tool(None, "tool2", {})
        assert len(received) == 2
        assert received[0]["tool_name"] == "tool1"
        assert received[1]["tool_name"] == "tool2"

    def test_after_tool_records_outcome(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.before_tool(None, "search", {})
        cb.after_tool(None, "search", {}, result="data")
        assert cb.decisions[0].get("execution_outcome") == "executed"

    def test_reset_clears_state(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.before_tool(None, "tool", {})
        cb.freeze()
        cb.reset()
        assert len(cb.decisions) == 0
        assert cb.total_cost == 0.0
        assert cb.is_frozen is False

    def test_allow_count(self):
        cb = TealTigerCallback(
            policies=[{"type": "tool_allowlist", "allowed": ["search"]}],
            mode="ENFORCE",
        )
        cb.before_tool(None, "search", {})
        cb.before_tool(None, "search", {})
        cb.before_tool(None, "delete", {})
        assert cb.allow_count == 2
        assert cb.deny_count == 1


class TestToolNameResolution:
    """Test tool name extraction from different input types."""

    def test_string_tool_name(self):
        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.before_tool(None, "my_tool", {})
        assert cb.decisions[-1]["tool_name"] == "my_tool"

    def test_object_with_name_attr(self):
        class MockTool:
            name = "mock_search"

        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.before_tool(None, MockTool(), {})
        assert cb.decisions[-1]["tool_name"] == "mock_search"

    def test_object_without_name_uses_str(self):
        class CustomTool:
            def __str__(self):
                return "custom_tool_v2"

        cb = TealTigerCallback(policies=[], mode="ENFORCE")
        cb.before_tool(None, CustomTool(), {})
        assert "custom_tool_v2" in cb.decisions[-1]["tool_name"]
