"""Property-based test: Decision Receipt Expiry Enforcement (Property 24).

# Feature: ag2-tealtiger-adapter, Property 24: Decision Receipt Expiry Enforcement

*For any* ALLOW decision receipt whose expires_at timestamp has passed, any subsequent
attempt to use that receipt SHALL be rejected and trigger fresh TealEngine evaluation,
with an audit entry containing reason_code "DECISION_EXPIRED".

**Validates: Requirements 16.3, 16.6**
"""

from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.types import GovernanceAction

# ── Strategies ────────────────────────────────────────────────────────────────

# Generate positive expiry offsets in seconds (representing how far in the past
# the expiry was set relative to "now"). Min 1 second to ensure clear expiry.
_past_expiry_offsets = st.integers(min_value=1, max_value=86400)

# Generate future expiry offsets (receipts that are NOT expired)
_future_expiry_offsets = st.integers(min_value=1, max_value=86400)

# Generate decision IDs as UUID v4 strings
_decision_ids = st.builds(lambda: str(uuid_mod.uuid4()))

# Default expiry seconds configuration
_default_expiry_seconds = st.integers(min_value=60, max_value=7200)


@pytest.mark.property
class TestDecisionReceiptExpiryEnforcement:
    """Property 24: Decision Receipt Expiry Enforcement.

    For any ALLOW decision receipt whose expires_at timestamp has passed,
    is_valid() SHALL return False (receipt rejected), and expire() SHALL
    record "DECISION_EXPIRED" in execution_outcome, enabling an audit
    entry with reason_code "DECISION_EXPIRED" to be produced.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        past_offset=_past_expiry_offsets,
    )
    def test_expired_receipt_is_rejected(
        self, decision_id: str, past_offset: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        Any ALLOW decision receipt whose expires_at timestamp is in the past
        SHALL be rejected by is_valid(), returning False.
        """
        manager = DecisionReceiptManager()
        # Create receipt with an expiry in the past
        expired_time = datetime.now(timezone.utc) - timedelta(seconds=past_offset)

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=expired_time,
        )

        # The receipt MUST be invalid (rejected)
        assert manager.is_valid(decision_id) is False

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        past_offset=_past_expiry_offsets,
    )
    def test_expired_receipt_marked_is_expired(
        self, decision_id: str, past_offset: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        When a receipt's expires_at has passed and is_valid() is called,
        the receipt SHALL be marked as is_expired=True for future checks.
        """
        manager = DecisionReceiptManager()
        expired_time = datetime.now(timezone.utc) - timedelta(seconds=past_offset)

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=expired_time,
        )

        # Trigger validity check
        manager.is_valid(decision_id)

        # Receipt must be marked expired
        receipt = manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.is_expired is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        past_offset=_past_expiry_offsets,
    )
    def test_expired_receipt_records_decision_expired_reason(
        self, decision_id: str, past_offset: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        When an expired receipt is explicitly expired via expire() with
        reason "DECISION_EXPIRED", the execution_outcome SHALL contain
        "DECISION_EXPIRED" enabling the audit trail to record this reason code.
        """
        manager = DecisionReceiptManager()
        expired_time = datetime.now(timezone.utc) - timedelta(seconds=past_offset)

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=expired_time,
        )

        # Expire with the standard reason code
        manager.expire(decision_id, "DECISION_EXPIRED")

        receipt = manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.execution_outcome == "DECISION_EXPIRED"
        assert receipt.is_expired is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        future_offset=_future_expiry_offsets,
    )
    def test_non_expired_receipt_remains_valid(
        self, decision_id: str, future_offset: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        Receipts whose expires_at is in the future SHALL remain valid
        (is_valid returns True) — only expired receipts are rejected.
        """
        manager = DecisionReceiptManager()
        future_time = datetime.now(timezone.utc) + timedelta(seconds=future_offset)

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=future_time,
        )

        # The receipt MUST be valid
        assert manager.is_valid(decision_id) is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        default_expiry=_default_expiry_seconds,
    )
    def test_default_expiry_applied_when_none_specified(
        self, decision_id: str, default_expiry: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        When expires_at is not specified, the manager SHALL apply a
        configurable default expiry, and the receipt SHALL be valid
        immediately after creation (not yet expired).
        """
        manager = DecisionReceiptManager(default_expiry_seconds=default_expiry)

        receipt = manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=None,
        )

        # Receipt should be valid (default expiry is in the future)
        assert manager.is_valid(decision_id) is True
        # expires_at should be set (not None)
        assert receipt.expires_at is not None

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        past_offset=_past_expiry_offsets,
    )
    def test_repeated_validity_checks_on_expired_consistently_false(
        self, decision_id: str, past_offset: int
    ) -> None:
        """Validates: Requirements 16.3, 16.6

        Once a receipt is expired, repeated calls to is_valid SHALL
        consistently return False — expiry is irreversible without
        fresh evaluation.
        """
        manager = DecisionReceiptManager()
        expired_time = datetime.now(timezone.utc) - timedelta(seconds=past_offset)

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            expires_at=expired_time,
        )

        # Multiple checks must all return False
        assert manager.is_valid(decision_id) is False
        assert manager.is_valid(decision_id) is False
        assert manager.is_valid(decision_id) is False
