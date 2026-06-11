"""DecisionReceiptManager — manages governance decision receipts with expiry and revalidation.

Handles the lifecycle of governance decisions including:
- Creating receipts with expiry timestamps and revalidation conditions
- Validating whether a receipt is still valid (not expired)
- Evaluating revalidation conditions against current context
- Manually expiring receipts with a reason

Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ag2_tealtiger.types import DecisionReceipt, GovernanceAction, RevalidationCondition


class DecisionReceiptManager:
    """Manages governance decision receipts with expiry and revalidation.

    Stores receipts in an internal dict keyed by decision_id. Supports
    configurable default expiry when expires_at is not specified by policy.

    Args:
        default_expiry_seconds: Default expiry duration in seconds applied
            to ALLOW decisions when expires_at is not specified. Defaults to 3600 (1 hour).
    """

    def __init__(self, default_expiry_seconds: int = 3600) -> None:
        self.default_expiry_seconds = default_expiry_seconds
        self._receipts: dict[str, DecisionReceipt] = {}

    def create_receipt(
        self,
        decision_id: str,
        action: GovernanceAction,
        expires_at: datetime | None = None,
        revalidate_if: list[RevalidationCondition] | None = None,
    ) -> DecisionReceipt:
        """Create and store a decision receipt.

        If expires_at is not provided, a default expiry is applied based on
        the configured default_expiry_seconds from the current UTC time.

        Args:
            decision_id: Unique identifier for this governance decision.
            action: The governance action (ALLOW, DENY, MODIFY, REFER).
            expires_at: Optional ISO 8601 expiry timestamp. If None, default
                expiry is applied.
            revalidate_if: Optional list of conditions that trigger re-evaluation.

        Returns:
            The created DecisionReceipt instance.
        """
        now = datetime.now(timezone.utc)

        if expires_at is None:
            expires_at = now + timedelta(seconds=self.default_expiry_seconds)

        receipt = DecisionReceipt(
            decision_id=decision_id,
            action=action,
            issued_at=now,
            expires_at=expires_at,
            revalidate_if=revalidate_if if revalidate_if is not None else [],
            is_expired=False,
        )

        self._receipts[decision_id] = receipt
        return receipt

    def is_valid(self, decision_id: str) -> bool:
        """Check whether a decision receipt is still valid (not expired).

        A receipt is valid if:
        - It exists in the store
        - It has not been manually expired
        - The current time has not exceeded its expires_at timestamp

        Args:
            decision_id: The decision identifier to check.

        Returns:
            True if the receipt is valid, False otherwise.
        """
        receipt = self._receipts.get(decision_id)
        if receipt is None:
            return False

        if receipt.is_expired:
            return False

        now = datetime.now(timezone.utc)
        if receipt.expires_at is not None and now >= receipt.expires_at:
            # Mark as expired for future checks
            receipt.is_expired = True
            return False

        return True

    def check_revalidation(self, decision_id: str, current_context: dict) -> bool:
        """Evaluate revalidation conditions against current context.

        Checks each RevalidationCondition attached to the receipt. If any
        condition is met, returns True indicating re-evaluation is needed.

        Supported condition types:
        - "cost_exceeded": Triggered when current_context["cost"] >= threshold
        - "time_elapsed": Triggered when current_context["elapsed_seconds"] >= threshold
        - "context_changed": Triggered when current_context["context_hash"] != threshold
            (threshold holds the original context hash)

        Args:
            decision_id: The decision identifier to check revalidation for.
            current_context: Dict containing current state values to evaluate
                conditions against.

        Returns:
            True if any revalidation condition is met (re-evaluation needed),
            False if no conditions are met or the receipt doesn't exist.
        """
        receipt = self._receipts.get(decision_id)
        if receipt is None:
            return False

        if not receipt.revalidate_if:
            return False

        for condition in receipt.revalidate_if:
            if self._evaluate_condition(condition, current_context):
                return True

        return False

    def expire(self, decision_id: str, reason: str) -> None:
        """Manually expire a decision receipt.

        Marks the receipt as expired and records the reason in the
        execution_outcome field.

        Args:
            decision_id: The decision identifier to expire.
            reason: The reason for manual expiry (e.g., "RECEIPT_EXPIRED",
                "REVALIDATION_TRIGGERED").

        Raises:
            KeyError: If the decision_id is not found in the store.
        """
        receipt = self._receipts.get(decision_id)
        if receipt is None:
            raise KeyError(f"Decision receipt not found: {decision_id}")

        receipt.is_expired = True
        receipt.execution_outcome = reason

    def get_receipt(self, decision_id: str) -> DecisionReceipt | None:
        """Retrieve a receipt by decision_id.

        Args:
            decision_id: The decision identifier to look up.

        Returns:
            The DecisionReceipt if found, None otherwise.
        """
        return self._receipts.get(decision_id)

    def _evaluate_condition(
        self, condition: RevalidationCondition, current_context: dict
    ) -> bool:
        """Evaluate a single revalidation condition against current context.

        Args:
            condition: The revalidation condition to evaluate.
            current_context: Dict with current state values.

        Returns:
            True if the condition is met, False otherwise.
        """
        condition_type = condition.condition_type

        if condition_type == "cost_exceeded":
            cost = current_context.get("cost")
            if cost is not None and cost >= condition.threshold:
                return True

        elif condition_type == "time_elapsed":
            elapsed = current_context.get("elapsed_seconds")
            if elapsed is not None and elapsed >= condition.threshold:
                return True

        elif condition_type == "context_changed":
            context_hash = current_context.get("context_hash")
            if context_hash is not None and context_hash != condition.threshold:
                return True

        return False
