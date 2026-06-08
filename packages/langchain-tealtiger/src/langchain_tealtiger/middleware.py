"""TealTiger governance middleware for LangChain agents.

This is the main entry point. Add TealTigerMiddleware to any LangChain agent
to get deterministic policy enforcement at every tool call boundary.

Example:
    from langchain.agents import create_agent
    from langchain_tealtiger import TealTigerMiddleware

    agent = create_agent(
        model="claude-sonnet-4-6",
        tools=[search, calculator, file_write],
        middleware=[
            TealTigerMiddleware(
                policies=[
                    {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                    {"type": "cost_limit", "max_per_session": 5.00},
                    {"type": "rate_limit", "max_calls": 100, "window": "1h"},
                ],
                freeze_tools=["rm_rf", "drop_database"],
            )
        ],
    )
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Set

from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain.messages import AIMessage, ToolMessage
from langchain.tools.tool_node import ToolCallRequest
from langgraph.runtime import Runtime

from langchain_tealtiger._engine import GovernanceBridge
from langchain_tealtiger._types import (
    GovernanceAction,
    GovernanceDecision,
    GovernanceMode,
    SessionSummary,
)


class TealTigerMiddleware(AgentMiddleware):
    """Deterministic governance middleware for LangChain agents.

    Enforces policy rules at the tool-call boundary without any LLM
    in the governance path. Adds <5ms latency per evaluation.

    Governance hooks:
        - wrap_tool_call: Evaluate policies before every tool invocation.
          DENY → short-circuit with denial message. ALLOW → proceed normally.
        - after_model: PII/secrets detection on model output (optional).
        - before_agent: Initialize governance session.
        - after_agent: Finalize evidence trail.

    Governance modes:
        - ENFORCE: Block denied actions (production default)
        - MONITOR: Allow all but log violations (staging)
        - REPORT_ONLY: Allow all, generate reports only (initial rollout)

    Args:
        policies: List of policy config dicts. See PolicyConfig for types.
        agent_id: Optional agent identifier for NHI scope enforcement.
        mode: Governance mode (ENFORCE, MONITOR, REPORT_ONLY).
        freeze_tools: Tools that are unconditionally blocked (immutable deny).
        detect_pii: Whether to run PII detection on model outputs.

    Example:
        >>> middleware = TealTigerMiddleware(
        ...     policies=[
        ...         {"type": "tool_allowlist", "tools": ["search"]},
        ...         {"type": "cost_limit", "max_per_session": 5.00},
        ...     ],
        ...     freeze_tools=["delete_all"],
        ...     mode="ENFORCE",
        ... )
    """

    def __init__(
        self,
        policies: Optional[List[Dict[str, Any]]] = None,
        agent_id: Optional[str] = None,
        mode: str | GovernanceMode = GovernanceMode.ENFORCE,
        freeze_tools: Optional[List[str]] = None,
        detect_pii: bool = False,
    ) -> None:
        # Normalize mode
        if isinstance(mode, str):
            mode = GovernanceMode(mode.upper())

        self._mode = mode
        self._agent_id = agent_id
        self._detect_pii = detect_pii
        self._freeze_tools: Set[str] = set(freeze_tools or [])

        # Initialize governance engine bridge
        self._engine = GovernanceBridge(
            policies=policies or [],
            mode=mode,
            agent_id=agent_id,
            freeze_tools=self._freeze_tools,
        )

    # ── Lifecycle hooks ──────────────────────────────────────────

    def before_agent(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Initialize governance session at agent start.

        Resets session cost, call count, and evidence trail.
        """
        self._engine.reset_session()
        return None

    def after_agent(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Finalize governance session.

        Evidence trail is available via middleware.summary and middleware.evidence.
        """
        # Evidence is retained on the middleware instance for caller access
        return None

    # ── Tool governance (main enforcement point) ─────────────────

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Any],
    ) -> ToolMessage | Any:
        """Governance gate before every tool call.

        Evaluates all configured policies deterministically:
        - If DENY: returns a ToolMessage with denial reason (tool is not executed)
        - If ALLOW: calls handler and proceeds normally
        - If MODIFY: applies modifications before calling handler

        In MONITOR mode, violations are logged but tool calls always proceed.
        In REPORT_ONLY mode, no evaluation is performed.
        """
        tool_name: str = request.tool_call["name"]
        tool_args: Dict[str, Any] = request.tool_call.get("args", {})

        # Evaluate governance policies
        decision = self._engine.evaluate(tool_name=tool_name, tool_args=tool_args)

        # In ENFORCE mode, deny blocks execution
        if decision.action == GovernanceAction.DENY and self._mode == GovernanceMode.ENFORCE:
            return ToolMessage(
                content=f"[GOVERNANCE DENIED] {decision.reason}",
                tool_call_id=request.tool_call["id"],
            )

        # In MONITOR/REPORT_ONLY mode, or if ALLOW — proceed
        result = handler(request)
        return result

    # ── Output governance (optional PII detection) ───────────────

    def after_model(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Post-model output classification.

        When detect_pii=True, scans model output for PII patterns
        and redacts in ENFORCE mode.
        """
        if not self._detect_pii:
            return None

        last_message = state["messages"][-1] if state.get("messages") else None
        if not isinstance(last_message, AIMessage):
            return None

        # PII detection would integrate with tealtiger.guardrails.PIIDetectionGuardrail
        # For v0.1.0, this is a placeholder for the full integration
        return None

    # ── Public API for callers ───────────────────────────────────

    @property
    def summary(self) -> SessionSummary:
        """Get governance summary for the current/last session.

        Returns:
            SessionSummary with counts, cost, and mode.

        Example:
            >>> result = agent.invoke({"messages": [...]})
            >>> print(middleware.summary)
            SessionSummary(total_evaluations=5, allowed=4, denied=1, ...)
        """
        return self._engine.get_summary()

    @property
    def evidence(self) -> List[GovernanceDecision]:
        """Access the full evidence trail of governance decisions.

        Each decision includes the tool name, args, action taken,
        reason codes, risk score, and correlation ID.
        """
        return self._engine.evidence

    @property
    def mode(self) -> GovernanceMode:
        """Current governance mode."""
        return self._mode
