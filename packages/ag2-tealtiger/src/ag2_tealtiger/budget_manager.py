"""BudgetStateManager — per-agent budget tracking and enforcement.

Tracks cumulative cost per agent identity with configurable budget limits.
Emits BUDGET_WARNING when an agent's spend crosses 80% of its limit.
Maintains the invariant: remaining_budget = budget_limit - current_spend.

Requirements covered: 18.1, 18.2, 18.4, 18.5
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from ag2_tealtiger.types import BudgetState


@dataclass
class BudgetCheckResult:
    """Result of a budget check for an agent.

    Attributes:
        exceeded: Whether the agent's budget limit has been exceeded.
        remaining: Remaining budget (None if no limit configured).
        warning: Whether the 80% threshold warning was triggered.
    """

    exceeded: bool
    remaining: float | None
    warning: bool


# Type alias for budget warning callbacks
BudgetWarningCallback = Callable[[str, float, float], None]


class BudgetStateManager:
    """Per-agent budget tracking and enforcement.

    Tracks cumulative cost per agent with configurable budget limits.
    Emits a BUDGET_WARNING (via callback or returned flag) when
    cumulative_cost crosses 80% of the configured budget_limit.

    The core invariant maintained:
        remaining_budget = budget_limit - current_spend

    Usage:
        manager = BudgetStateManager()
        manager.set_limit("agent-1", 10.0)
        manager.track_cost("agent-1", 2.5)
        state = manager.get_state("agent-1")
        # state.remaining_budget == 7.5
    """

    # Warning threshold: emit BUDGET_WARNING at 80% of limit
    WARNING_THRESHOLD: float = 0.80

    def __init__(
        self,
        on_budget_warning: BudgetWarningCallback | None = None,
    ) -> None:
        """Initialize the budget state manager.

        Args:
            on_budget_warning: Optional callback invoked when an agent's spend
                crosses 80% of its limit. Receives (agent_id, current_spend, budget_limit).
        """
        self._states: dict[str, BudgetState] = {}
        self._on_budget_warning = on_budget_warning

    def _ensure_state(self, agent_id: str) -> BudgetState:
        """Get or create the BudgetState for an agent."""
        if agent_id not in self._states:
            self._states[agent_id] = BudgetState(
                agent_id=agent_id,
                budget_limit=None,
                current_spend=0.0,
                remaining_budget=None,
                warning_emitted=False,
            )
        return self._states[agent_id]

    def _compute_remaining(self, state: BudgetState) -> float | None:
        """Compute remaining budget. Returns None if no limit set."""
        if state.budget_limit is None:
            return None
        return state.budget_limit - state.current_spend

    def track_cost(self, agent_id: str, cost: float) -> BudgetCheckResult:
        """Accumulate cost for an agent and check budget status.

        Adds the given cost to the agent's cumulative spend and checks
        whether the 80% warning threshold has been crossed.

        Args:
            agent_id: The identity of the agent incurring cost.
            cost: The cost amount to add (must be >= 0).

        Returns:
            BudgetCheckResult with current exceeded/warning status.

        Raises:
            ValueError: If cost is negative.
        """
        if cost < 0:
            raise ValueError(f"Cost must be non-negative, got {cost}")

        state = self._ensure_state(agent_id)
        state.current_spend += cost
        state.remaining_budget = self._compute_remaining(state)

        # Check warning threshold
        warning = False
        if state.budget_limit is not None and not state.warning_emitted:
            threshold_amount = state.budget_limit * self.WARNING_THRESHOLD
            if state.current_spend >= threshold_amount:
                state.warning_emitted = True
                warning = True
                if self._on_budget_warning is not None:
                    self._on_budget_warning(
                        agent_id, state.current_spend, state.budget_limit
                    )

        # Check exceeded
        exceeded = False
        if state.budget_limit is not None:
            exceeded = state.current_spend > state.budget_limit

        return BudgetCheckResult(
            exceeded=exceeded,
            remaining=state.remaining_budget,
            warning=warning,
        )

    def get_state(self, agent_id: str) -> BudgetState:
        """Return current budget state for an agent.

        The returned BudgetState maintains the invariant:
            remaining_budget = budget_limit - current_spend

        If no budget limit is configured, remaining_budget is None.

        Args:
            agent_id: The identity of the agent.

        Returns:
            BudgetState with current spend, limit, and remaining budget.
        """
        state = self._ensure_state(agent_id)
        state.remaining_budget = self._compute_remaining(state)
        return state

    def check_budget(self, agent_id: str) -> BudgetCheckResult:
        """Check if an agent's budget has been exceeded.

        Does NOT modify state or emit warnings — use track_cost for that.

        Args:
            agent_id: The identity of the agent.

        Returns:
            BudgetCheckResult indicating exceeded status and remaining budget.
        """
        state = self._ensure_state(agent_id)
        remaining = self._compute_remaining(state)

        exceeded = False
        if state.budget_limit is not None:
            exceeded = state.current_spend > state.budget_limit

        # Report warning status (whether it was already emitted)
        warning = state.warning_emitted

        return BudgetCheckResult(
            exceeded=exceeded,
            remaining=remaining,
            warning=warning,
        )

    def set_limit(self, agent_id: str, limit: float) -> None:
        """Configure a budget limit for an agent.

        Args:
            agent_id: The identity of the agent.
            limit: The budget limit to set (must be > 0).

        Raises:
            ValueError: If limit is not positive.
        """
        if limit <= 0:
            raise ValueError(f"Budget limit must be positive, got {limit}")

        state = self._ensure_state(agent_id)
        state.budget_limit = limit
        state.remaining_budget = self._compute_remaining(state)

        # Re-check warning threshold with new limit
        # (warning might need re-emission if limit was lowered)
        if not state.warning_emitted:
            threshold_amount = state.budget_limit * self.WARNING_THRESHOLD
            if state.current_spend >= threshold_amount:
                state.warning_emitted = True
                if self._on_budget_warning is not None:
                    self._on_budget_warning(
                        agent_id, state.current_spend, state.budget_limit
                    )

    def reset(self, agent_id: str) -> None:
        """Reset an agent's spend to zero.

        Preserves the configured budget_limit but resets current_spend
        and warning_emitted state.

        Args:
            agent_id: The identity of the agent to reset.
        """
        state = self._ensure_state(agent_id)
        state.current_spend = 0.0
        state.warning_emitted = False
        state.remaining_budget = self._compute_remaining(state)
