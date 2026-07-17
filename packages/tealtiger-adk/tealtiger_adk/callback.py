"""TealTiger governance callback for Google Agent Development Kit (ADK).

Provides before_tool_callback and after_tool_callback hooks that enforce
governance policies (PII detection, tool allowlisting, cost budgets, kill switch)
before tools execute in Google ADK agents.

Usage:
    from google.adk import Agent
    from tealtiger_adk import TealTigerCallback

    governance = TealTigerCallback(
        policies=[
            {"type": "pii_block", "categories": ["ssn", "credit_card"]},
            {"type": "cost_limit", "max_per_session": 5.00},
        ],
        mode="ENFORCE",
    )

    agent = Agent(
        model="gemini-2.0-flash",
        tools=[search_tool, code_tool],
        before_tool_callback=governance.before_tool,
        after_tool_callback=governance.after_tool,
    )
"""

from __future__ import annotations

import re
import uuid
import time
from typing import Any, Callable, Dict, List, Optional


# PII patterns
_PII_PATTERNS: Dict[str, re.Pattern] = {
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone": re.compile(r"\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "ip_address": re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
}

# Secret patterns
_SECRET_PATTERNS: List[re.Pattern] = [
    re.compile(r"\b(sk-[a-zA-Z0-9]{20,})\b"),       # OpenAI keys
    re.compile(r"\b(ghp_[a-zA-Z0-9]{36,})\b"),      # GitHub PATs
    re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),           # AWS access keys
    re.compile(r"\b(gsk_[a-zA-Z0-9]{20,})\b"),      # Groq keys
    re.compile(r"\b(AIza[0-9A-Za-z_-]{35})\b"),     # Google API keys
]


