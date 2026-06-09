"""TealTiger Agent Hook for CAMEL-AI multi-agent systems.

This hook provides deterministic governance for CAMEL-AI agents:
- Zero-config mode: observe, track cost, detect PII, allow all (passthrough)
- Policy mode: evaluate policies via TealEngine, block if DENY

No LLM in the governance path. Typical evaluation: <2ms.
"""

from __future__ import annotations

import hashlib
import importlib
import json
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
    """Phase: pre_step or post_step."""

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
    """TEEC namespace fields (teec.camelai)."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Additional metadata."""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


@dataclass
class AgentSummary:
    """Cost and step summary for a single agent."""

    agent_id: str
    total_cost: float = 0.0
    step_count: int = 0
    denied_count: int = 0
    pii_findings_count: int = 0


@dataclass
class BaselineEntry:
    """Behavioral baseline entry for an agent."""

    agent_id: str
    avg_cost_per_step: float
    total_steps: int
    total_cost: float
    pii_frequency: float
    common_tools: list[str]
    typical_risk_scores: list[int]


# ─── Exceptions ──────────────────────────────────────────────────────────────


class GovernanceDenyError(Exception):
    """Raised when a governance policy denies the request in ENFORCE mode."""

    def __init__(self, decision: dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(f"Governance DENY: {decision.get('reason', 'Policy violation')}")


# ─── Agent Hook ──────────────────────────────────────────────────────────────


class TealTigerAgentHook:
    """Deterministic governance hook for CAMEL-AI multi-agent systems.

    Operates in two modes:

    1. **Zero-config mode** (default): Observe all traffic, track cost estimates,
       detect PII in step content, and allow everything through unchanged. Produces
       structured audit entries for observability.

    2. **Policy mode**: When a TealEngine instance is provided, evaluates configured
       policies. If a policy returns DENY and mode is ENFORCE, raises
       GovernanceDenyError.

    Usage:
        # Zero-config (observe mode)
        hook = TealTigerAgentHook()

        # Policy mode
        from tealtiger import TealEngine
        engine = TealEngine(policies=[{"type": "cost_limit", "max_per_session": 5.00}])
        hook = TealTigerAgentHook(engine=engine, mode="ENFORCE")

    TEEC Namespace (teec.camelai):
        - session_id: Unique session identifier
        - task_prompt: SHA-256 hash of the task prompt
        - agent_role: Agent's assigned role
        - role_type: Type of role (e.g., "assistant", "user", "critic")
        - step_id: Unique step identifier
        - society_id: Multi-agent society/group identifier
    """

    def __init__(
        self,
        engine: Any | None = None,
        mode: str = "OBSERVE",
        cost_per_1k_tokens: float = 0.002,
        session_id: str | None = None,
        society_id: str | None = None,
        task_prompt: str | None = None,
        role_allowlist: list[str] | None = None,
    ) -> None:
        """Initialize the governance hook.

        Args:
            engine: Optional TealEngine instance for policy evaluation.
                    When None, operates in zero-config observe mode.
            mode: Governance mode — "OBSERVE", "MONITOR", or "ENFORCE".
                  Defaults to "OBSERVE" (zero-config).
            cost_per_1k_tokens: Estimated cost per 1000 tokens for cost tracking.
                                Defaults to $0.002.
            session_id: Optional session identifier. Auto-generated if not provided.
            society_id: Optional multi-agent society/group identifier.
            task_prompt: Optional task prompt (will be hashed for TEEC).
            role_allowlist: Optional list of allowed agent roles. If set,
                           agents with roles not in this list will be denied.
        """
        self._engine = engine
        self._mode = GovernanceMode(mode)
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._session_id = session_id or str(uuid.uuid4())
        self._society_id = society_id
        self._task_prompt_hash = (
            hashlib.sha256(task_prompt.encode()).hexdigest() if task_prompt else None
        )
        self._role_allowlist: set[str] | None = set(role_allowlist) if role_allowlist else None

        # Session state
        self._cumulative_cost: float = 0.0
        self._step_count: int = 0
        self._audit_trail: list[AuditEntry] = []
        self._agent_costs: dict[str, float] = {}
        self._agent_steps: dict[str, int] = {}
        self._agent_denied: dict[str, int] = {}
        self._agent_pii: dict[str, int] = {}
        self._agent_roles: dict[str, str] = {}
        self._agent_tools: dict[str, list[str]] = {}
        self._agent_risk_scores: dict[str, list[int]] = {}
        self._frozen_agents: set[str] = set()

    # ─── Pre-Step Hook ───────────────────────────────────────────────────

    def pre_step(  # noqa: C901
        self,
        agent_id: str,
        step_content: str,
        tool_name: str | None = None,
        tool_args: dict[str, Any] | None = None,
        agent_role: str | None = None,
        role_type: str | None = None,
    ) -> dict[str, Any]:
        """Evaluate governance before an agent step.

        Args:
            agent_id: Unique identifier for the agent.
            step_content: Content of the step to evaluate.
            tool_name: Optional name of the tool being invoked.
            tool_args: Optional arguments for the tool.
            agent_role: Optional role name of the agent.
            role_type: Optional type of role (assistant, user, critic, etc.).

        Returns:
            Dictionary with governance decision.

        Raises:
            GovernanceDenyError: When blocked in ENFORCE mode.
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        step_id = str(uuid.uuid4())
        self._step_count += 1

        # Track agent role
        if agent_role:
            self._agent_roles[agent_id] = agent_role

        # Track tool usage
        if tool_name:
            if agent_id not in self._agent_tools:
                self._agent_tools[agent_id] = []
            self._agent_tools[agent_id].append(tool_name)

        # ── Frozen agent check ───────────────────────────────────────────
        if agent_id in self._frozen_agents:
            action = GovernanceAction.DENY
            reason = f"Agent {agent_id} is frozen (kill switch active)"
            reason_codes = ["AGENT_FROZEN", "KILL_SWITCH"]
            risk_score = 100
            pii_findings: list[PIIFinding] = []
            estimated_cost = 0.0

            evaluation_time_ms = (time.perf_counter() - start_time) * 1000
            teec = self._build_teec(agent_role=agent_role, role_type=role_type, step_id=step_id)

            audit_entry = AuditEntry(
                correlation_id=correlation_id,
                timestamp_ms=time.time() * 1000,
                action=action.value,
                mode=self._mode.value,
                phase="pre_step",
                agent_id=agent_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                pii_detected=[],
                cost_tracked=estimated_cost,
                cumulative_cost=self._cumulative_cost,
                evaluation_time_ms=evaluation_time_ms,
                trace_id=_get_current_trace_id(),
                teec=teec,
                metadata={
                    "step_count": self._step_count,
                    "tool_name": tool_name,
                    "tool_args": tool_args,
                },
            )
            self._audit_trail.append(audit_entry)
            self._agent_denied[agent_id] = self._agent_denied.get(agent_id, 0) + 1

            decision_dict = audit_entry.to_dict()

            if self._mode == GovernanceMode.ENFORCE:
                raise GovernanceDenyError(decision_dict)

            return decision_dict

        # ── Role validation ──────────────────────────────────────────────
        if self._role_allowlist is not None and agent_role is not None:
            if agent_role not in self._role_allowlist:
                action = GovernanceAction.DENY
                reason = f"Role '{agent_role}' not in allowlist: {sorted(self._role_allowlist)}"
                reason_codes = ["ROLE_NOT_ALLOWED"]
                risk_score = 90

                evaluation_time_ms = (time.perf_counter() - start_time) * 1000
                teec = self._build_teec(agent_role=agent_role, role_type=role_type, step_id=step_id)

                audit_entry = AuditEntry(
                    correlation_id=correlation_id,
                    timestamp_ms=time.time() * 1000,
                    action=action.value,
                    mode=self._mode.value,
                    phase="pre_step",
                    agent_id=agent_id,
                    reason=reason,
                    reason_codes=reason_codes,
                    risk_score=risk_score,
                    pii_detected=[],
                    cost_tracked=0.0,
                    cumulative_cost=self._cumulative_cost,
                    evaluation_time_ms=evaluation_time_ms,
                    trace_id=_get_current_trace_id(),
                    teec=teec,
                    metadata={
                        "step_count": self._step_count,
                        "tool_name": tool_name,
                        "tool_args": tool_args,
                        "role_allowlist": sorted(self._role_allowlist),
                    },
                )
                self._audit_trail.append(audit_entry)
                self._agent_denied[agent_id] = self._agent_denied.get(agent_id, 0) + 1

                decision_dict = audit_entry.to_dict()

                if self._mode == GovernanceMode.ENFORCE:
                    raise GovernanceDenyError(decision_dict)

                return decision_dict

        # ── PII Detection ────────────────────────────────────────────────
        pii_findings = self._detect_pii(step_content)
        if pii_findings:
            self._agent_pii[agent_id] = self._agent_pii.get(agent_id, 0) + len(pii_findings)

        # ── Cost Tracking ────────────────────────────────────────────────
        estimated_tokens = max(len(step_content) / 4, 1)
        estimated_cost = (estimated_tokens / 1000) * self._cost_per_1k_tokens
        self._cumulative_cost += estimated_cost
        self._agent_costs[agent_id] = self._agent_costs.get(agent_id, 0) + estimated_cost
        self._agent_steps[agent_id] = self._agent_steps.get(agent_id, 0) + 1

        # ── Policy Evaluation ────────────────────────────────────────────
        action = GovernanceAction.ALLOW
        reason = "Allowed: zero-config observe mode"
        reason_codes = ["OBSERVE_PASSTHROUGH"]
        risk_score = 0

        if self._engine is not None:
            engine_decision = self._evaluate_with_engine(
                agent_id=agent_id,
                content=step_content,
                tool_name=tool_name,
                tool_args=tool_args,
                phase="pre_step",
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

        # Track risk scores
        if agent_id not in self._agent_risk_scores:
            self._agent_risk_scores[agent_id] = []
        self._agent_risk_scores[agent_id].append(risk_score)

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(agent_role=agent_role, role_type=role_type, step_id=step_id)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=action.value,
            mode=self._mode.value,
            phase="pre_step",
            agent_id=agent_id,
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
                "step_count": self._step_count,
                "tool_name": tool_name,
                "tool_args": tool_args,
                "input_length": len(step_content),
                "estimated_tokens": int(estimated_tokens),
            },
        )
        self._audit_trail.append(audit_entry)

        # ── Handle DENY ──────────────────────────────────────────────────
        decision_dict = audit_entry.to_dict()

        if action == GovernanceAction.DENY:
            self._agent_denied[agent_id] = self._agent_denied.get(agent_id, 0) + 1
            if self._mode == GovernanceMode.ENFORCE:
                raise GovernanceDenyError(decision_dict)

        return decision_dict

    # ─── Post-Step Hook ──────────────────────────────────────────────────

    def post_step(
        self,
        agent_id: str,
        step_result: str,
        token_usage: dict[str, int] | None = None,
        agent_role: str | None = None,
        role_type: str | None = None,
    ) -> dict[str, Any]:
        """Track cost and audit after an agent step completes.

        Args:
            agent_id: Unique identifier for the agent.
            step_result: Result/output of the completed step.
            token_usage: Optional token usage dict with keys like
                         "prompt_tokens", "completion_tokens", "total_tokens".
            agent_role: Optional role name of the agent.
            role_type: Optional type of role.

        Returns:
            Dictionary with post-step audit entry.
        """
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        step_id = str(uuid.uuid4())

        # ── Cost Tracking from token_usage ───────────────────────────────
        actual_cost = 0.0
        if token_usage:
            total_tokens = token_usage.get(
                "total_tokens",
                token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0),
            )
            actual_cost = (total_tokens / 1000) * self._cost_per_1k_tokens
            self._cumulative_cost += actual_cost
            self._agent_costs[agent_id] = self._agent_costs.get(agent_id, 0) + actual_cost
        else:
            # Estimate from result text length
            estimated_tokens = max(len(step_result) / 4, 1)
            actual_cost = (estimated_tokens / 1000) * self._cost_per_1k_tokens
            self._cumulative_cost += actual_cost
            self._agent_costs[agent_id] = self._agent_costs.get(agent_id, 0) + actual_cost

        # ── PII Detection in output ──────────────────────────────────────
        pii_findings = self._detect_pii(step_result)
        if pii_findings:
            self._agent_pii[agent_id] = self._agent_pii.get(agent_id, 0) + len(pii_findings)

        # ── Build Audit Entry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        teec = self._build_teec(agent_role=agent_role, role_type=role_type, step_id=step_id)

        risk_score = 0
        if pii_findings:
            risk_score = min(len(pii_findings) * 20, 80)

        audit_entry = AuditEntry(
            correlation_id=correlation_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.ALLOW.value,
            mode=self._mode.value,
            phase="post_step",
            agent_id=agent_id,
            reason="Post-step audit recorded",
            reason_codes=["POST_STEP_AUDIT"],
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
                "output_length": len(step_result),
            },
        )
        self._audit_trail.append(audit_entry)

        return audit_entry.to_dict()

    # ─── Kill Switch ─────────────────────────────────────────────────────

    def freeze(self, agent_id: str) -> None:
        """Freeze an agent — kill switch that blocks all subsequent steps.

        Args:
            agent_id: Agent to freeze.
        """
        self._frozen_agents.add(agent_id)

    def unfreeze(self, agent_id: str) -> None:
        """Unfreeze a previously frozen agent.

        Args:
            agent_id: Agent to unfreeze.
        """
        self._frozen_agents.discard(agent_id)

    def export_audit_trail(self, path: str) -> int:
        """Export audit trail as JSONL and return the number of entries written."""
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                f.write(json.dumps(entry.to_dict()) + "\n")

        return len(self._audit_trail)

    # ─── Properties ──────────────────────────────────────────────────────

    @property
    def audit_trail(self) -> list[AuditEntry]:
        """Access the full audit trail of governance decisions."""
        return list(self._audit_trail)

    @property
    def summary(self) -> dict[str, AgentSummary]:
        """Get cost/step summary per agent.

        Returns:
            Dictionary mapping agent_id to AgentSummary.
        """
        result: dict[str, AgentSummary] = {}
        all_agents = set(self._agent_costs.keys()) | set(self._agent_steps.keys())

        for agent_id in all_agents:
            result[agent_id] = AgentSummary(
                agent_id=agent_id,
                total_cost=self._agent_costs.get(agent_id, 0.0),
                step_count=self._agent_steps.get(agent_id, 0),
                denied_count=self._agent_denied.get(agent_id, 0),
                pii_findings_count=self._agent_pii.get(agent_id, 0),
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

    def get_baseline(self) -> dict[str, BaselineEntry]:
        """Get a summary of observed behavior as a baseline.

        Returns:
            Dictionary mapping agent_id to baseline behavior summary.
        """
        result: dict[str, BaselineEntry] = {}

        for agent_id in set(self._agent_steps.keys()):
            steps = self._agent_steps.get(agent_id, 0)
            cost = self._agent_costs.get(agent_id, 0.0)
            pii_count = self._agent_pii.get(agent_id, 0)
            tools = self._agent_tools.get(agent_id, [])
            risk_scores = self._agent_risk_scores.get(agent_id, [])

            # Deduplicate tools and find most common
            tool_counts: dict[str, int] = {}
            for tool in tools:
                tool_counts[tool] = tool_counts.get(tool, 0) + 1
            common_tools = sorted(tool_counts.keys(), key=lambda t: -tool_counts[t])[:5]

            result[agent_id] = BaselineEntry(
                agent_id=agent_id,
                avg_cost_per_step=cost / steps if steps > 0 else 0.0,
                total_steps=steps,
                total_cost=cost,
                pii_frequency=pii_count / steps if steps > 0 else 0.0,
                common_tools=common_tools,
                typical_risk_scores=risk_scores[-10:],  # Last 10 scores
            )

        return result

    # ─── Internal Methods ────────────────────────────────────────────────

    def _build_teec(
        self,
        agent_role: str | None = None,
        role_type: str | None = None,
        step_id: str | None = None,
    ) -> dict[str, Any]:
        """Build TEEC namespace fields for teec.camelai.

        Returns:
            Dictionary with TEEC fields.
        """
        teec: dict[str, Any] = {
            "namespace": "teec.camelai",
            "session_id": self._session_id,
            "step_id": step_id or str(uuid.uuid4()),
        }

        if self._task_prompt_hash:
            teec["task_prompt"] = self._task_prompt_hash

        if agent_role:
            teec["agent_role"] = agent_role

        if role_type:
            teec["role_type"] = role_type

        if self._society_id:
            teec["society_id"] = self._society_id

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
        content: str,
        tool_name: str | None = None,
        tool_args: dict[str, Any] | None = None,
        phase: str = "pre_step",
    ) -> dict[str, Any]:
        """Evaluate content against TealEngine policies.

        Args:
            agent_id: Agent making the request.
            content: Content to evaluate.
            tool_name: Optional tool being invoked.
            tool_args: Optional tool arguments.
            phase: Evaluation phase (pre_step or post_step).

        Returns:
            Decision dictionary from TealEngine.
        """
        try:
            decision = self._engine.evaluate(  # type: ignore[union-attr]
                request={
                    "input": content,
                    "agent_id": agent_id,
                    "tool_name": tool_name,
                    "tool_args": tool_args,
                    "context": {
                        "framework": "camel-ai",
                        "hook": "TealTigerAgentHook",
                        "phase": phase,
                        "session_id": self._session_id,
                        "cumulative_cost": self._cumulative_cost,
                        "agent_role": self._agent_roles.get(agent_id),
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
