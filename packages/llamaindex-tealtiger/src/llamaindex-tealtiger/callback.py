"""TealTiger governance callback handler for LlamaIndex.

This module provides deterministic governance for LlamaIndex RAG pipelines
via the standard callback mechanism. It intercepts LLM, RETRIEVE, and TOOL
events to enforce policies, track cost, and detect PII/secrets.

No LLM in the governance path. Typical evaluation: <2ms.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from llama_index.core.callbacks import CBEventType
from llama_index.core.callbacks.base_handler import BaseCallbackHandler

logger = logging.getLogger(__name__)

# ─── Adapter metadata ────────────────────────────────────────────────────────

ADAPTER_SOURCE = "llamaindex-tealtiger"

# ─── PII Detection Patterns ──────────────────────────────────────────────────

_PII_PATTERNS: Dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone_us": re.compile(
        r"\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
    ),
    "phone_intl": re.compile(
        r"(?<!\w)\+(?:44|49|33|91)[-.\s]?\d{2,4}[-.\s]?\d{3,8}\b"
    ),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ip_address": re.compile(
        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
        r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
}

# ─── Secret Detection Patterns ───────────────────────────────────────────────

_SECRET_PATTERNS: List[re.Pattern[str]] = [
    re.compile(
        r"(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,}",
        re.IGNORECASE,
    ),
    re.compile(r"ghp_[A-Za-z0-9]{36}"),
    re.compile(r"sk_live_[A-Za-z0-9]{24,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"sk-[A-Za-z0-9]{32,}"),
]


# ─── Cost Defaults ────────────────────────────────────────────────────────────

_DEFAULT_COST_PER_1K_INPUT = 0.002
_DEFAULT_COST_PER_1K_OUTPUT = 0.006


# ─── Types ────────────────────────────────────────────────────────────────────


class GovernanceMode(str, Enum):
    """Governance enforcement mode."""

    OBSERVE = "OBSERVE"
    """Zero-config: log all events, track cost, detect PII. Never block."""

    MONITOR = "MONITOR"
    """Allow all events, log denials as warnings."""

    ENFORCE = "ENFORCE"
    """Block denied actions by raising GovernanceDenyError."""


class GovernanceDenyError(Exception):
    """Raised when a governance policy denies the request in ENFORCE mode.

    Attributes:
        decision: Dictionary containing full decision details including
            reason, reason_codes, risk_score, and correlation_id.
    """

    def __init__(self, decision: Dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(
            f"Governance DENY: {decision.get('reason', 'Policy violation')}"
        )


@dataclass
class PIIFinding:
    """A detected PII occurrence."""

    pii_type: str
    start: int
    end: int
    redacted_value: str


@dataclass
class GovernanceDecision:
    """A single governance decision record."""

    correlation_id: str
    timestamp_ms: float
    event_type: str
    action: str
    mode: str
    tool_name: str
    reason: str
    reason_codes: List[str]
    risk_score: int
    pii_findings: List[Dict[str, Any]] = field(default_factory=list)
    secrets_detected: int = 0
    cost_tracked: float = 0.0
    cumulative_cost: float = 0.0
    evaluation_time_ms: float = 0.0
    params_hash: Optional[str] = None
    adapter_source: str = ADAPTER_SOURCE
    agent_id: str = ""
    session_id: str = ""
    event_id: str = ""
    proposed_call_id: Optional[str] = None
    trace_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# ─── TealTigerCallback ────────────────────────────────────────────────────────


class TealTigerCallback(BaseCallbackHandler):
    """Deterministic governance callback handler for LlamaIndex.

    Intercepts LLM, RETRIEVE, and TOOL events to enforce policies, track
    cost, and detect PII/secrets. Plugs into LlamaIndex's CallbackManager.

    Modes:
        OBSERVE — Log everything, never block (default, zero-config).
        MONITOR — Log + emit warnings on policy violations.
        ENFORCE — Block denied actions before dispatch by raising
                  GovernanceDenyError.

    Example:
        from llama_index.core import Settings
        from llamaindex_tealtiger import TealTigerCallback

        Settings.callback_manager.add_handler(TealTigerCallback())
    """

    def __init__(
        self,
        mode: str = "OBSERVE",
        policies: Optional[List[Dict[str, Any]]] = None,
        engine: Any = None,
        budget: Optional[float] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """Initialize the TealTiger callback handler.

        Args:
            mode: Governance mode — "OBSERVE", "MONITOR", or "ENFORCE".
            policies: Optional list of policy configurations. Each policy
                is a dict with at minimum a "type" key.
            engine: Optional TealEngine instance for advanced policy
                evaluation. When None, uses built-in rule evaluation.
            budget: Optional maximum cost budget in USD for the session.
            agent_id: Optional agent identifier for multi-agent setups.
            session_id: Optional session identifier. Auto-generated if omitted.
        """
        super().__init__(
            event_starts_to_ignore=[],
            event_ends_to_ignore=[],
        )
        self._mode = GovernanceMode(mode)
        self._policies = policies or []
        self._engine = engine
        self._budget = budget
        self._agent_id = agent_id or f"llamaindex-{uuid.uuid4().hex[:8]}"
        self._session_id = session_id or str(uuid.uuid4())

        # Session state
        self._cumulative_cost: float = 0.0
        self._decisions: List[GovernanceDecision] = []
        self._pending_events: Dict[str, Dict[str, Any]] = {}

        # Parse policies
        self._tool_allowlist: Optional[Set[str]] = None
        self._tool_blocklist: Set[str] = set()
        self._policy_timeout: Optional[float] = None
        self._parse_policies()

    def _parse_policies(self) -> None:
        """Parse policy configurations into internal state."""
        for policy in self._policies:
            ptype = policy.get("type", "")
            if ptype == "tool_allowlist":
                self._tool_allowlist = set(policy.get("tools", []))
            elif ptype == "tool_blocklist":
                self._tool_blocklist = set(policy.get("tools", []))
            elif ptype == "timeout":
                self._policy_timeout = policy.get("seconds")

    # ─── LlamaIndex Callback Interface ───────────────────────────────────

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> str:
        """Intercept event start for governance evaluation.

        Handles TOOL, RETRIEVE, and LLM events. In ENFORCE mode, may raise
        GovernanceDenyError before the event proceeds.

        Args:
            event_type: The LlamaIndex callback event type.
            payload: Event payload with tool/query details.
            event_id: Unique identifier for this event.
            parent_id: Parent event identifier.
            **kwargs: Additional keyword arguments.

        Returns:
            The event_id (pass-through for LlamaIndex).

        Raises:
            GovernanceDenyError: In ENFORCE mode when a policy denies.
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        proposed_call_id = str(uuid.uuid4())
        payload = payload or {}

        # Extract tool/query info from payload
        tool_name = self._extract_tool_name(event_type, payload)
        tool_args = self._extract_args(event_type, payload)

        # Compute params hash for reproducibility
        params_hash = self._compute_params_hash(tool_args)

        # Detect PII in arguments
        args_text = json.dumps(tool_args, default=str) if tool_args else ""
        pii_findings = self._detect_pii(args_text)
        secrets_count = self._count_secrets(args_text)

        # Evaluate policy
        decision_action, reason, reason_codes, risk_score = (
            self._evaluate_policy(tool_name, tool_args)
        )

        # Track cost estimate for LLM events
        cost_delta = 0.0
        if event_type in (CBEventType.LLM, CBEventType.EMBEDDING):
            cost_delta = self._estimate_cost(payload)
            self._cumulative_cost += cost_delta

        # Budget check
        if self._budget and self._cumulative_cost > self._budget:
            decision_action = "DENY"
            reason = (
                f"Budget exceeded: ${self._cumulative_cost:.4f}/"
                f"${self._budget:.2f}"
            )
            reason_codes = ["BUDGET_EXCEEDED"]
            risk_score = 80

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        decision = GovernanceDecision(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            event_type=event_type.value if hasattr(event_type, "value") else str(event_type),
            action=decision_action,
            mode=self._mode.value,
            tool_name=tool_name,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            pii_findings=[{"type": f.pii_type, "start": f.start, "end": f.end} for f in pii_findings],
            secrets_detected=secrets_count,
            cost_tracked=cost_delta,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=elapsed_ms,
            params_hash=params_hash,
            agent_id=self._agent_id,
            session_id=self._session_id,
            event_id=event_id,
            proposed_call_id=proposed_call_id,
            trace_id=_get_current_trace_id(),
        )
        self._decisions.append(decision)

        # Store pending event for on_event_end correlation
        self._pending_events[event_id] = {
            "proposed_call_id": proposed_call_id,
            "correlation_id": correlation_id,
            "tool_name": tool_name,
            "start_time": time.perf_counter(),
        }

        # Mode-specific behavior
        if decision_action == "DENY":
            if self._mode == GovernanceMode.ENFORCE:
                raise GovernanceDenyError(
                    {
                        "action": "DENY",
                        "reason": reason,
                        "reason_codes": reason_codes,
                        "risk_score": risk_score,
                        "correlation_id": correlation_id,
                        "proposed_call_id": proposed_call_id,
                        "adapter_source": ADAPTER_SOURCE,
                    }
                )
            elif self._mode == GovernanceMode.MONITOR:
                logger.warning(
                    "TealTiger MONITOR denial: tool=%s reason=%s codes=%s",
                    tool_name,
                    reason,
                    reason_codes,
                )

        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        """Record event outcome after execution.

        Updates cost tracking with actual token usage when available.

        Args:
            event_type: The LlamaIndex callback event type.
            payload: Event result payload (may contain token counts).
            event_id: Unique identifier for this event.
            **kwargs: Additional keyword arguments.
        """
        payload = payload or {}
        pending = self._pending_events.pop(event_id, None)

        # Track actual cost from LLM response token usage
        if event_type in (CBEventType.LLM, CBEventType.EMBEDDING):
            token_usage = self._extract_token_usage(payload)
            if token_usage:
                actual_cost = self._track_cost(token_usage)
                # Adjust cumulative (replace estimate with actual)
                if pending:
                    self._cumulative_cost += actual_cost

    # ─── Properties ──────────────────────────────────────────────────────

    @property
    def decisions(self) -> List[GovernanceDecision]:
        """Access the list of all governance decisions made this session."""
        return list(self._decisions)

    @property
    def total_cost(self) -> float:
        """Current cumulative cost tracked for this session in USD."""
        return self._cumulative_cost

    def report(self) -> Dict[str, Any]:
        """Generate a governance summary report for the session.

        Returns:
            Dictionary with session summary including total evaluations,
            allow/deny counts, cost, PII findings, and mode.
        """
        allowed = sum(1 for d in self._decisions if d.action == "ALLOW")
        denied = sum(1 for d in self._decisions if d.action == "DENY")
        pii_total = sum(len(d.pii_findings) for d in self._decisions)
        secrets_total = sum(d.secrets_detected for d in self._decisions)

        return {
            "session_id": self._session_id,
            "agent_id": self._agent_id,
            "mode": self._mode.value,
            "total_evaluations": len(self._decisions),
            "allowed": allowed,
            "denied": denied,
            "total_cost_usd": round(self._cumulative_cost, 6),
            "budget_usd": self._budget,
            "pii_findings_total": pii_total,
            "secrets_detected_total": secrets_total,
            "adapter_source": ADAPTER_SOURCE,
        }

    # ─── Required abstract methods ───────────────────────────────────────

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        """Start a trace (no-op, required by BaseCallbackHandler)."""

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """End a trace (no-op, required by BaseCallbackHandler)."""

    # ─── Internal Methods ─────────────────────────────────────────────────

    def _evaluate_policy(
        self,
        tool_name: str,
        args: Dict[str, Any],
    ) -> tuple[str, str, List[str], int]:
        """Evaluate policies against a tool call.

        Args:
            tool_name: Name of the tool being invoked.
            args: Arguments to the tool.

        Returns:
            Tuple of (action, reason, reason_codes, risk_score).
        """
        # Engine-based evaluation (external TealEngine)
        if self._engine is not None:
            try:
                result = self._engine.evaluate(tool_name, args)
                if hasattr(result, "action"):
                    action = result.action
                    if hasattr(action, "value"):
                        action = action.value
                    return (
                        str(action),
                        getattr(result, "reason", "Engine evaluation"),
                        getattr(result, "reason_codes", []),
                        getattr(result, "risk_score", 0),
                    )
            except TimeoutError:
                # Policy timeout → fail closed
                return (
                    "DENY",
                    "Policy evaluation timed out — fail closed",
                    ["POLICY_TIMEOUT"],
                    90,
                )
            except Exception as exc:
                # Any other engine error → fail closed
                logger.error("TealEngine evaluation error: %s", exc)
                return (
                    "DENY",
                    f"Policy evaluation error — fail closed: {exc}",
                    ["POLICY_ERROR"],
                    90,
                )

        # Built-in policy evaluation
        # Tool allowlist check
        if self._tool_allowlist is not None and tool_name not in self._tool_allowlist:
            return (
                "DENY",
                f"Tool '{tool_name}' not in allowlist",
                ["TOOL_NOT_ALLOWED"],
                80,
            )

        # Tool blocklist check
        if tool_name in self._tool_blocklist:
            return (
                "DENY",
                f"Tool '{tool_name}' is blocklisted",
                ["TOOL_BLOCKED"],
                80,
            )

        return ("ALLOW", "Compliant with all policies", ["POLICY_COMPLIANT"], 0)

    def _track_cost(self, token_usage: Dict[str, int]) -> float:
        """Accumulate cost from token usage.

        Args:
            token_usage: Dictionary with 'input_tokens' and 'output_tokens'.

        Returns:
            Cost in USD for this usage.
        """
        input_tokens = token_usage.get("input_tokens", 0)
        output_tokens = token_usage.get("output_tokens", 0)

        input_cost = (input_tokens / 1000) * _DEFAULT_COST_PER_1K_INPUT
        output_cost = (output_tokens / 1000) * _DEFAULT_COST_PER_1K_OUTPUT

        return input_cost + output_cost

    def _detect_pii(self, text: str) -> List[PIIFinding]:
        """Scan text for PII patterns.

        Args:
            text: Text to scan for PII.

        Returns:
            List of PII findings with type, position, and redacted value.
        """
        findings: List[PIIFinding] = []
        if not text:
            return findings

        for pii_type, pattern in _PII_PATTERNS.items():
            for match in pattern.finditer(text):
                value = match.group(0)
                redacted = value[:2] + "*" * (len(value) - 4) + value[-2:]
                findings.append(
                    PIIFinding(
                        pii_type=pii_type,
                        start=match.start(),
                        end=match.end(),
                        redacted_value=redacted,
                    )
                )

        return findings

    def _count_secrets(self, text: str) -> int:
        """Count secret occurrences in text.

        Args:
            text: Text to scan for secrets.

        Returns:
            Number of secrets detected.
        """
        if not text:
            return 0
        count = 0
        for pattern in _SECRET_PATTERNS:
            count += len(pattern.findall(text))
        return count

    def _compute_params_hash(self, args: Dict[str, Any]) -> Optional[str]:
        """Compute SHA-256 digest of JCS-canonicalized arguments.

        Uses JSON Canonicalization Scheme (RFC 8785) approximation via
        sorted keys and deterministic serialization.

        Args:
            args: Arguments dictionary to hash.

        Returns:
            Hex SHA-256 digest, or None if args is empty.
        """
        if not args:
            return None
        canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _estimate_cost(self, payload: Dict[str, Any]) -> float:
        """Estimate cost from an LLM event payload.

        Args:
            payload: Event payload that may contain model info.

        Returns:
            Estimated cost in USD.
        """
        # Try to use tealtiger pricing if available
        model = payload.get("model", "")
        if model:
            try:
                from tealtiger.cost.pricing import get_model_pricing

                pricing = get_model_pricing(model)
                if pricing:
                    # Rough estimate: assume 500 tokens per call
                    return (500 / 1000) * pricing.input_cost_per_1k
            except ImportError:
                pass

        # Fallback: minimal estimate
        return (500 / 1000) * _DEFAULT_COST_PER_1K_INPUT

    def _extract_tool_name(
        self, event_type: CBEventType, payload: Dict[str, Any]
    ) -> str:
        """Extract tool name from event type and payload.

        Args:
            event_type: LlamaIndex callback event type.
            payload: Event payload.

        Returns:
            Tool/component name string.
        """
        if event_type == CBEventType.FUNCTION_CALL:
            return payload.get("tool", {}).get("name", "unknown_tool")
        if event_type == CBEventType.RETRIEVE:
            return "retriever"
        if event_type == CBEventType.LLM:
            return payload.get("model", "llm")
        if event_type == CBEventType.EMBEDDING:
            return "embedding"
        if event_type == CBEventType.QUERY:
            return "query"
        return str(event_type.value) if hasattr(event_type, "value") else "unknown"

    def _extract_args(
        self, event_type: CBEventType, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract arguments from event payload.

        Args:
            event_type: LlamaIndex callback event type.
            payload: Event payload.

        Returns:
            Dictionary of arguments.
        """
        if event_type == CBEventType.FUNCTION_CALL:
            return payload.get("tool", {}).get("input", {})
        if event_type == CBEventType.RETRIEVE:
            return {"query": payload.get("query_str", "")}
        if event_type == CBEventType.LLM:
            messages = payload.get("messages", [])
            if messages:
                return {"messages_count": len(messages)}
            return {"prompt": payload.get("prompt", "")}
        return dict(payload)

    def _extract_token_usage(self, payload: Dict[str, Any]) -> Optional[Dict[str, int]]:
        """Extract token usage from a completed LLM event payload.

        Args:
            payload: The event end payload.

        Returns:
            Token usage dict or None if not available.
        """
        # LlamaIndex stores token usage in response metadata
        response = payload.get("response", None)
        if response and hasattr(response, "raw"):
            raw = response.raw
            usage = getattr(raw, "usage", None)
            if usage:
                return {
                    "input_tokens": getattr(usage, "prompt_tokens", 0),
                    "output_tokens": getattr(usage, "completion_tokens", 0),
                }
        # Direct token counts in payload
        if "token_usage" in payload:
            return payload["token_usage"]
        return None


# ─── Utility ──────────────────────────────────────────────────────────────────


def _get_current_trace_id() -> Optional[str]:
    """Return the current OpenTelemetry trace ID if the API is available."""
    try:
        import importlib

        trace = importlib.import_module("opentelemetry.trace")
        span = trace.get_current_span()
        context = span.get_span_context()
        trace_id = int(getattr(context, "trace_id", 0))
        if trace_id == 0:
            return None
        return format(trace_id, "032x")
    except (ImportError, AttributeError, TypeError, ValueError):
        return None
