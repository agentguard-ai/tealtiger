"""Tests for TealTigerGuard."""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest

from pydanticai_tealtiger import (
    GovernanceDenyError,
    TealTigerGuard,
)

# ─── Zero-Config Mode Tests ─────────────────────────────────────────────────


class TestZeroConfigMode:
    """Tests for zero-config observe mode (no TealEngine)."""

    def test_evaluate_allows_all(self) -> None:
        """evaluate() allows all in zero-config mode."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="search", args={"query": "hello"})

        assert decision["action"] == "ALLOW"
        assert decision["mode"] == "OBSERVE"

    def test_cost_tracking_accumulates(self) -> None:
        """Cumulative cost increases with each evaluate call."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        guard.evaluate(tool="search", args={"query": "x" * 1000})
        guard.evaluate(tool="search", args={"query": "y" * 1000})

        assert guard.cumulative_cost > 0
        assert guard.cumulative_cost > 0.001

    def test_cost_tracking_per_tool(self) -> None:
        """Cost is tracked per tool in summary."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        guard.evaluate(tool="search", args={"query": "A" * 1000})
        guard.evaluate(tool="compute", args={"data": "B" * 2000})

        summary = guard.summary
        assert "search" in summary
        assert "compute" in summary
        assert summary["compute"].total_cost > summary["search"].total_cost

    def test_post_call_tracks_cost_from_token_usage(self) -> None:
        """post_call uses token_usage for accurate cost tracking."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        guard.evaluate(tool="search", args={"query": "request"})
        guard.post_call(
            tool_name="search",
            result="Response text",
            token_usage={"prompt_tokens": 100, "completion_tokens": 50},
        )

        # 150 tokens at 0.01/1k = 0.0015 from post_call
        assert guard.cumulative_cost > 0.001

    def test_post_call_estimates_cost_without_token_usage(self) -> None:
        """post_call estimates cost from result length when no token_usage."""
        guard = TealTigerGuard()
        guard.post_call(tool_name="search", result="A short response")

        assert guard.cumulative_cost > 0

    def test_empty_args_allowed(self) -> None:
        """Evaluate with no args is handled gracefully."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="ping")

        assert decision["action"] == "ALLOW"

    def test_session_id_generated(self) -> None:
        """Session ID is auto-generated if not provided."""
        guard = TealTigerGuard()
        assert guard.session_id is not None
        # Verify UUID format
        uuid.UUID(guard.session_id, version=4)

    def test_custom_session_id(self) -> None:
        """Custom session ID is used when provided."""
        guard = TealTigerGuard(session_id="my-session-123")
        assert guard.session_id == "my-session-123"

    def test_pre_call_is_alias_for_evaluate(self) -> None:
        """pre_call() is an alias for evaluate()."""
        guard = TealTigerGuard()
        decision = guard.pre_call(tool_name="search", args={"query": "test"})

        assert decision["action"] == "ALLOW"
        assert decision["tool_name"] == "search"


# ─── PII Detection Tests ────────────────────────────────────────────────────


class TestPIIDetection:
    """Tests for PII detection in tool arguments."""

    def test_detects_email(self) -> None:
        """Detects email addresses in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="send_email",
            args={"to": "john.doe@example.com", "body": "Hello"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "email" for p in pii)

    def test_detects_ssn(self) -> None:
        """Detects SSN patterns in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="lookup",
            args={"ssn": "123-45-6789"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "ssn" for p in pii)

    def test_detects_credit_card(self) -> None:
        """Detects credit card numbers in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="payment",
            args={"card": "4111-1111-1111-1111"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "credit_card" for p in pii)

    def test_detects_phone(self) -> None:
        """Detects US phone numbers in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="call",
            args={"number": "(555) 123-4567"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "phone_us" for p in pii)

    @pytest.mark.parametrize(
        ("number", "pii_type"),
        [
            ("+44 20 7946 0958", "phone_uk"),
            ("+49 30 12345678", "phone_eu"),
            ("+33 1 23 45 67 89", "phone_eu"),
            ("+91 98765 43210", "phone_in"),
        ],
    )
    def test_detects_international_phone(self, number: str, pii_type: str) -> None:
        """Detects UK, EU, and India phone numbers in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="call", args={"number": number})

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == pii_type for p in pii)

    def test_detects_ip_address(self) -> None:
        """Detects IP addresses in tool args."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="connect",
            args={"host": "192.168.1.100"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "ip_address" for p in pii)

    def test_detects_multiple_pii(self) -> None:
        """Detects multiple PII types in a single evaluation."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="process",
            args={"data": "Email: test@example.com, SSN: 123-45-6789"},
        )

        pii = decision["pii_detected"]
        types = {p["type"] for p in pii}
        assert "email" in types
        assert "ssn" in types

    def test_pii_still_allows_in_observe_mode(self) -> None:
        """PII detection does not block in observe mode."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="lookup",
            args={"ssn": "123-45-6789"},
        )

        assert decision["action"] == "ALLOW"
        assert "PII_DETECTED" in decision["reason_codes"]

    def test_pii_in_post_call_output(self) -> None:
        """PII is detected in post-call output as well."""
        guard = TealTigerGuard()
        decision = guard.post_call(
            tool_name="search",
            result="Contact: user@company.com for details",
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "email" for p in pii)

    def test_no_pii_zero_risk(self) -> None:
        """Clean args have zero risk score."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="search",
            args={"query": "hello world"},
        )

        assert decision["risk_score"] == 0
        assert len(decision["pii_detected"]) == 0

    def test_pii_redaction_format(self) -> None:
        """PII findings include properly redacted values."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="email",
            args={"to": "test@example.com"},
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        email_finding = next(p for p in pii if p["type"] == "email")
        assert email_finding["redacted"].startswith("te")
        assert email_finding["redacted"].endswith("om")
        assert "*" in email_finding["redacted"]


# ─── Policy Mode Tests ───────────────────────────────────────────────────────


class TestPolicyMode:
    """Tests for policy mode with TealEngine."""

    def _make_engine(self, decision: dict[str, Any]) -> MagicMock:
        """Create a mock TealEngine that returns a given decision."""
        engine = MagicMock()
        engine.evaluate.return_value = decision
        return engine

    def test_engine_allow(self) -> None:
        """TealEngine ALLOW decision passes through."""
        engine = self._make_engine(
            {
                "action": "ALLOW",
                "reason": "Compliant",
                "reason_codes": ["OK"],
                "risk_score": 0,
            }
        )
        guard = TealTigerGuard(engine=engine, mode="ENFORCE")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["action"] == "ALLOW"

    def test_engine_deny_raises_in_enforce(self) -> None:
        """TealEngine DENY in ENFORCE mode raises GovernanceDenyError."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Cost limit exceeded",
                "reason_codes": ["COST_LIMIT"],
                "risk_score": 80,
            }
        )
        guard = TealTigerGuard(engine=engine, mode="ENFORCE")

        with pytest.raises(GovernanceDenyError) as exc_info:
            guard.evaluate(tool="expensive_tool", args={"data": "big"})

        assert "Cost limit exceeded" in str(exc_info.value)
        assert exc_info.value.decision["action"] == "DENY"

    def test_engine_deny_in_monitor_allows(self) -> None:
        """TealEngine DENY in MONITOR mode still allows (logs only)."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Would be blocked",
                "reason_codes": ["WOULD_BLOCK"],
                "risk_score": 70,
            }
        )
        guard = TealTigerGuard(engine=engine, mode="MONITOR")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        # MONITOR mode: decision is DENY but no exception raised
        assert decision["action"] == "DENY"

    def test_engine_deny_in_observe_allows(self) -> None:
        """TealEngine DENY in OBSERVE mode still allows."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Observing",
                "reason_codes": ["OBSERVE"],
                "risk_score": 60,
            }
        )
        guard = TealTigerGuard(engine=engine, mode="OBSERVE")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["action"] == "DENY"
        # No exception raised in OBSERVE mode

    def test_engine_error_fail_closed_enforce(self) -> None:
        """Engine error in ENFORCE mode results in DENY (fail-closed)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        guard = TealTigerGuard(engine=engine, mode="ENFORCE")

        with pytest.raises(GovernanceDenyError) as exc_info:
            guard.evaluate(tool="search", args={"query": "test"})

        assert "FAIL_CLOSED" in exc_info.value.decision["reason_codes"]

    def test_engine_error_fail_open_monitor(self) -> None:
        """Engine error in MONITOR mode allows through (fail-open)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        guard = TealTigerGuard(engine=engine, mode="MONITOR")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["action"] == "ALLOW"
        assert "ENGINE_ERROR" in decision["reason_codes"]
        assert "FAIL_OPEN" in decision["reason_codes"]


