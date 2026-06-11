"""Tests for TealTigerGuard budget integration (task 6.7).

Validates:
- Budget check before tool call evaluation via BudgetStateManager
- Deny with "BUDGET_EXCEEDED" when limit exceeded in ENFORCE mode
- Log warning and allow in MONITOR mode when budget exceeded
- Track cost after tool execution
- Expose budget management methods: set_budget, get_budget_state, reset_budget

Requirements: 18.1, 18.2, 18.3, 18.6, 18.7, 18.8
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    GovernanceAction,
    GovernanceMode,
    ActionKind,
    BudgetState,
)


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for budget integration tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


class _MockTealEngine:
    """Mock TealEngine that returns ALLOW by default."""

    def __init__(self, action: str = "ALLOW") -> None:
        self._action = action
        self.call_count = 0

    def evaluate(self, **kwargs: Any) -> dict[str, Any]:
        self.call_count += 1
        return {
            "action": self._action,
            "risk_score": 0,
            "reason_codes": [],
            "reason": "Mock decision",
        }


def _make_tool_call_message(
    tool_name: str = "run_code",
    arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a mock tool call message in AG2 format."""
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": f"call_{tool_name}_001",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": arguments if arguments is not None else {},
                },
            }
        ],
    }


def _invoke(
    guard: TealTigerGuard,
    agent: _MockAgent,
    messages: list[dict[str, Any]] | None = None,
) -> tuple[bool, str | dict[str, Any] | None]:
    """Invoke the guard's reply hook with standard params."""
    if messages is None:
        messages = [_make_tool_call_message()]
    sender = _MockAgent("user")
    return guard._reply_hook(
        recipient=agent, messages=messages, sender=sender, config=None
    )


# ── Tests: Budget Management Methods ─────────────────────────────────────────


class TestBudgetManagementMethods:
    """Test public budget management methods on TealTigerGuard."""

    def test_set_budget_configures_limit(self) -> None:
        """set_budget() delegates to BudgetStateManager.set_limit()."""
        guard = TealTigerGuard()
        guard.set_budget("agent-1", 10.0)

        state = guard.get_budget_state("agent-1")
        assert state.budget_limit == 10.0
        assert state.current_spend == 0.0
        assert state.remaining_budget == 10.0

    def test_set_budget_negative_raises_value_error(self) -> None:
        """set_budget() raises ValueError for non-positive limits."""
        guard = TealTigerGuard()
        with pytest.raises(ValueError):
            guard.set_budget("agent-1", -5.0)

    def test_set_budget_zero_raises_value_error(self) -> None:
        """set_budget() raises ValueError for zero limit."""
        guard = TealTigerGuard()
        with pytest.raises(ValueError):
            guard.set_budget("agent-1", 0.0)

    def test_get_budget_state_returns_budget_state(self) -> None:
        """get_budget_state() returns a BudgetState dataclass."""
        guard = TealTigerGuard()
        guard.set_budget("agent-1", 5.0)

        state = guard.get_budget_state("agent-1")
        assert isinstance(state, BudgetState)
        assert state.agent_id == "agent-1"
        assert state.budget_limit == 5.0

    def test_get_budget_state_no_limit_returns_none_budget(self) -> None:
        """get_budget_state() returns None for budget_limit when no limit set."""
        guard = TealTigerGuard()

        state = guard.get_budget_state("agent-1")
        assert state.budget_limit is None
        assert state.remaining_budget is None
        assert state.current_spend == 0.0

    def test_reset_budget_clears_spend(self) -> None:
        """reset_budget() resets current_spend to zero."""
        guard = TealTigerGuard()
        guard.set_budget("agent-1", 10.0)

        # Manually track some cost
        guard._budget_manager.track_cost("agent-1", 5.0)
        state = guard.get_budget_state("agent-1")
        assert state.current_spend == 5.0

        guard.reset_budget("agent-1")
        state = guard.get_budget_state("agent-1")
        assert state.current_spend == 0.0
        assert state.remaining_budget == 10.0

    def test_reset_budget_preserves_limit(self) -> None:
        """reset_budget() keeps the configured budget_limit."""
        guard = TealTigerGuard()
        guard.set_budget("agent-1", 15.0)
        guard._budget_manager.track_cost("agent-1", 10.0)

        guard.reset_budget("agent-1")
        state = guard.get_budget_state("agent-1")
        assert state.budget_limit == 15.0

    def test_reset_budget_records_audit_entry(self) -> None:
        """reset_budget() produces an audit entry with BUDGET_RESET reason code."""
        guard = TealTigerGuard()
        guard.set_budget("agent-1", 10.0)
        guard._budget_manager.track_cost("agent-1", 5.0)

        guard.reset_budget("agent-1")

        # Find the BUDGET_RESET audit entry
        reset_entries = [
            e for e in guard.audit_trail
            if "BUDGET_RESET" in e.reason_codes
        ]
        assert len(reset_entries) == 1
        entry = reset_entries[0]
        assert entry.action == GovernanceAction.ALLOW.value
        assert entry.action_kind == ActionKind.BUDGET_CHANGE.value
        assert entry.agent_id == "agent-1"


