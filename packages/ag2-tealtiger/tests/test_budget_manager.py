"""Unit tests for BudgetStateManager.

Tests cover:
- Per-agent cost accumulation
- Budget limit enforcement
- 80% threshold warning emission
- remaining_budget invariant
- Reset behavior
- Edge cases (no limit, zero cost, multiple agents)
"""

from __future__ import annotations

import pytest

from ag2_tealtiger.budget_manager import BudgetCheckResult, BudgetStateManager
from ag2_tealtiger.types import BudgetState


class TestTrackCost:
    """Tests for track_cost method."""

    def test_accumulates_cost(self) -> None:
        """Cost is accumulated across multiple track_cost calls."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 2.0)
        mgr.track_cost("agent-1", 3.0)
        state = mgr.get_state("agent-1")
        assert state.current_spend == 5.0

    def test_returns_budget_check_result(self) -> None:
        """track_cost returns a BudgetCheckResult."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        result = mgr.track_cost("agent-1", 2.0)
        assert isinstance(result, BudgetCheckResult)
        assert result.exceeded is False
        assert result.remaining == 8.0
        assert result.warning is False

    def test_negative_cost_raises(self) -> None:
        """Negative cost values are rejected."""
        mgr = BudgetStateManager()
        with pytest.raises(ValueError, match="non-negative"):
            mgr.track_cost("agent-1", -1.0)

    def test_zero_cost_is_valid(self) -> None:
        """Zero cost is a valid no-op."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        result = mgr.track_cost("agent-1", 0.0)
        assert result.exceeded is False
        assert result.remaining == 10.0

    def test_no_limit_configured(self) -> None:
        """Track cost works even without a budget limit configured."""
        mgr = BudgetStateManager()
        result = mgr.track_cost("agent-1", 5.0)
        assert result.exceeded is False
        assert result.remaining is None
        assert result.warning is False

    def test_exceeded_detection(self) -> None:
        """Budget exceeded is detected when spend > limit."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        result = mgr.track_cost("agent-1", 11.0)
        assert result.exceeded is True
        assert result.remaining == -1.0


class TestBudgetWarning:
    """Tests for the 80% warning threshold."""

    def test_warning_emitted_at_80_percent(self) -> None:
        """Warning is emitted when cost crosses 80% of limit."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        # 7.9 is under 80% (8.0)
        result = mgr.track_cost("agent-1", 7.9)
        assert result.warning is False
        # 0.2 pushes total to 8.1, crossing 80%
        result = mgr.track_cost("agent-1", 0.2)
        assert result.warning is True

    def test_warning_emitted_only_once(self) -> None:
        """Warning is only emitted once per agent (not on subsequent calls)."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 8.5)  # Triggers warning
        result = mgr.track_cost("agent-1", 0.5)
        assert result.warning is False  # Already emitted

    def test_warning_callback_invoked(self) -> None:
        """Callback is invoked when warning threshold is crossed."""
        warnings: list[tuple[str, float, float]] = []

        def on_warning(agent_id: str, spend: float, limit: float) -> None:
            warnings.append((agent_id, spend, limit))

        mgr = BudgetStateManager(on_budget_warning=on_warning)
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 9.0)
        assert len(warnings) == 1
        assert warnings[0] == ("agent-1", 9.0, 10.0)

    def test_warning_not_triggered_without_limit(self) -> None:
        """No warning is emitted when no limit is configured."""
        warnings: list[tuple[str, float, float]] = []

        def on_warning(agent_id: str, spend: float, limit: float) -> None:
            warnings.append((agent_id, spend, limit))

        mgr = BudgetStateManager(on_budget_warning=on_warning)
        mgr.track_cost("agent-1", 100.0)
        assert len(warnings) == 0

    def test_exact_80_percent_triggers_warning(self) -> None:
        """Exactly 80% of the limit triggers the warning."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        result = mgr.track_cost("agent-1", 8.0)
        assert result.warning is True


class TestGetState:
    """Tests for get_state method."""

    def test_new_agent_default_state(self) -> None:
        """New agent returns default BudgetState."""
        mgr = BudgetStateManager()
        state = mgr.get_state("new-agent")
        assert state.agent_id == "new-agent"
        assert state.budget_limit is None
        assert state.current_spend == 0.0
        assert state.remaining_budget is None
        assert state.warning_emitted is False

    def test_remaining_budget_invariant(self) -> None:
        """remaining_budget = budget_limit - current_spend."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 20.0)
        mgr.track_cost("agent-1", 7.5)
        state = mgr.get_state("agent-1")
        assert state.remaining_budget == 12.5
        assert state.remaining_budget == state.budget_limit - state.current_spend

    def test_returns_budget_state_type(self) -> None:
        """get_state returns a BudgetState dataclass."""
        mgr = BudgetStateManager()
        state = mgr.get_state("agent-1")
        assert isinstance(state, BudgetState)


class TestCheckBudget:
    """Tests for check_budget method."""

    def test_within_budget(self) -> None:
        """Agent within budget returns exceeded=False."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 5.0)
        result = mgr.check_budget("agent-1")
        assert result.exceeded is False
        assert result.remaining == 5.0

    def test_exceeded_budget(self) -> None:
        """Agent over budget returns exceeded=True."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 15.0)
        result = mgr.check_budget("agent-1")
        assert result.exceeded is True
        assert result.remaining == -5.0

    def test_no_limit_never_exceeded(self) -> None:
        """Without a limit, budget is never exceeded."""
        mgr = BudgetStateManager()
        mgr.track_cost("agent-1", 1000.0)
        result = mgr.check_budget("agent-1")
        assert result.exceeded is False
        assert result.remaining is None

    def test_does_not_modify_state(self) -> None:
        """check_budget is a read-only operation."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 5.0)
        state_before = mgr.get_state("agent-1")
        mgr.check_budget("agent-1")
        state_after = mgr.get_state("agent-1")
        assert state_before.current_spend == state_after.current_spend

    def test_reports_warning_status(self) -> None:
        """check_budget reports whether warning was previously emitted."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        result = mgr.check_budget("agent-1")
        assert result.warning is False
        mgr.track_cost("agent-1", 9.0)  # Triggers warning
        result = mgr.check_budget("agent-1")
        assert result.warning is True


