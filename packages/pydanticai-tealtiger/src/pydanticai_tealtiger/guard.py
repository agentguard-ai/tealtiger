"""TealTiger Governance Guard for Pydantic AI agents.

This guard provides deterministic governance as a Pydantic AI dependency:
- Zero-config mode: observe, track cost, detect PII, allow all (passthrough)
- Policy mode: evaluate policies via TealEngine, block if DENY

No LLM in the governance path. Typical evaluation: <2ms.
"""

from __future__ import annotations

import importlib
import json
import logging
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

# ─── PII Detection Patterns ─────────────────────────────────────────────────

_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone_us": re.compile(r"\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"),
    "phone_uk": re.compile(r"(?<!\w)\+44[-.\s]?(?:\d{2,4}[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b"),
    "phone_eu": re.compile(
        r"(?<!\w)(?:\+49[-.\s]?\d{2,4}[-.\s]?\d{5,8}|\+33[-.\s]?\d(?:[-.\s]?\d{2}){4})\b"
    ),
    "phone_in": re.compile(r"(?<!\w)\+91[-.\s]?[6-9]\d{4}[-.\s]?\d{5}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ip_address": re.compile(
        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
}

logger = logging.getLogger(__name__)


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

    reason_codes: list[str]
    """Machine-readable reason codes."""

    risk_score: int
    """Risk score (0-100)."""

    pii_detected: list[dict[str, Any]]
    """List of PII findings."""

    cost_tracked: float
    """Cost tracked for this evaluation."""

    cumulative_cost: float
    """Cumulative cost for the session."""

    evaluation_time_ms: float
    """Time taken for governance evaluation in milliseconds."""

    trace_id: str | None = None
    """Current OpenTelemetry trace ID, if available."""

    teec: dict[str, Any] = field(default_factory=dict)
    """TEEC namespace fields (teec.pydanticai)."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Additional metadata."""

    def to_dict(self) -> dict[str, Any]:
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


@dataclass
class ToolBaseline:
    """Behavioral baseline entry for a tool."""

    tool_name: str
    avg_cost_per_call: float
    total_calls: int
    total_cost: float
    pii_frequency: float
    denied_frequency: float


# ─── Exceptions ──────────────────────────────────────────────────────────────


class GovernanceDenyError(Exception):
    """Raised when a governance policy denies the request in ENFORCE mode."""

    def __init__(self, decision: dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(f"Governance DENY: {decision.get('reason', 'Policy violation')}")


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
        engine: Any | None = None,
        mode: str = "OBSERVE",
        cost_per_1k_tokens: float = 0.002,
        session_id: str | None = None,
        tool_allowlist: list[str] | None = None,
        budget_limit: float | None = None,
        anomaly_threshold: float = 200,
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
            anomaly_threshold: Percentage threshold for post-call cost anomaly
                               alerts. Default 200 means actual cost over 2x
                               the pre-call estimate is flagged.
        """
        self._engine = engine
        self._mode = GovernanceMode(mode)
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._session_id = session_id or str(uuid.uuid4())
        self._tool_allowlist: set[str] | None = set(tool_allowlist) if tool_allowlist else None
        self._budget_limit = budget_limit
        self._anomaly_threshold = anomaly_threshold

        # Session state
        self._cumulative_cost: float = 0.0
        self._call_count: int = 0
        self._audit_trail: list[AuditEntry] = []
        self._tool_attempts: dict[str, int] = {}
        self._tool_costs: dict[str, float] = {}
        self._tool_calls: dict[str, int] = {}
        self._tool_denied: dict[str, int] = {}
        self._tool_pii: dict[str, int] = {}
        self._frozen: bool = False
        self._last_estimated_cost_by_tool: dict[str, float] = {}

    # ─── evaluate (pre_call) ─────────────────────────────────────────────

    def evaluate(
        self,
        tool: str,
        args: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> dict[str, Any]:
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
        self._tool_attempts[tool] = self._tool_attempts.get(tool, 0) + 1

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
        pii_findings: list[PIIFinding] = []
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
        self._last_estimated_cost_by_tool[tool] = estimated_cost

        # ── Policy Evaluation ────────────────────────────────────────────
        action = GovernanceAction.ALLOW
        reason = "Allowed: zero-config observe mode"
        reason_codes: list[str] = ["OBSERVE_PASSTHROUGH"]
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
            trace_id=_get_current_trace_id(),
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
        args: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
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
        token_usage: dict[str, int] | None = None,
    ) -> dict[str, Any]:
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
                token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0),
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
            self._tool_pii[tool_name] = self._tool_pii.get(tool_name, 0) + len(pii_findings)

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(tool_name=tool_name, call_id=call_id)

        risk_score = 0
        if pii_findings:
            risk_score = min(len(pii_findings) * 20, 80)

        reason_codes = ["POST_CALL_AUDIT"]
        estimated_cost = self._last_estimated_cost_by_tool.get(tool_name, 0.0)
        if estimated_cost > 0:
            cost_ratio = (actual_cost / estimated_cost) * 100
            if cost_ratio > self._anomaly_threshold:
                logger.warning(
                    "Cost anomaly for tool %s: actual %.6f is %.0f%% of estimated %.6f "
                    "(threshold %.0f%%)",
                    tool_name,
                    actual_cost,
                    cost_ratio,
                    estimated_cost,
                    self._anomaly_threshold,
                )
                reason_codes.append("COST_ANOMALY")

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.ALLOW.value,
            mode=self._mode.value,
            phase="post_call",
            tool_name=tool_name,
            agent_id="default",
            reason="Post-call audit recorded",
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
            cost_tracked=actual_cost,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            trace_id=_get_current_trace_id(),
            teec=teec,
            metadata={
                "token_usage": token_usage,
                "result_length": len(result_str),
                "estimated_cost": estimated_cost,
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

    def export_audit_trail(self, path: str) -> int:
        """Export audit trail as JSONL and return the number of entries written."""
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                f.write(json.dumps(entry.to_dict()) + "\n")

        return len(self._audit_trail)
    def reset(self) -> None:
        """Reset session state, including cost, audit trail, call count, and freeze state."""
        self._cumulative_cost = 0.0
        self._call_count = 0
        self._audit_trail = []
        self._tool_costs = {}
        self._tool_calls = {}
        self._tool_denied = {}
        self._tool_pii = {}
        self._last_estimated_cost_by_tool = {}
        self._frozen = False

    # ─── Properties ──────────────────────────────────────────────────────

    @property
    def audit_trail(self) -> list[AuditEntry]:
        """Access the full audit trail of governance decisions."""
        return list(self._audit_trail)

    @property
    def summary(self) -> dict[str, ToolSummary]:
        """Get cost/call summary per tool.

        Returns:
            Dictionary mapping tool_name to ToolSummary.
        """
        result: dict[str, ToolSummary] = {}
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

    # ─── Baseline ────────────────────────────────────────────────────────

    def get_baseline(self) -> dict[str, ToolBaseline]:
        """Get a summary of observed tool behavior as a baseline.

        Returns:
            Dictionary mapping tool_name to baseline behavior summary.
        """
        result: dict[str, ToolBaseline] = {}
        all_tools = (
            set(self._tool_attempts.keys())
            | set(self._tool_costs.keys())
            | set(self._tool_pii.keys())
            | set(self._tool_denied.keys())
        )

        for tool_name in all_tools:
            calls = self._tool_attempts.get(tool_name, 0)
            cost = self._tool_costs.get(tool_name, 0.0)
            pii_count = self._tool_pii.get(tool_name, 0)
            denied_count = self._tool_denied.get(tool_name, 0)

            result[tool_name] = ToolBaseline(
                tool_name=tool_name,
                avg_cost_per_call=cost / calls if calls > 0 else 0.0,
                total_calls=calls,
                total_cost=cost,
                pii_frequency=pii_count / calls if calls > 0 else 0.0,
                denied_frequency=denied_count / calls if calls > 0 else 0.0,
            )

        return result

    # ─── Internal: Deny helpers ──────────────────────────────────────────

    def _deny_frozen(
        self,
        correlation_id: str,
        call_id: str,
        tool: str,
        agent_id: str,
        start_time: float,
    ) -> dict[str, Any]:
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
            trace_id=_get_current_trace_id(),
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
    ) -> dict[str, Any]:
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
            trace_id=_get_current_trace_id(),
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
    ) -> dict[str, Any]:
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
                f"Budget limit exceeded: ${self._cumulative_cost:.4f}/${self._budget_limit:.4f}"
            ),
            reason_codes=["BUDGET_LIMIT_EXCEEDED"],
            risk_score=85,
            pii_detected=[],
            cost_tracked=0.0,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            trace_id=_get_current_trace_id(),
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
        tool_name: str | None = None,
        call_id: str | None = None,
    ) -> dict[str, Any]:
        """Build TEEC namespace fields for teec.pydanticai.

        Returns:
            Dictionary with TEEC fields.
        """
        teec: dict[str, Any] = {
            "namespace": "teec.pydanticai",
            "session_id": self._session_id,
            "call_id": call_id or str(uuid.uuid4()),
        }

        if tool_name:
            teec["tool_name"] = tool_name

        return teec

    def _detect_pii(self, text: str) -> list[PIIFinding]:
        """Detect PII patterns in input text.

        Args:
            text: Input text to scan.

        Returns:
            List of PII findings with redacted values.
        """
        findings: list[PIIFinding] = []

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
        tool_args: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
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
                "reason": (f"Engine evaluation failed (fail-open in {self._mode.value}): {e}"),
                "reason_codes": ["ENGINE_ERROR", "FAIL_OPEN"],
                "risk_score": 50,
            }


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
