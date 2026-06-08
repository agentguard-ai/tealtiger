"""Tests for TealTigerAgentHook."""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest

from camelai_tealtiger import (
    GovernanceDenyError,
    TealTigerAgentHook,
)

# ─── Zero-Config Mode Tests ─────────────────────────────────────────────────


class TestZeroConfigMode:
    """Tests for zero-config observe mode (no TealEngine)."""

    def test_passthrough_allows_all(self) -> None:
        """Pre-step allows all in zero-config mode."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Hello world")

        assert decision["action"] == "ALLOW"
        assert decision["mode"] == "OBSERVE"

    def test_cost_tracking_accumulates(self) -> None:
        """Cumulative cost increases with each step."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="Hello " * 250)
        hook.pre_step(agent_id="agent-1", step_content="World " * 250)

        assert hook.cumulative_cost > 0
        assert hook.cumulative_cost > 0.001

    def test_cost_tracking_per_agent(self) -> None:
        """Cost is tracked per agent in summary."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="A" * 4000)
        hook.pre_step(agent_id="agent-2", step_content="B" * 8000)

        summary = hook.summary
        assert "agent-1" in summary
        assert "agent-2" in summary
        assert summary["agent-2"].total_cost > summary["agent-1"].total_cost

    def test_post_step_tracks_cost_from_token_usage(self) -> None:
        """Post-step uses token_usage for accurate cost tracking."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="Request")
        hook.post_step(
            agent_id="agent-1",
            step_result="Response",
            token_usage={"prompt_tokens": 100, "completion_tokens": 50},
        )

        # 150 tokens at 0.01/1k = 0.0015 from post_step
        assert hook.cumulative_cost > 0.001

    def test_post_step_estimates_cost_without_token_usage(self) -> None:
        """Post-step estimates cost from text length when no token_usage."""
        hook = TealTigerAgentHook()
        hook.post_step(agent_id="agent-1", step_result="A short response")

        assert hook.cumulative_cost > 0

    def test_empty_content_allowed(self) -> None:
        """Empty step content is handled gracefully."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="")

        assert decision["action"] == "ALLOW"

    def test_session_id_generated(self) -> None:
        """Session ID is auto-generated if not provided."""
        hook = TealTigerAgentHook()
        assert hook.session_id is not None
        # Verify UUID format
        uuid.UUID(hook.session_id, version=4)

    def test_custom_session_id(self) -> None:
        """Custom session ID is used when provided."""
        hook = TealTigerAgentHook(session_id="my-session-123")
        assert hook.session_id == "my-session-123"


# ─── PII Detection Tests ────────────────────────────────────────────────────


class TestPIIDetection:
    """Tests for PII detection in step content."""

    def test_detects_email(self) -> None:
        """Detects email addresses in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Contact me at john.doe@example.com please",
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "email" for p in pii)

    def test_detects_ssn(self) -> None:
        """Detects SSN patterns in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="My SSN is 123-45-6789")

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "ssn" for p in pii)

    def test_detects_credit_card(self) -> None:
        """Detects credit card numbers in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Card: 4111-1111-1111-1111")

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "credit_card" for p in pii)

    def test_detects_phone(self) -> None:
        """Detects US phone numbers in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Call me at (555) 123-4567")

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "phone_us" for p in pii)

    @pytest.mark.parametrize(
        ("step_content", "pii_type"),
        [
            ("London office: +44 20 7946 0958", "phone_uk"),
            ("Berlin office: +49 30 12345678", "phone_eu"),
            ("Paris office: +33 1 23 45 67 89", "phone_eu"),
            ("Mumbai office: +91 98765 43210", "phone_in"),
        ],
    )
    def test_detects_international_phone(self, step_content: str, pii_type: str) -> None:
        """Detects UK, EU, and India phone numbers in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content=step_content)

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == pii_type for p in pii)

    def test_detects_ip_address(self) -> None:
        """Detects IP addresses in step content."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Server at 192.168.1.100")

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "ip_address" for p in pii)

    def test_detects_multiple_pii(self) -> None:
        """Detects multiple PII types in a single step."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Email: test@example.com, SSN: 123-45-6789",
        )

        pii = decision["pii_detected"]
        types = {p["type"] for p in pii}
        assert "email" in types
        assert "ssn" in types

    def test_pii_still_allows_in_observe_mode(self) -> None:
        """PII detection does not block in observe mode."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="My SSN is 123-45-6789")

        assert decision["action"] == "ALLOW"
        assert "PII_DETECTED" in decision["reason_codes"]

    def test_pii_in_post_step_output(self) -> None:
        """PII is detected in post-step output as well."""
        hook = TealTigerAgentHook()
        decision = hook.post_step(
            agent_id="agent-1",
            step_result="Here is the email: user@company.com",
        )

        pii = decision["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "email" for p in pii)

    def test_no_pii_zero_risk(self) -> None:
        """Clean text has zero risk score."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Hello, how are you today?")

        assert decision["risk_score"] == 0
        assert len(decision["pii_detected"]) == 0

    def test_pii_redaction_format(self) -> None:
        """PII findings include properly redacted values."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Email: test@example.com")

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
        hook = TealTigerAgentHook(engine=engine, mode="ENFORCE")
        decision = hook.pre_step(agent_id="agent-1", step_content="Hello")

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
        hook = TealTigerAgentHook(engine=engine, mode="ENFORCE")

        with pytest.raises(GovernanceDenyError) as exc_info:
            hook.pre_step(agent_id="agent-1", step_content="Expensive request")

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
        hook = TealTigerAgentHook(engine=engine, mode="MONITOR")
        decision = hook.pre_step(agent_id="agent-1", step_content="Monitored")

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
        hook = TealTigerAgentHook(engine=engine, mode="OBSERVE")
        decision = hook.pre_step(agent_id="agent-1", step_content="Observed")

        assert decision["action"] == "DENY"
        # No exception raised in OBSERVE mode

    def test_engine_error_fail_closed_enforce(self) -> None:
        """Engine error in ENFORCE mode results in DENY (fail-closed)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        hook = TealTigerAgentHook(engine=engine, mode="ENFORCE")

        with pytest.raises(GovernanceDenyError) as exc_info:
            hook.pre_step(agent_id="agent-1", step_content="Test")

        assert "FAIL_CLOSED" in exc_info.value.decision["reason_codes"]

    def test_engine_error_fail_open_monitor(self) -> None:
        """Engine error in MONITOR mode allows through (fail-open)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        hook = TealTigerAgentHook(engine=engine, mode="MONITOR")
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        assert decision["action"] == "ALLOW"
        assert "ENGINE_ERROR" in decision["reason_codes"]
        assert "FAIL_OPEN" in decision["reason_codes"]


# ─── Kill Switch Tests ───────────────────────────────────────────────────────


class TestKillSwitch:
    """Tests for freeze/unfreeze kill switch."""

    def test_freeze_blocks_in_enforce(self) -> None:
        """Frozen agent is blocked in ENFORCE mode."""
        hook = TealTigerAgentHook(mode="ENFORCE")
        hook.freeze("agent-1")

        with pytest.raises(GovernanceDenyError) as exc_info:
            hook.pre_step(agent_id="agent-1", step_content="Blocked")

        assert "AGENT_FROZEN" in exc_info.value.decision["reason_codes"]
        assert "KILL_SWITCH" in exc_info.value.decision["reason_codes"]

    def test_freeze_records_in_observe(self) -> None:
        """Frozen agent is recorded but not blocked in OBSERVE mode."""
        hook = TealTigerAgentHook(mode="OBSERVE")
        hook.freeze("agent-1")

        decision = hook.pre_step(agent_id="agent-1", step_content="Allowed in observe")

        assert decision["action"] == "DENY"
        assert "AGENT_FROZEN" in decision["reason_codes"]

    def test_unfreeze_allows_again(self) -> None:
        """Unfrozen agent can proceed normally."""
        hook = TealTigerAgentHook(mode="ENFORCE")
        hook.freeze("agent-1")

        # Verify frozen
        with pytest.raises(GovernanceDenyError):
            hook.pre_step(agent_id="agent-1", step_content="Blocked")

        # Unfreeze
        hook.unfreeze("agent-1")

        # Should work now
        decision = hook.pre_step(agent_id="agent-1", step_content="Allowed again")
        assert decision["action"] == "ALLOW"

    def test_freeze_only_affects_target_agent(self) -> None:
        """Freezing one agent does not affect others."""
        hook = TealTigerAgentHook(mode="ENFORCE")
        hook.freeze("agent-1")

        # agent-2 should still work
        decision = hook.pre_step(agent_id="agent-2", step_content="I'm fine")
        assert decision["action"] == "ALLOW"

    def test_unfreeze_nonexistent_agent_is_safe(self) -> None:
        """Unfreezing a non-frozen agent does not error."""
        hook = TealTigerAgentHook()
        hook.unfreeze("never-frozen")  # Should not raise

    def test_freeze_blocks_all_subsequent_steps(self) -> None:
        """Frozen agent is blocked on every subsequent pre_step call."""
        hook = TealTigerAgentHook(mode="ENFORCE")

        # First step works
        hook.pre_step(agent_id="agent-1", step_content="Step 1")

        # Freeze
        hook.freeze("agent-1")

        # All subsequent steps blocked
        with pytest.raises(GovernanceDenyError):
            hook.pre_step(agent_id="agent-1", step_content="Step 2")

        with pytest.raises(GovernanceDenyError):
            hook.pre_step(agent_id="agent-1", step_content="Step 3")


# ─── Cost Tracking Tests ────────────────────────────────────────────────────


class TestCostTracking:
    """Tests for cost tracking accumulation."""

    def test_cost_accumulates_across_steps(self) -> None:
        """Cost accumulates across pre_step and post_step calls."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="A" * 4000)
        hook.post_step(
            agent_id="agent-1",
            step_result="B" * 4000,
            token_usage={"total_tokens": 2000},
        )

        # pre_step: ~1000 tokens * 0.01/1k = ~0.01
        # post_step: 2000 tokens * 0.01/1k = 0.02
        assert hook.cumulative_cost > 0.02

    def test_summary_per_agent(self) -> None:
        """Summary tracks cost per agent."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="A" * 4000)
        hook.pre_step(agent_id="agent-1", step_content="B" * 4000)
        hook.pre_step(agent_id="agent-2", step_content="C" * 4000)

        summary = hook.summary
        assert summary["agent-1"].step_count == 2
        assert summary["agent-2"].step_count == 1
        assert summary["agent-1"].total_cost > summary["agent-2"].total_cost

    def test_cumulative_cost_in_decision(self) -> None:
        """Each decision includes cumulative cost."""
        hook = TealTigerAgentHook()
        d1 = hook.pre_step(agent_id="agent-1", step_content="First")
        d2 = hook.pre_step(agent_id="agent-1", step_content="Second")

        assert d2["cumulative_cost"] > d1["cumulative_cost"]

    def test_per_step_cost_in_decision(self) -> None:
        """Each decision includes the per-step cost."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Some content")

        assert decision["cost_tracked"] > 0