class TealTigerCallback:
    """Deterministic governance callback for Google ADK agents.

    Evaluates governance policies before tool execution and records
    audit entries after execution completes. Supports OBSERVE, MONITOR,
    and ENFORCE modes.

    Args:
        policies: List of governance policy dicts. Supported types:
            - ``{"type": "pii_block", "categories": ["ssn", "credit_card"]}``
            - ``{"type": "cost_limit", "max_per_session": 5.00}``
            - ``{"type": "tool_allowlist", "allowed": ["google_search", "code_*"]}``
            - ``{"type": "secret_detection"}``
        mode: Governance mode — "OBSERVE" (log only), "MONITOR" (log + warn),
            or "ENFORCE" (log + block).
        agent_id: Agent identifier for audit correlation.
        on_decision: Optional callback invoked with each governance decision dict.
        cost_per_call: Estimated cost per tool call in USD (default: 0.002).

    Example:
        >>> from tealtiger_adk import TealTigerCallback
        >>> cb = TealTigerCallback(
        ...     policies=[{"type": "pii_block", "categories": ["ssn"]}],
        ...     mode="ENFORCE",
        ... )
        >>> # Use with Google ADK Agent
        >>> # agent = Agent(before_tool_callback=cb.before_tool, ...)
    """

    def __init__(
        self,
        policies: Optional[List[Dict[str, Any]]] = None,
        mode: str = "OBSERVE",
        agent_id: Optional[str] = None,
        on_decision: Optional[Callable[[Dict[str, Any]], None]] = None,
        cost_per_call: float = 0.002,
    ):
        self.policies = policies or []
        self.mode = mode.upper()
        if self.mode not in ("OBSERVE", "MONITOR", "ENFORCE"):
            raise ValueError(f"Invalid mode '{self.mode}'. Must be OBSERVE, MONITOR, or ENFORCE.")
        self.agent_id = agent_id or f"adk-agent-{str(uuid.uuid4())[:8]}"
        self.on_decision = on_decision
        self.cost_per_call = cost_per_call
        self._decisions: List[Dict[str, Any]] = []
        self._cumulative_cost: float = 0.0
        self._frozen: bool = False

    def before_tool(self, callback_context, tool, args, tool_context=None):
        """Before-tool callback for Google ADK.

        Evaluates governance policies before tool execution.
        Returns a dict to block execution (ADK pattern), or None to allow.

        Args:
            callback_context: ADK callback context (CallbackContext).
            tool: The tool being called (BaseTool or str).
            args: Tool arguments dict.
            tool_context: Optional tool context (ToolContext).

        Returns:
            None to allow execution, or a dict with ``content`` key to block.
        """
        start_time = time.perf_counter()
        tool_name = getattr(tool, "name", str(tool)) if not isinstance(tool, str) else tool
        correlation_id = str(uuid.uuid4())

        # Evaluate policies
        action = "ALLOW"
        reason_codes: List[str] = []
        risk_score = 0

        # Check freeze
        if self._frozen:
            action = "DENY"
            reason_codes.append("AGENT_FROZEN")
            risk_score = 100

        # Tool allowlist check
        if action == "ALLOW":
            action, reason_codes, risk_score = self._check_tool_allowlist(
                tool_name, action, reason_codes, risk_score
            )

        # PII detection
        if action == "ALLOW":
            action, reason_codes, risk_score = self._check_pii(
                args, action, reason_codes, risk_score
            )

        # Secret detection
        if action == "ALLOW":
            action, reason_codes, risk_score = self._check_secrets(
                args, action, reason_codes, risk_score
            )

        # Cost limit check
        if action == "ALLOW":
            action, reason_codes, risk_score = self._check_cost_limit(
                action, reason_codes, risk_score
            )

        eval_time = (time.perf_counter() - start_time) * 1000

        # Record decision
        decision = {
            "correlation_id": correlation_id,
            "timestamp_ms": time.time() * 1000,
            "action": action,
            "mode": self.mode,
            "tool_name": tool_name,
            "agent_id": self.agent_id,
            "reason_codes": reason_codes or (["POLICY_ALLOW"] if action == "ALLOW" else []),
            "risk_score": risk_score,
            "evaluation_time_ms": round(eval_time, 3),
            "cost_tracked": self.cost_per_call if action == "ALLOW" else 0.0,
            "cumulative_cost": self._cumulative_cost,
        }
        self._decisions.append(decision)

        if self.on_decision:
            self.on_decision(decision)

        # Track cost for allowed actions
        if action == "ALLOW":
            self._cumulative_cost += self.cost_per_call

        # Mode-based behavior
        if self.mode == "ENFORCE" and action == "DENY":
            reason = ", ".join(reason_codes)
            return {
                "content": (
                    f"[GOVERNANCE DENIED] Tool '{tool_name}' blocked. "
                    f"Reason: {reason}. Decision ID: {correlation_id}"
                )
            }

        # OBSERVE and MONITOR modes: allow through
        return None

    def after_tool(self, callback_context, tool, args, tool_context=None, result=None):
        """After-tool callback for audit trail.

        Records the tool execution result in the governance audit log.

        Args:
            callback_context: ADK callback context.
            tool: The tool that was called.
            args: Tool arguments dict.
            tool_context: Optional tool context.
            result: Tool execution result.

        Returns:
            None (never blocks after execution).
        """
        if self._decisions:
            self._decisions[-1]["execution_outcome"] = "executed"
        return None

    def freeze(self) -> None:
        """Freeze this agent — blocks all subsequent tool calls."""
        self._frozen = True

    def unfreeze(self) -> None:
        """Unfreeze this agent — restores normal governance evaluation."""
        self._frozen = False

    @property
    def is_frozen(self) -> bool:
        """Whether the agent is currently frozen."""
        return self._frozen

    @property
    def decisions(self) -> List[Dict[str, Any]]:
        """All governance decisions made during this session."""
        return list(self._decisions)

    @property
    def deny_count(self) -> int:
        """Count of denied tool calls."""
        return sum(1 for d in self._decisions if d["action"] == "DENY")

    @property
    def allow_count(self) -> int:
        """Count of allowed tool calls."""
        return sum(1 for d in self._decisions if d["action"] == "ALLOW")

    @property
    def total_cost(self) -> float:
        """Cumulative cost tracked across all allowed tool calls."""
        return self._cumulative_cost

    def reset(self) -> None:
        """Reset all state — decisions, cost, frozen status."""
        self._decisions.clear()
        self._cumulative_cost = 0.0
        self._frozen = False

    # ─── Private policy evaluation helpers ───────────────────────────────

    def _check_tool_allowlist(
        self, tool_name: str, action: str, reason_codes: List[str], risk_score: int
    ):
        for policy in self.policies:
            if policy.get("type") == "tool_allowlist":
                allowed = policy.get("allowed", [])
                if not any(
                    tool_name == p or (p.endswith("*") and tool_name.startswith(p[:-1]))
                    for p in allowed
                ):
                    action = "DENY"
                    reason_codes.append("TOOL_NOT_ALLOWED")
                    risk_score = max(risk_score, 80)
                    break
        return action, reason_codes, risk_score

    def _check_pii(
        self, args: Any, action: str, reason_codes: List[str], risk_score: int
    ):
        args_text = str(args)
        for policy in self.policies:
            if policy.get("type") == "pii_block":
                categories = policy.get("categories", list(_PII_PATTERNS.keys()))
                for cat in categories:
                    pattern = _PII_PATTERNS.get(cat)
                    if pattern and pattern.search(args_text):
                        action = "DENY"
                        reason_codes.append(f"PII_DETECTED:{cat}")
                        risk_score = max(risk_score, 90)
                if action == "DENY":
                    break
        return action, reason_codes, risk_score

    def _check_secrets(
        self, args: Any, action: str, reason_codes: List[str], risk_score: int
    ):
        args_text = str(args)
        for policy in self.policies:
            if policy.get("type") == "secret_detection":
                if any(p.search(args_text) for p in _SECRET_PATTERNS):
                    action = "DENY"
                    reason_codes.append("SECRET_DETECTED")
                    risk_score = max(risk_score, 95)
                    break
        return action, reason_codes, risk_score

    def _check_cost_limit(
        self, action: str, reason_codes: List[str], risk_score: int
    ):
        for policy in self.policies:
            if policy.get("type") == "cost_limit":
                limit = policy.get("max_per_session", float("inf"))
                if self._cumulative_cost >= limit:
                    action = "DENY"
                    reason_codes.append("BUDGET_EXCEEDED")
                    risk_score = max(risk_score, 70)
                    break
        return action, reason_codes, risk_score
