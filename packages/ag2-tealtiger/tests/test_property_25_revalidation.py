"""Property-based test: Revalidation Condition Triggering (Property 25).

# Feature: ag2-tealtiger-adapter, Property 25: Revalidation Condition Triggering

*For any* ALLOW decision receipt with revalidate_if conditions, when a condition
is met, the system SHALL trigger re-evaluation before permitting execution,
recording an audit entry with reason_code "REVALIDATION_TRIGGERED".

**Validates: Requirements 16.4, 16.6**
"""

from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.types import GovernanceAction, RevalidationCondition

# ── Strategies ────────────────────────────────────────────────────────────────

# Decision IDs as UUID v4 strings
_decision_ids = st.builds(lambda: str(uuid_mod.uuid4()))

# Cost thresholds for "cost_exceeded" conditions
_cost_thresholds = st.floats(min_value=0.01, max_value=10000.0, allow_nan=False, allow_infinity=False)

# Time thresholds in seconds for "time_elapsed" conditions
_time_thresholds = st.integers(min_value=1, max_value=86400)

# Context hash strings for "context_changed" conditions
_context_hashes = st.text(
    alphabet="0123456789abcdef",
    min_size=8,
    max_size=64,
)

# Amounts to exceed thresholds by (positive deltas)
_positive_deltas = st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False)

# Amounts below thresholds (fractions 0.0 to 0.99 of threshold)
_below_fractions = st.floats(min_value=0.0, max_value=0.99, allow_nan=False, allow_infinity=False)


