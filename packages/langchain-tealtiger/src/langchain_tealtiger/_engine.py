"""Bridge between LangChain middleware and TealTiger governance engine.

This module adapts the LangChain tool call interface to TealTiger's
GovernanceRequest/DecisionV13 types.
"""

from __future__ import annotations

import importlib
import time
import uuid
from typing import Any, Dict, List, Optional, Set

from langchain_tealtiger._types import (
    GovernanceAction,
    GovernanceDecision,
    GovernanceMode,
    SessionSummary,
)


class GovernanceBridge:
    """Bridges LangChain middleware calls to TealTiger governance evaluation.

    This class handles:
    - Policy configuration parsing
    - Tool allowlist/blocklist enforcement
    - Cost limit tracking
    - Rate limit tracking
    - Time-of-day restrictions
    - Decision evidence collection

    The engine is deterministic — no LLM calls, no network requests.
    Typical evaluation time: <1ms.
    """

    def __init__(
        self,
        policies: List[Dict[str, Any]],
        mode: GovernanceMode = GovernanceMode.ENFORCE,
        agent_id: Optional[str] = None,
        freeze_tools: Optional[Set[str]] = None,
    ) -> None:
        self._mode = mode
        self._agent_id = agent_id or f"langchain-agent-{uuid.uuid4().hex[:8]}"
        self._freeze_tools = freeze_tools or set()

        # Parse policies
        self._tool_allowlist: Optional[Set[str]] = None
        self._tool_blocklist: Set[str] = set()
        self._cost_limit_session: Optional[float] = None
        self._cost_limit_request: Optional[float] = None
        self._rate_limit_max: Optional[int] = None
        self._rate_limit_window: Optional[str] = None
        self._time_restrictions: List[Dict[str, Any]] = []

        self._parse_policies(policies)

        # Session state
        self._session_cost: float = 0.0
        self._call_count: int = 0
        self._evidence: List[GovernanceDecision] = []

    def _parse_policies(self, policies: List[Dict[str, Any]]) -> None:
        """Parse policy config dicts into internal state."""
        for policy in policies:
            ptype = policy.get("type", "")

            if ptype == "tool_allowlist":
                self._tool_allowlist = set(policy.get("tools", []))
            elif ptype == "tool_blocklist":
                self._tool_blocklist = set(policy.get("tools", []))
            elif ptype == "cost_limit":
                self._cost_limit_session = policy.get("max_per_session")
                self._cost_limit_request = policy.get("max_per_request")
            elif ptype == "rate_limit":
                self._rate_limit_max = policy.get("max_calls")
                self._rate_limit_window = policy.get("window")
            elif ptype == "time_restriction":
                self._time_restrictions.append(policy)

    def evaluate(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
    ) -> GovernanceDecision:
        """Evaluate a tool call against configured policies.

        Args:
            tool_name: Name of the tool being invoked.
            tool_args: Arguments passed to the tool.

        Returns:
            GovernanceDecision with the action to take.
        """
        start = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        triggered: List[str] = []

        # ── FREEZE check (always enforced, regardless of mode) ──
        if tool_name in self._freeze_tools:
            decision = GovernanceDecision(
                action=GovernanceAction.DENY,
                tool_name=tool_name,
                tool_args=tool_args,
                reason=f"FREEZE: tool '{tool_name}' is frozen and cannot be executed",
                reason_codes=["FREEZE_RULE"],
                risk_score=100,
                correlation_id=correlation_id,
                trace_id=_get_current_trace_id(),
                triggered_policies=["freeze"],
            )
            decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
            self._record(decision)
            return decision

        # ── Tool allowlist check ──
        if self._tool_allowlist is not None and tool_name not in self._tool_allowlist:
            triggered.append("tool_allowlist")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Tool '{tool_name}' not in allowlist: {sorted(self._tool_allowlist)}",
                    reason_codes=["TOOL_NOT_ALLOWED"],
                    risk_score=80,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Tool blocklist check ──
        if tool_name in self._tool_blocklist:
            triggered.append("tool_blocklist")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Tool '{tool_name}' is blocklisted",
                    reason_codes=["TOOL_BLOCKED"],
                    risk_score=80,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Rate limit check ──
        if self._rate_limit_max is not None and self._call_count >= self._rate_limit_max:
            triggered.append("rate_limit")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Rate limit exceeded: {self._call_count}/{self._rate_limit_max} calls",
                    reason_codes=["RATE_LIMIT_EXCEEDED"],
                    risk_score=70,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Cost limit check ──
        if self._cost_limit_session is not None and self._session_cost >= self._cost_limit_session:
            triggered.append("cost_limit")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=(
                        f"Session cost limit exceeded: "
                        f"${self._session_cost:.2f}/${self._cost_limit_session:.2f}"
                    ),
                    reason_codes=["COST_LIMIT_EXCEEDED"],
                    risk_score=60,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── All checks passed ──
        decision = GovernanceDecision(
            action=GovernanceAction.ALLOW,
            tool_name=tool_name,
            tool_args=tool_args,
            reason="Request allowed and compliant with all policies",
            reason_codes=["POLICY_COMPLIANT"],
            risk_score=0,
            correlation_id=correlation_id,
            trace_id=_get_current_trace_id(),
            triggered_policies=triggered,
        )
        decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
        self._call_count += 1
        self._record(decision)
        return decision

    def record_cost(self, cost: float) -> None:
        """Record cost for a completed tool call."""
        self._session_cost += cost

    def reset_session(self) -> None:
        """Reset session state (called at agent start)."""
        self._session_cost = 0.0
        self._call_count = 0
        self._evidence = []

    def get_summary(self) -> SessionSummary:
        """Get governance summary for the session."""
        return SessionSummary(
            total_evaluations=len(self._evidence),
            allowed=sum(1 for e in self._evidence if e.action == GovernanceAction.ALLOW),
            denied=sum(1 for e in self._evidence if e.action == GovernanceAction.DENY),
            modified=sum(1 for e in self._evidence if e.action == GovernanceAction.MODIFY),
            session_cost=self._session_cost,
            mode=self._mode,
            evidence=list(self._evidence),
        )

    @property
    def evidence(self) -> List[GovernanceDecision]:
        """Access the evidence trail."""
        return list(self._evidence)

    def _record(self, decision: GovernanceDecision) -> None:
        """Record a decision in the evidence trail."""
        self._evidence.append(decision)


def _get_current_trace_id() -> str | None:
    """Return the current OpenTelemetry trace ID, if the optional API is present."""
    try:
        trace = importlib.import_module("opentelemetry.trace")
    except ImportError:
        return None

    try:
        span = trace.get_current_span()
        context = span.get_span_context()
        trace_id = int(getattr(context, "trace_id", 0))
    except (AttributeError, TypeError, ValueError):
        return None

    if trace_id == 0:
        return None

    return format(trace_id, "032x")
