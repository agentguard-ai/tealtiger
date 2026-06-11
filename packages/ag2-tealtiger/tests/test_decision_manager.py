"""Unit tests for DecisionReceiptManager.

Tests cover:
- Receipt creation with explicit and default expiry
- Validity checking (valid, expired, manually expired, unknown)
- Revalidation condition evaluation (cost_exceeded, time_elapsed, context_changed)
- Manual expiry with reason recording
- Configurable default expiry duration
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.types import GovernanceAction, RevalidationCondition


class TestCreateReceipt:
    """Tests for DecisionReceiptManager.create_receipt."""

    def test_creates_receipt_with_explicit_expiry(self) -> None:
        manager = DecisionReceiptManager()
        expires = datetime.now(timezone.utc) + timedelta(hours=2)

        receipt = manager.create_receipt(
            decision_id="dec-001",
            action=GovernanceAction.ALLOW,
            expires_at=expires,
            revalidate_if=None,
        )

        assert receipt.decision_id == "dec-001"
        assert receipt.action == GovernanceAction.ALLOW
        assert receipt.expires_at == expires
        assert receipt.is_expired is False
        assert receipt.revalidate_if == []

    def test_creates_receipt_with_default_expiry(self) -> None:
        manager = DecisionReceiptManager(default_expiry_seconds=1800)
        before = datetime.now(timezone.utc)

        receipt = manager.create_receipt(
            decision_id="dec-002",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=None,
        )

        after = datetime.now(timezone.utc)
        assert receipt.expires_at is not None
        # Default expiry should be ~1800 seconds from now
        expected_min = before + timedelta(seconds=1800)
        expected_max = after + timedelta(seconds=1800)
        assert expected_min <= receipt.expires_at <= expected_max

    def test_creates_receipt_with_revalidation_conditions(self) -> None:
        manager = DecisionReceiptManager()
        conditions = [
            RevalidationCondition(
                condition_type="cost_exceeded",
                threshold=10.0,
                description="Re-evaluate when cost exceeds $10",
            ),
            RevalidationCondition(
                condition_type="time_elapsed",
                threshold=300,
                description="Re-evaluate after 5 minutes",
            ),
        ]

        receipt = manager.create_receipt(
            decision_id="dec-003",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            revalidate_if=conditions,
        )

        assert len(receipt.revalidate_if) == 2
        assert receipt.revalidate_if[0].condition_type == "cost_exceeded"
        assert receipt.revalidate_if[1].condition_type == "time_elapsed"

    def test_creates_receipt_for_refer_action(self) -> None:
        manager = DecisionReceiptManager()

        receipt = manager.create_receipt(
            decision_id="dec-004",
            action=GovernanceAction.REFER,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )

        assert receipt.action == GovernanceAction.REFER
        assert receipt.is_expired is False

    def test_receipt_stores_issued_at_timestamp(self) -> None:
        manager = DecisionReceiptManager()
        before = datetime.now(timezone.utc)

        receipt = manager.create_receipt(
            decision_id="dec-005",
            action=GovernanceAction.ALLOW,
            expires_at=None,
        )

        after = datetime.now(timezone.utc)
        assert before <= receipt.issued_at <= after

    def test_receipt_is_stored_and_retrievable(self) -> None:
        manager = DecisionReceiptManager()
        receipt = manager.create_receipt(
            decision_id="dec-006",
            action=GovernanceAction.ALLOW,
            expires_at=None,
        )

        retrieved = manager.get_receipt("dec-006")
        assert retrieved is receipt


class TestIsValid:
    """Tests for DecisionReceiptManager.is_valid."""

    def test_valid_receipt_not_expired(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-valid",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

        assert manager.is_valid("dec-valid") is True

    def test_expired_receipt_returns_false(self) -> None:
        manager = DecisionReceiptManager()
        # Create with an already-passed expiry
        manager.create_receipt(
            decision_id="dec-expired",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )

        assert manager.is_valid("dec-expired") is False

    def test_manually_expired_receipt_returns_false(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-manual",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        manager.expire("dec-manual", "RECEIPT_EXPIRED")

        assert manager.is_valid("dec-manual") is False

    def test_unknown_decision_id_returns_false(self) -> None:
        manager = DecisionReceiptManager()

        assert manager.is_valid("nonexistent-id") is False

    def test_expired_receipt_gets_marked_is_expired(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-mark",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )

        # First call discovers expiry and marks it
        manager.is_valid("dec-mark")

        receipt = manager.get_receipt("dec-mark")
        assert receipt is not None
        assert receipt.is_expired is True


class TestCheckRevalidation:
    """Tests for DecisionReceiptManager.check_revalidation."""

    def test_no_conditions_returns_false(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-no-conds",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[],
        )

        result = manager.check_revalidation("dec-no-conds", {"cost": 100.0})
        assert result is False

    def test_cost_exceeded_triggers_revalidation(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-cost",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[
                RevalidationCondition(
                    condition_type="cost_exceeded",
                    threshold=10.0,
                    description="Cost limit",
                )
            ],
        )

        # Cost below threshold — no revalidation
        assert manager.check_revalidation("dec-cost", {"cost": 5.0}) is False
        # Cost at threshold — triggers revalidation
        assert manager.check_revalidation("dec-cost", {"cost": 10.0}) is True
        # Cost above threshold — triggers revalidation
        assert manager.check_revalidation("dec-cost", {"cost": 15.0}) is True

    def test_time_elapsed_triggers_revalidation(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-time",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[
                RevalidationCondition(
                    condition_type="time_elapsed",
                    threshold=300,
                    description="5 minutes",
                )
            ],
        )

        assert manager.check_revalidation("dec-time", {"elapsed_seconds": 100}) is False
        assert manager.check_revalidation("dec-time", {"elapsed_seconds": 300}) is True
        assert manager.check_revalidation("dec-time", {"elapsed_seconds": 600}) is True

    def test_context_changed_triggers_revalidation(self) -> None:
        manager = DecisionReceiptManager()
        original_hash = "abc123"
        manager.create_receipt(
            decision_id="dec-ctx",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[
                RevalidationCondition(
                    condition_type="context_changed",
                    threshold=original_hash,
                    description="Context hash changed",
                )
            ],
        )

        # Same hash — no revalidation
        assert manager.check_revalidation("dec-ctx", {"context_hash": "abc123"}) is False
        # Different hash — triggers revalidation
        assert manager.check_revalidation("dec-ctx", {"context_hash": "xyz789"}) is True

    def test_unknown_decision_returns_false(self) -> None:
        manager = DecisionReceiptManager()

        result = manager.check_revalidation("nonexistent", {"cost": 100.0})
        assert result is False

    def test_multiple_conditions_any_triggers(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-multi",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[
                RevalidationCondition(
                    condition_type="cost_exceeded",
                    threshold=50.0,
                    description="Cost limit",
                ),
                RevalidationCondition(
                    condition_type="time_elapsed",
                    threshold=600,
                    description="10 minutes",
                ),
            ],
        )

        # Neither met
        assert manager.check_revalidation(
            "dec-multi", {"cost": 10.0, "elapsed_seconds": 100}
        ) is False
        # Only cost met
        assert manager.check_revalidation(
            "dec-multi", {"cost": 60.0, "elapsed_seconds": 100}
        ) is True
        # Only time met
        assert manager.check_revalidation(
            "dec-multi", {"cost": 10.0, "elapsed_seconds": 700}
        ) is True

    def test_missing_context_key_does_not_trigger(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-missing",
            action=GovernanceAction.ALLOW,
            expires_at=None,
            revalidate_if=[
                RevalidationCondition(
                    condition_type="cost_exceeded",
                    threshold=10.0,
                    description="Cost limit",
                )
            ],
        )

        # Context doesn't have "cost" key — should not trigger
        assert manager.check_revalidation("dec-missing", {"unrelated": "value"}) is False


class TestExpire:
    """Tests for DecisionReceiptManager.expire."""

    def test_expire_marks_receipt_as_expired(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-exp",
            action=GovernanceAction.ALLOW,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

        manager.expire("dec-exp", "RECEIPT_EXPIRED")

        receipt = manager.get_receipt("dec-exp")
        assert receipt is not None
        assert receipt.is_expired is True
        assert receipt.execution_outcome == "RECEIPT_EXPIRED"

    def test_expire_with_revalidation_triggered_reason(self) -> None:
        manager = DecisionReceiptManager()
        manager.create_receipt(
            decision_id="dec-reval",
            action=GovernanceAction.ALLOW,
            expires_at=None,
        )

        manager.expire("dec-reval", "REVALIDATION_TRIGGERED")

        receipt = manager.get_receipt("dec-reval")
        assert receipt is not None
        assert receipt.execution_outcome == "REVALIDATION_TRIGGERED"

    def test_expire_unknown_decision_raises_key_error(self) -> None:
        manager = DecisionReceiptManager()

        with pytest.raises(KeyError, match="Decision receipt not found"):
            manager.expire("nonexistent", "SOME_REASON")


class TestConfigurableDefaultExpiry:
    """Tests for configurable default expiry behavior."""

    def test_default_expiry_is_3600_seconds(self) -> None:
        manager = DecisionReceiptManager()
        assert manager.default_expiry_seconds == 3600

    def test_custom_default_expiry(self) -> None:
        manager = DecisionReceiptManager(default_expiry_seconds=7200)
        before = datetime.now(timezone.utc)

        receipt = manager.create_receipt(
            decision_id="dec-custom",
            action=GovernanceAction.ALLOW,
            expires_at=None,
        )

        after = datetime.now(timezone.utc)
        assert receipt.expires_at is not None
        expected_min = before + timedelta(seconds=7200)
        expected_max = after + timedelta(seconds=7200)
        assert expected_min <= receipt.expires_at <= expected_max

    def test_explicit_expiry_overrides_default(self) -> None:
        manager = DecisionReceiptManager(default_expiry_seconds=3600)
        explicit_expiry = datetime.now(timezone.utc) + timedelta(minutes=5)

        receipt = manager.create_receipt(
            decision_id="dec-override",
            action=GovernanceAction.ALLOW,
            expires_at=explicit_expiry,
        )

        assert receipt.expires_at == explicit_expiry
