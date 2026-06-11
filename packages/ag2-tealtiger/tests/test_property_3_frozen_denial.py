"""Property test: Frozen Agent Complete Denial (Property 3).

**Property 3:** For any frozen agent, all subsequent operations (tool calls
and inter-agent messages) SHALL be denied with reason_code "AGENT_FROZEN"
and risk_score 100, regardless of the tool name, arguments, or message content.

**Validates: Requirements 4.1, 4.2, 4.5, 17.4**

Uses Hypothesis to generate arbitrary tool calls and messages, verifying
that a frozen agent is always denied regardless of operation type or content.
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import MockTealEngine, make_mock_agent, make_tool_call_message, make_text_message
from .strategies import agent_ids, tool_names, tool_args, governance_modes


# ── Strategies ────────────────────────────────────────────────────────────────

# Message content: arbitrary text that could contain anything
message_content = st.text(min_size=0, max_size=500)


# ── Property 3: Frozen Agent Complete Denial ──────────────────────────────────


@pytest.mark.property
class TestFrozenAgentCompleteDenial:
    """Property 3: Frozen agents are always denied with AGENT_FROZEN and risk_score 100."""

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
        mode=governance_modes,
    )
    def test_frozen_agent_tool_calls_always_denied(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
        mode: GovernanceMode,
    ) -> None:
        """For any frozen agent, tool calls are denied with AGENT_FROZEN and risk_score 100.

        Validates: Requirements 4.1, 4.2
        """
        # Setup: create guard in the given mode (with engine for non-observe modes)
        engine = MockTealEngine() if mode != GovernanceMode.OBSERVE else None
        guard = TealTigerGuard(engine=engine, mode=mode)

        # Create and attach agent
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze the agent
        guard.freeze(agent_id)

        # Clear the freeze audit entry to isolate tool call denial entries
        freeze_entries_count = len(guard.audit_trail)

        # Simulate a tool call from the frozen agent
        sender = make_mock_agent("user_proxy")
        messages = [make_tool_call_message(tool_name, tool_arguments)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Verify: result is (True, denial_string) — blocked
        assert result[0] is True, "Frozen agent tool call should be blocked (True)"
        assert isinstance(result[1], str), "Denial result should be a string"
        assert "GOVERNANCE DENIAL" in result[1], "Should contain GOVERNANCE DENIAL marker"

        # Verify: audit entry has AGENT_FROZEN and risk_score 100
        # The new entry is after the freeze event entries
        new_entries = guard.audit_trail[freeze_entries_count:]
        assert len(new_entries) >= 1, "Should record at least one audit entry"

        denial_entry = new_entries[0]
        assert denial_entry.action == GovernanceAction.DENY.value
        assert "AGENT_FROZEN" in denial_entry.reason_codes
        assert denial_entry.risk_score == 100
        assert denial_entry.agent_id == agent_id

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        content=message_content,
        mode=governance_modes,
    )
    def test_frozen_agent_messages_always_denied(
        self,
        agent_id: str,
        content: str,
        mode: GovernanceMode,
    ) -> None:
        """For any frozen agent, inter-agent messages are denied with AGENT_FROZEN and risk_score 100.

        Validates: Requirements 4.1, 4.5, 17.4
        """
        # Setup: create guard in the given mode
        engine = MockTealEngine() if mode != GovernanceMode.OBSERVE else None
        guard = TealTigerGuard(engine=engine, mode=mode)

        # Create and attach agent
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze the agent
        guard.freeze(agent_id)

        # Clear the freeze audit entry to isolate message denial entries
        freeze_entries_count = len(guard.audit_trail)

        # Simulate a plain text message (no tool_calls) to the frozen agent
        sender = make_mock_agent("other_agent")
        messages = [make_text_message(content)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Verify: result is (True, denial_string) — blocked
        assert result[0] is True, "Frozen agent message should be blocked (True)"
        assert isinstance(result[1], str), "Denial result should be a string"
        assert "frozen" in result[1].lower(), "Denial message should mention frozen"

        # Verify: audit entry has AGENT_FROZEN and risk_score 100
        new_entries = guard.audit_trail[freeze_entries_count:]
        assert len(new_entries) >= 1, "Should record at least one audit entry"

        denial_entry = new_entries[0]
        assert denial_entry.action == GovernanceAction.DENY.value
        assert "AGENT_FROZEN" in denial_entry.reason_codes
        assert denial_entry.risk_score == 100
        assert denial_entry.agent_id == agent_id

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
        content=message_content,
        mode=governance_modes,
    )
    def test_frozen_agent_denied_regardless_of_content(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
        content: str,
        mode: GovernanceMode,
    ) -> None:
        """For any frozen agent, ALL operations are denied regardless of tool name, args, or message content.

        This test combines tool calls and messages to verify universality of the denial.

        Validates: Requirements 4.1, 4.2, 4.5, 17.4
        """
        # Setup: create guard with an engine configured to ALLOW everything
        # This proves that freeze overrides even permissive engine decisions
        engine = MockTealEngine(
            default_action=GovernanceAction.ALLOW,
            default_risk_score=0,
            default_reason_codes=["ALLOWED"],
        )
        guard = TealTigerGuard(engine=engine, mode=mode)

        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze the agent
        guard.freeze(agent_id)
        freeze_entries_count = len(guard.audit_trail)

        sender = make_mock_agent("orchestrator")

        # Test tool call
        tool_messages = [make_tool_call_message(tool_name, tool_arguments)]
        tool_result = guard._reply_hook(
            recipient=agent,
            messages=tool_messages,
            sender=sender,
            config=None,
        )

        assert tool_result[0] is True, "Frozen agent tool call must be blocked"
        assert isinstance(tool_result[1], str)

        # Test message
        text_messages = [make_text_message(content)]
        msg_result = guard._reply_hook(
            recipient=agent,
            messages=text_messages,
            sender=sender,
            config=None,
        )

        assert msg_result[0] is True, "Frozen agent message must be blocked"
        assert isinstance(msg_result[1], str)

        # Verify all new audit entries are DENY with AGENT_FROZEN and risk_score 100
        new_entries = guard.audit_trail[freeze_entries_count:]
        assert len(new_entries) >= 2, "Should have entries for both tool call and message"

        for entry in new_entries:
            assert entry.action == GovernanceAction.DENY.value, (
                f"All operations on frozen agent must be DENY, got {entry.action}"
            )
            assert "AGENT_FROZEN" in entry.reason_codes, (
                f"All denials for frozen agent must have AGENT_FROZEN, got {entry.reason_codes}"
            )
            assert entry.risk_score == 100, (
                f"All denials for frozen agent must have risk_score 100, got {entry.risk_score}"
            )

        # Verify engine was never called (freeze short-circuits before engine evaluation)
        assert engine.call_count == 0, (
            "TealEngine should NOT be invoked for frozen agents"
        )