# ─── Audit Trail Tests ──────────────────────────────────────────────────────


class TestAuditTrail:
    """Tests for structured audit trail."""

    def test_audit_trail_grows(self) -> None:
        """Audit trail accumulates entries."""
        hook = TealTigerAgentHook()
        hook.pre_step(agent_id="agent-1", step_content="First")
        hook.pre_step(agent_id="agent-1", step_content="Second")
        hook.post_step(agent_id="agent-1", step_result="Result")

        assert len(hook.audit_trail) == 3

    def test_export_audit_trail_writes_jsonl(self, tmp_path: Any) -> None:
        """Audit trail export writes one JSON object per line."""
        hook = TealTigerAgentHook()
        first = hook.pre_step(agent_id="agent-1", step_content="First")
        second = hook.post_step(agent_id="agent-1", step_result="Result")
        export_path = tmp_path / "audit.jsonl"

        count = hook.export_audit_trail(str(export_path))

        lines = export_path.read_text(encoding="utf-8").splitlines()
        exported = [json.loads(line) for line in lines]

        assert count == 2
        assert len(lines) == 2
        assert exported == [entry.to_dict() for entry in hook.audit_trail]
        assert exported[0]["correlation_id"] == first["correlation_id"]
        assert exported[1]["correlation_id"] == second["correlation_id"]

    def test_audit_entry_fields(self) -> None:
        """Audit entry contains all required fields."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Audit test")

        required_fields = [
            "correlation_id",
            "timestamp_ms",
            "action",
            "mode",
            "phase",
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
        hook = TealTigerAgentHook()
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Serialize test with email@example.com",
        )

        # Should not raise
        serialized = json.dumps(decision)
        assert isinstance(serialized, str)

    def test_phase_tracking(self) -> None:
        """Audit entries track pre_step vs post_step phase."""
        hook = TealTigerAgentHook()
        d1 = hook.pre_step(agent_id="agent-1", step_content="Before")
        d2 = hook.post_step(agent_id="agent-1", step_result="After")

        assert d1["phase"] == "pre_step"
        assert d2["phase"] == "post_step"

    def test_agent_id_in_audit(self) -> None:
        """Audit entries include the agent_id."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="my-agent-42", step_content="Test")

        assert decision["agent_id"] == "my-agent-42"

    def test_timestamp_is_unix_ms(self) -> None:
        """Timestamp is in Unix milliseconds."""
        import time

        hook = TealTigerAgentHook()
        before = time.time() * 1000
        decision = hook.pre_step(agent_id="agent-1", step_content="Time test")
        after = time.time() * 1000

        ts = decision["timestamp_ms"]
        assert before <= ts <= after


