# Copyright (c) 2026, TealTiger Team
#
# SPDX-License-Identifier: Apache-2.0

"""Types for TealTiger AG2 Beta governance middleware."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class GovernanceMode(str, Enum):
    """Governance enforcement mode."""

    OBSERVE = "observe"  # Track everything, block nothing
    MONITOR = "monitor"  # Evaluate policies, log decisions, allow all
    ENFORCE = "enforce"  # Evaluate policies, block denied actions


class DecisionAction(str, Enum):
    """Governance decision outcome."""

    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_APPROVAL = "require_approval"
    REVISE = "revise"


class DecisionSource(str, Enum):
    """Who or what made the governance decision."""

    POLICY_ENGINE = "policy_engine"
    HUMAN_REVIEWER = "human_reviewer"
    DELEGATED_AUTHORITY = "delegated_authority"
    DEFAULT_MODE = "default_mode"
    SYSTEM_TIMEOUT = "system_timeout"
    FREEZE = "freeze"


@dataclass
class GovernancePolicy:
    """A governance policy definition."""

    type: str  # tool_allowlist, pii_block, cost_limit, secret_detection
    config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def tool_allowlist(cls, allowed: List[str]) -> "GovernancePolicy":
        """Create a tool allowlist policy."""
        return cls(type="tool_allowlist", config={"allowed": allowed})

    @classmethod
    def tool_denylist(cls, denied: List[str]) -> "GovernancePolicy":
        """Create a tool denylist policy."""
        return cls(type="tool_denylist", config={"denied": denied})

    @classmethod
    def pii_block(cls, categories: Optional[List[str]] = None) -> "GovernancePolicy":
        """Create a PII blocking policy."""
        return cls(
            type="pii_block",
            config={"categories": categories or ["ssn", "credit_card", "email", "phone"]},
        )

    @classmethod
    def cost_limit(cls, max_per_session: float) -> "GovernancePolicy":
        """Create a cost limit policy."""
        return cls(type="cost_limit", config={"max_per_session": max_per_session})

    @classmethod
    def secret_detection(cls, action: str = "block") -> "GovernancePolicy":
        """Create a secret detection policy."""
        return cls(type="secret_detection", config={"action": action})


@dataclass
class GovernanceDecision:
    """A governance decision record — created before every consequential action.

    Invariants:
    - decision_id is unique per evaluation (same payload in two turns = two IDs)
    - params_hash binds the proposed payload content
    - execution_outcome backlinks to this decision_id
    """

    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str = ""
    turn_id: int = 0
    parent_turn_id: Optional[int] = None
    action_kind: str = ""  # tool_call, message, budget_change, freeze, delegation
    tool_name: Optional[str] = None
    params_hash: str = ""  # SHA-256 of JCS-canonicalized args
    action: DecisionAction = DecisionAction.ALLOW
    decision_source: DecisionSource = DecisionSource.POLICY_ENGINE
    policy_digest: str = ""  # SHA-256 of policy document in effect
    approval_id: Optional[str] = None
    idempotency_key: str = ""
    delegation_scope: Optional[str] = None
    expiry: Optional[str] = None
    reason_codes: List[str] = field(default_factory=list)
    risk_score: int = 0
    evaluation_time_ms: float = 0.0
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @staticmethod
    def compute_params_hash(args: Any) -> str:
        """Compute SHA-256 hash of canonicalized arguments."""
        try:
            canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError):
            canonical = str(args)
        return f"sha256:{hashlib.sha256(canonical.encode()).hexdigest()}"

    @staticmethod
    def compute_policy_digest(policies: List[GovernancePolicy]) -> str:
        """Compute SHA-256 hash of the policy set in effect."""
        policy_repr = json.dumps(
            [{"type": p.type, "config": p.config} for p in policies],
            sort_keys=True,
            separators=(",", ":"),
        )
        return f"sha256:{hashlib.sha256(policy_repr.encode()).hexdigest()}"


@dataclass
class TEECReceipt:
    """Typed Evidence & Evidence Contract receipt for AG2 Beta.

    Contains the full governance context for a single action.
    Five orthogonal answers:
    - Content digest (params_hash): "Are these the same args?"
    - Decision identity (decision_id): "Is this the same decision?"
    - Policy evidence (policy_digest): "What rules were in effect?"
    - Decision source (decision_source): "Who decided?"
    - Execution outcome (execution_outcome): "What actually happened?"
    """

    # Identity
    decision_id: str = ""
    conversation_id: str = ""
    turn_id: int = 0
    parent_turn_id: Optional[int] = None

    # Actor
    agent_id: str = ""
    agent_role: str = ""

    # Action
    action_kind: str = ""
    tool_name: Optional[str] = None
    params_hash: str = ""

    # Decision
    action: str = ""  # allow, deny, require_approval, revise
    decision_source: str = ""
    policy_digest: str = ""
    reason_codes: List[str] = field(default_factory=list)
    risk_score: int = 0

    # Execution
    execution_outcome: str = ""  # executed, blocked, skipped, timed_out, pending
    idempotency_key: str = ""
    approval_id: Optional[str] = None

    # Delegation
    delegation_scope: Optional[str] = None
    delegation_chain: List[Dict[str, Any]] = field(default_factory=list)

    # Metadata
    evaluation_time_ms: float = 0.0
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "teec": {
                "ag2_beta": {
                    "decision_id": self.decision_id,
                    "conversation_id": self.conversation_id,
                    "turn_id": self.turn_id,
                    "parent_turn_id": self.parent_turn_id,
                    "agent_id": self.agent_id,
                    "agent_role": self.agent_role,
                    "action_kind": self.action_kind,
                    "tool_name": self.tool_name,
                    "params_hash": self.params_hash,
                    "action": self.action,
                    "decision_source": self.decision_source,
                    "policy_digest": self.policy_digest,
                    "reason_codes": self.reason_codes,
                    "risk_score": self.risk_score,
                    "execution_outcome": self.execution_outcome,
                    "idempotency_key": self.idempotency_key,
                    "approval_id": self.approval_id,
                    "delegation_scope": self.delegation_scope,
                    "delegation_chain": self.delegation_chain,
                    "evaluation_time_ms": self.evaluation_time_ms,
                    "timestamp": self.timestamp,
                }
            }
        }
