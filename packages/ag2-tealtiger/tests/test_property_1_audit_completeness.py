"""Property-based test: Audit Entry Structural Completeness (Property 1).

# Feature: ag2-tealtiger-adapter, Property 1: Audit Entry Structural Completeness

*For any* governance evaluation (tool call, message send, or speaker selection),
the resulting AuditEntry SHALL contain a valid teec.ag2 namespace with
conversation_id, turn_id, agent_id, decision_id, and evaluation_time_ms > 0,
regardless of the governance decision outcome.

**Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5**
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
)

from .conftest import MockTealEngine, make_mock_engine
from .strategies import agent_ids, governance_actions, governance_modes, tool_args, tool_names


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for property tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


def _make_tool_call_messages(
    tool_name: str, arguments: dict[str, Any]
) -> list[dict[str, Any]]:
    """Create a messages list with a single tool call in AG2 format."""
    return [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": f"call_{tool_name}_001",
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": arguments,
                    },
                }
            ],
        }
    ]


def _make_text_messages(content: str) -> list[dict[str, Any]]:
    """Create a messages list with a plain text message (for message governance)."""
    return [{"role": "assistant", "content": content}]


def _assert_audit_entry_structurally_complete(entry: AuditEntry) -> None:
    """Assert that an AuditEntry has all required structural fields populated."""
    # teec namespace must be "teec.ag2"
    assert entry.teec.namespace == "teec.ag2", (
        f"Expected namespace 'teec.ag2', got '{entry.teec.namespace}'"
    )

    # conversation_id must be a non-empty string (UUID v4 format)
    assert entry.teec.conversation_id, (
        "conversation_id must be a non-empty string"
    )
    assert len(entry.teec.conversation_id) > 0

    # turn_id must be a positive integer
    assert isinstance(entry.teec.turn_id, int), (
        f"turn_id must be int, got {type(entry.teec.turn_id)}"
    )
    assert entry.teec.turn_id > 0, (
        f"turn_id must be > 0, got {entry.teec.turn_id}"
    )

    # agent_id must be a non-empty string
    assert entry.agent_id, "agent_id must be a non-empty string"
    assert len(entry.agent_id) > 0

    # decision_id must be a non-empty string (UUID v4 format)
    assert entry.teec.decision_id, (
        "decision_id must be a non-empty string"
    )
    assert len(entry.teec.decision_id) > 0

    # evaluation_time_ms must be > 0
    assert entry.evaluation_time_ms > 0, (
        f"evaluation_time_ms must be > 0, got {entry.evaluation_time_ms}"
    )


# ── Strategies ────────────────────────────────────────────────────────────────


# Governance modes to test across
_all_modes = st.sampled_from(list(GovernanceMode))

# Engine decision outcomes for policy mode
_engine_actions = st.sampled_from([
    GovernanceAction.ALLOW,
    GovernanceAction.DENY,
    GovernanceAction.REFER,
])

# Simple text content for message sends
_message_content = st.text(
    alphabet="abcdefghijklmnopqrstuvwxyz ",
    min_size=1,
    max_size=100,
)


# ── Property Tests ────────────────────────────────────────────────────────────


@pytest.mark.property
class TestAuditEntryStructuralCompleteness:
    """Property 1: Audit Entry Structural Completeness.

    For any governance evaluation (tool call, message send, or speaker selection),
    the resulting AuditEntry SHALL contain a valid teec.ag2 namespace with
    conversation_id, turn_id, agent_id, decision_id, and evaluation_time_ms > 0.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_observe_mode_tool_call_audit_completeness(
        self, agent_name: str, tool_name: str, args: dict[str, Any]
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        In observe mode (no engine), tool call evaluations SHALL produce
        structurally complete AuditEntries with all required TEEC fields.
        """
        guard = TealTigerGuard()
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_tool_call_messages(tool_name, args)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # At least one audit entry should be produced
        assert len(guard.audit_trail) >= 1, (
            "Observe mode tool call should produce at least one AuditEntry"
        )

        # Verify structural completeness of the last audit entry
        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        engine_action=_engine_actions,
    )
    def test_enforce_mode_tool_call_audit_completeness(
        self,
        agent_name: str,
        tool_name: str,
        args: dict[str, Any],
        engine_action: GovernanceAction,
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        In ENFORCE mode, any TealEngine decision (ALLOW, DENY, REFER) for
        a tool call SHALL produce a structurally complete AuditEntry.
        """
        engine = make_mock_engine(
            action=engine_action,
            risk_score=50,
            reason_codes=["TEST_POLICY"],
            reason="Test policy decision",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_tool_call_messages(tool_name, args)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # At least one audit entry should be produced
        assert len(guard.audit_trail) >= 1, (
            f"ENFORCE mode with {engine_action.value} decision should produce "
            f"at least one AuditEntry"
        )

        # Verify structural completeness of the last audit entry
        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        engine_action=_engine_actions,
    )
    def test_monitor_mode_tool_call_audit_completeness(
        self,
        agent_name: str,
        tool_name: str,
        args: dict[str, Any],
        engine_action: GovernanceAction,
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        In MONITOR mode, any TealEngine decision (ALLOW, DENY, REFER) for
        a tool call SHALL produce a structurally complete AuditEntry.
        """
        engine = make_mock_engine(
            action=engine_action,
            risk_score=30,
            reason_codes=["TEST_MONITOR"],
            reason="Monitor mode test",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_tool_call_messages(tool_name, args)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # At least one audit entry should be produced
        assert len(guard.audit_trail) >= 1, (
            f"MONITOR mode with {engine_action.value} decision should produce "
            f"at least one AuditEntry"
        )

        # Verify structural completeness of the last audit entry
        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        content=_message_content,
    )
    def test_observe_mode_message_send_audit_completeness(
        self, agent_name: str, content: str
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        In observe mode, text message evaluations (message sends) SHALL
        produce structurally complete AuditEntries.
        """
        guard = TealTigerGuard()
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_text_messages(content)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # At least one audit entry should be produced
        assert len(guard.audit_trail) >= 1, (
            "Observe mode message send should produce at least one AuditEntry"
        )

        # Verify structural completeness of the last audit entry
        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        content=_message_content,
        engine_action=_engine_actions,
    )
    def test_policy_mode_message_send_audit_completeness(
        self, agent_name: str, content: str, engine_action: GovernanceAction
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        In policy mode (ENFORCE), text message evaluations SHALL produce
        structurally complete AuditEntries regardless of the decision outcome.
        """
        engine = make_mock_engine(
            action=engine_action,
            risk_score=40,
            reason_codes=["MSG_POLICY"],
            reason="Message governance test",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_text_messages(content)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # At least one audit entry should be produced
        assert len(guard.audit_trail) >= 1, (
            f"Policy mode with {engine_action.value} for message should produce "
            f"at least one AuditEntry"
        )

        # Verify structural completeness of the last audit entry
        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_frozen_agent_tool_call_audit_completeness(
        self, agent_name: str, tool_name: str, args: dict[str, Any]
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        When a frozen agent attempts a tool call, the resulting DENY AuditEntry
        SHALL still be structurally complete with all required TEEC fields.
        """
        guard = TealTigerGuard()
        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        # Freeze the agent
        guard.freeze(agent_name)

        messages = _make_tool_call_messages(tool_name, args)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        # The freeze event produces an audit entry, and the denied tool call
        # produces another. We want the denial entry (last one after freeze).
        # Filter audit entries for this agent's tool call denial
        denial_entries = [
            e for e in guard.audit_trail
            if e.agent_id == agent_name and e.action == GovernanceAction.DENY.value
            and "AGENT_FROZEN" in e.reason_codes
        ]
        assert len(denial_entries) >= 1, (
            "Frozen agent tool call should produce at least one DENY AuditEntry"
        )

        entry = denial_entries[-1]
        _assert_audit_entry_structurally_complete(entry)

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        mode=_all_modes,
    )
    def test_all_modes_produce_complete_audit_entries(
        self,
        agent_name: str,
        tool_name: str,
        args: dict[str, Any],
        mode: GovernanceMode,
    ) -> None:
        """Validates: Requirements 1.6, 5.1, 5.7, 12.1, 12.2, 12.5, 13.5

        Regardless of governance mode (OBSERVE, MONITOR, ENFORCE), every
        governance evaluation SHALL produce a structurally complete AuditEntry.
        """
        if mode == GovernanceMode.OBSERVE:
            guard = TealTigerGuard(mode=mode)
        else:
            engine = make_mock_engine(
                action=GovernanceAction.ALLOW,
                risk_score=0,
                reason_codes=["TEST"],
                reason="Test",
            )
            guard = TealTigerGuard(engine=engine, mode=mode)

        agent = _MockAgent(agent_name)
        sender = _MockAgent("user")

        messages = _make_tool_call_messages(tool_name, args)
        guard._reply_hook(recipient=agent, messages=messages, sender=sender, config=None)

        assert len(guard.audit_trail) >= 1, (
            f"Mode {mode.value} should produce at least one AuditEntry"
        )

        entry = guard.audit_trail[-1]
        _assert_audit_entry_structurally_complete(entry)
