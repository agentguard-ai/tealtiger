"""Property-based test: Per-Agent Governance Isolation (Property 5).

# Feature: ag2-tealtiger-adapter, Property 5: Per-Agent Governance Isolation

*For any* two distinct agents sharing a TealTigerGuard instance, an ALLOW
decision for Agent A SHALL NOT authorize the same action for Agent B — Agent B's
request SHALL be evaluated independently, producing its own distinct decision_id.

**Validates: Requirements 1.7, 8.1, 8.2, 8.3**
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import MockConversableAgent, MockTealEngine, make_tool_call_message
from .strategies import agent_ids, tool_args, tool_names


@st.composite
def _distinct_agent_pair(draw: st.DrawFn) -> tuple[str, str]:
    """Generate two distinct agent IDs guaranteed to be different."""
    agent_a = draw(agent_ids)
    agent_b = draw(agent_ids.filter(lambda x: x != agent_a))
    return (agent_a, agent_b)


@pytest.mark.property
class TestPerAgentGovernanceIsolation:
    """Property 5: Per-Agent Governance Isolation.

    For any two distinct agents sharing a TealTigerGuard instance, an ALLOW
    decision for Agent A SHALL NOT authorize the same action for Agent B —
    Agent B's request SHALL be evaluated independently, producing its own
    distinct decision_id.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_pair=_distinct_agent_pair(),
        tool_name=tool_names,
        args=tool_args,
    )
    def test_same_tool_call_produces_independent_decision_ids(
        self,
        agent_pair: tuple[str, str],
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 1.7, 8.1, 8.2, 8.3

        When two distinct agents make the same tool call through the same
        TealTigerGuard, each SHALL receive an independent decision_id. The
        ALLOW decision for Agent A does not authorize Agent B's identical call.
        """
        agent_a_name, agent_b_name = agent_pair

        # Create a single guard with a mock engine that allows everything
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Create two distinct agents and attach both to the same guard
        agent_a = MockConversableAgent(name=agent_a_name)
        agent_b = MockConversableAgent(name=agent_b_name)
        guard.attach(agent_a)
        guard.attach(agent_b)

        # Make the same tool call from Agent A
        msg_a = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent_a,
            messages=[msg_a],
            sender=agent_b,
            config=None,
        )

        # Make the same tool call from Agent B
        msg_b = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent_b,
            messages=[msg_b],
            sender=agent_a,
            config=None,
        )

        # Both calls should produce audit entries with distinct decision_ids
        trail = guard.audit_trail
        assert len(trail) >= 2, (
            f"Expected at least 2 audit entries, got {len(trail)}"
        )

        # Get the last two entries (corresponding to Agent A and Agent B calls)
        entry_a = trail[-2]
        entry_b = trail[-1]

        # Verify they have different decision_ids
        assert entry_a.decision_id != entry_b.decision_id, (
            f"Agent A and Agent B must have distinct decision_ids, "
            f"but both got '{entry_a.decision_id}'"
        )

        # Verify agent_ids are correctly scoped
        assert entry_a.agent_id == agent_a_name
        assert entry_b.agent_id == agent_b_name

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_pair=_distinct_agent_pair(),
        tool_name=tool_names,
        args=tool_args,
    )
    def test_engine_called_independently_for_each_agent(
        self,
        agent_pair: tuple[str, str],
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 1.7, 8.1, 8.2, 8.3

        When two distinct agents make the same tool call, the TealEngine
        SHALL be invoked separately for each agent — the engine evaluate()
        is called once per agent with the respective agent_id in the context.
        """
        agent_a_name, agent_b_name = agent_pair

        # Create a single guard with a mock engine
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Attach two agents
        agent_a = MockConversableAgent(name=agent_a_name)
        agent_b = MockConversableAgent(name=agent_b_name)
        guard.attach(agent_a)
        guard.attach(agent_b)

        # Record engine call count before
        initial_count = engine.call_count

        # Agent A makes a tool call
        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent_a,
            messages=[msg],
            sender=agent_b,
            config=None,
        )

        # Agent B makes the same tool call
        guard._reply_hook(
            recipient=agent_b,
            messages=[msg],
            sender=agent_a,
            config=None,
        )

        # Engine should have been called once for each agent (2 total new calls)
        assert engine.call_count - initial_count == 2, (
            f"Expected engine to be called 2 times (once per agent), "
            f"but was called {engine.call_count - initial_count} times"
        )

        # Verify that each call included the correct agent_id in context
        recent_calls = engine.evaluate_calls[-2:]
        agent_ids_in_calls = [
            call["context"]["agent_id"] for call in recent_calls
        ]
        assert agent_a_name in agent_ids_in_calls, (
            f"Expected agent_id '{agent_a_name}' in engine calls"
        )
        assert agent_b_name in agent_ids_in_calls, (
            f"Expected agent_id '{agent_b_name}' in engine calls"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_pair=_distinct_agent_pair(),
        tool_name=tool_names,
        args=tool_args,
    )
    def test_allow_for_agent_a_does_not_prevent_deny_for_agent_b(
        self,
        agent_pair: tuple[str, str],
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 1.7, 8.1, 8.2, 8.3

        When the engine allows Agent A but denies Agent B for the same tool
        call, both decisions SHALL be independently enforced — Agent A proceeds
        while Agent B is blocked.
        """
        agent_a_name, agent_b_name = agent_pair

        # Create engine that allows Agent A but denies Agent B
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        engine.set_decision_for_agent(
            agent_b_name,
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
            reason="Agent B denied",
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent_a = MockConversableAgent(name=agent_a_name)
        agent_b = MockConversableAgent(name=agent_b_name)
        guard.attach(agent_a)
        guard.attach(agent_b)

        # Agent A's call should be allowed (return False, None)
        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        result_a = guard._reply_hook(
            recipient=agent_a,
            messages=[msg],
            sender=agent_b,
            config=None,
        )

        # Agent B's identical call should be denied (return True, denial_message)
        result_b = guard._reply_hook(
            recipient=agent_b,
            messages=[msg],
            sender=agent_a,
            config=None,
        )

        # Agent A should pass through
        assert result_a[0] is False, (
            f"Agent A should be allowed (False, None), got terminate={result_a[0]}"
        )

        # Agent B should be blocked
        assert result_b[0] is True, (
            f"Agent B should be denied (True, message), got terminate={result_b[0]}"
        )

        # Verify audit trail reflects the per-agent scoping
        trail = guard.audit_trail
        agent_a_entries = [e for e in trail if e.agent_id == agent_a_name]
        agent_b_entries = [e for e in trail if e.agent_id == agent_b_name]

        # Agent A should have an ALLOW entry
        assert any(e.action == GovernanceAction.ALLOW.value for e in agent_a_entries), (
            "Agent A should have an ALLOW audit entry"
        )

        # Agent B should have a DENY entry
        assert any(e.action == GovernanceAction.DENY.value for e in agent_b_entries), (
            "Agent B should have a DENY audit entry"
        )
