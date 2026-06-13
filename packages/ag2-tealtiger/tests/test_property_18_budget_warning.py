"""Property-based test: Budget Warning at 80% (Property 18).

# Feature: ag2-tealtiger-adapter, Property 18: Budget Warning at 80%

Verifies that when an agent's cumulative_cost crosses 80% of its budget_limit,
the system emits a BUDGET_WARNING without blocking the triggering operation.
The warning is emitted exactly once per budget cycle (resets after reset()).

**Validates: Requirements 18.5**
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from ag2_tealtiger.budget_manager import BudgetStateManager

from tests.strategies import agent_ids, budget_limits


# ── Strategies ────────────────────────────────────────────────────────────────

# Budget limits constrained to reasonable positive values
_budget_limits = st.floats(min_value=1.0, max_value=10000.0, allow_nan=False, allow_infinity=False)

# Cost fractions relative to budget limit
_sub_threshold_fraction = st.floats(
    min_value=0.0, max_value=0.79, allow_nan=False, allow_infinity=False
)

_crossing_fraction = st.floats(
    min_value=0.80, max_value=1.5, allow_nan=False, allow_infinity=False
)


@pytest.mark.property
class TestBudgetWarningAt80Percent:
    """Property 18: Budget Warning at 80%.

    *For any* agent whose cumulative_cost crosses 80% of its budget_limit,
    the system SHALL emit a BUDGET_WARNING audit entry without blocking
    the triggering operation.

    **Validates: Requirements 18.5**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
        crossing_fraction=_crossing_fraction,
    )
    def test_warning_emitted_when_crossing_80_percent(
        self,
        agent_id: str,
        budget_limit: float,
        crossing_fraction: float,
    ) -> None:
        """Warning is emitted when cumulative cost crosses 80% of limit.

        For any agent with a budget limit, when their cumulative cost
        reaches or exceeds 80% of the limit, a warning flag is set
        in the BudgetCheckResult.
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        # Add cost that crosses the 80% threshold in a single call
        cost = budget_limit * crossing_fraction
        result = mgr.track_cost(agent_id, cost)

        assert result.warning is True, (
            f"Expected warning=True when cost ({cost:.4f}) crosses "
            f"80% threshold ({budget_limit * 0.80:.4f}) of limit ({budget_limit:.4f})"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
        sub_fraction=_sub_threshold_fraction,
    )
    def test_no_warning_below_80_percent(
        self,
        agent_id: str,
        budget_limit: float,
        sub_fraction: float,
    ) -> None:
        """No warning when cumulative cost is below 80% of limit.

        For any cost that keeps the agent below the 80% threshold,
        the warning flag remains False.
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        cost = budget_limit * sub_fraction
        # Ensure we're strictly below threshold due to floating point
        assume(cost < budget_limit * 0.80)

        result = mgr.track_cost(agent_id, cost)

        assert result.warning is False, (
            f"Expected warning=False when cost ({cost:.4f}) is below "
            f"80% threshold ({budget_limit * 0.80:.4f}) of limit ({budget_limit:.4f})"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
        crossing_fraction=_crossing_fraction,
    )
    def test_warning_does_not_block_operation(
        self,
        agent_id: str,
        budget_limit: float,
        crossing_fraction: float,
    ) -> None:
        """Warning does not block the triggering operation.

        When the 80% threshold is crossed, the track_cost call still
        succeeds — the cost is accumulated and a result is returned.
        The warning is informational, not a denial.
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        cost = budget_limit * crossing_fraction
        result = mgr.track_cost(agent_id, cost)

        # The operation completed — cost was tracked
        state = mgr.get_state(agent_id)
        assert state.current_spend == cost, (
            f"Cost not tracked: expected {cost:.4f}, got {state.current_spend:.4f}"
        )

        # Budget check result is returned (operation not blocked)
        assert result is not None
        assert result.remaining is not None

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
    )
    def test_warning_emitted_only_once_per_cycle(
        self,
        agent_id: str,
        budget_limit: float,
    ) -> None:
        """Warning is emitted only once per budget cycle.

        After the first crossing of 80%, subsequent track_cost calls
        do NOT re-emit the warning (warning=False on subsequent calls).
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        # First call crosses 80%
        cost_to_cross = budget_limit * 0.85
        result1 = mgr.track_cost(agent_id, cost_to_cross)
        assert result1.warning is True, "First crossing should emit warning"

        # Subsequent calls should NOT re-emit warning
        small_cost = budget_limit * 0.05
        result2 = mgr.track_cost(agent_id, small_cost)
        assert result2.warning is False, (
            "Warning should only be emitted once per cycle"
        )

        # Even another call — still no re-emission
        result3 = mgr.track_cost(agent_id, small_cost)
        assert result3.warning is False, (
            "Warning should not re-emit on third call"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
    )
    def test_warning_re_emits_after_reset(
        self,
        agent_id: str,
        budget_limit: float,
    ) -> None:
        """Warning can be emitted again after a budget reset.

        The reset() operation clears the warning_emitted flag,
        allowing the warning to fire again when the threshold
        is crossed in the next budget cycle.
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        # Cross 80% — warning emitted
        cost_to_cross = budget_limit * 0.85
        result1 = mgr.track_cost(agent_id, cost_to_cross)
        assert result1.warning is True

        # Reset clears the cycle
        mgr.reset(agent_id)
        state = mgr.get_state(agent_id)
        assert state.warning_emitted is False, "Reset should clear warning flag"

        # Cross 80% again — warning re-emitted
        result2 = mgr.track_cost(agent_id, cost_to_cross)
        assert result2.warning is True, (
            "Warning should re-emit after reset when threshold crossed again"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
        num_steps=st.integers(min_value=2, max_value=10),
    )
    def test_incremental_crossing_triggers_warning(
        self,
        agent_id: str,
        budget_limit: float,
        num_steps: int,
    ) -> None:
        """Warning triggers when 80% is crossed incrementally.

        For any sequence of small cost increments that eventually
        cross the 80% threshold, the warning is emitted exactly
        on the call that crosses the threshold.
        """
        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, budget_limit)

        threshold = budget_limit * 0.80
        # Divide cost to cross threshold across num_steps
        step_cost = (threshold + budget_limit * 0.01) / num_steps

        warning_seen = False
        warning_count = 0

        for i in range(num_steps):
            result = mgr.track_cost(agent_id, step_cost)
            if result.warning:
                warning_seen = True
                warning_count += 1

        assert warning_seen is True, (
            f"Warning should be emitted when crossing 80% threshold "
            f"({threshold:.4f}) with incremental steps"
        )
        assert warning_count == 1, (
            f"Warning should be emitted exactly once, got {warning_count}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        budget_limit=_budget_limits,
    )
    def test_warning_callback_invoked_at_threshold(
        self,
        agent_id: str,
        budget_limit: float,
    ) -> None:
        """The on_budget_warning callback is invoked when threshold crossed.

        When a callback is configured, it receives the correct agent_id,
        current_spend, and budget_limit when the 80% threshold is crossed.
        """
        warnings: list[tuple[str, float, float]] = []

        def on_warning(aid: str, spend: float, limit: float) -> None:
            warnings.append((aid, spend, limit))

        mgr = BudgetStateManager(on_budget_warning=on_warning)
        mgr.set_limit(agent_id, budget_limit)

        # Cross the threshold
        cost = budget_limit * 0.85
        mgr.track_cost(agent_id, cost)

        assert len(warnings) == 1, (
            f"Expected exactly 1 warning callback, got {len(warnings)}"
        )
        assert warnings[0][0] == agent_id
        assert warnings[0][1] == cost  # current_spend
        assert warnings[0][2] == budget_limit