# ─── Tool Allowlist Tests ────────────────────────────────────────────────────


class TestToolAllowlist:
    """Tests for tool allowlist enforcement."""

    def test_allowed_tool_passes(self) -> None:
        """Tool in allowlist passes governance."""
        guard = TealTigerGuard(
            tool_allowlist=["search", "compute", "read_file"],
            mode="ENFORCE",
        )
        decision = guard.evaluate(tool="search", args={"query": "hello"})

        assert decision["action"] == "ALLOW"

    def test_disallowed_tool_denied_enforce(self) -> None:
        """Tool not in allowlist is denied in ENFORCE mode."""
        guard = TealTigerGuard(
            tool_allowlist=["search", "compute"],
            mode="ENFORCE",
        )

        with pytest.raises(GovernanceDenyError) as exc_info:
            guard.evaluate(tool="delete_all", args={"target": "/"})

        assert "TOOL_NOT_ALLOWED" in exc_info.value.decision["reason_codes"]

    def test_disallowed_tool_logged_monitor(self) -> None:
        """Tool not in allowlist is logged but allowed in MONITOR mode."""
        guard = TealTigerGuard(
            tool_allowlist=["search", "compute"],
            mode="MONITOR",
        )
        decision = guard.evaluate(tool="dangerous_tool", args={})

        assert decision["action"] == "DENY"
        assert "TOOL_NOT_ALLOWED" in decision["reason_codes"]
        # No exception — MONITOR mode

    def test_no_allowlist_allows_all_tools(self) -> None:
        """Without allowlist, all tools are accepted."""
        guard = TealTigerGuard(mode="ENFORCE")
        decision = guard.evaluate(tool="any_tool_at_all", args={})

        assert decision["action"] == "ALLOW"

    def test_allowlist_multiple_tools(self) -> None:
        """All tools in the allowlist are accepted."""
        guard = TealTigerGuard(
            tool_allowlist=["a", "b", "c"],
            mode="ENFORCE",
        )

        for tool in ["a", "b", "c"]:
            decision = guard.evaluate(tool=tool, args={})
            assert decision["action"] == "ALLOW"


