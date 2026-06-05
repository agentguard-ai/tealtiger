"""TealTiger Governance Guard for Pydantic AI agents.

This guard provides deterministic governance as a Pydantic AI dependency:
- Zero-config mode: observe, track cost, detect PII, allow all (passthrough)
- Policy mode: evaluate policies via TealEngine, block if DENY

No LLM in the governance path. Typical evaluation: <2ms.
"""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set


# ─── PII Detection Patterns ─────────────────────────────────────────────────

_PII_PATTERNS: Dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone_us": re.compile(
        r"\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
    ),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ip_address": re.compile(
        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
}


# ─── Types ───────────────────────────────────────────────────────────────────


class GovernanceAction(str, Enum):
    """Action resulting from governance evaluation."""

    ALLOW = "ALLOW"
    DENY = "DENY"
    MODIFY = "MODIFY"


class GovernanceMode(str, Enum):
    """Governance enforcement mode."""

    ENFORCE = "ENFORCE"
    """Block denied actions. Production default."""

    MONITOR = "MONITOR"
    """Allow all actions, log decisions. Good for staging."""

    OBSERVE = "OBSERVE"
    """Zero-config: observe, track, detect, allow all."""


@dataclass
class PIIFinding:
    """A detected PII occurrence."""

    pii_type: str
    """Type of PII detected (email, phone_us, ssn, credit_card, ip_address)."""

    start: int
    """Start character index in the input text."""

    end: int
    """End character index in the input text."""

    redacted_value: str
    """Redacted version of the detected value."""


@dataclass
class AuditEntry:
    """Structured audit entry for a governance evaluation."""

    correlation_id: str
    """UUID v4 correlation ID for tracing."""

    timestamp_ms: float
    """Unix timestamp in milliseconds when evaluation occurred."""

    action: str
    """Governance action taken: ALLOW, DENY, or MODIFY."""

    mode: str
    """Governance mode: ENFORCE, MONITOR, or OBSERVE."""

    phase: str
    """Phase: pre_call or post_call."""

    tool_name: str
    """Tool name being evaluated."""

    agent_id: str
    """Agent identifier."""

    reason: str
    """Human-readable reason for the decision."""

    reason_codes: List[str]
    """Machine-readable reason codes."""

    risk_score: int
    """Risk score (0-100)."""

    pii_detected: List[Dict[str, Any]]
    """List of PII findings."""

    cost_tracked: float
    """Cost tracked for this evaluation."""

    cumulative_cost: float
    """Cumulative cost for the session."""

    evaluation_time_ms: float
    """Time taken for governance evaluation in milliseconds."""

    teec: Dict[str, Any] = field(default_factory=dict)
    """TEEC namespace fields (teec.pydanticai)."""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """Additional metadata."""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


@dataclass
class ToolSummary:
    """Cost and call summary for a single tool."""

    tool_name: str
    total_cost: float = 0.0
    call_count: int = 0
    denied_count: int = 0
    pii_findings_count: int = 0


# ─── Exceptions ──────────────────────────────────────────────────────────────


