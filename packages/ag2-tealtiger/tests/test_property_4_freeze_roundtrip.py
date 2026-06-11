"""Property test: Freeze/Unfreeze Round-Trip (Property 4).

**Property 4:** For any agent, calling freeze followed by unfreeze SHALL restore
normal governance evaluation — subsequent tool calls SHALL be evaluated against
policies (not auto-denied) and the agent SHALL be eligible for speaker selection.

**Validates: Requirements 4.4**

Uses Hypothesis with max_examples=100 to verify the round-trip property
across generated agent_ids.
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    GovernanceAction,
    GovernanceMode,
)

from .conftest import (
    MockConversableAgent,
    MockTealEngine,
    make_mock_agent,
    make_mock_engine,
    make_tool_call_message,
)
from .strategies import agent_ids, tool_names, tool_args


# ── Property 4: Freeze/Unfreeze Round-Trip ────────────────────────────────────


class TestProperty4FreezeUnfreezeRoundTrip:
    """Property 4: Freeze/Unfreeze Round-Trip.

    For any agent, calling freeze followed by unfreeze SHALL restore normal
    governance evaluation — subsequent tool calls SHALL be evaluated against
    policies (not auto-denied) and the agent SHALL be eligible for speaker
    selection.

    Validates: Requirements 4.4
    """

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(agent_id=agent_ids)
    def test_freeze_unfreeze_restores_non_frozen_state(
        self, agent_id: str
    ) -> None:
        """After freeze+unfreeze, agent is no longer frozen.

        **Validates: Requirements 4.4**
        """
        guard = TealTigerGuard()

        # Freeze the agent
        guard.freeze(agent_id)
        assert guard.is_frozen(agent_id) is True

        # Unfreeze the agent
        guard.unfreeze(agent_id)
        assert guard.is_frozen(agent_id) is False

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(agent_id=agent_ids, tool_name=tool_names, args=tool_args)
    def test_freeze_unfreeze_tool_calls_not_auto_denied(
        self, agent_id: str, tool_name: str, args: dict[str, Any]
    ) -> None:
        """After freeze+unfreeze in observe mode, tool calls pass through (not denied).

        In observe mode (no engine), the _reply_hook should return (False, None)
        indicating the tool call is allowed to proceed, not (True, denial_message)
        which would indicate AGENT_FROZEN auto-denial.

        **Validates: Requirements 4.4**
        """
        guard = TealTigerGuard()  # observe mode, no engine

        # Create a mock agent and attach the guard
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze then unfreeze
        guard.freeze(agent_id)
        guard.unfreeze(agent_id)

        # Simulate a tool call through the reply hook
        sender = make_mock_agent("user")
        messages = [make_tool_call_message(tool_name, args, sender_name=agent_id)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should pass through (False, None) — not denied
        should_terminate, reply = result
        assert should_terminate is False, (
            f"Tool call was blocked after freeze+unfreeze for agent '{agent_id}'. "
            f"Reply: {reply}"
        )
        assert reply is None

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(agent_id=agent_ids, tool_name=tool_names, args=tool_args)
    def test_freeze_unfreeze_policy_evaluation_not_frozen_denial(
        self, agent_id: str, tool_name: str, args: dict[str, Any]
    ) -> None:
        """After freeze+unfreeze in ENFORCE mode, tool calls are evaluated by engine (not auto-denied as AGENT_FROZEN).

        With a mock engine returning ALLOW, the tool call should pass through
        rather than being blocked with reason_code AGENT_FROZEN.

        **Validates: Requirements 4.4**
        """
        engine = make_mock_engine(
            action=GovernanceAction.ALLOW,
            risk_score=0,
            reason_codes=["POLICY_ALLOW"],
            reason="Allowed by policy",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Create a mock agent and attach the guard
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze then unfreeze
        guard.freeze(agent_id)
        guard.unfreeze(agent_id)

        # Simulate a tool call through the reply hook
        sender = make_mock_agent("user")
        messages = [make_tool_call_message(tool_name, args, sender_name=agent_id)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should pass through (engine returns ALLOW) — not denied as AGENT_FROZEN
        should_terminate, reply = result
        assert should_terminate is False, (
            f"Tool call was blocked after freeze+unfreeze for agent '{agent_id}'. "
            f"Expected engine evaluation (ALLOW), got denial. Reply: {reply}"
        )
        assert reply is None

        # Verify the engine was actually called (not short-circuited by frozen check)
        assert engine.call_count >= 1, (
            "TealEngine was not called — agent may still be treated as frozen"
        )

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(agent_id=agent_ids, tool_name=tool_names, args=tool_args)
    def test_freeze_unfreeze_no_agent_frozen_reason_code_in_post_unfreeze_audit(
        self, agent_id: str, tool_name: str, args: dict[str, Any]
    ) -> None:
        """After freeze+unfreeze, subsequent tool call audit entries do NOT contain AGENT_FROZEN reason code.

        This verifies that the governance evaluation after unfreeze treats the
        agent normally, producing audit entries with reason codes from the actual
        evaluation path (e.g., OBSERVE_PASSTHROUGH) rather than AGENT_FROZEN.

        **Validates: Requirements 4.4**
        """
        guard = TealTigerGuard()  # observe mode

        # Create a mock agent and attach the guard
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Freeze then unfreeze
        guard.freeze(agent_id)
        guard.unfreeze(agent_id)

        # Count audit entries before the tool call
        entries_before = len(guard.audit_trail)

        # Simulate a tool call
        sender = make_mock_agent("user")
        messages = [make_tool_call_message(tool_name, args, sender_name=agent_id)]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Check audit entries added after the tool call
        new_entries = guard.audit_trail[entries_before:]
        assert len(new_entries) >= 1, "No audit entry was produced for the tool call"

        for entry in new_entries:
            assert "AGENT_FROZEN" not in entry.reason_codes, (
                f"Post-unfreeze tool call produced AGENT_FROZEN reason code. "
                f"Agent '{agent_id}' is being treated as frozen after unfreeze. "
                f"Entry reason_codes: {entry.reason_codes}"
            )

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(agent_id=agent_ids)
    def test_freeze_unfreeze_agent_eligible_for_speaker_selection(
        self, agent_id: str
    ) -> None:
        """After freeze+unfreeze, agent is eligible for speaker selection (not skipped as frozen).

        GovernedGroupChat skips frozen agents without TealEngine evaluation.
        After unfreeze, the agent should NOT be skipped — is_frozen returns False.

        **Validates: Requirements 4.4**
        """
        guard = TealTigerGuard()

        # Freeze then unfreeze
        guard.freeze(agent_id)
        guard.unfreeze(agent_id)

        # The agent should not be frozen — eligible for speaker selection
        assert guard.is_frozen(agent_id) is False, (
            f"Agent '{agent_id}' is still frozen after unfreeze — "
            f"would be skipped during speaker selection"
        )

    @pytest.mark.property
    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        num_cycles=st.integers(min_value=1, max_value=5),
        tool_name=tool_names,
        args=tool_args,
    )
    def test_multiple_freeze_unfreeze_cycles_restore_evaluation(
        self, agent_id: str, num_cycles: int, tool_name: str, args: dict[str, Any]
    ) -> None:
        """Multiple freeze/unfreeze cycles still restore normal evaluation.

        After any number of freeze+unfreeze cycles, the agent should
        be in a non-frozen state and tool calls should pass through.

        **Validates: Requirements 4.4**
        """
        guard = TealTigerGuard()  # observe mode

        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Perform multiple freeze/unfreeze cycles
        for _ in range(num_cycles):
            guard.freeze(agent_id)
            assert guard.is_frozen(agent_id) is True
            guard.unfreeze(agent_id)
            assert guard.is_frozen(agent_id) is False

        # After all cycles, tool call should pass through
        sender = make_mock_agent("user")
        messages = [make_tool_call_message(tool_name, args, sender_name=agent_id)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        should_terminate, reply = result
        assert should_terminate is False, (
            f"Tool call blocked after {num_cycles} freeze/unfreeze cycles "
            f"for agent '{agent_id}'. Reply: {reply}"
        )
        assert reply is None
