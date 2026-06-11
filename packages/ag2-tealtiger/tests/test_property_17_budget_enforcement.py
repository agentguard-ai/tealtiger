"""Property-based test: Budget Enforcement Threshold (Property 17).

# Feature: ag2-tealtiger-adapter, Property 17: Budget Enforcement Threshold

*For any* agent whose cumulative_cost exceeds its configured budget_limit, all
subsequent tool calls SHALL be denied with reason_code "BUDGET_EXCEEDED", and
budget_state.remaining_budget SHALL be <= 0.

**Validates: Requirements 18.2, 18.4**
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.budget_manager import BudgetStateManager

from .strategies import agent_ids, budget_limits, cost_values


# Strategy: cost sequences that guarantee the total exceeds the limit
@st.composite
def _exceeding_cost_sequence(draw: st.DrawFn) -> tuple[str, float, list[float]]:
    """Generate (agent_id, budget_limit, cost_list) where sum(costs) > limit.

    Ensures the total cost strictly exceeds the budget limit so that
    the agent should be denied on subsequent checks.
    """
    agent_id = draw(agent_ids)
    limit = draw(budget_limits)

    # Generate costs that sum to more than the limit
    # First, generate a partial sequence (may be under limit)
    num_costs = draw(st.integers(min_value=1, max_value=10))
    costs: list[float] = []
    for _ in range(num_costs):
        c = draw(
            st.floats(min_value=0.001, max_value=limit * 2, allow_nan=False, allow_infinity=False)
        )
        costs.append(c)

    # Ensure the sum exceeds the limit by adding a final cost if needed
    total = sum(costs)
    if total <= limit:
        # Add enough to exceed
        shortfall = limit - total
        extra = draw(
            st.floats(
                min_value=shortfall + 0.001,
                max_value=shortfall + limit,
                allow_nan=False,
                allow_infinity=False,
            )
        )
        costs.append(extra)

    return (agent_id, limit, costs)


@pytest.mark.property
class TestBudgetEnforcementThreshold:
    """Property 17: Budget Enforcement Threshold.

    For any agent whose cumulative_cost exceeds its configured budget_limit,
    all subsequent tool calls SHALL be denied with reason_code "BUDGET_EXCEEDED",
    and budget_state.remaining_budget SHALL be <= 0.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(data=_exceeding_cost_sequence())
    def test_exceeded_budget_results_in_denial(
        self, data: tuple[str, float, list[float]]
    ) -> None:
        """Validates: Requirements 18.2, 18.4

        Once an agent's cumulative cost exceeds its budget_limit, check_budget
        SHALL report exceeded=True with reason_code "BUDGET_EXCEEDED" semantics,
        and all subsequent calls to check_budget SHALL continue to report exceeded.
        """
        agent_id, limit, costs = data

        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, limit)

        # Apply all costs
        for cost in costs:
            mgr.track_cost(agent_id, cost)

        # After exceeding, check_budget must report exceeded=True
        result = mgr.check_budget(agent_id)
        assert result.exceeded is True, (
            f"Expected exceeded=True after cumulative cost "
            f"{sum(costs):.4f} > limit {limit:.4f}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(data=_exceeding_cost_sequence())
    def test_exceeded_budget_remaining_is_non_positive(
        self, data: tuple[str, float, list[float]]
    ) -> None:
        """Validates: Requirements 18.2, 18.4

        When an agent's cumulative_cost exceeds its budget_limit,
        budget_state.remaining_budget SHALL be <= 0.
        """
        agent_id, limit, costs = data

        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, limit)

        # Apply all costs
        for cost in costs:
            mgr.track_cost(agent_id, cost)

        # Remaining budget must be <= 0
        state = mgr.get_state(agent_id)
        assert state.remaining_budget is not None
        assert state.remaining_budget <= 0, (
            f"Expected remaining_budget <= 0, got {state.remaining_budget:.4f} "
            f"(spend={state.current_spend:.4f}, limit={limit:.4f})"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(data=_exceeding_cost_sequence())
    def test_subsequent_checks_remain_exceeded(
        self, data: tuple[str, float, list[float]]
    ) -> None:
        """Validates: Requirements 18.2, 18.4

        Once budget is exceeded, ALL subsequent check_budget calls SHALL
        continue to report exceeded=True (the denial is persistent until
        reset or limit increase).
        """
        agent_id, limit, costs = data

        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, limit)

        # Apply costs until we exceed
        for cost in costs:
            mgr.track_cost(agent_id, cost)

        # Verify multiple subsequent checks all report exceeded
        for _ in range(5):
            result = mgr.check_budget(agent_id)
            assert result.exceeded is True, (
                "Budget exceeded state must persist across multiple checks"
            )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(data=_exceeding_cost_sequence())
    def test_additional_costs_after_exceeded_stay_exceeded(
        self, data: tuple[str, float, list[float]]
    ) -> None:
        """Validates: Requirements 18.2, 18.4

        After budget is exceeded, tracking additional costs SHALL keep
        the agent in exceeded state with remaining_budget further decreasing.
        """
        agent_id, limit, costs = data

        mgr = BudgetStateManager()
        mgr.set_limit(agent_id, limit)

        # Apply all costs to exceed budget
        for cost in costs:
            mgr.track_cost(agent_id, cost)

        # Track one more cost — should still be exceeded
        additional = mgr.track_cost(agent_id, 0.01)
        assert additional.exceeded is True
        assert additional.remaining is not None
        assert additional.remaining <= 0
