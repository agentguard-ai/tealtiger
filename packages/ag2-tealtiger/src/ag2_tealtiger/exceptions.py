"""Exception hierarchy for ag2-tealtiger.

Provides typed exceptions for governance denials, budget enforcement,
freeze operations, and escalation states.
"""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from ag2_tealtiger.types import EscalationReceipt


class AG2TealTigerError(Exception):
    """Base exception for ag2-tealtiger package."""

    pass


class GovernanceDenyError(AG2TealTigerError):
    """Raised when a governance policy denies the request in ENFORCE mode.

    Contains the full decision dict including reason, risk_score,
    reason_codes, and correlation_id for audit trail lookup.
    """

    def __init__(self, decision: dict[str, Any]) -> None:
        self.decision = decision
        super().__init__(f"Governance DENY: {decision.get('reason', 'Policy violation')}")


class DecisionExpiredError(AG2TealTigerError):
    """Raised when a cached decision receipt has expired."""

    def __init__(self, decision_id: str, expired_at: str) -> None:
        self.decision_id = decision_id
        self.expired_at = expired_at
        super().__init__(f"Decision {decision_id} expired at {expired_at}")


class BudgetExceededError(GovernanceDenyError):
    """Raised when an agent's budget limit is exceeded in ENFORCE mode."""

    pass


class AgentFrozenError(GovernanceDenyError):
    """Raised when a frozen agent attempts an operation in ENFORCE mode."""

    pass


class EscalationPendingError(AG2TealTigerError):
    """Raised when an action is suspended pending REFER resolution."""

    def __init__(self, escalation_receipt: EscalationReceipt) -> None:
        self.escalation_receipt = escalation_receipt
        super().__init__(f"Action suspended: REFER {escalation_receipt.decision_id}")