# ─── Role Validation Tests ───────────────────────────────────────────────────


class TestRoleValidation:
    """Tests for role allowlist validation."""

    def test_allowed_role_passes(self) -> None:
        """Agent with allowed role passes governance."""
        hook = TealTigerAgentHook(
            role_allowlist=["assistant", "critic", "researcher"],
            mode="ENFORCE",
        )
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Hello",
            agent_role="assistant",
        )

        assert decision["action"] == "ALLOW"

    def test_disallowed_role_denied_enforce(self) -> None:
        """Agent with disallowed role is denied in ENFORCE mode."""
        hook = TealTigerAgentHook(
            role_allowlist=["assistant", "critic"],
            mode="ENFORCE",
        )

        with pytest.raises(GovernanceDenyError) as exc_info:
            hook.pre_step(
                agent_id="agent-1",
                step_content="Hello",
                agent_role="hacker",
            )

        assert "ROLE_NOT_ALLOWED" in exc_info.value.decision["reason_codes"]

    def test_disallowed_role_logged_monitor(self) -> None:
        """Agent with disallowed role is logged but allowed in MONITOR mode."""
        hook = TealTigerAgentHook(
            role_allowlist=["assistant", "critic"],
            mode="MONITOR",
        )
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Hello",
            agent_role="hacker",
        )

        assert decision["action"] == "DENY"
        assert "ROLE_NOT_ALLOWED" in decision["reason_codes"]
        # No exception — MONITOR mode

    def test_no_allowlist_allows_all_roles(self) -> None:
        """Without allowlist, all roles are accepted."""
        hook = TealTigerAgentHook(mode="ENFORCE")
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Hello",
            agent_role="any-role-at-all",
        )

        assert decision["action"] == "ALLOW"

    def test_no_role_skips_validation(self) -> None:
        """When no role is provided, role validation is skipped."""
        hook = TealTigerAgentHook(
            role_allowlist=["assistant"],
            mode="ENFORCE",
        )
        decision = hook.pre_step(agent_id="agent-1", step_content="Hello")

        assert decision["action"] == "ALLOW"


