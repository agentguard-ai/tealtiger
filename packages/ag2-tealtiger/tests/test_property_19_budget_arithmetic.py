"""Property-based test: Budget State Arithmetic Consistency (Property 19).

# Feature: ag2-tealtiger-adapter, Property 19: Budget State Arithmetic Consistency

*For any* agent with a configured budget_limit and tracked costs, the budget state
SHALL maintain the invariant: remaining_budget = budget_limit - current_spend.

**Validates: Requirements 18.4**
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.budget_manager import BudgetStateManager

# ── Custom Strategies ─────────────────────────────────────────────────────────

# Budget limits: positive floats (matches strategies.py budget_limits)
budget_limits = st.floats(
    min_value=0.01, max_value=10000.0, allow_nan=False, allow_infinity=False
)

# Cost values: non-negative floats (matches strategies.py cost_values)
cost_values = st.floats(
    min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False
)

# Agent IDs: realistic identifiers
agent_ids = st.from_regex(r"[a-z][a-z0-9_]{2,29}", fullmatch=True)

# Lists of costs to accumulate
cost_sequences = st.lists(
    cost_values,
    min_size=1,
    max_size=20,
)


@pytest.mark.property
class TestBudgetStateArithmeticConsistency:
    """Property 19: Budget State Arithmetic Consistency.

    For any agent with a configured budget_limit and tracked costs, the
    budget state SHALL maintain the invariant:
        remaining_budget = budget_limit - current_spend
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        limit=budget_limits,
        costs=cost_sequences,
    )
    def test_remaining_budget_equals_limit_minus_spend(
        self, agent_id: str, limit: float, costs: list[float]
    ) -> None:
        """Validates: Requirements 18.4

        After setting a budget limit and tracking any sequence of costs,
        the invariant remaining_budget = budget_limit - current_spend
        must hold at every step.
        """
        manager = BudgetStateManager()
        manager.set_limit(agent_id, limit)

        # Verify invariant after setting limit (before any costs)
        state = manager.get_state(agent_id)
        assert state.remaining_budget is not None
        assert state.remaining_budget == pytest.approx(
            state.budget_limit - state.current_spend
        )

        # Verify invariant holds after each cost is tracked
        for cost in costs:
            manager.track_cost(agent_id, cost)
            state = manager.get_state(agent_id)

            assert state.budget_limit == pytest.approx(limit)
            assert state.remaining_budget is not None
            assert state.remaining_budget == pytest.approx(
                state.budget_limit - state.current_spend
            )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        limit=budget_limits,
        cost=cost_values,
    )
    def test_single_cost_arithmetic(
        self, agent_id: str, limit: float, cost: float
    ) -> None:
        """Validates: Requirements 18.4

        After a single cost is tracked, remaining_budget must equal
        budget_limit - cost (the total current_spend).
        """
        manager = BudgetStateManager()
        manager.set_limit(agent_id, limit)
        manager.track_cost(agent_id, cost)

        state = manager.get_state(agent_id)

        assert state.current_spend == pytest.approx(cost)
        assert state.remaining_budget == pytest.approx(limit - cost)

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        limit=budget_limits,
        costs=cost_sequences,
    )
    def test_invariant_holds_after_reset(
        self, agent_id: str, limit: float, costs: list[float]
    ) -> None:
        """Validates: Requirements 18.4

        After tracking costs and then resetting, the invariant
        remaining_budget = budget_limit - current_spend must hold
        (with current_spend reset to 0).
        """
        manager = BudgetStateManager()
        manager.set_limit(agent_id, limit)

        # Accumulate some costs
        for cost in costs:
            manager.track_cost(agent_id, cost)

        # Reset and verify invariant
        manager.reset(agent_id)
        state = manager.get_state(agent_id)

        assert state.current_spend == 0.0
        assert state.budget_limit == pytest.approx(limit)
        assert state.remaining_budget == pytest.approx(limit)
        assert state.remaining_budget == pytest.approx(
            state.budget_limit - state.current_spend
        )
