"""Property-based test: Cumulative Cost Monotonicity (Property 20).

# Feature: ag2-tealtiger-adapter, Property 20: Cumulative Cost Monotonicity

*For any* sequence of tool calls and message sends by an agent, the
cumulative_cost SHALL be monotonically non-decreasing, and per-agent cost
totals SHALL equal the sum of individual operation costs.

**Validates: Requirements 6.2, 6.4, 18.1**
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.budget_manager import BudgetStateManager


# Strategy for non-negative cost values (simulates individual operation costs)
_cost_values = st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)

# Strategy for sequences of costs (simulates a sequence of tool calls/messages)
_cost_sequences = st.lists(_cost_values, min_size=1, max_size=50)

# Strategy for agent IDs
_agent_ids = st.from_regex(r"[a-z][a-z0-9_]{2,19}", fullmatch=True)


@pytest.mark.property
class TestCumulativeCostMonotonicity:
    """Property 20: Cumulative Cost Monotonicity.

    For any sequence of tool calls and message sends by an agent,
    cumulative_cost is monotonically non-decreasing, and per-agent cost
    totals equal the sum of individual operation costs.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(agent_id=_agent_ids, costs=_cost_sequences)
    def test_cumulative_cost_monotonically_non_decreasing(
        self, agent_id: str, costs: list[float]
    ) -> None:
        """Validates: Requirements 6.2, 6.4, 18.1

        After each track_cost call, the cumulative_cost (current_spend)
        SHALL be >= the previous cumulative_cost, ensuring monotonic
        non-decreasing behavior.
        """
        manager = BudgetStateManager()
        previous_spend = 0.0

        for cost in costs:
            manager.track_cost(agent_id, cost)
            state = manager.get_state(agent_id)

            # Cumulative cost must be non-decreasing
            assert state.current_spend >= previous_spend, (
                f"Cumulative cost decreased: {state.current_spend} < {previous_spend} "
                f"after adding cost={cost}"
            )
            previous_spend = state.current_spend

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(agent_id=_agent_ids, costs=_cost_sequences)
    def test_cumulative_cost_equals_sum_of_individual_costs(
        self, agent_id: str, costs: list[float]
    ) -> None:
        """Validates: Requirements 6.2, 6.4, 18.1

        The final cumulative_cost for an agent SHALL equal the sum of
        all individual operation costs tracked for that agent.
        """
        manager = BudgetStateManager()

        for cost in costs:
            manager.track_cost(agent_id, cost)

        state = manager.get_state(agent_id)
        expected_total = sum(costs)

        # Allow small floating-point tolerance
        assert abs(state.current_spend - expected_total) < 1e-9, (
            f"Cumulative cost {state.current_spend} != sum of costs {expected_total} "
            f"(difference: {abs(state.current_spend - expected_total)})"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_id_a=_agent_ids,
        agent_id_b=_agent_ids,
        costs_a=_cost_sequences,
        costs_b=_cost_sequences,
    )
    def test_per_agent_cost_totals_independent(
        self,
        agent_id_a: str,
        agent_id_b: str,
        costs_a: list[float],
        costs_b: list[float],
    ) -> None:
        """Validates: Requirements 6.2, 6.4, 18.1

        Per-agent cost totals SHALL be tracked independently — costs
        tracked for Agent A SHALL NOT affect Agent B's cumulative cost,
        and each agent's total SHALL equal the sum of its own costs.
        """
        from hypothesis import assume

        assume(agent_id_a != agent_id_b)

        manager = BudgetStateManager()

        for cost in costs_a:
            manager.track_cost(agent_id_a, cost)
        for cost in costs_b:
            manager.track_cost(agent_id_b, cost)

        state_a = manager.get_state(agent_id_a)
        state_b = manager.get_state(agent_id_b)

        expected_a = sum(costs_a)
        expected_b = sum(costs_b)

        assert abs(state_a.current_spend - expected_a) < 1e-9, (
            f"Agent A cost {state_a.current_spend} != sum {expected_a}"
        )
        assert abs(state_b.current_spend - expected_b) < 1e-9, (
            f"Agent B cost {state_b.current_spend} != sum {expected_b}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(agent_id=_agent_ids, costs=_cost_sequences)
    def test_each_step_increases_by_exact_cost(
        self, agent_id: str, costs: list[float]
    ) -> None:
        """Validates: Requirements 6.2, 6.4, 18.1

        After each track_cost(agent_id, cost) call, the cumulative cost
        SHALL increase by exactly the tracked cost amount (within
        floating-point tolerance).
        """
        manager = BudgetStateManager()
        previous_spend = 0.0

        for cost in costs:
            manager.track_cost(agent_id, cost)
            state = manager.get_state(agent_id)

            expected_spend = previous_spend + cost
            assert abs(state.current_spend - expected_spend) < 1e-9, (
                f"After adding {cost}, expected spend={expected_spend} "
                f"but got {state.current_spend}"
            )
            previous_spend = state.current_spend