# ─── Budget Limit Tests ──────────────────────────────────────────────────────


class TestBudgetLimit:
    """Tests for budget limit enforcement."""

    def test_under_budget_allows(self) -> None:
        """Calls under budget limit are allowed."""
        guard = TealTigerGuard(budget_limit=1.0, mode="ENFORCE")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["action"] == "ALLOW"

    def test_over_budget_denied_enforce(self) -> None:
        """Calls exceeding budget are denied in ENFORCE mode."""
        guard = TealTigerGuard(
            budget_limit=0.001,
            cost_per_1k_tokens=0.01,
            mode="ENFORCE",
        )
        # First call will push cost over budget
        guard.evaluate(tool="search", args={"query": "x" * 4000})

        # Second call should be denied (budget exceeded)
        with pytest.raises(GovernanceDenyError) as exc_info:
            guard.evaluate(tool="search", args={"query": "another"})

        assert "BUDGET_LIMIT_EXCEEDED" in exc_info.value.decision["reason_codes"]

    def test_over_budget_logged_monitor(self) -> None:
        """Calls exceeding budget are logged but allowed in MONITOR mode."""
        guard = TealTigerGuard(
            budget_limit=0.001,
            cost_per_1k_tokens=0.01,
            mode="MONITOR",
        )
        # First call pushes cost over budget
        guard.evaluate(tool="search", args={"query": "x" * 4000})

        # Second call logged as DENY but allowed
        decision = guard.evaluate(tool="search", args={"query": "another"})
        assert decision["action"] == "DENY"
        assert "BUDGET_LIMIT_EXCEEDED" in decision["reason_codes"]

    def test_no_budget_limit_allows_all(self) -> None:
        """Without budget limit, all calls are allowed regardless of cost."""
        guard = TealTigerGuard(cost_per_1k_tokens=1.0, mode="ENFORCE")
        # Large args — high cost but no limit
        for _ in range(10):
            decision = guard.evaluate(tool="search", args={"query": "x" * 4000})
            assert decision["action"] == "ALLOW"


# ─── Kill Switch Tests ───────────────────────────────────────────────────────


