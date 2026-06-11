"""Tests for TealTigerGuard freeze/unfreeze kill switch.

Validates:
- Task 6.2: freeze(), unfreeze(), is_frozen() methods
- Requirements: 4.1, 4.2, 4.4, 4.5, 4.6

Freeze is mode-independent: always blocks regardless of governance mode.
"""

from __future__ import annotations

import time
from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


class _MockConversableAgent:
    """Lightweight mock of AG2's ConversableAgent for unit testing."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self,
        trigger: Any,
        reply_func: Any,
        position: int = 0,
        config: Any = None,
        reset_config: Any = None,
        **kwargs: Any,
    ) -> None:
        self._reply_funcs.insert(
            position,
            {
                "trigger": trigger,
                "reply_func": reply_func,
                "config": config,
                "reset_config": reset_config,
            },
        )


# ── Test: freeze() ───────────────────────────────────────────────────────────


class TestFreeze:
    """Test TealTigerGuard.freeze() behavior."""

    def test_freeze_adds_agent_to_frozen_set(self) -> None:
        """freeze() adds the agent_id to internal frozen set."""
        guard = TealTigerGuard()

        guard.freeze("agent_a")

        assert "agent_a" in guard._frozen_agents

    def test_freeze_multiple_agents(self) -> None:
        """freeze() can freeze multiple agents independently."""
        guard = TealTigerGuard()

        guard.freeze("agent_a")
        guard.freeze("agent_b")
        guard.freeze("agent_c")

        assert "agent_a" in guard._frozen_agents
        assert "agent_b" in guard._frozen_agents
        assert "agent_c" in guard._frozen_agents

    def test_freeze_same_agent_twice_is_idempotent(self) -> None:
        """Freezing an already-frozen agent does not error; remains frozen."""
        guard = TealTigerGuard()

        guard.freeze("agent_a")
        guard.freeze("agent_a")

        assert "agent_a" in guard._frozen_agents
        # Two audit entries are recorded (one per freeze call)
        freeze_entries = [
            e for e in guard.audit_trail
            if e.agent_id == "agent_a" and "AGENT_FROZEN" in e.reason_codes
        ]
        assert len(freeze_entries) == 2

    def test_freeze_records_audit_entry(self) -> None:
        """freeze() records an AuditEntry in the audit trail. (Req 4.6)"""
        guard = TealTigerGuard()

        guard.freeze("agent_a")

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert isinstance(entry, AuditEntry)

    def test_freeze_audit_entry_fields(self) -> None:
        """freeze() audit entry has correct field values."""
        guard = TealTigerGuard()
        before_ms = time.time() * 1000

        guard.freeze("coder")

        after_ms = time.time() * 1000
        entry = guard.audit_trail[0]

        # Core fields
        assert entry.agent_id == "coder"
        assert entry.action == GovernanceAction.DENY.value
        assert entry.action_kind == ActionKind.FREEZE.value
        assert entry.mode == GovernanceMode.OBSERVE.value
        assert entry.reason_codes == ["AGENT_FROZEN"]
        assert entry.risk_score == 100
        assert "frozen" in entry.reason.lower()

        # Timestamp is realistic
        assert before_ms <= entry.timestamp_ms <= after_ms

        # IDs are populated
        assert entry.correlation_id  # non-empty UUID
        assert entry.decision_id  # non-empty UUID
        assert entry.correlation_id != entry.decision_id

    def test_freeze_audit_entry_has_teec_context(self) -> None:
        """freeze() audit entry includes a TEEC context."""
        guard = TealTigerGuard()

        guard.freeze("coder")

        entry = guard.audit_trail[0]
        assert entry.teec is not None
        assert entry.teec.namespace == "teec.ag2"
        assert entry.teec.conversation_id == guard._teec_builder.conversation_id
        assert entry.teec.agent_role == "coder"
        assert entry.teec.decision_id == entry.decision_id
        assert entry.teec.decision_source == "default_mode"

    def test_freeze_in_enforce_mode(self) -> None:
        """freeze() works the same in ENFORCE mode — mode-independent."""
        guard = TealTigerGuard(mode=GovernanceMode.ENFORCE)

        guard.freeze("coder")

        assert guard.is_frozen("coder")
        entry = guard.audit_trail[0]
        assert entry.mode == GovernanceMode.ENFORCE.value
        assert entry.risk_score == 100

    def test_freeze_in_monitor_mode(self) -> None:
        """freeze() works the same in MONITOR mode — mode-independent."""
        guard = TealTigerGuard(mode=GovernanceMode.MONITOR)

        guard.freeze("coder")

        assert guard.is_frozen("coder")
        entry = guard.audit_trail[0]
        assert entry.mode == GovernanceMode.MONITOR.value
        assert entry.risk_score == 100

    def test_freeze_evaluation_time_recorded(self) -> None:
        """freeze() records evaluation_time_ms >= 0."""
        guard = TealTigerGuard()

        guard.freeze("coder")

        entry = guard.audit_trail[0]
        assert entry.evaluation_time_ms >= 0


# ── Test: unfreeze() ──────────────────────────────────────────────────────────


class TestUnfreeze:
    """Test TealTigerGuard.unfreeze() behavior."""

    def test_unfreeze_removes_agent_from_frozen_set(self) -> None:
        """unfreeze() removes the agent_id from the frozen set. (Req 4.4)"""
        guard = TealTigerGuard()
        guard.freeze("agent_a")

        guard.unfreeze("agent_a")

        assert "agent_a" not in guard._frozen_agents

    def test_unfreeze_agent_not_frozen_is_safe(self) -> None:
        """unfreeze() on a non-frozen agent does not error."""
        guard = TealTigerGuard()

        # Should not raise
        guard.unfreeze("agent_a")

        assert "agent_a" not in guard._frozen_agents

    def test_unfreeze_records_audit_entry(self) -> None:
        """unfreeze() records an AuditEntry in the audit trail. (Req 4.6)"""
        guard = TealTigerGuard()
        guard.freeze("agent_a")

        guard.unfreeze("agent_a")

        # Two entries: one freeze + one unfreeze
        assert len(guard.audit_trail) == 2
        unfreeze_entry = guard.audit_trail[1]
        assert isinstance(unfreeze_entry, AuditEntry)

    def test_unfreeze_audit_entry_fields(self) -> None:
        """unfreeze() audit entry has correct field values."""
        guard = TealTigerGuard()
        guard.freeze("coder")
        before_ms = time.time() * 1000

        guard.unfreeze("coder")

        after_ms = time.time() * 1000
        entry = guard.audit_trail[1]  # second entry is unfreeze

        # Core fields
        assert entry.agent_id == "coder"
        assert entry.action == GovernanceAction.ALLOW.value
        assert entry.action_kind == ActionKind.FREEZE.value
        assert entry.mode == GovernanceMode.OBSERVE.value
        assert entry.reason_codes == ["AGENT_UNFROZEN"]
        assert entry.risk_score == 0
        assert "unfrozen" in entry.reason.lower()

        # Timestamp is realistic
        assert before_ms <= entry.timestamp_ms <= after_ms

        # IDs are populated
        assert entry.correlation_id  # non-empty
        assert entry.decision_id  # non-empty
        assert entry.correlation_id != entry.decision_id

    def test_unfreeze_audit_entry_has_teec_context(self) -> None:
        """unfreeze() audit entry includes a TEEC context."""
        guard = TealTigerGuard()
        guard.freeze("coder")

        guard.unfreeze("coder")

        entry = guard.audit_trail[1]
        assert entry.teec is not None
        assert entry.teec.namespace == "teec.ag2"
        assert entry.teec.conversation_id == guard._teec_builder.conversation_id
        assert entry.teec.agent_role == "coder"
        assert entry.teec.decision_id == entry.decision_id

    def test_unfreeze_preserves_other_frozen_agents(self) -> None:
        """unfreeze() only affects the specified agent."""
        guard = TealTigerGuard()
        guard.freeze("agent_a")
        guard.freeze("agent_b")
        guard.freeze("agent_c")

        guard.unfreeze("agent_b")

        assert guard.is_frozen("agent_a")
        assert not guard.is_frozen("agent_b")
        assert guard.is_frozen("agent_c")


# ── Test: is_frozen() ─────────────────────────────────────────────────────────


class TestIsFrozen:
    """Test TealTigerGuard.is_frozen() behavior."""

    def test_is_frozen_returns_false_for_unknown_agent(self) -> None:
        """is_frozen() returns False for an agent never frozen."""
        guard = TealTigerGuard()

        assert guard.is_frozen("unknown_agent") is False

    def test_is_frozen_returns_true_after_freeze(self) -> None:
        """is_frozen() returns True after freeze is called."""
        guard = TealTigerGuard()
        guard.freeze("coder")

        assert guard.is_frozen("coder") is True

    def test_is_frozen_returns_false_after_unfreeze(self) -> None:
        """is_frozen() returns False after unfreeze is called."""
        guard = TealTigerGuard()
        guard.freeze("coder")
        guard.unfreeze("coder")

        assert guard.is_frozen("coder") is False

    def test_is_frozen_independent_per_agent(self) -> None:
        """is_frozen() is per-agent — freezing one doesn't affect others."""
        guard = TealTigerGuard()
        guard.freeze("agent_a")

        assert guard.is_frozen("agent_a") is True
        assert guard.is_frozen("agent_b") is False


