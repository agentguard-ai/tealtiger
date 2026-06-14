"""Circuit breaker component for Haystack agent and tool-calling loops."""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from typing import Any

from haystack import component


@dataclass(frozen=True)
class CircuitBreakerAuditEntry:
    """Structured audit entry for one circuit-breaker iteration."""

    correlation_id: str
    timestamp_ms: float
    iteration: int
    action: str
    triggered: bool
    trigger_reason: str | None
    message: str
    reason_codes: list[str]
    cost_tracked: float
    cumulative_cost: float
    max_cost_per_session: float
    consecutive_failures: int
    max_consecutive_failures: int
    max_iterations: int
    human_escalation: bool
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dictionary."""
        return {
            "correlation_id": self.correlation_id,
            "timestamp_ms": self.timestamp_ms,
            "iteration": self.iteration,
            "action": self.action,
            "triggered": self.triggered,
            "trigger_reason": self.trigger_reason,
            "message": self.message,
            "reason_codes": self.reason_codes,
            "cost_tracked": self.cost_tracked,
            "cumulative_cost": self.cumulative_cost,
            "max_cost_per_session": self.max_cost_per_session,
            "consecutive_failures": self.consecutive_failures,
            "max_consecutive_failures": self.max_consecutive_failures,
            "max_iterations": self.max_iterations,
            "human_escalation": self.human_escalation,
            "metadata": self.metadata,
        }


@component
class TealTigerCircuitBreaker:
    """Stop runaway Haystack loops based on cost, failures, or iterations."""

    _VALID_BREAK_ACTIONS = {"terminate", "refer"}

    def __init__(
        self,
        max_cost_per_session: float = 5.0,
        max_consecutive_failures: int = 3,
        max_iterations: int = 10,
        action_on_break: str = "terminate",
        cost_per_1k_tokens: float = 0.002,
        agent_id: str | None = None,
    ) -> None:
        """Initialize the circuit breaker.

        Args:
            max_cost_per_session: Maximum cumulative estimated session cost.
            max_consecutive_failures: Failed iterations allowed before break.
            max_iterations: Total loop iterations allowed before break.
            action_on_break: ``"terminate"`` stops output or ``"refer"`` escalates.
            cost_per_1k_tokens: Cost estimator rate used for each iteration.
            agent_id: Optional identifier for audit correlation.
        """
        if action_on_break not in self._VALID_BREAK_ACTIONS:
            valid = ", ".join(sorted(self._VALID_BREAK_ACTIONS))
            raise ValueError(f"action_on_break must be one of: {valid}")
        if max_cost_per_session <= 0:
            raise ValueError("max_cost_per_session must be greater than zero")
        if max_consecutive_failures <= 0:
            raise ValueError("max_consecutive_failures must be greater than zero")
        if max_iterations <= 0:
            raise ValueError("max_iterations must be greater than zero")
        if cost_per_1k_tokens <= 0:
            raise ValueError("cost_per_1k_tokens must be greater than zero")

        self._max_cost_per_session = max_cost_per_session
        self._max_consecutive_failures = max_consecutive_failures
        self._max_iterations = max_iterations
        self._action_on_break = action_on_break
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._agent_id = agent_id or f"haystack-agent-{uuid.uuid4().hex[:8]}"
        self._iteration_count = 0
        self._consecutive_failures = 0
        self._cumulative_cost = 0.0
        self._audit_trail: list[CircuitBreakerAuditEntry] = []

    @component.output_types(
        text=str,
        should_continue=bool,
        action=str,
        message=str,
        audit=dict,
        audit_trail=list,
    )
    def run(
        self,
        text: str = "",
        token_usage: dict[str, int] | None = None,
        success: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Evaluate whether an agent loop should continue."""
        self._iteration_count += 1
        if success:
            self._consecutive_failures = 0
        else:
            self._consecutive_failures += 1

        cost_tracked = self._estimate_cost(text=text, token_usage=token_usage)
        self._cumulative_cost += cost_tracked

        triggered, trigger_reason, message, reason_codes = self._evaluate_break()
        action = self._action_on_break if triggered else "continue"
        human_escalation = triggered and action == "refer"
        if human_escalation:
            reason_codes = [*reason_codes, "HUMAN_ESCALATION"]

        audit_entry = CircuitBreakerAuditEntry(
            correlation_id=str(uuid.uuid4()),
            timestamp_ms=time.time() * 1000,
            iteration=self._iteration_count,
            action=action,
            triggered=triggered,
            trigger_reason=trigger_reason,
            message=message,
            reason_codes=reason_codes,
            cost_tracked=cost_tracked,
            cumulative_cost=self._cumulative_cost,
            max_cost_per_session=self._max_cost_per_session,
            consecutive_failures=self._consecutive_failures,
            max_consecutive_failures=self._max_consecutive_failures,
            max_iterations=self._max_iterations,
            human_escalation=human_escalation,
            metadata={
                "agent_id": self._agent_id,
                "token_usage": token_usage,
                **(metadata or {}),
            },
        )
        self._audit_trail.append(audit_entry)

        return {
            "text": "" if triggered and action == "terminate" else text,
            "should_continue": not triggered,
            "action": action,
            "message": message,
            "audit": audit_entry.to_dict(),
            "audit_trail": [entry.to_dict() for entry in self._audit_trail],
        }

    def _estimate_cost(self, text: str, token_usage: dict[str, int] | None) -> float:
        """Estimate iteration cost using deterministic TealTiger-style accounting."""
        if token_usage:
            total_tokens = token_usage.get(
                "total_tokens",
                token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0),
            )
            return (total_tokens / 1000) * self._cost_per_1k_tokens

        estimated_tokens = max(len(text) / 4, 1)
        return (estimated_tokens / 1000) * self._cost_per_1k_tokens

    def _evaluate_break(self) -> tuple[bool, str | None, str, list[str]]:
        """Return break state, reason, message, and reason codes."""
        if self._cumulative_cost > self._max_cost_per_session:
            return (
                True,
                "cost",
                f"Circuit breaker triggered: cost exceeded ${self._max_cost_per_session:.2f}",
                ["COST_EXCEEDED"],
            )
        if self._consecutive_failures >= self._max_consecutive_failures:
            return (
                True,
                "consecutive_failures",
                "Circuit breaker triggered: consecutive failures exceeded "
                f"{self._max_consecutive_failures}",
                ["CONSECUTIVE_FAILURES"],
            )
        if self._iteration_count >= self._max_iterations:
            return (
                True,
                "iterations",
                f"Circuit breaker triggered: max iterations reached {self._max_iterations}",
                ["MAX_ITERATIONS"],
            )

        return False, None, "Circuit breaker OK", []

    @property
    def audit_trail(self) -> list[dict[str, Any]]:
        """Return the full audit trail as dictionaries."""
        return [entry.to_dict() for entry in self._audit_trail]

    @property
    def cumulative_cost(self) -> float:
        """Return the cumulative session cost."""
        return self._cumulative_cost

    @property
    def iteration_count(self) -> int:
        """Return the number of evaluated loop iterations."""
        return self._iteration_count

    def export_audit_trail(self, path: str) -> int:
        """Export audit trail as JSONL and return the number of entries written."""
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                f.write(json.dumps(entry.to_dict()) + "\n")

        return len(self._audit_trail)

    def reset(self) -> None:
        """Reset session cost, iteration, failure, and audit state."""
        self._iteration_count = 0
        self._consecutive_failures = 0
        self._cumulative_cost = 0.0
        self._audit_trail = []
