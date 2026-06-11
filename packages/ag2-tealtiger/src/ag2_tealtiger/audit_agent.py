"""TealTigerAuditAgent — ConversableAgent subclass with built-in governance.

A convenience class that automatically sets up TealTiger governance on
initialization. Extends AG2's ConversableAgent to provide:

- Automatic TealTigerGuard registration during __init__
- Zero-config observe mode when no TealEngine provided
- Built-in audit_trail, summary, and guard properties
- Optional per-agent budget_limit

Requirements covered: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
"""

from __future__ import annotations

from typing import Any

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    AuditEntry,
    GovernanceMode,
)

# Conditional import of AG2's ConversableAgent.
# If ag2 is not installed (e.g. in test environments), we fall back to
# a minimal base class that provides the interface TealTigerGuard expects.
try:
    from autogen import ConversableAgent as _BaseAgent  # type: ignore[import-untyped]
except ImportError:
    try:
        from ag2 import ConversableAgent as _BaseAgent  # type: ignore[import-untyped]
    except ImportError:
        # Fallback for environments without AG2 installed.
        # Provides the minimal interface needed by TealTigerGuard.
        class _BaseAgent:  # type: ignore[no-redef]
            """Minimal ConversableAgent stub for environments without AG2."""

            def __init__(self, name: str, **kwargs: Any) -> None:
                self.name = name
                self._reply_funcs: list[dict[str, Any]] = []
                # Store kwargs so subclass can access them
                self._init_kwargs = kwargs

            def register_reply(
                self,
                trigger: Any,
                reply_func: Any,
                position: int = 0,
                config: Any = None,
                reset_config: Any = None,
                **kwargs: Any,
            ) -> None:
                """Register a reply function — mirrors AG2's ConversableAgent API."""
                self._reply_funcs.insert(
                    position,
                    {
                        "trigger": trigger,
                        "reply_func": reply_func,
                        "config": config,
                        "reset_config": reset_config,
                    },
                )


class TealTigerAuditAgent(_BaseAgent):
    """ConversableAgent with built-in TealTiger governance.

    Automatically registers TealTigerGuard during __init__.
    Operates in observe mode when no engine is provided (zero-config).

    Accepts all ConversableAgent kwargs without modifying their behavior —
    they are passed through to the parent class.

    Usage:
        # Zero-config observe mode
        agent = TealTigerAuditAgent(name="coder")

        # With policy engine
        agent = TealTigerAuditAgent(
            name="executor",
            engine=my_engine,
            mode=GovernanceMode.ENFORCE,
            budget_limit=1.0,
        )

        # Access governance state
        print(agent.guard.is_frozen("executor"))
        print(agent.audit_trail)
        print(agent.summary)

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """

    def __init__(
        self,
        name: str,
        engine: Any | None = None,
        mode: GovernanceMode = GovernanceMode.OBSERVE,
        budget_limit: float | None = None,
        **kwargs: Any,
    ) -> None:
        """Initialize the TealTigerAuditAgent.

        Creates the underlying ConversableAgent with all provided kwargs,
        then attaches a TealTigerGuard instance for governance.

        Args:
            name: The agent's identity name. Used for governance tracking
                and passed to ConversableAgent.
            engine: Optional TealEngine instance for policy evaluation.
                If None, the agent operates in zero-config observe mode.
            mode: Governance operating mode (ENFORCE, MONITOR, or OBSERVE).
                Defaults to OBSERVE for zero-config usage.
            budget_limit: Optional per-agent cost ceiling. When exceeded,
                subsequent tool calls are denied in ENFORCE mode. If provided,
                calls guard.set_budget(name, budget_limit) during init.
            **kwargs: All additional keyword arguments are passed directly
                to ConversableAgent.__init__ without modification.
        """
        # Pass name and all kwargs through to ConversableAgent
        super().__init__(name=name, **kwargs)

        # Create and attach the TealTigerGuard interceptor
        self._guard = TealTigerGuard(
            engine=engine,
            mode=mode,
        )
        self._guard.attach(self)

        # Set per-agent budget if specified
        if budget_limit is not None:
            self._guard.set_budget(self.name, budget_limit)

    @property
    def guard(self) -> TealTigerGuard:
        """Return the attached TealTigerGuard instance.

        Provides access to the full guard API including freeze/unfreeze,
        budget management, and decision resolution.

        Returns:
            The TealTigerGuard governing this agent.

        Requirements: 2.1
        """
        return self._guard

    @property
    def audit_trail(self) -> list[AuditEntry]:
        """Return the ordered list of AuditEntry objects for this agent.

        Delegates to the guard's audit_trail, which contains entries
        for all governance evaluations on this agent (tool calls,
        messages, freeze/unfreeze events, budget operations).

        Returns:
            Ordered list of AuditEntry objects.

        Requirements: 2.4
        """
        return self._guard.audit_trail

    @property
    def summary(self) -> dict[str, Any]:
        """Return cost and call statistics grouped by tool name.

        Aggregates the audit trail into a summary dict containing:
        - "tools": dict mapping tool names to {"calls": int, "cost": float}
        - "total_cost": float total cost across all tools
        - "total_calls": int total number of tool call evaluations

        Returns:
            A dict with structure:
            {
                "tools": {
                    "run_code": {"calls": 5, "cost": 0.03},
                    "web_search": {"calls": 3, "cost": 0.01},
                    ...
                },
                "total_cost": 0.15,
                "total_calls": 12,
            }

        Requirements: 2.5
        """
        tools: dict[str, dict[str, Any]] = {}
        total_cost: float = 0.0
        total_calls: int = 0

        for entry in self._guard.audit_trail:
            # Only count tool_call action kinds for summary
            if entry.action_kind != "tool_call":
                continue

            tool_name = entry.tool_name or "unknown"
            total_calls += 1
            total_cost += entry.cost_tracked

            if tool_name not in tools:
                tools[tool_name] = {"calls": 0, "cost": 0.0}

            tools[tool_name]["calls"] += 1
            tools[tool_name]["cost"] += entry.cost_tracked

        return {
            "tools": tools,
            "total_cost": total_cost,
            "total_calls": total_calls,
        }