# ── Test: Freeze/Unfreeze Round-Trip ──────────────────────────────────────────


class TestFreezeUnfreezeRoundTrip:
    """Test freeze followed by unfreeze restores normal state. (Req 4.4)"""

    def test_freeze_unfreeze_restores_state(self) -> None:
        """Freeze then unfreeze restores the agent to non-frozen state."""
        guard = TealTigerGuard()

        guard.freeze("coder")
        assert guard.is_frozen("coder") is True

        guard.unfreeze("coder")
        assert guard.is_frozen("coder") is False

    def test_multiple_freeze_unfreeze_cycles(self) -> None:
        """Agent can be frozen and unfrozen multiple times."""
        guard = TealTigerGuard()

        for _ in range(5):
            guard.freeze("coder")
            assert guard.is_frozen("coder") is True

            guard.unfreeze("coder")
            assert guard.is_frozen("coder") is False

    def test_freeze_unfreeze_audit_trail_ordering(self) -> None:
        """Freeze/unfreeze events are recorded in order in audit trail."""
        guard = TealTigerGuard()

        guard.freeze("coder")
        guard.unfreeze("coder")
        guard.freeze("coder")

        assert len(guard.audit_trail) == 3

        # First: freeze
        assert guard.audit_trail[0].reason_codes == ["AGENT_FROZEN"]
        assert guard.audit_trail[0].action == GovernanceAction.DENY.value

        # Second: unfreeze
        assert guard.audit_trail[1].reason_codes == ["AGENT_UNFROZEN"]
        assert guard.audit_trail[1].action == GovernanceAction.ALLOW.value

        # Third: freeze again
        assert guard.audit_trail[2].reason_codes == ["AGENT_FROZEN"]
        assert guard.audit_trail[2].action == GovernanceAction.DENY.value

    def test_freeze_unfreeze_timestamps_are_ordered(self) -> None:
        """Audit timestamps are monotonically increasing across operations."""
        guard = TealTigerGuard()

        guard.freeze("coder")
        guard.unfreeze("coder")

        assert guard.audit_trail[0].timestamp_ms <= guard.audit_trail[1].timestamp_ms