# ─── Correlation ID Tests ────────────────────────────────────────────────────


class TestCorrelationIDs:
    """Tests for UUID v4 correlation IDs."""

    def test_correlation_id_is_uuid4(self) -> None:
        """Correlation IDs are valid UUID v4."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        parsed = uuid.UUID(decision["correlation_id"], version=4)
        assert parsed.version == 4

    def test_correlation_ids_unique(self) -> None:
        """Every evaluation gets a unique correlation ID."""
        hook = TealTigerAgentHook()
        ids = set()

        for i in range(20):
            decision = hook.pre_step(agent_id="agent-1", step_content=f"Step {i}")
            ids.add(decision["correlation_id"])

        assert len(ids) == 20

    def test_pre_and_post_have_different_ids(self) -> None:
        """pre_step and post_step get different correlation IDs."""
        hook = TealTigerAgentHook()
        d1 = hook.pre_step(agent_id="agent-1", step_content="Request")
        d2 = hook.post_step(agent_id="agent-1", step_result="Response")

        assert d1["correlation_id"] != d2["correlation_id"]


# ─── Session & Step Tracking Tests ───────────────────────────────────────────


class TestSessionStepTracking:
    """Tests for TEEC namespace and session/step tracking."""

    def test_teec_namespace(self) -> None:
        """TEEC fields use teec.camelai namespace."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        assert decision["teec"]["namespace"] == "teec.camelai"

    def test_teec_session_id(self) -> None:
        """TEEC includes session_id."""
        hook = TealTigerAgentHook(session_id="sess-abc")
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        assert decision["teec"]["session_id"] == "sess-abc"

    def test_teec_step_id(self) -> None:
        """TEEC includes unique step_id for each evaluation."""
        hook = TealTigerAgentHook()
        d1 = hook.pre_step(agent_id="agent-1", step_content="Step 1")
        d2 = hook.pre_step(agent_id="agent-1", step_content="Step 2")

        assert d1["teec"]["step_id"] != d2["teec"]["step_id"]
        # Validate UUID format
        uuid.UUID(d1["teec"]["step_id"], version=4)

    def test_teec_task_prompt_hashed(self) -> None:
        """TEEC includes hashed task prompt."""
        hook = TealTigerAgentHook(task_prompt="Solve the math problem")
        decision = hook.pre_step(agent_id="agent-1", step_content="Step")

        assert "task_prompt" in decision["teec"]
        # Should be a SHA-256 hex digest (64 chars)
        assert len(decision["teec"]["task_prompt"]) == 64

    def test_teec_agent_role(self) -> None:
        """TEEC includes agent_role when provided."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Test",
            agent_role="assistant",
        )

        assert decision["teec"]["agent_role"] == "assistant"

    def test_teec_role_type(self) -> None:
        """TEEC includes role_type when provided."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(
            agent_id="agent-1",
            step_content="Test",
            role_type="critic",
        )

        assert decision["teec"]["role_type"] == "critic"

    def test_teec_society_id(self) -> None:
        """TEEC includes society_id when configured."""
        hook = TealTigerAgentHook(society_id="debate-society-001")
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        assert decision["teec"]["society_id"] == "debate-society-001"

    def test_teec_no_optional_fields_when_not_set(self) -> None:
        """TEEC omits optional fields when not configured."""
        hook = TealTigerAgentHook()
        decision = hook.pre_step(agent_id="agent-1", step_content="Test")

        assert "task_prompt" not in decision["teec"]
        assert "society_id" not in decision["teec"]


