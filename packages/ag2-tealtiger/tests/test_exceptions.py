"""Unit tests for ag2_tealtiger.exceptions module.

Validates the exception hierarchy for the ag2-tealtiger governance adapter:
- AG2TealTigerError base exception
- GovernanceDenyError with decision dict
- DecisionExpiredError with decision_id and expired_at
- BudgetExceededError extending GovernanceDenyError
- AgentFrozenError extending GovernanceDenyError
- EscalationPendingError with escalation_receipt
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

# Ensure package is importable
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ag2_tealtiger.exceptions import (
    AG2TealTigerError,
    AgentFrozenError,
    BudgetExceededError,
    DecisionExpiredError,
    EscalationPendingError,
    GovernanceDenyError,
)
from ag2_tealtiger.types import EscalationReceipt


class TestAG2TealTigerError:
    """Tests for the base exception class."""

    def test_can_be_raised(self) -> None:
        with pytest.raises(AG2TealTigerError, match="something went wrong"):
            raise AG2TealTigerError("something went wrong")

    def test_inherits_from_exception(self) -> None:
        assert issubclass(AG2TealTigerError, Exception)

    def test_empty_message(self) -> None:
        e = AG2TealTigerError()
        assert str(e) == ""


class TestGovernanceDenyError:
    """Tests for GovernanceDenyError with decision dict."""

    def test_stores_decision_dict(self) -> None:
        decision = {"reason": "Policy violation", "risk_score": 85, "reason_codes": ["BLOCKED"]}
        e = GovernanceDenyError(decision)
        assert e.decision == decision

    def test_message_includes_reason(self) -> None:
        decision = {"reason": "Tool not allowed", "risk_score": 90}
        e = GovernanceDenyError(decision)
        assert "Tool not allowed" in str(e)

    def test_message_default_when_no_reason(self) -> None:
        decision = {"risk_score": 50}
        e = GovernanceDenyError(decision)
        assert "Policy violation" in str(e)

    def test_inherits_from_base(self) -> None:
        assert issubclass(GovernanceDenyError, AG2TealTigerError)

    def test_catchable_as_base(self) -> None:
        decision = {"reason": "test"}
        with pytest.raises(AG2TealTigerError):
            raise GovernanceDenyError(decision)


class TestDecisionExpiredError:
    """Tests for DecisionExpiredError with decision_id and expired_at."""

    def test_stores_decision_id(self) -> None:
        e = DecisionExpiredError("dec-abc-123", "2026-03-15T10:30:00Z")
        assert e.decision_id == "dec-abc-123"

    def test_stores_expired_at(self) -> None:
        e = DecisionExpiredError("dec-abc-123", "2026-03-15T10:30:00Z")
        assert e.expired_at == "2026-03-15T10:30:00Z"

    def test_message_includes_both_fields(self) -> None:
        e = DecisionExpiredError("dec-xyz", "2026-01-01T00:00:00Z")
        msg = str(e)
        assert "dec-xyz" in msg
        assert "expired at" in msg
        assert "2026-01-01T00:00:00Z" in msg

    def test_inherits_from_base(self) -> None:
        assert issubclass(DecisionExpiredError, AG2TealTigerError)

    def test_not_a_governance_deny_error(self) -> None:
        assert not issubclass(DecisionExpiredError, GovernanceDenyError)


class TestBudgetExceededError:
    """Tests for BudgetExceededError extending GovernanceDenyError."""

    def test_inherits_from_governance_deny(self) -> None:
        assert issubclass(BudgetExceededError, GovernanceDenyError)

    def test_inherits_from_base(self) -> None:
        assert issubclass(BudgetExceededError, AG2TealTigerError)

    def test_stores_decision(self) -> None:
        decision = {"reason": "Budget limit exceeded", "risk_score": 95, "reason_codes": ["BUDGET_EXCEEDED"]}
        e = BudgetExceededError(decision)
        assert e.decision == decision

    def test_catchable_as_governance_deny(self) -> None:
        decision = {"reason": "Over budget"}
        with pytest.raises(GovernanceDenyError):
            raise BudgetExceededError(decision)


class TestAgentFrozenError:
    """Tests for AgentFrozenError extending GovernanceDenyError."""

    def test_inherits_from_governance_deny(self) -> None:
        assert issubclass(AgentFrozenError, GovernanceDenyError)

    def test_inherits_from_base(self) -> None:
        assert issubclass(AgentFrozenError, AG2TealTigerError)

    def test_stores_decision(self) -> None:
        decision = {"reason": "Agent is frozen", "risk_score": 100, "reason_codes": ["AGENT_FROZEN"]}
        e = AgentFrozenError(decision)
        assert e.decision == decision

    def test_catchable_as_governance_deny(self) -> None:
        decision = {"reason": "Frozen"}
        with pytest.raises(GovernanceDenyError):
            raise AgentFrozenError(decision)


class TestEscalationPendingError:
    """Tests for EscalationPendingError with escalation_receipt field."""

    @pytest.fixture
    def sample_receipt(self) -> EscalationReceipt:
        return EscalationReceipt(
            decision_id="esc-456",
            agent_id="agent-1",
            tool_name="file_write",
            tool_arguments={"path": "/tmp/test", "content": "hello"},
            conversation_id="conv-789",
            turn_id=3,
            group_chat_id="gc-001",
            risk_score=75,
            reason_codes=["HIGH_RISK_TOOL", "FILESYSTEM_ACCESS"],
            human_readable_summary="Agent wants to write to filesystem",
            policy_context={"policy": "fs_access", "version": "1.0"},
            issued_at=datetime(2026, 3, 15, 10, 0, 0),
            expires_at=None,
        )

    def test_stores_escalation_receipt(self, sample_receipt: EscalationReceipt) -> None:
        e = EscalationPendingError(sample_receipt)
        assert e.escalation_receipt is sample_receipt

    def test_message_includes_decision_id(self, sample_receipt: EscalationReceipt) -> None:
        e = EscalationPendingError(sample_receipt)
        assert "esc-456" in str(e)

    def test_message_includes_refer(self, sample_receipt: EscalationReceipt) -> None:
        e = EscalationPendingError(sample_receipt)
        assert "REFER" in str(e)

    def test_message_includes_suspended(self, sample_receipt: EscalationReceipt) -> None:
        e = EscalationPendingError(sample_receipt)
        assert "suspended" in str(e).lower() or "Action suspended" in str(e)

    def test_inherits_from_base(self) -> None:
        assert issubclass(EscalationPendingError, AG2TealTigerError)

    def test_not_a_governance_deny_error(self) -> None:
        assert not issubclass(EscalationPendingError, GovernanceDenyError)


class TestExceptionHierarchy:
    """Tests verifying the overall inheritance hierarchy."""

    def test_all_exceptions_derive_from_base(self) -> None:
        for exc_class in [
            GovernanceDenyError,
            DecisionExpiredError,
            BudgetExceededError,
            AgentFrozenError,
            EscalationPendingError,
        ]:
            assert issubclass(exc_class, AG2TealTigerError), f"{exc_class.__name__} must inherit AG2TealTigerError"

    def test_budget_and_frozen_are_deny_subtypes(self) -> None:
        assert issubclass(BudgetExceededError, GovernanceDenyError)
        assert issubclass(AgentFrozenError, GovernanceDenyError)

    def test_expired_and_escalation_are_not_deny_subtypes(self) -> None:
        assert not issubclass(DecisionExpiredError, GovernanceDenyError)
        assert not issubclass(EscalationPendingError, GovernanceDenyError)

    def test_catch_all_with_base_exception(self) -> None:
        """Verify that catching AG2TealTigerError catches all subtypes."""
        decision = {"reason": "test"}
        receipt = EscalationReceipt(
            decision_id="x",
            agent_id="a",
            tool_name="t",
            tool_arguments={},
            conversation_id="c",
            turn_id=1,
            group_chat_id=None,
            risk_score=50,
            reason_codes=["TEST"],
            human_readable_summary="test",
            policy_context={},
            issued_at=datetime.now(),
            expires_at=None,
        )

        exceptions_to_test = [
            AG2TealTigerError("base"),
            GovernanceDenyError(decision),
            DecisionExpiredError("id", "time"),
            BudgetExceededError(decision),
            AgentFrozenError(decision),
            EscalationPendingError(receipt),
        ]

        for exc in exceptions_to_test:
            with pytest.raises(AG2TealTigerError):
                raise exc
