"""TealTiger Governance Adapter for AG2 (AutoGen fork).

Add deterministic governance to any AG2 ConversableAgent or GroupChat:

    from ag2_tealtiger import TealTigerGuard, TealTigerAuditAgent, GovernedGroupChat

    # Zero-config observe mode — track cost, PII, and tool usage
    guard = TealTigerGuard()
    guard.attach(my_agent)

    # Or use the convenience subclass
    agent = TealTigerAuditAgent(name="coder")

    # Policy enforcement with TealEngine
    from tealtiger import TealEngine

    engine = TealEngine(policies=[...])
    guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
    guard.attach(my_agent)

    # Governed speaker selection in GroupChat
    group_chat = GovernedGroupChat(agents=[agent1, agent2], guard=guard)

No LLM in the governance path. All policy evaluation is deterministic, targeting <5ms latency.
"""

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.audit_agent import TealTigerAuditAgent
from ag2_tealtiger.governed_groupchat import GovernedGroupChat
from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    BudgetState,
    DecisionReceipt,
    DecisionSource,
    DenialMessage,
    EscalationReceipt,
    GovernanceAction,
    GovernanceMode,
    RevalidationCondition,
    SpeakerSelectionAuditEntry,
    TEECContext,
)
from ag2_tealtiger.exceptions import (
    AG2TealTigerError,
    AgentFrozenError,
    BudgetExceededError,
    DecisionExpiredError,
    EscalationPendingError,
    GovernanceDenyError,
)
from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.budget_manager import BudgetCheckResult, BudgetStateManager
from ag2_tealtiger.idempotency import compute_params_hash, derive_idempotency_key

__all__ = [
    # Core components
    "TealTigerGuard",
    "TealTigerAuditAgent",
    "GovernedGroupChat",
    # Managers
    "DecisionReceiptManager",
    "BudgetStateManager",
    "BudgetCheckResult",
    # Data types and enums
    "GovernanceAction",
    "GovernanceMode",
    "ActionKind",
    "DecisionSource",
    "TEECContext",
    "AuditEntry",
    "DecisionReceipt",
    "RevalidationCondition",
    "EscalationReceipt",
    "BudgetState",
    "SpeakerSelectionAuditEntry",
    "DenialMessage",
    # Exceptions
    "AG2TealTigerError",
    "GovernanceDenyError",
    "DecisionExpiredError",
    "BudgetExceededError",
    "AgentFrozenError",
    "EscalationPendingError",
    # Utilities
    "compute_params_hash",
    "derive_idempotency_key",
]