# ─── Baseline Tests ──────────────────────────────────────────────────────────


class TestBaseline:
    """Tests for behavioral baseline generation."""

    def test_baseline_empty_on_no_data(self) -> None:
        """Baseline is empty when no steps have been recorded."""
        hook = TealTigerAgentHook()
        baseline = hook.get_baseline()

        assert baseline == {}

    def test_baseline_tracks_agent(self) -> None:
        """Baseline includes data for each observed agent."""
        hook = TealTigerAgentHook()
        hook.pre_step(agent_id="agent-1", step_content="Hello")
        hook.pre_step(agent_id="agent-2", step_content="World")

        baseline = hook.get_baseline()
        assert "agent-1" in baseline
        assert "agent-2" in baseline

    def test_baseline_avg_cost(self) -> None:
        """Baseline computes average cost per step."""
        hook = TealTigerAgentHook(cost_per_1k_tokens=0.01)
        hook.pre_step(agent_id="agent-1", step_content="A" * 4000)
        hook.pre_step(agent_id="agent-1", step_content="B" * 4000)

        baseline = hook.get_baseline()
        entry = baseline["agent-1"]
        assert entry.avg_cost_per_step > 0
        assert entry.total_steps == 2

    def test_baseline_tracks_tools(self) -> None:
        """Baseline includes common tools used."""
        hook = TealTigerAgentHook()
        hook.pre_step(agent_id="agent-1", step_content="Search", tool_name="web_search")
        hook.pre_step(agent_id="agent-1", step_content="Search again", tool_name="web_search")
        hook.pre_step(agent_id="agent-1", step_content="Calculate", tool_name="calculator")

        baseline = hook.get_baseline()
        assert "web_search" in baseline["agent-1"].common_tools

    def test_baseline_pii_frequency(self) -> None:
        """Baseline tracks PII detection frequency."""
        hook = TealTigerAgentHook()
        hook.pre_step(agent_id="agent-1", step_content="Email: test@example.com")
        hook.pre_step(agent_id="agent-1", step_content="Clean text")

        baseline = hook.get_baseline()
        # 1 PII finding out of 2 steps = 0.5 frequency
        assert baseline["agent-1"].pii_frequency > 0
