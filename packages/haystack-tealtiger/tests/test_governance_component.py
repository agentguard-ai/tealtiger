"""Tests for TealTigerGovernanceComponent."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)
from haystack_integrations.components.connectors.tealtiger.governance_component import (
    GovernanceDenyError,
)

# ─── Zero-Config Mode Tests ─────────────────────────────────────────────────


class TestZeroConfigMode:
    """Tests for zero-config observe mode (no TealEngine)."""

    def test_passthrough_plain_text(self) -> None:
        """Text passes through unchanged in zero-config mode."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Hello, how can I help you?")

        assert result["text"] == "Hello, how can I help you?"
        assert result["decision"]["action"] == "ALLOW"
        assert result["decision"]["mode"] == "OBSERVE"

    def test_passthrough_preserves_exact_input(self) -> None:
        """Output text is exactly the input text."""
        gov = TealTigerGovernanceComponent()
        input_text = "  Multiple\n  lines\n  with   spaces  "
        result = gov.run(text=input_text)

        assert result["text"] == input_text

    def test_correlation_id_generated(self) -> None:
        """Each evaluation gets a unique UUID v4 correlation ID."""
        gov = TealTigerGovernanceComponent()
        r1 = gov.run(text="First")
        r2 = gov.run(text="Second")

        assert r1["decision"]["correlation_id"] != r2["decision"]["correlation_id"]
        # Verify UUID v4 format
        import uuid

        uuid.UUID(r1["decision"]["correlation_id"], version=4)
        uuid.UUID(r2["decision"]["correlation_id"], version=4)

    def test_cost_tracking_accumulates(self) -> None:
        """Cumulative cost increases with each evaluation."""
        gov = TealTigerGovernanceComponent(cost_per_1k_tokens=0.01)
        gov.run(text="Hello " * 250)  # ~250 tokens
        gov.run(text="World " * 250)  # ~250 tokens

        assert gov.cumulative_cost > 0
        assert gov.evaluation_count == 2
        # Cost should be roughly 0.01 * 0.5 = 0.005 (500 tokens total)
        # but depends on char-to-token estimation
        assert gov.cumulative_cost > 0.001

    def test_cost_in_decision(self) -> None:
        """Decision includes per-evaluation and cumulative cost."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Some text for cost tracking")

        assert result["decision"]["cost_tracked"] > 0
        assert result["decision"]["cumulative_cost"] > 0
        assert result["decision"]["cost_tracked"] == result["decision"]["cumulative_cost"]

    def test_evaluation_time_recorded(self) -> None:
        """Evaluation time is recorded in milliseconds."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Quick test")

        assert result["decision"]["evaluation_time_ms"] >= 0
        # Should be very fast in zero-config mode
        assert result["decision"]["evaluation_time_ms"] < 100

    def test_empty_text_allowed(self) -> None:
        """Empty string input is handled gracefully."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="")

        assert result["text"] == ""
        assert result["decision"]["action"] == "ALLOW"

    def test_audit_trail_grows(self) -> None:
        """Audit trail accumulates entries."""
        gov = TealTigerGovernanceComponent()
        gov.run(text="First")
        gov.run(text="Second")
        gov.run(text="Third")

        assert len(gov.audit_trail) == 3
        assert gov.audit_trail[0].correlation_id != gov.audit_trail[1].correlation_id

    def test_export_audit_trail_writes_jsonl(self, tmp_path: Any) -> None:
        """Audit trail export writes one JSON object per line."""
        gov = TealTigerGovernanceComponent()
        first = gov.run(text="First")["decision"]
        second = gov.run(text="Second")["decision"]
        export_path = tmp_path / "audit.jsonl"

        count = gov.export_audit_trail(str(export_path))

        lines = export_path.read_text(encoding="utf-8").splitlines()
        exported = [json.loads(line) for line in lines]

        assert count == 2
        assert len(lines) == 2
        assert exported == [entry.to_dict() for entry in gov.audit_trail]
        assert exported[0]["correlation_id"] == first["correlation_id"]
        assert exported[1]["correlation_id"] == second["correlation_id"]

    def test_reset_clears_state(self) -> None:
        """Reset clears cost, audit trail, and evaluation count."""
        gov = TealTigerGovernanceComponent()
        gov.run(text="Some text")
        gov.run(text="More text")

        gov.reset()

        assert gov.cumulative_cost == 0.0
        assert gov.evaluation_count == 0
        assert len(gov.audit_trail) == 0


# ─── PII Detection Tests ────────────────────────────────────────────────────


class TestPIIDetection:
    """Tests for PII detection in zero-config mode."""

    def test_detects_email(self) -> None:
        """Detects email addresses in input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Contact me at john.doe@example.com please")

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "email" for p in pii)

    def test_detects_ssn(self) -> None:
        """Detects SSN patterns in input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="My SSN is 123-45-6789")

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "ssn" for p in pii)

    def test_detects_credit_card(self) -> None:
        """Detects credit card numbers in input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Card: 4111-1111-1111-1111")

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "credit_card" for p in pii)

    def test_detects_phone(self) -> None:
        """Detects US phone numbers in input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Call me at (555) 123-4567")

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == "phone_us" for p in pii)

    @pytest.mark.parametrize(
        ("text", "pii_type"),
        [
            ("London office: +44 20 7946 0958", "phone_uk"),
            ("Berlin office: +49 30 12345678", "phone_eu"),
            ("Paris office: +33 1 23 45 67 89", "phone_eu"),
            ("Mumbai office: +91 98765 43210", "phone_in"),
        ],
    )
    def test_detects_international_phone(self, text: str, pii_type: str) -> None:
        """Detects UK, EU, and India phone numbers in input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text=text)

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        assert any(p["type"] == pii_type for p in pii)

    def test_detects_multiple_pii(self) -> None:
        """Detects multiple PII types in a single input."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(
            text="Email: test@example.com, SSN: 123-45-6789, Card: 4111 1111 1111 1111"
        )

        pii = result["decision"]["pii_detected"]
        types = {p["type"] for p in pii}
        assert "email" in types
        assert "ssn" in types

    def test_pii_still_allows_in_observe_mode(self) -> None:
        """PII detection does not block in observe mode."""
        gov = TealTigerGovernanceComponent()
        text = "My SSN is 123-45-6789"
        result = gov.run(text=text)

        assert result["text"] == text  # passthrough
        assert result["decision"]["action"] == "ALLOW"
        assert "PII_DETECTED" in result["decision"]["reason_codes"]

    def test_pii_risk_score(self) -> None:
        """PII findings increase risk score."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="SSN: 123-45-6789, Email: a@b.com")

        assert result["decision"]["risk_score"] > 0

    def test_no_pii_zero_risk(self) -> None:
        """Clean text has zero risk score."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Hello, how can I help you today?")

        assert result["decision"]["risk_score"] == 0
        assert len(result["decision"]["pii_detected"]) == 0

    def test_pii_redaction_format(self) -> None:
        """PII findings include properly redacted values."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Email: test@example.com")

        pii = result["decision"]["pii_detected"]
        assert len(pii) >= 1
        email_finding = next(p for p in pii if p["type"] == "email")
        # Redacted: first 2 + masked + last 2
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
        """TealEngine ALLOW decision passes text through."""
        engine = self._make_engine(
            {"action": "ALLOW", "reason": "Compliant", "reason_codes": ["OK"], "risk_score": 0}
        )
        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE")
        result = gov.run(text="Hello")

        assert result["text"] == "Hello"
        assert result["decision"]["action"] == "ALLOW"

    def test_engine_deny_raises(self) -> None:
        """TealEngine DENY in ENFORCE mode raises GovernanceDenyError."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Cost limit exceeded",
                "reason_codes": ["COST_LIMIT"],
                "risk_score": 80,
            }
        )
        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE", raise_on_deny=True)

        with pytest.raises(GovernanceDenyError) as exc_info:
            gov.run(text="Expensive request")

        assert "Cost limit exceeded" in str(exc_info.value)
        assert exc_info.value.decision["action"] == "DENY"

    def test_engine_deny_returns_empty(self) -> None:
        """TealEngine DENY with raise_on_deny=False returns empty text."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Blocked",
                "reason_codes": ["BLOCKED"],
                "risk_score": 90,
            }
        )
        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE", raise_on_deny=False)
        result = gov.run(text="Should be blocked")

        assert result["text"] == ""
        assert result["decision"]["action"] == "DENY"

    def test_engine_deny_in_monitor_mode_allows(self) -> None:
        """TealEngine DENY in MONITOR mode still allows text through."""
        engine = self._make_engine(
            {
                "action": "DENY",
                "reason": "Would be blocked",
                "reason_codes": ["WOULD_BLOCK"],
                "risk_score": 70,
            }
        )
        gov = TealTigerGovernanceComponent(engine=engine, mode="MONITOR")
        result = gov.run(text="Monitored text")

        # MONITOR mode: decision is DENY but text passes through
        assert result["text"] == "Monitored text"

    def test_engine_error_fail_closed_enforce(self) -> None:
        """Engine error in ENFORCE mode results in DENY (fail-closed)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE", raise_on_deny=True)

        with pytest.raises(GovernanceDenyError) as exc_info:
            gov.run(text="Test")

        assert "FAIL_CLOSED" in exc_info.value.decision["reason_codes"]

    def test_engine_error_fail_open_monitor(self) -> None:
        """Engine error in MONITOR mode allows through (fail-open)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection timeout")

        gov = TealTigerGovernanceComponent(engine=engine, mode="MONITOR")
        result = gov.run(text="Test")

        assert result["text"] == "Test"
        assert "ENGINE_ERROR" in result["decision"]["reason_codes"]
        assert "FAIL_OPEN" in result["decision"]["reason_codes"]

    def test_engine_receives_context(self) -> None:
        """TealEngine receives proper context including framework info."""
        engine = self._make_engine(
            {"action": "ALLOW", "reason": "OK", "reason_codes": [], "risk_score": 0}
        )
        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE")
        gov.run(text="Check context")

        call_args = engine.evaluate.call_args
        request = call_args[1]["request"] if "request" in call_args[1] else call_args[0][0]

        if isinstance(request, dict):
            assert request["context"]["framework"] == "haystack"


