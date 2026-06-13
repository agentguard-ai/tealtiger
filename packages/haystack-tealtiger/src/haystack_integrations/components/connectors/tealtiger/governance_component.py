"""TealTiger Governance Component for Haystack pipelines.

This component provides deterministic governance for any Haystack pipeline:
- Zero-config mode: observe, track cost, detect PII, allow all (passthrough)
- Policy mode: evaluate policies via TealEngine, block if DENY

No LLM in the governance path. Typical evaluation: <2ms.
"""

from __future__ import annotations

import importlib
import json
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

from haystack import component, logging

logger = logging.getLogger(__name__)


# ─── PII Detection Patterns ─────────────────────────────────────────────────

_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone_us": re.compile(
        r"\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
    ),
    "phone_uk": re.compile(
        r"(?<!\w)\+44[-.\s]?(?:\d{2,4}[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b"
    ),
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
    """Cumulative cost for the pipeline run."""

    evaluation_time_ms: float
    """Time taken for governance evaluation in milliseconds."""

    trace_id: str | None = None
    """Current OpenTelemetry trace ID, if available."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Additional metadata."""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


# ─── Exceptions ──────────────────────────────────────────────────────────────


class GovernanceDenyError(Exception):
    """Raised when a governance policy denies the request in ENFORCE mode."""

    def __init__(self, decision: dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(
            f"Governance DENY: {decision.get('reason', 'Policy violation')}"
        )


# ─── Component ───────────────────────────────────────────────────────────────


@component
class TealTigerGovernanceComponent:
    """Deterministic governance component for Haystack pipelines.

    Operates in two modes:

    1. **Zero-config mode** (default): Observe all traffic, track cost estimates,
       detect PII in input text, and allow everything through unchanged. Produces
       structured audit entries for observability.

    2. **Policy mode**: When a TealEngine instance is provided, evaluates configured
       policies. If a policy returns DENY and mode is ENFORCE, raises
       GovernanceDenyError or returns empty text (configurable).

    Usage:
        # Zero-config (observe mode)
        gov = TealTigerGovernanceComponent()

        # Policy mode
        from tealtiger import TealEngine
        engine = TealEngine(policies=[{"type": "cost_limit", "max_per_session": 5.00}])
        gov = TealTigerGovernanceComponent(engine=engine, mode="ENFORCE")
    """

    def __init__(
        self,
        engine: Any | None = None,
        mode: str = "OBSERVE",
        cost_per_1k_tokens: float = 0.002,
        raise_on_deny: bool = True,
        agent_id: str | None = None,
        anomaly_threshold: float = 200,
    ) -> None:
        """Initialize the governance component.

        Args:
            engine: Optional TealEngine instance for policy evaluation.
                    When None, operates in zero-config observe mode.
            mode: Governance mode — "OBSERVE", "MONITOR", or "ENFORCE".
                  Defaults to "OBSERVE" (zero-config).
            cost_per_1k_tokens: Estimated cost per 1000 tokens for cost tracking.
                                Defaults to $0.002.
            raise_on_deny: If True, raise GovernanceDenyError on DENY in ENFORCE mode.
                          If False, return empty string for text output.
            agent_id: Optional agent identifier for audit correlation.
            anomaly_threshold: Percentage threshold for cost anomaly alerts.
                               Default 200 means actual cost over 2x the
                               input estimate is flagged.
        """
        self._engine = engine
        self._mode = GovernanceMode(mode)
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._raise_on_deny = raise_on_deny
        self._agent_id = agent_id or f"haystack-pipeline-{uuid.uuid4().hex[:8]}"
        self._anomaly_threshold = anomaly_threshold

        # Session state
        self._cumulative_cost: float = 0.0
        self._evaluation_count: int = 0
        self._audit_trail: list[AuditEntry] = []
        self._last_estimated_cost: float = 0.0

    @component.output_types(text=str, decision=dict)
    def run(self, text: str, token_usage: dict[str, int] | None = None) -> dict[str, Any]:
        """Evaluate governance policies on the input text.

        In zero-config mode, passes text through unchanged while tracking
        cost and detecting PII for observability.

        In policy mode, evaluates TealEngine policies and may block the request.

        Args:
            text: Input text to evaluate.
            token_usage: Optional usage with "total_tokens" or
                         "prompt_tokens"/"completion_tokens" for actual cost.

        Returns:
            Dictionary with:
                - text: The input text (unchanged if allowed, empty if denied)
                - decision: Structured audit entry as a dictionary
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        self._evaluation_count += 1

        # ── PII Detection ────────────────────────────────────────────────
        pii_findings = self._detect_pii(text)

        # ── Cost Tracking ────────────────────────────────────────────────
        estimated_tokens = max(len(text) / 4, 1)  # rough char-to-token ratio
        estimated_cost = (estimated_tokens / 1000) * self._cost_per_1k_tokens
        actual_cost = estimated_cost
        if token_usage:
            total_tokens = token_usage.get(
                "total_tokens",
                token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0),
            )
            actual_cost = (total_tokens / 1000) * self._cost_per_1k_tokens

        self._last_estimated_cost = estimated_cost
        self._cumulative_cost += actual_cost

        # ── Policy Evaluation ────────────────────────────────────────────
        action = GovernanceAction.ALLOW
        reason = "Allowed: zero-config observe mode"
        reason_codes: list[str] = ["OBSERVE_PASSTHROUGH"]
        risk_score = 0

        if self._engine is not None:
            # Policy mode: delegate to TealEngine
            engine_decision = self._evaluate_with_engine(text)
            action = GovernanceAction(engine_decision.get("action", "ALLOW"))
            reason = engine_decision.get("reason", "Policy evaluated")
            reason_codes = engine_decision.get("reason_codes", ["POLICY_EVALUATED"])
            risk_score = engine_decision.get("risk_score", 0)
        elif pii_findings:
            # Zero-config mode with PII detected: flag but allow
            reason = (
                f"PII detected ({len(pii_findings)} finding(s)) — "
                f"allowed in {self._mode.value} mode"
            )
            reason_codes = ["PII_DETECTED", "OBSERVE_PASSTHROUGH"]
            risk_score = min(len(pii_findings) * 20, 80)

        if estimated_cost > 0:
            cost_ratio = (actual_cost / estimated_cost) * 100
            if cost_ratio > self._anomaly_threshold:
                logger.warning(
                    "Cost anomaly for Haystack input: actual ${actual:.6f} is "
                    "{ratio:.0f}% of estimated ${estimated:.6f} "
                    "(threshold {threshold:.0f}%)",
                    actual=actual_cost,
                    ratio=cost_ratio,
                    estimated=estimated_cost,
                    threshold=self._anomaly_threshold,
                )
                reason_codes = [*reason_codes, "COST_ANOMALY"]

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=action.value,
            mode=self._mode.value,
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
            cost_tracked=actual_cost,
            cumulative_cost=self._cumulative_cost,
            evaluation_time_ms=evaluation_time_ms,
            trace_id=_get_current_trace_id(),
            metadata={
                "agent_id": self._agent_id,
                "evaluation_number": self._evaluation_count,
                "input_length": len(text),
                "estimated_tokens": int(estimated_tokens),
                "estimated_cost": estimated_cost,
                "token_usage": token_usage,
            },
        )
        self._audit_trail.append(audit_entry)

        logger.info(
            "TealTiger governance: {action} | correlation_id={cid} | "
            "cost=${cost:.4f} | pii_count={pii} | time={time:.2f}ms",
            action=action.value,
            cid=correlation_id,
            cost=actual_cost,
            pii=len(pii_findings),
            time=evaluation_time_ms,
        )

        # ── Handle DENY ──────────────────────────────────────────────────
        decision_dict = audit_entry.to_dict()

        if action == GovernanceAction.DENY and self._mode == GovernanceMode.ENFORCE:
            if self._raise_on_deny:
                raise GovernanceDenyError(decision_dict)
            return {"text": "", "decision": decision_dict}

        # ── ALLOW / MONITOR: pass through ────────────────────────────────
        return {"text": text, "decision": decision_dict}

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

    def _evaluate_with_engine(self, text: str) -> dict[str, Any]:
        """Evaluate text against TealEngine policies.

        Args:
            text: Input text to evaluate.

        Returns:
            Decision dictionary from TealEngine.
        """
        try:
            # TealEngine.evaluate() returns a Decision object
            decision = self._engine.evaluate(  # type: ignore[union-attr]
                request={
                    "input": text,
                    "agent_id": self._agent_id,
                    "context": {
                        "framework": "haystack",
                        "component": "TealTigerGovernanceComponent",
                        "cumulative_cost": self._cumulative_cost,
                    },
                }
            )

            # Handle both dict and object responses from TealEngine
            if isinstance(decision, dict):
                return decision

            # TealEngine Decision object
            return {
                "action": getattr(decision, "action", "ALLOW"),
                "reason": getattr(decision, "reason", ""),
                "reason_codes": getattr(decision, "reason_codes", []),
                "risk_score": getattr(decision, "risk_score", 0),
            }
        except Exception as e:
            # Fail-closed: if engine errors, deny in ENFORCE mode
            logger.warning(
                "TealEngine evaluation failed: {error}. Fail-closed.",
                error=str(e),
            )
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
                "reason": f"Engine evaluation failed (fail-open in {self._mode.value}): {e}",
                "reason_codes": ["ENGINE_ERROR", "FAIL_OPEN"],
                "risk_score": 50,
            }

    @property
    def audit_trail(self) -> list[AuditEntry]:
        """Access the full audit trail of governance decisions."""
        return list(self._audit_trail)

    @property
    def cumulative_cost(self) -> float:
        """Get the cumulative tracked cost for this pipeline run."""
        return self._cumulative_cost

    @property
    def evaluation_count(self) -> int:
        """Get the total number of evaluations performed."""
        return self._evaluation_count

    def export_audit_trail(self, path: str) -> int:
        """Export audit trail as JSONL and return the number of entries written."""
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                f.write(json.dumps(entry.to_dict()) + "\n")

        return len(self._audit_trail)

    def reset(self) -> None:
        """Reset session state (cost, audit trail, evaluation count)."""
        self._cumulative_cost = 0.0
        self._evaluation_count = 0
        self._audit_trail = []
        self._last_estimated_cost = 0.0


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