class TestKillSwitch:
    """Tests for freeze/unfreeze kill switch."""

    def test_freeze_blocks_in_enforce(self) -> None:
        """Frozen guard is blocked in ENFORCE mode."""
        guard = TealTigerGuard(mode="ENFORCE")
        guard.freeze()

        with pytest.raises(GovernanceDenyError) as exc_info:
            guard.evaluate(tool="search", args={"query": "blocked"})

        assert "GUARD_FROZEN" in exc_info.value.decision["reason_codes"]
        assert "KILL_SWITCH" in exc_info.value.decision["reason_codes"]

    def test_freeze_records_in_observe(self) -> None:
        """Frozen guard is recorded but not blocked in OBSERVE mode."""
        guard = TealTigerGuard(mode="OBSERVE")
        guard.freeze()

        decision = guard.evaluate(tool="search", args={"query": "allowed in observe"})

        assert decision["action"] == "DENY"
        assert "GUARD_FROZEN" in decision["reason_codes"]

    def test_unfreeze_allows_again(self) -> None:
        """Unfrozen guard can proceed normally."""
        guard = TealTigerGuard(mode="ENFORCE")
        guard.freeze()

        # Verify frozen
        with pytest.raises(GovernanceDenyError):
            guard.evaluate(tool="search", args={"query": "blocked"})

        # Unfreeze
        guard.unfreeze()

        # Should work now
        decision = guard.evaluate(tool="search", args={"query": "allowed again"})
        assert decision["action"] == "ALLOW"

    def test_freeze_blocks_all_subsequent_calls(self) -> None:
        """Frozen guard blocks all subsequent evaluate calls."""
        guard = TealTigerGuard(mode="ENFORCE")

        # First call works
        guard.evaluate(tool="search", args={"query": "works"})

        # Freeze
        guard.freeze()

        # All subsequent calls blocked
        with pytest.raises(GovernanceDenyError):
            guard.evaluate(tool="search", args={"query": "blocked 1"})

        with pytest.raises(GovernanceDenyError):
            guard.evaluate(tool="compute", args={"data": "blocked 2"})

    def test_unfreeze_non_frozen_is_safe(self) -> None:
        """Unfreezing a non-frozen guard does not error."""
        guard = TealTigerGuard()
        guard.unfreeze()  # Should not raise


# ─── Cost Tracking Tests ────────────────────────────────────────────────────