# ─── Audit Entry Tests ───────────────────────────────────────────────────────


class TestAuditEntry:
    """Tests for structured audit entries."""

    def test_audit_entry_fields(self) -> None:
        """Audit entry contains all required fields."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Audit test")

        decision = result["decision"]
        required_fields = [
            "correlation_id",
            "timestamp_ms",
            "action",
            "mode",
            "reason",
            "reason_codes",
            "risk_score",
            "pii_detected",
            "cost_tracked",
            "cumulative_cost",
            "evaluation_time_ms",
            "metadata",
        ]
        for field_name in required_fields:
            assert field_name in decision, f"Missing field: {field_name}"

    def test_audit_metadata_includes_agent_id(self) -> None:
        """Audit metadata includes the agent ID."""
        gov = TealTigerGovernanceComponent(agent_id="test-agent-123")
        result = gov.run(text="Meta test")

        assert result["decision"]["metadata"]["agent_id"] == "test-agent-123"

    def test_audit_metadata_includes_evaluation_number(self) -> None:
        """Audit metadata tracks evaluation number."""
        gov = TealTigerGovernanceComponent()
        gov.run(text="First")
        result = gov.run(text="Second")

        assert result["decision"]["metadata"]["evaluation_number"] == 2

    def test_audit_entry_serializable(self) -> None:
        """Audit entry can be serialized to JSON-compatible dict."""
        import json

        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Serialize test with email@example.com")

        # Should not raise
        serialized = json.dumps(result["decision"])
        assert isinstance(serialized, str)

    def test_timestamp_is_unix_ms(self) -> None:
        """Timestamp is in Unix milliseconds."""
        import time

        gov = TealTigerGovernanceComponent()
        before = time.time() * 1000
        result = gov.run(text="Time test")
        after = time.time() * 1000

        ts = result["decision"]["timestamp_ms"]
        assert before <= ts <= after


# ─── Component Interface Tests ───────────────────────────────────────────────


class TestComponentInterface:
    """Tests for Haystack component interface compliance."""

    def test_has_run_method(self) -> None:
        """Component has a run method."""
        gov = TealTigerGovernanceComponent()
        assert hasattr(gov, "run")
        assert callable(gov.run)

    def test_output_types(self) -> None:
        """Component declares text and decision output types."""
        gov = TealTigerGovernanceComponent()
        result = gov.run(text="Interface test")

        assert "text" in result
        assert "decision" in result
        assert isinstance(result["text"], str)
        assert isinstance(result["decision"], dict)

    def test_custom_cost_per_1k_tokens(self) -> None:
        """Custom cost_per_1k_tokens is respected."""
        gov = TealTigerGovernanceComponent(cost_per_1k_tokens=0.05)
        gov.run(text="A" * 4000)  # ~1000 tokens

        # With 0.05/1k tokens and ~1000 tokens, cost should be ~0.05
        assert gov.cumulative_cost > 0.01