# ── Tests: Budget Check in Reply Hook — ENFORCE Mode ─────────────────────────


class TestBudgetCheckEnforceMode:
    """Test budget enforcement in the reply hook flow (ENFORCE mode)."""

    def test_budget_exceeded_denies_tool_call(self) -> None:
        """When budget is exceeded in ENFORCE mode, tool call is denied."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # Set a small budget and exceed it
        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)  # Exceed the limit

        # Invoke reply hook — should deny
        should_terminate, reply = _invoke(guard, agent)

        assert should_terminate is True
        assert reply is not None
        assert "BUDGET_EXCEEDED" in str(reply)

    def test_budget_exceeded_audit_entry_has_correct_reason_code(self) -> None:
        """Budget denial produces audit entry with BUDGET_EXCEEDED reason code."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        _invoke(guard, agent)

        # Find BUDGET_EXCEEDED audit entry
        budget_entries = [
            e for e in guard.audit_trail
            if "BUDGET_EXCEEDED" in e.reason_codes
        ]
        assert len(budget_entries) == 1
        entry = budget_entries[0]
        assert entry.action == GovernanceAction.DENY.value
        assert entry.agent_id == "coder"
        assert entry.risk_score == 80

    def test_budget_exceeded_does_not_call_engine(self) -> None:
        """When budget is exceeded, TealEngine.evaluate() is NOT called."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        _invoke(guard, agent)

        # Engine should not be invoked since budget check blocks first
        assert engine.call_count == 0

    def test_budget_not_exceeded_allows_through(self) -> None:
        """When budget has remaining room, tool call proceeds to engine evaluation."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 100.0)

        should_terminate, reply = _invoke(guard, agent)

        # Should allow through
        assert should_terminate is False
        assert reply is None
        # Engine was called
        assert engine.call_count == 1

    def test_no_budget_limit_allows_through(self) -> None:
        """When no budget limit is configured, all calls pass through."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # No set_budget call — no limit configured

        should_terminate, reply = _invoke(guard, agent)
        assert should_terminate is False
        assert reply is None
        assert engine.call_count == 1


# ── Tests: Budget Check in Reply Hook — MONITOR Mode ─────────────────────────


class TestBudgetCheckMonitorMode:
    """Test budget check behavior in MONITOR mode."""

    def test_budget_exceeded_allows_through_in_monitor(self) -> None:
        """When budget exceeded in MONITOR mode, log warning and allow."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        should_terminate, reply = _invoke(guard, agent)

        # Should allow through in MONITOR mode
        assert should_terminate is False
        assert reply is None
        # Engine should still be called
        assert engine.call_count == 1

    def test_budget_exceeded_allows_through_in_observe(self) -> None:
        """When budget exceeded in OBSERVE mode (no engine), allow through."""
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        should_terminate, reply = _invoke(guard, agent)

        # Should allow through in OBSERVE mode
        assert should_terminate is False
        assert reply is None


# ── Tests: Cost Tracking After Tool Execution ─────────────────────────────────