# ── Test: Frozen Agent Denial Behavior ────────────────────────────────────────


class TestFrozenAgentDenial:
    """Test that frozen agents receive DENY with AGENT_FROZEN regardless of mode."""

    def test_frozen_denial_has_correct_reason_code(self) -> None:
        """Frozen agent denial uses reason_code 'AGENT_FROZEN'. (Req 4.2)"""
        guard = TealTigerGuard()
        guard.freeze("coder")

        # The freeze itself records a DENY with AGENT_FROZEN
        entry = guard.audit_trail[0]
        assert "AGENT_FROZEN" in entry.reason_codes

    def test_frozen_denial_has_risk_score_100(self) -> None:
        """Frozen agent denial always has risk_score 100. (Req 4.2)"""
        guard = TealTigerGuard()
        guard.freeze("coder")

        entry = guard.audit_trail[0]
        assert entry.risk_score == 100

    def test_frozen_denial_mode_independent_observe(self) -> None:
        """Freeze blocks in OBSERVE mode — mode-independent. (Req 4.1)"""
        guard = TealTigerGuard(mode=GovernanceMode.OBSERVE)
        guard.freeze("coder")

        assert guard.is_frozen("coder")
        entry = guard.audit_trail[0]
        assert entry.risk_score == 100
        assert "AGENT_FROZEN" in entry.reason_codes

    def test_frozen_denial_mode_independent_monitor(self) -> None:
        """Freeze blocks in MONITOR mode — mode-independent. (Req 4.1)"""
        guard = TealTigerGuard(mode=GovernanceMode.MONITOR)
        guard.freeze("coder")

        assert guard.is_frozen("coder")
        entry = guard.audit_trail[0]
        assert entry.risk_score == 100
        assert "AGENT_FROZEN" in entry.reason_codes

    def test_frozen_denial_mode_independent_enforce(self) -> None:
        """Freeze blocks in ENFORCE mode — mode-independent. (Req 4.1)"""
        guard = TealTigerGuard(mode=GovernanceMode.ENFORCE)
        guard.freeze("coder")

        assert guard.is_frozen("coder")
        entry = guard.audit_trail[0]
        assert entry.risk_score == 100
        assert "AGENT_FROZEN" in entry.reason_codes