class GovernanceDenyError(Exception):
    """Raised when a governance policy denies the request in ENFORCE mode."""

    def __init__(self, decision: Dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(
            f"Governance DENY: {decision.get('reason', 'Policy violation')}"
        )


# ─── TealTigerGuard ─────────────────────────────────────────────────────────


class TealTigerGuard:
    """Deterministic governance guard for Pydantic AI agents.

    Designed to be used as a Pydantic AI dependency (deps_type=TealTigerGuard).
    Operates in two modes:

    1. **Zero-config mode** (default): Observe all traffic, track cost estimates,
       detect PII in tool arguments, and allow everything through unchanged.
       Produces structured audit entries for observability.

    2. **Policy mode**: When a TealEngine instance is provided, evaluates configured
       policies. If a policy returns DENY and mode is ENFORCE, raises
       GovernanceDenyError.

    Usage:
        from pydantic_ai import Agent
        from pydanticai_tealtiger import TealTigerGuard

        guard = TealTigerGuard()
        agent = Agent('openai:gpt-4', deps_type=TealTigerGuard)

        @agent.tool
        async def search(ctx, query: str) -> str:
            ctx.deps.evaluate(tool="search", args={"query": query})
            return "results"

    TEEC Namespace (teec.pydanticai):
        - session_id: Unique session identifier
        - tool_name: Tool being evaluated
        - call_id: Unique call identifier
    """

    def __init__(
        self,
        engine: Optional[Any] = None,
        mode: str = "OBSERVE",
        cost_per_1k_tokens: float = 0.002,
        session_id: Optional[str] = None,
        tool_allowlist: Optional[List[str]] = None,
        budget_limit: Optional[float] = None,
    ) -> None:
        """Initialize the governance guard.

        Args:
            engine: Optional TealEngine instance for policy evaluation.
                    When None, operates in zero-config observe mode.
            mode: Governance mode — "OBSERVE", "MONITOR", or "ENFORCE".
                  Defaults to "OBSERVE" (zero-config).
            cost_per_1k_tokens: Estimated cost per 1000 tokens for cost tracking.
                                Defaults to $0.002.
            session_id: Optional session identifier. Auto-generated if not provided.
            tool_allowlist: Optional list of allowed tool names. If set,
                           tools not in this list will be denied.
            budget_limit: Optional maximum cost per session in USD.
                          When exceeded, subsequent calls are denied in ENFORCE mode.
        """
        self._engine = engine
        self._mode = GovernanceMode(mode)
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._session_id = session_id or str(uuid.uuid4())
        self._tool_allowlist: Optional[Set[str]] = (
            set(tool_allowlist) if tool_allowlist else None
        )
        self._budget_limit = budget_limit

        # Session state
        self._cumulative_cost: float = 0.0
        self._call_count: int = 0
        self._audit_trail: List[AuditEntry] = []
        self._tool_costs: Dict[str, float] = {}
        self._tool_calls: Dict[str, int] = {}
        self._tool_denied: Dict[str, int] = {}
        self._tool_pii: Dict[str, int] = {}
        self._frozen: bool = False

    # ─── evaluate (pre_call) ─────────────────────────────────────────────

    def evaluate(
        self,
        tool: str,
        args: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Evaluate governance before a tool execution.

        This is the primary method to call inside Pydantic AI tool functions.

        Args:
            tool: Name of the tool being invoked.
            args: Optional arguments for the tool.
            agent_id: Optional agent identifier for multi-agent setups.

        Returns:
            Dictionary with governance decision.

        Raises:
            GovernanceDenyError: When blocked in ENFORCE mode.
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        call_id = str(uuid.uuid4())
        self._call_count += 1

        effective_agent_id = agent_id or "default"

        # ── Frozen check (kill switch) ───────────────────────────────────
        if self._frozen:
            return self._deny_frozen(
                correlation_id=correlation_id,
                call_id=call_id,
                tool=tool,
                agent_id=effective_agent_id,
                start_time=start_time,
            )

        # ── Tool allowlist check ─────────────────────────────────────────
        if self._tool_allowlist is not None and tool not in self._tool_allowlist:
            return self._deny_tool_not_allowed(
                correlation_id=correlation_id,
                call_id=call_id,
                tool=tool,
                agent_id=effective_agent_id,
                start_time=start_time,
            )

        # ── Budget limit check ───────────────────────────────────────────
        if self._budget_limit is not None and self._cumulative_cost >= self._budget_limit:
            return self._deny_budget_exceeded(
                correlation_id=correlation_id,
                call_id=call_id,
                tool=tool,
                agent_id=effective_agent_id,
                start_time=start_time,
            )

        # ── PII Detection in args ───────────────────────────────────────
        pii_findings: List[PIIFinding] = []
        args_text = ""
        if args:
            args_text = " ".join(str(v) for v in args.values())
            pii_findings = self._detect_pii(args_text)
            if pii_findings:
                self._tool_pii[tool] = self._tool_pii.get(tool, 0) + len(pii_findings)

        # ── Cost Tracking ────────────────────────────────────────────────
        estimated_tokens = max(len(args_text) / 4, 1)
        estimated_cost = (estimated_tokens / 1000) * self._cost_per_1k_tokens
        self._cumulative_cost += estimated_cost
        self._tool_costs[tool] = self._tool_costs.get(tool, 0) + estimated_cost
        self._tool_calls[tool] = self._tool_calls.get(tool, 0) + 1

        # ── Policy Evaluation ────────────────────────────────────────────
        action = GovernanceAction.ALLOW
        reason = "Allowed: zero-config observe mode"
        reason_codes: List[str] = ["OBSERVE_PASSTHROUGH"]
        risk_score = 0

        if self._engine is not None:
            engine_decision = self._evaluate_with_engine(
                agent_id=effective_agent_id,
                tool_name=tool,
                tool_args=args,
            )
            action = GovernanceAction(engine_decision.get("action", "ALLOW"))
            reason = engine_decision.get("reason", "Policy evaluated")
            reason_codes = engine_decision.get("reason_codes", ["POLICY_EVALUATED"])
            risk_score = engine_decision.get("risk_score", 0)
        elif pii_findings:
            reason = (
                f"PII detected ({len(pii_findings)} finding(s)) — "
                f"allowed in {self._mode.value} mode"
            )
            reason_codes = ["PII_DETECTED", "OBSERVE_PASSTHROUGH"]
            risk_score = min(len(pii_findings) * 20, 80)

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool, call_id=call_id)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=action.value,
            mode=self._mode.value,
            phase="pre_call",
            tool_name=tool,
            agent_id=effective_agent_id,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            pii_detected=[
                {
                    "type": f.pii_type,
                    "start": f.start,
                    "end": f.end,
                    "redacted": f.redacted_value,
                }
                for f in pii_findings
            ],
            cost_tracked=estimated_cost,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            metadata={
                "call_count": self._call_count,
                "tool_args": args,
            },
        )
        self._audit_trail.append(audit_entry)

        # ── Handle DENY ──────────────────────────────────────────────────
        decision_dict = audit_entry.to_dict()

        if action == GovernanceAction.DENY:
            self._tool_denied[tool] = self._tool_denied.get(tool, 0) + 1
            if self._mode == GovernanceMode.ENFORCE:
                raise GovernanceDenyError(decision_dict)

        return decision_dict

    # ─── pre_call (alias for evaluate) ───────────────────────────────────

    def pre_call(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Alias for evaluate() with a more intuitive name.

        Args:
            tool_name: Name of the tool being invoked.
            args: Optional arguments for the tool.

        Returns:
            Dictionary with governance decision.

        Raises:
            GovernanceDenyError: When blocked in ENFORCE mode.
        """
        return self.evaluate(tool=tool_name, args=args)

    # ─── post_call ───────────────────────────────────────────────────────

    def post_call(
        self,
        tool_name: str,
        result: Any,
        token_usage: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """Record cost after a tool execution completes.

        Args:
            tool_name: Name of the tool that was invoked.
            result: Result of the tool execution.
            token_usage: Optional token usage dict with keys like
                         "prompt_tokens", "completion_tokens", "total_tokens".

        Returns:
            Dictionary with post-call audit entry.
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        call_id = str(uuid.uuid4())

        # ── Cost Tracking from token_usage ───────────────────────────────
        actual_cost = 0.0
        if token_usage:
            total_tokens = token_usage.get(
                "total_tokens",
                token_usage.get("prompt_tokens", 0)
                + token_usage.get("completion_tokens", 0),
            )
            actual_cost = (total_tokens / 1000) * self._cost_per_1k_tokens
        else:
            # Estimate from result text length
            result_str = str(result) if result is not None else ""
            estimated_tokens = max(len(result_str) / 4, 1)
            actual_cost = (estimated_tokens / 1000) * self._cost_per_1k_tokens

        self._cumulative_cost += actual_cost
        self._tool_costs[tool_name] = self._tool_costs.get(tool_name, 0) + actual_cost

        # ── PII Detection in output ──────────────────────────────────────
        result_str = str(result) if result is not None else ""
        pii_findings = self._detect_pii(result_str)
        if pii_findings:
            self._tool_pii[tool_name] = (
                self._tool_pii.get(tool_name, 0) + len(pii_findings)
            )

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool_name, call_id=call_id)

        risk_score = 0
        if pii_findings:
            risk_score = min(len(pii_findings) * 20, 80)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.ALLOW.value,
            mode=self._mode.value,
            phase="post_call",
            tool_name=tool_name,
            agent_id="default",
            reason="Post-call audit recorded",
            reason_codes=["POST_CALL_AUDIT"],
            risk_score=risk_score,
            pii_detected=[
                {
                    "type": f.pii_type,
                    "start": f.start,
                    "end": f.end,
                    "redacted": f.redacted_value,
                }
                for f in pii_findings
            ],
            cost_tracked=actual_cost,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            metadata={
                "token_usage": token_usage,
                "result_length": len(result_str),
            },
        )
        self._audit_trail.append(audit_entry)

        return audit_entry.to_dict()

    # ─── Kill Switch ─────────────────────────────────────────────────────

    def freeze(self) -> None:
        """Freeze the guard — kill switch that blocks all subsequent calls."""
        self._frozen = True

    def unfreeze(self) -> None:
        """Unfreeze a previously frozen guard."""
        self._frozen = False

    # ─── Properties ──────────────────────────────────────────────────────

    @property
    def audit_trail(self) -> List[AuditEntry]:
        """Access the full audit trail of governance decisions."""
        return list(self._audit_trail)

    @property
    def summary(self) -> Dict[str, ToolSummary]:
        """Get cost/call summary per tool.

        Returns:
            Dictionary mapping tool_name to ToolSummary.
        """
        result: Dict[str, ToolSummary] = {}
        all_tools = set(self._tool_costs.keys()) | set(self._tool_calls.keys())

        for tool_name in all_tools:
            result[tool_name] = ToolSummary(
                tool_name=tool_name,
                total_cost=self._tool_costs.get(tool_name, 0.0),
                call_count=self._tool_calls.get(tool_name, 0),
                denied_count=self._tool_denied.get(tool_name, 0),
                pii_findings_count=self._tool_pii.get(tool_name, 0),
            )

        return result

    @property
    def cumulative_cost(self) -> float:
        """Get the cumulative tracked cost for this session."""
        return self._cumulative_cost

    @property
    def session_id(self) -> str:
        """Get the session identifier."""
        return self._session_id

    # ─── Internal: Deny helpers ──────────────────────────────────────────

    def _deny_frozen(
        self,
        correlation_id: str,
        call_id: str,
        tool: str,
        agent_id: str,
        start_time: float,
    ) -> Dict[str, Any]:
        """Handle deny for frozen guard."""
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool, call_id=call_id)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.DENY.value,
            mode=self._mode.value,
            phase="pre_call",
            tool_name=tool,
            agent_id=agent_id,
            reason="Guard is frozen (kill switch active)",
            reason_codes=["GUARD_FROZEN", "KILL_SWITCH"],
            risk_score=100,
            pii_detected=[],
            cost_tracked=0.0,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            metadata={"call_count": self._call_count},
        )
        self._audit_trail.append(audit_entry)
        self._tool_denied[tool] = self._tool_denied.get(tool, 0) + 1

        decision_dict = audit_entry.to_dict()

        if self._mode == GovernanceMode.ENFORCE:
            raise GovernanceDenyError(decision_dict)

        return decision_dict

    def _deny_tool_not_allowed(
        self,
        correlation_id: str,
        call_id: str,
        tool: str,
        agent_id: str,
        start_time: float,
    ) -> Dict[str, Any]:
        """Handle deny for tool not in allowlist."""
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool, call_id=call_id)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.DENY.value,
            mode=self._mode.value,
            phase="pre_call",
            tool_name=tool,
            agent_id=agent_id,
            reason=f"Tool '{tool}' not in allowlist: {sorted(self._tool_allowlist or [])}",
            reason_codes=["TOOL_NOT_ALLOWED"],
            risk_score=90,
            pii_detected=[],
            cost_tracked=0.0,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            metadata={
                "call_count": self._call_count,
                "tool_allowlist": sorted(self._tool_allowlist or []),
            },
        )
        self._audit_trail.append(audit_entry)
        self._tool_denied[tool] = self._tool_denied.get(tool, 0) + 1

        decision_dict = audit_entry.to_dict()

        if self._mode == GovernanceMode.ENFORCE:
            raise GovernanceDenyError(decision_dict)

        return decision_dict

    def _deny_budget_exceeded(
        self,
        correlation_id: str,
        call_id: str,
        tool: str,
        agent_id: str,
        start_time: float,
    ) -> Dict[str, Any]:
        """Handle deny for budget limit exceeded."""
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool, call_id=call_id)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.DENY.value,
            mode=self._mode.value,
            phase="pre_call",
            tool_name=tool,
            agent_id=agent_id,
            reason=(
                f"Budget limit exceeded: "
                f"${self._cumulative_cost:.4f}/${self._budget_limit:.4f}"
            ),
            reason_codes=["BUDGET_LIMIT_EXCEEDED"],
            risk_score=85,
            pii_detected=[],
            cost_tracked=0.0,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            metadata={
                "call_count": self._call_count,
                "budget_limit": self._budget_limit,
            },
        )
        self._audit_trail.append(audit_entry)
        self._tool_denied[tool] = self._tool_denied.get(tool, 0) + 1

        decision_dict = audit_entry.to_dict()

        if self._mode == GovernanceMode.ENFORCE:
            raise GovernanceDenyError(decision_dict)

        return decision_dict

    # ─── Internal Methods ────────────────────────────────────────────────

    def _build_teec(
        self,
        tool_name: Optional[str] = None,
        call_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build TEEC namespace fields for teec.pydanticai.

        Returns:
            Dictionary with TEEC fields.
        """
        teec: Dict[str, Any] = {
            "namespace": "teec.pydanticai",
            "session_id": self._session_id,
            "call_id": call_id or str(uuid.uuid4()),
        }

        if tool_name:
            teec["tool_name"] = tool_name

        return teec

    def _detect_pii(self, text: str) -> List[PIIFinding]:
        """Detect PII patterns in input text.

        Args:
            text: Input text to scan.

        Returns:
            List of PII findings with redacted values.
        """
        findings: List[PIIFinding] = []

        for pii_type, pattern in _PII_PATTERNS.items():
            for match in pattern.finditer(text):
                value = match.group()
                # Redact: keep first 2 and last 2 chars, mask the rest
                if len(value) > 4:
                    redacted = value[:2] + "*" * (len(value) - 4) + value[-2:]
                else:
                    redacted = "*" * len(value)

                findings.append(
                    PIIFinding(
                        pii_type=pii_type,
                        start=match.start(),
                        end=match.end(),
                        redacted_value=redacted,
                    )
                )

        return findings

    def _evaluate_with_engine(
        self,
        agent_id: str,
        tool_name: str,
        tool_args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Evaluate content against TealEngine policies.

        Args:
            agent_id: Agent making the request.
            tool_name: Tool being invoked.
            tool_args: Optional tool arguments.

        Returns:
            Decision dictionary from TealEngine.
        """
        try:
            decision = self._engine.evaluate(  # type: ignore[union-attr]
                request={
                    "tool_name": tool_name,
                    "tool_args": tool_args,
                    "agent_id": agent_id,
                    "context": {
                        "framework": "pydantic-ai",
                        "guard": "TealTigerGuard",
                        "session_id": self._session_id,
                        "cumulative_cost": self._cumulative_cost,
                    },
                }
            )

            # Handle both dict and object responses from TealEngine
            if isinstance(decision, dict):
                return decision

            return {
                "action": getattr(decision, "action", "ALLOW"),
                "reason": getattr(decision, "reason", ""),
                "reason_codes": getattr(decision, "reason_codes", []),
                "risk_score": getattr(decision, "risk_score", 0),
            }
        except Exception as e:
            # Fail-closed: if engine errors, deny in ENFORCE mode
            if self._mode == GovernanceMode.ENFORCE:
                return {
                    "action": "DENY",
                    "reason": f"Engine evaluation failed (fail-closed): {e}",
                    "reason_codes": ["ENGINE_ERROR", "FAIL_CLOSED"],
                    "risk_score": 100,
                }
            # In MONITOR/OBSERVE, allow through despite error
            return {
                "action": "ALLOW",
                "reason": (
                    f"Engine evaluation failed "
                    f"(fail-open in {self._mode.value}): {e}"
                ),
                "reason_codes": ["ENGINE_ERROR", "FAIL_OPEN"],
                "risk_score": 50,
            }
