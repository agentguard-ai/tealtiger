"""Data models and enums for ag2-tealtiger governance adapter.

This module defines all core types used throughout the ag2-tealtiger package:
- Enums for governance actions, modes, action kinds, and decision sources
- Dataclasses for TEEC context, audit entries, decision receipts, and more

All types use Python 3.10+ annotations with `from __future__ import annotations`
for forward reference support.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class GovernanceAction(str, Enum):
    """Governance decision action returned by TealEngine evaluation."""

    ALLOW = "ALLOW"
    DENY = "DENY"
    MODIFY = "MODIFY"
    REFER = "REFER"


class GovernanceMode(str, Enum):
    """Operating mode for the governance interceptor."""

    ENFORCE = "ENFORCE"
    MONITOR = "MONITOR"
    OBSERVE = "OBSERVE"


class ActionKind(str, Enum):
    """Category of governed action being evaluated."""

    MESSAGE = "message"
    TOOL_CALL = "tool_call"
    BUDGET_CHANGE = "budget_change"
    STOP = "stop"
    FREEZE = "freeze"


class DecisionSource(str, Enum):
    """Entity that made the governance decision."""

    POLICY_ENGINE = "policy_engine"
    HUMAN_REVIEWER = "human_reviewer"
    DELEGATED_AUTHORITY = "delegated_authority"
    DEFAULT_MODE = "default_mode"
    SYSTEM_TIMEOUT = "system_timeout"


@dataclass
class TEECContext:
    """teec.ag2 namespace — structured telemetry context.

    Attached to every AuditEntry to enable correlation and audit
    reconstruction across conversations, nested chats, and group interactions.
    """

    namespace: str = "teec.ag2"
    conversation_id: str = ""
    turn_id: int = 0
    agent_role: str | None = None
    group_chat_id: str | None = None
    params_hash: str | None = None
    parent_conversation_id: str | None = None
    decision_id: str = ""
    idempotency_key: str | None = None
    policy_digest: str | None = None
    decision_source: str = "default_mode"
    execution_outcome: str | None = None
    approval_id: str | None = None


@dataclass
class AuditEntry:
    """Structured audit entry for every governance evaluation.

    Produced for every intercepted tool call, message send, or speaker
    selection event regardless of the governance decision outcome.
    """

    correlation_id: str
    decision_id: str
    timestamp_ms: float
    action: str  # GovernanceAction value
    action_kind: str  # ActionKind value
    mode: str  # GovernanceMode value
    agent_id: str
    reason: str
    reason_codes: list[str]
    risk_score: int
    evaluation_time_ms: float
    teec: TEECContext

    # Optional fields
    tool_name: str | None = None
    tool_args_summary: dict[str, Any] | None = None
    pii_detected: list[dict[str, Any]] = field(default_factory=list)
    cost_tracked: float = 0.0
    cumulative_cost: float = 0.0
    trace_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RevalidationCondition:
    """Condition that triggers decision re-evaluation.

    Attached to decision receipts to define when a previously granted
    ALLOW decision becomes stale and requires fresh evaluation.
    """

    condition_type: str  # e.g., "cost_exceeded", "time_elapsed", "context_changed"
    threshold: Any
    description: str


@dataclass
class DecisionReceipt:
    """Record of a governance decision with expiry and revalidation.

    Tracks the lifecycle of a governance decision including when it
    expires and under what conditions it should be re-evaluated.
    """

    decision_id: str
    action: GovernanceAction
    issued_at: datetime
    expires_at: datetime | None
    revalidate_if: list[RevalidationCondition] = field(default_factory=list)
    execution_outcome: str | None = None
    approval_id: str | None = None
    is_expired: bool = False


@dataclass
class EscalationReceipt:
    """Structured escalation receipt for REFER decisions.

    Contains full decision context enabling a downstream reviewer to
    make an informed decision without re-running the agent.
    """

    decision_id: str
    agent_id: str
    tool_name: str
    tool_arguments: dict[str, Any]
    conversation_id: str
    turn_id: int
    group_chat_id: str | None
    risk_score: int
    reason_codes: list[str]
    human_readable_summary: str
    policy_context: dict[str, Any]
    issued_at: datetime
    expires_at: datetime | None


@dataclass
class BudgetState:
    """Per-agent budget tracking state.

    Maintains current spend, configured limit, and remaining budget
    for cost enforcement per agent identity.
    """

    agent_id: str
    budget_limit: float | None
    current_spend: float = 0.0
    remaining_budget: float | None = None
    warning_emitted: bool = False


@dataclass
class SpeakerSelectionAuditEntry:
    """Audit entry for GovernedGroupChat speaker selection rounds.

    Records which candidates were evaluated, the decision for each,
    and the final selected speaker for each selection round.
    """

    round_id: str
    timestamp_ms: float
    candidates_evaluated: list[dict[str, Any]]  # [{agent_id, decision, reason}]
    selected_speaker: str | None
    reason_codes: list[str]
    group_chat_id: str


@dataclass
class DenialMessage:
    """Structured denial result visible in the AG2 conversation.

    Produced when a tool call is denied in ENFORCE mode, formatted
    as a parseable string for downstream agents.
    """

    tool_name: str
    action: str
    reason: str
    risk_score: int
    reason_codes: list[str]
    correlation_id: str
    decision_id: str

    def to_reply_string(self) -> str:
        """Format as a parseable string for downstream agents.

        Returns a structured denial message containing all relevant
        fields separated by pipe delimiters for easy parsing.
        """
        return (
            f"[GOVERNANCE DENIAL] Tool: {self.tool_name} | "
            f"Action: {self.action} | Risk: {self.risk_score} | "
            f"Reason: {self.reason} | Codes: {','.join(self.reason_codes)} | "
            f"Decision: {self.decision_id}"
        )
