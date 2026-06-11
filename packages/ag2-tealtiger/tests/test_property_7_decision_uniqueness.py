"""Property-based test: Decision Identity Uniqueness Across Turns (Property 7).

# Feature: ag2-tealtiger-adapter, Property 7: Decision Identity Uniqueness Across Turns

*For any* two governance evaluations in different turns (even with identical
agent_id, tool_name, and tool_args), the system SHALL produce two distinct
decision_ids, even when params_hash is identical.

**Validates: Requirements 5.7, 11.4**
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import MockConversableAgent, MockTealEngine, make_tool_call_message
from .strategies import agent_ids, tool_args, tool_names


@pytest.mark.property
class TestDecisionIdentityUniquenessAcrossTurns:
    """Property 7: Decision Identity Uniqueness Across Turns.

    For any two governance evaluations in different turns (even with identical
    agent_id, tool_name, and tool_args), the system SHALL produce two distinct
    decision_ids, even when params_hash is identical.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_identical_calls_in_different_turns_produce_distinct_decision_ids(
        self,
        agent_id: str,
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 5.7, 11.4

        When the same agent calls the same tool with identical arguments in
        two different turns, each evaluation SHALL produce a distinct
        decision_id even though params_hash is the same.
        """
        # Create guard with a mock engine returning ALLOW
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Create agent and attach
        agent = MockConversableAgent(name=agent_id)
        sender = MockConversableAgent(name="sender_agent")
        guard.attach(agent)

        # Build identical tool call message
        msg = make_tool_call_message(tool_name=tool_name, arguments=args)

        # Turn 1: First invocation
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Turn 2: Identical invocation (same agent, tool, args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Both calls should produce audit entries
        trail = guard.audit_trail
        assert len(trail) >= 2, (
            f"Expected at least 2 audit entries, got {len(trail)}"
        )

        # Get the two entries corresponding to the tool call evaluations
        entry_1 = trail[-2]
        entry_2 = trail[-1]

        # Verify they have distinct decision_ids
        assert entry_1.decision_id != entry_2.decision_id, (
            f"Same agent/tool/args in different turns must produce distinct "
            f"decision_ids, but both got '{entry_1.decision_id}'"
        )

        # Verify that params_hash is the same (since args are identical)
        if entry_1.teec.params_hash and entry_2.teec.params_hash:
            assert entry_1.teec.params_hash == entry_2.teec.params_hash, (
                f"Same args should produce same params_hash, but got "
                f"'{entry_1.teec.params_hash}' vs '{entry_2.teec.params_hash}'"
            )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        num_turns=st.integers(min_value=2, max_value=10),
    )
    def test_n_identical_calls_produce_n_distinct_decision_ids(
        self,
        agent_id: str,
        tool_name: str,
        args: dict,
        num_turns: int,
    ) -> None:
        """Validates: Requirements 5.7, 11.4

        When the same agent calls the same tool with identical arguments
        across N different turns, all N evaluations SHALL produce N distinct
        decision_ids.
        """
        # Create guard with a mock engine returning ALLOW
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Create agent and attach
        agent = MockConversableAgent(name=agent_id)
        sender = MockConversableAgent(name="sender_agent")
        guard.attach(agent)

        # Build identical tool call message
        msg = make_tool_call_message(tool_name=tool_name, arguments=args)

        # Execute N identical turns
        for _ in range(num_turns):
            guard._reply_hook(
                recipient=agent,
                messages=[msg],
                sender=sender,
                config=None,
            )

        # Collect all decision_ids from the audit trail
        trail = guard.audit_trail
        assert len(trail) >= num_turns, (
            f"Expected at least {num_turns} audit entries, got {len(trail)}"
        )

        # Get the last N entries
        recent_entries = trail[-num_turns:]
        decision_ids = [entry.decision_id for entry in recent_entries]

        # All decision_ids must be unique
        assert len(set(decision_ids)) == num_turns, (
            f"Expected {num_turns} distinct decision_ids across {num_turns} turns, "
            f"but got {len(set(decision_ids))} unique: {decision_ids}"
        )

        # Verify params_hash consistency (same args -> same hash)
        params_hashes = [
            entry.teec.params_hash
            for entry in recent_entries
            if entry.teec.params_hash is not None
        ]
        if params_hashes:
            assert len(set(params_hashes)) == 1, (
                f"Same args should produce same params_hash across all turns, "
                f"but got {len(set(params_hashes))} unique hashes"
            )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_decision_ids_are_valid_uuids(
        self,
        agent_id: str,
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 5.7, 11.4

        Each decision_id SHALL be a valid UUID v4 string, ensuring global
        uniqueness across governance evaluations.
        """
        import uuid as uuid_mod

        # Create guard with a mock engine returning ALLOW
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Create agent and attach
        agent = MockConversableAgent(name=agent_id)
        sender = MockConversableAgent(name="sender_agent")
        guard.attach(agent)

        # Build identical tool call message
        msg = make_tool_call_message(tool_name=tool_name, arguments=args)

        # Execute two turns
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Verify both decision_ids are valid UUIDs
        trail = guard.audit_trail
        for entry in trail[-2:]:
            try:
                parsed = uuid_mod.UUID(entry.decision_id)
                assert parsed.version == 4, (
                    f"decision_id should be UUID v4, got version {parsed.version}"
                )
            except ValueError:
                pytest.fail(
                    f"decision_id '{entry.decision_id}' is not a valid UUID"
                )