# ── Test: Audit Trail Completeness ────────────────────────────────────────────


class TestFreezeAuditCompleteness:
    """Test that freeze/unfreeze produce complete audit entries. (Req 4.6)"""

    def test_freeze_entry_has_all_required_fields(self) -> None:
        """freeze() audit entry has all AuditEntry required fields."""
        guard = TealTigerGuard()
        guard.freeze("coder")

        entry = guard.audit_trail[0]

        # All required fields exist and are non-empty/non-None
        assert entry.correlation_id
        assert entry.decision_id
        assert entry.timestamp_ms > 0
        assert entry.action in ("ALLOW", "DENY", "MODIFY", "REFER")
        assert entry.action_kind == ActionKind.FREEZE.value
        assert entry.mode in ("ENFORCE", "MONITOR", "OBSERVE")
        assert entry.agent_id == "coder"
        assert entry.reason
        assert isinstance(entry.reason_codes, list)
        assert entry.risk_score >= 0
        assert entry.evaluation_time_ms >= 0
        assert entry.teec is not None

    def test_unfreeze_entry_has_all_required_fields(self) -> None:
        """unfreeze() audit entry has all AuditEntry required fields."""
        guard = TealTigerGuard()
        guard.freeze("coder")
        guard.unfreeze("coder")

        entry = guard.audit_trail[1]

        assert entry.correlation_id
        assert entry.decision_id
        assert entry.timestamp_ms > 0
        assert entry.action == GovernanceAction.ALLOW.value
        assert entry.action_kind == ActionKind.FREEZE.value
        assert entry.mode in ("ENFORCE", "MONITOR", "OBSERVE")
        assert entry.agent_id == "coder"
        assert entry.reason
        assert isinstance(entry.reason_codes, list)
        assert entry.risk_score == 0
        assert entry.evaluation_time_ms >= 0
        assert entry.teec is not None

    def test_each_freeze_unfreeze_gets_unique_ids(self) -> None:
        """Each freeze/unfreeze call gets its own correlation_id and decision_id."""
        guard = TealTigerGuard()

        guard.freeze("coder")
        guard.unfreeze("coder")
        guard.freeze("reviewer")

        ids = set()
        for entry in guard.audit_trail:
            ids.add(entry.correlation_id)
            ids.add(entry.decision_id)

        # 3 entries * 2 ids each = 6 unique IDs
        assert len(ids) == 6