class TestSetLimit:
    """Tests for set_limit method."""

    def test_sets_budget_limit(self) -> None:
        """set_limit configures the budget limit for an agent."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 50.0)
        state = mgr.get_state("agent-1")
        assert state.budget_limit == 50.0
        assert state.remaining_budget == 50.0

    def test_updates_remaining_budget(self) -> None:
        """Changing limit updates remaining_budget correctly."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 20.0)
        mgr.track_cost("agent-1", 5.0)
        mgr.set_limit("agent-1", 30.0)
        state = mgr.get_state("agent-1")
        assert state.budget_limit == 30.0
        assert state.remaining_budget == 25.0

    def test_invalid_limit_raises(self) -> None:
        """Non-positive limits are rejected."""
        mgr = BudgetStateManager()
        with pytest.raises(ValueError, match="positive"):
            mgr.set_limit("agent-1", 0.0)
        with pytest.raises(ValueError, match="positive"):
            mgr.set_limit("agent-1", -5.0)

    def test_lowering_limit_triggers_warning(self) -> None:
        """Lowering limit below 80% of current spend triggers warning."""
        warnings: list[tuple[str, float, float]] = []

        def on_warning(agent_id: str, spend: float, limit: float) -> None:
            warnings.append((agent_id, spend, limit))

        mgr = BudgetStateManager(on_budget_warning=on_warning)
        mgr.set_limit("agent-1", 100.0)
        mgr.track_cost("agent-1", 9.0)  # 9% of 100, no warning
        assert len(warnings) == 0
        mgr.set_limit("agent-1", 10.0)  # Now 9.0 is 90% of 10.0
        assert len(warnings) == 1


class TestReset:
    """Tests for reset method."""

    def test_resets_spend_to_zero(self) -> None:
        """reset clears current_spend to zero."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 5.0)
        mgr.reset("agent-1")
        state = mgr.get_state("agent-1")
        assert state.current_spend == 0.0

    def test_preserves_budget_limit(self) -> None:
        """reset preserves the configured budget limit."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 5.0)
        mgr.reset("agent-1")
        state = mgr.get_state("agent-1")
        assert state.budget_limit == 10.0
        assert state.remaining_budget == 10.0

    def test_resets_warning_flag(self) -> None:
        """reset clears the warning_emitted flag."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 9.0)  # Triggers warning
        state = mgr.get_state("agent-1")
        assert state.warning_emitted is True
        mgr.reset("agent-1")
        state = mgr.get_state("agent-1")
        assert state.warning_emitted is False

    def test_warning_can_re_trigger_after_reset(self) -> None:
        """After reset, the warning can be emitted again."""
        warnings: list[tuple[str, float, float]] = []

        def on_warning(agent_id: str, spend: float, limit: float) -> None:
            warnings.append((agent_id, spend, limit))

        mgr = BudgetStateManager(on_budget_warning=on_warning)
        mgr.set_limit("agent-1", 10.0)
        mgr.track_cost("agent-1", 9.0)
        assert len(warnings) == 1
        mgr.reset("agent-1")
        mgr.track_cost("agent-1", 8.5)
        assert len(warnings) == 2

    def test_reset_nonexistent_agent(self) -> None:
        """Resetting an agent that hasn't been tracked creates default state."""
        mgr = BudgetStateManager()
        mgr.reset("new-agent")
        state = mgr.get_state("new-agent")
        assert state.current_spend == 0.0
        assert state.budget_limit is None


class TestMultiAgentIsolation:
    """Tests for per-agent isolation."""

    def test_independent_cost_tracking(self) -> None:
        """Each agent tracks cost independently."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-a", 10.0)
        mgr.set_limit("agent-b", 20.0)
        mgr.track_cost("agent-a", 5.0)
        mgr.track_cost("agent-b", 15.0)
        assert mgr.get_state("agent-a").current_spend == 5.0
        assert mgr.get_state("agent-b").current_spend == 15.0

    def test_independent_budget_limits(self) -> None:
        """Each agent has its own budget limit."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-a", 10.0)
        mgr.set_limit("agent-b", 100.0)
        mgr.track_cost("agent-a", 11.0)
        mgr.track_cost("agent-b", 11.0)
        assert mgr.check_budget("agent-a").exceeded is True
        assert mgr.check_budget("agent-b").exceeded is False

    def test_independent_warning_emission(self) -> None:
        """Warnings are tracked independently per agent."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-a", 10.0)
        mgr.set_limit("agent-b", 10.0)
        result_a = mgr.track_cost("agent-a", 9.0)
        result_b = mgr.track_cost("agent-b", 3.0)
        assert result_a.warning is True
        assert result_b.warning is False

    def test_reset_one_does_not_affect_other(self) -> None:
        """Resetting one agent doesn't affect another."""
        mgr = BudgetStateManager()
        mgr.set_limit("agent-a", 10.0)
        mgr.set_limit("agent-b", 10.0)
        mgr.track_cost("agent-a", 5.0)
        mgr.track_cost("agent-b", 7.0)
        mgr.reset("agent-a")
        assert mgr.get_state("agent-a").current_spend == 0.0
        assert mgr.get_state("agent-b").current_spend == 7.0