@pytest.mark.property
class TestRevalidationConditionTriggering:
    """Property 25: Revalidation Condition Triggering.

    For any ALLOW decision receipt with revalidate_if conditions, when a
    condition is met, check_revalidation() SHALL return True indicating
    re-evaluation is needed, and expire() SHALL record
    "REVALIDATION_TRIGGERED" in execution_outcome enabling an audit entry
    with that reason code.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        threshold=_cost_thresholds,
        delta=_positive_deltas,
    )
    def test_cost_exceeded_condition_triggers_revalidation(
        self, decision_id: str, threshold: float, delta: float
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a "cost_exceeded" revalidation condition is attached and the
        current context cost meets or exceeds the threshold, check_revalidation
        SHALL return True indicating re-evaluation is needed.
        """
        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="cost_exceeded",
            threshold=threshold,
            description="Re-evaluate when cost exceeds threshold",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Current cost meets or exceeds threshold
        current_cost = threshold + delta
        result = manager.check_revalidation(
            decision_id, {"cost": current_cost}
        )

        assert result is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        threshold=_time_thresholds,
        extra_seconds=st.integers(min_value=0, max_value=3600),
    )
    def test_time_elapsed_condition_triggers_revalidation(
        self, decision_id: str, threshold: int, extra_seconds: int
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a "time_elapsed" revalidation condition is attached and the
        current context elapsed_seconds meets or exceeds the threshold,
        check_revalidation SHALL return True indicating re-evaluation is needed.
        """
        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="time_elapsed",
            threshold=threshold,
            description="Re-evaluate after time threshold",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Elapsed time meets or exceeds threshold
        elapsed = threshold + extra_seconds
        result = manager.check_revalidation(
            decision_id, {"elapsed_seconds": elapsed}
        )

        assert result is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        original_hash=_context_hashes,
        new_hash=_context_hashes,
    )
    def test_context_changed_condition_triggers_revalidation(
        self, decision_id: str, original_hash: str, new_hash: str
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a "context_changed" revalidation condition is attached and the
        current context_hash differs from the threshold (original hash),
        check_revalidation SHALL return True indicating re-evaluation is needed.
        """
        # Only test when hashes actually differ
        from hypothesis import assume

        assume(original_hash != new_hash)

        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="context_changed",
            threshold=original_hash,
            description="Re-evaluate when context changes",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Context hash is different from original
        result = manager.check_revalidation(
            decision_id, {"context_hash": new_hash}
        )

        assert result is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        threshold=_cost_thresholds,
        below_fraction=_below_fractions,
    )
    def test_unmet_cost_condition_does_not_trigger(
        self, decision_id: str, threshold: float, below_fraction: float
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a "cost_exceeded" condition is attached but the current cost
        is below the threshold, check_revalidation SHALL return False
        (no re-evaluation needed).
        """
        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="cost_exceeded",
            threshold=threshold,
            description="Re-evaluate when cost exceeds threshold",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Current cost is strictly below threshold
        current_cost = threshold * below_fraction
        result = manager.check_revalidation(
            decision_id, {"cost": current_cost}
        )

        assert result is False

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        original_hash=_context_hashes,
    )
    def test_unchanged_context_does_not_trigger(
        self, decision_id: str, original_hash: str
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a "context_changed" condition is attached but the current
        context_hash matches the threshold (original), check_revalidation
        SHALL return False (no re-evaluation needed).
        """
        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="context_changed",
            threshold=original_hash,
            description="Re-evaluate when context changes",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Context hash is same as original — no change
        result = manager.check_revalidation(
            decision_id, {"context_hash": original_hash}
        )

        assert result is False

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        threshold=_cost_thresholds,
        delta=_positive_deltas,
    )
    def test_revalidation_triggered_records_reason_code(
        self, decision_id: str, threshold: float, delta: float
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a revalidation condition is met and expire() is called with
        "REVALIDATION_TRIGGERED", the execution_outcome SHALL contain
        "REVALIDATION_TRIGGERED" enabling an audit entry with that reason code.
        """
        manager = DecisionReceiptManager()

        condition = RevalidationCondition(
            condition_type="cost_exceeded",
            threshold=threshold,
            description="Re-evaluate when cost exceeds threshold",
        )

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[condition],
        )

        # Verify condition is met
        current_cost = threshold + delta
        assert manager.check_revalidation(decision_id, {"cost": current_cost}) is True

        # Expire with REVALIDATION_TRIGGERED reason
        manager.expire(decision_id, "REVALIDATION_TRIGGERED")

        receipt = manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.execution_outcome == "REVALIDATION_TRIGGERED"
        assert receipt.is_expired is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
        cost_threshold=_cost_thresholds,
        time_threshold=_time_thresholds,
        cost_delta=_positive_deltas,
    )
    def test_any_single_met_condition_triggers_revalidation(
        self,
        decision_id: str,
        cost_threshold: float,
        time_threshold: int,
        cost_delta: float,
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When multiple revalidation conditions are attached, meeting ANY
        single condition SHALL trigger revalidation (logical OR semantics).
        """
        manager = DecisionReceiptManager()

        conditions = [
            RevalidationCondition(
                condition_type="cost_exceeded",
                threshold=cost_threshold,
                description="Cost limit",
            ),
            RevalidationCondition(
                condition_type="time_elapsed",
                threshold=time_threshold,
                description="Time limit",
            ),
        ]

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=conditions,
        )

        # Only cost condition is met, time is not
        result = manager.check_revalidation(
            decision_id,
            {"cost": cost_threshold + cost_delta, "elapsed_seconds": 0},
        )

        assert result is True

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        decision_id=_decision_ids,
    )
    def test_no_conditions_never_triggers(
        self, decision_id: str
    ) -> None:
        """Validates: Requirements 16.4, 16.6

        When a receipt has no revalidation conditions (empty list),
        check_revalidation SHALL always return False regardless of context.
        """
        manager = DecisionReceiptManager()

        manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.ALLOW,
            revalidate_if=[],
        )

        # Any context should not trigger revalidation
        result = manager.check_revalidation(
            decision_id,
            {"cost": 99999.0, "elapsed_seconds": 99999, "context_hash": "changed"},
        )

        assert result is False