class TestCostTracking:
    """Tests for cost tracking accumulation."""

    def test_cost_accumulates_across_calls(self) -> None:
        """Cost accumulates across evaluate and post_call."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        guard.evaluate(tool="search", args={"query": "A" * 4000})
        guard.post_call(
            tool_name="search",
            result="B" * 4000,
            token_usage={"total_tokens": 2000},
        )

        # evaluate: ~1000 tokens * 0.01/1k = ~0.01
        # post_call: 2000 tokens * 0.01/1k = 0.02
        assert guard.cumulative_cost > 0.02

    def test_summary_per_tool(self) -> None:
        """Summary tracks cost per tool."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        guard.evaluate(tool="search", args={"query": "A" * 4000})
        guard.evaluate(tool="search", args={"query": "B" * 4000})
        guard.evaluate(tool="compute", args={"data": "C" * 4000})

        summary = guard.summary
        assert summary["search"].call_count == 2
        assert summary["compute"].call_count == 1
        assert summary["search"].total_cost > summary["compute"].total_cost

    def test_cumulative_cost_in_decision(self) -> None:
        """Each decision includes cumulative cost."""
        guard = TealTigerGuard()
        d1 = guard.evaluate(tool="search", args={"query": "first"})
        d2 = guard.evaluate(tool="search", args={"query": "second"})

        assert d2["cumulative_cost"] > d1["cumulative_cost"]

    def test_per_call_cost_in_decision(self) -> None:
        """Each decision includes the per-call cost."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="search", args={"query": "some content"})

        assert decision["cost_tracked"] > 0


# ─── Audit Trail Tests ──────────────────────────────────────────────────────


class TestAuditTrail:
    """Tests for structured audit trail."""

    def test_audit_trail_grows(self) -> None:
        """Audit trail accumulates entries."""
        guard = TealTigerGuard()
        guard.evaluate(tool="search", args={"query": "first"})
        guard.evaluate(tool="search", args={"query": "second"})
        guard.post_call(tool_name="search", result="result")

        assert len(guard.audit_trail) == 3

    def test_export_audit_trail_writes_jsonl(self, tmp_path: Any) -> None:
        """Audit trail export writes one JSON object per line."""
        guard = TealTigerGuard()
        first = guard.evaluate(tool="search", args={"query": "first"})
        second = guard.post_call(tool_name="search", result="result")
        export_path = tmp_path / "audit.jsonl"

        count = guard.export_audit_trail(str(export_path))

        lines = export_path.read_text(encoding="utf-8").splitlines()
        exported = [json.loads(line) for line in lines]

        assert count == 2
        assert len(lines) == 2
        assert exported == [entry.to_dict() for entry in guard.audit_trail]
        assert exported[0]["correlation_id"] == first["correlation_id"]
        assert exported[1]["correlation_id"] == second["correlation_id"]

    def test_audit_entry_fields(self) -> None:
        """Audit entry contains all required fields."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="search", args={"query": "audit test"})

        required_fields = [
            "correlation_id",
            "timestamp_ms",
            "action",
            "mode",
            "phase",
            "tool_name",
            "agent_id",
            "reason",
            "reason_codes",
            "risk_score",
            "pii_detected",
            "cost_tracked",
            "cumulative_cost",
            "evaluation_time_ms",
            "teec",
            "metadata",
        ]
        for field_name in required_fields:
            assert field_name in decision, f"Missing field: {field_name}"

    def test_audit_entry_serializable(self) -> None:
        """Audit entry can be serialized to JSON."""
        guard = TealTigerGuard()
        decision = guard.evaluate(
            tool="email",
            args={"to": "user@example.com"},
        )

        # Should not raise
        serialized = json.dumps(decision)
        assert isinstance(serialized, str)

    def test_phase_tracking(self) -> None:
        """Audit entries track pre_call vs post_call phase."""
        guard = TealTigerGuard()
        d1 = guard.evaluate(tool="search", args={"query": "before"})
        d2 = guard.post_call(tool_name="search", result="after")

        assert d1["phase"] == "pre_call"
        assert d2["phase"] == "post_call"

    def test_tool_name_in_audit(self) -> None:
        """Audit entries include the tool_name."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="my_custom_tool", args={})

        assert decision["tool_name"] == "my_custom_tool"

    def test_timestamp_is_unix_ms(self) -> None:
        """Timestamp is in Unix milliseconds."""
        import time

        guard = TealTigerGuard()
        before = time.time() * 1000
        decision = guard.evaluate(tool="search", args={"query": "time test"})
        after = time.time() * 1000

        ts = decision["timestamp_ms"]
        assert before <= ts <= after


# ─── Correlation ID Tests ────────────────────────────────────────────────────


class TestCorrelationIDs:
    """Tests for UUID v4 correlation IDs."""

    def test_correlation_id_is_uuid4(self) -> None:
        """Correlation IDs are valid UUID v4."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="search", args={"query": "test"})

        parsed = uuid.UUID(decision["correlation_id"], version=4)
        assert parsed.version == 4

    def test_correlation_ids_unique(self) -> None:
        """Every evaluation gets a unique correlation ID."""
        guard = TealTigerGuard()
        ids = set()

        for i in range(20):
            decision = guard.evaluate(tool="search", args={"query": f"step {i}"})
            ids.add(decision["correlation_id"])

        assert len(ids) == 20

    def test_pre_and_post_have_different_ids(self) -> None:
        """evaluate and post_call get different correlation IDs."""
        guard = TealTigerGuard()
        d1 = guard.evaluate(tool="search", args={"query": "request"})
        d2 = guard.post_call(tool_name="search", result="response")

        assert d1["correlation_id"] != d2["correlation_id"]


# ─── TEEC Namespace Tests ────────────────────────────────────────────────────


class TestTEECNamespace:
    """Tests for TEEC namespace and session tracking."""

    def test_teec_namespace(self) -> None:
        """TEEC fields use teec.pydanticai namespace."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["teec"]["namespace"] == "teec.pydanticai"

    def test_teec_session_id(self) -> None:
        """TEEC includes session_id."""
        guard = TealTigerGuard(session_id="sess-abc")
        decision = guard.evaluate(tool="search", args={"query": "test"})

        assert decision["teec"]["session_id"] == "sess-abc"

    def test_teec_call_id_unique(self) -> None:
        """TEEC includes unique call_id for each evaluation."""
        guard = TealTigerGuard()
        d1 = guard.evaluate(tool="search", args={"query": "call 1"})
        d2 = guard.evaluate(tool="search", args={"query": "call 2"})

        assert d1["teec"]["call_id"] != d2["teec"]["call_id"]
        # Validate UUID format
        uuid.UUID(d1["teec"]["call_id"], version=4)

    def test_teec_tool_name(self) -> None:
        """TEEC includes tool_name."""
        guard = TealTigerGuard()
        decision = guard.evaluate(tool="my_tool", args={})

        assert decision["teec"]["tool_name"] == "my_tool"