class TestCostTrackingAfterExecution:
    """Test that cost is tracked after allowed tool execution in policy mode."""

    def test_cost_tracked_after_allow_decision(self) -> None:
        """After ALLOW decision in policy mode, cost is tracked in BudgetStateManager."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 100.0)
        initial_spend = guard.get_budget_state("coder").current_spend

        _invoke(guard, agent)

        # Cost should have increased
        final_spend = guard.get_budget_state("coder").current_spend
        assert final_spend > initial_spend

    def test_cost_accumulates_across_multiple_calls(self) -> None:
        """Cost accumulates across multiple allowed tool calls."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 100.0)

        # Multiple calls
        _invoke(guard, agent)
        spend_after_1 = guard.get_budget_state("coder").current_spend

        _invoke(guard, agent)
        spend_after_2 = guard.get_budget_state("coder").current_spend

        _invoke(guard, agent)
        spend_after_3 = guard.get_budget_state("coder").current_spend

        assert spend_after_1 > 0
        assert spend_after_2 > spend_after_1
        assert spend_after_3 > spend_after_2

    def test_budget_warning_emitted_at_80_percent(self) -> None:
        """BUDGET_WARNING audit entry is emitted when 80% threshold is crossed."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # cost_per_1k_tokens = 0.002, estimated cost = 0.002/1000 * 50 = 0.0001 per call
        # Set budget so that 80% threshold is below the cost of one call
        # Budget = 0.0001, 80% threshold = 0.00008
        # After one call (cost = 0.0001), current_spend (0.0001) >= threshold (0.00008)
        guard.set_budget("coder", 0.0001)

        _invoke(guard, agent)

        # Check for BUDGET_WARNING in audit trail
        warning_entries = [
            e for e in guard.audit_trail
            if "BUDGET_WARNING" in e.reason_codes
        ]
        assert len(warning_entries) == 1
        assert warning_entries[0].action == GovernanceAction.ALLOW.value
        assert warning_entries[0].action_kind == ActionKind.BUDGET_CHANGE.value

    def test_cost_not_tracked_when_denied(self) -> None:
        """When tool call is denied (BUDGET_EXCEEDED), no additional cost is tracked."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)  # Exceed budget

        spend_before = guard.get_budget_state("coder").current_spend
        _invoke(guard, agent)  # Should be denied
        spend_after = guard.get_budget_state("coder").current_spend

        # Spend should not increase (tool was denied, not executed)
        assert spend_after == spend_before


# ── Tests: Budget and Freeze Interaction ──────────────────────────────────────


class TestBudgetFreezeInteraction:
    """Test interaction between budget checks and freeze kill switch."""

    def test_frozen_takes_priority_over_budget(self) -> None:
        """Frozen check happens before budget check — frozen agent gets AGENT_FROZEN."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # Both frozen and over-budget
        guard.freeze("coder")
        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        should_terminate, reply = _invoke(guard, agent)

        # Should get AGENT_FROZEN (not BUDGET_EXCEEDED)
        assert should_terminate is True
        assert "frozen" in str(reply).lower()

    def test_budget_reset_allows_subsequent_calls(self) -> None:
        """After reset_budget(), previously denied agent can make calls again."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        # First call should be denied
        should_terminate, _ = _invoke(guard, agent)
        assert should_terminate is True

        # Reset budget
        guard.reset_budget("coder")

        # Now should be allowed
        should_terminate, reply = _invoke(guard, agent)
        assert should_terminate is False
        assert reply is None


# ── Tests: Budget Denial Message Format ───────────────────────────────────────


class TestBudgetDenialMessage:
    """Test the denial message format for budget exceeded."""

    def test_denial_message_contains_budget_exceeded(self) -> None:
        """Denial message includes BUDGET_EXCEEDED in its content."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        _, reply = _invoke(guard, agent)

        assert "BUDGET_EXCEEDED" in str(reply)

    def test_denial_message_contains_governance_denial_prefix(self) -> None:
        """Denial message starts with [GOVERNANCE DENIAL] prefix."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        guard.set_budget("coder", 0.001)
        guard._budget_manager.track_cost("coder", 0.01)

        _, reply = _invoke(guard, agent)

        assert "[GOVERNANCE DENIAL]" in str(reply)
