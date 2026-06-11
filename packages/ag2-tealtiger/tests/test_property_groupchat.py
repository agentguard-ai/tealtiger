"""Property tests for GovernedGroupChat (Properties 15, 16, 21, 22, 23).

Tests governance-enforced speaker selection in GovernedGroupChat,
including frozen/budget skip, all-speakers-denied termination,
REFER decision continuation, REFER action isolation, and
escalation receipt completeness.

Uses Hypothesis with @settings(max_examples=100, deadline=5000)
and @pytest.mark.property for all property tests.
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.governed_groupchat import GovernedGroupChat
from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    GovernanceAction,
    GovernanceMode,
)

from .conftest import (
    MockTealEngine,
    make_mock_agent,
    make_mock_engine,
    make_tool_call_message,
)
from .strategies import agent_ids, tool_args, tool_names


# ── Strategies ────────────────────────────────────────────────────────────────

# Generate 2-5 distinct agent IDs for group chat scenarios
distinct_agent_ids = st.lists(
    agent_ids,
    min_size=2,
    max_size=5,
    unique=True,
)


# ── Property 15: GovernedGroupChat Frozen/Budget Skip Without Engine Call ─────


@pytest.mark.property
class TestFrozenBudgetSkipWithoutEngineCall:
    """Property 15: Frozen/over-budget agents are skipped without TealEngine invocation.

    **Validates: Requirements 3.5, 4.3, 18.6**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=distinct_agent_ids,
    )
    def test_frozen_agent_skipped_without_engine_call(
        self,
        agent_names: list[str],
    ) -> None:
        """Frozen agents are skipped in speaker selection without calling TealEngine.

        **Validates: Requirements 3.5, 4.3**
        """
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent(name) for name in agent_names]

        # Freeze the first agent
        frozen_agent_id = agent_names[0]
        guard.freeze(frozen_agent_id)

        # Record engine call count before selection
        calls_before = engine.call_count

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: frozen agent was skipped without engine call
        # Engine should NOT be called for the frozen agent
        # Only non-frozen agents should trigger engine evaluation
        non_frozen_count = len(agent_names) - 1

        # Since engine returns ALLOW for first non-frozen candidate,
        # it should be called exactly once (for the first non-frozen candidate)
        calls_after = engine.call_count
        engine_calls_during_selection = calls_after - calls_before
        assert engine_calls_during_selection <= non_frozen_count, (
            f"Engine called {engine_calls_during_selection} times but only "
            f"{non_frozen_count} non-frozen candidates exist"
        )

        # Verify the frozen agent was NOT the one selected
        if selected is not None:
            assert selected.name != frozen_agent_id, (
                "Frozen agent should never be selected as speaker"
            )

        # Verify audit trail records the skip with AGENT_FROZEN reason
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1, "Should have at least one audit entry"
        last_round = audit[-1]

        frozen_entries = [
            c for c in last_round.candidates_evaluated
            if c["agent_id"] == frozen_agent_id
        ]
        assert len(frozen_entries) == 1, "Frozen agent should appear in candidates"
        assert frozen_entries[0]["reason"] == "AGENT_FROZEN"
        assert frozen_entries[0]["decision"] == GovernanceAction.DENY.value

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=distinct_agent_ids,
        budget_limit=st.floats(min_value=0.01, max_value=10.0, allow_nan=False, allow_infinity=False),
    )
    def test_over_budget_agent_skipped_without_engine_call(
        self,
        agent_names: list[str],
        budget_limit: float,
    ) -> None:
        """Over-budget agents are skipped in speaker selection without calling TealEngine.

        **Validates: Requirements 3.5, 18.6**
        """
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent(name) for name in agent_names]

        # Set budget for first agent and exhaust it
        over_budget_agent_id = agent_names[0]
        guard.set_budget(over_budget_agent_id, budget_limit)
        # Track cost exceeding the limit
        guard._budget_manager.track_cost(over_budget_agent_id, budget_limit + 0.01)

        # Record engine call count before selection
        calls_before = engine.call_count

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: over-budget agent was skipped without engine call
        calls_after = engine.call_count
        engine_calls_during_selection = calls_after - calls_before

        non_over_budget_count = len(agent_names) - 1
        assert engine_calls_during_selection <= non_over_budget_count, (
            f"Engine called {engine_calls_during_selection} times but only "
            f"{non_over_budget_count} within-budget candidates exist"
        )

        # Verify the over-budget agent was NOT selected
        if selected is not None:
            assert selected.name != over_budget_agent_id, (
                "Over-budget agent should never be selected as speaker"
            )

        # Verify audit trail records the skip with BUDGET_EXCEEDED reason
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1
        last_round = audit[-1]

        budget_entries = [
            c for c in last_round.candidates_evaluated
            if c["agent_id"] == over_budget_agent_id
        ]
        assert len(budget_entries) == 1, "Over-budget agent should appear in candidates"
        assert budget_entries[0]["reason"] == "BUDGET_EXCEEDED"
        assert budget_entries[0]["decision"] == GovernanceAction.DENY.value


# ── Property 16: All Speakers Denied Termination ─────────────────────────────


@pytest.mark.property
class TestAllSpeakersDeniedTermination:
    """Property 16: Conversation terminates with ALL_SPEAKERS_DENIED when all candidates denied.

    **Validates: Requirements 3.3**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=distinct_agent_ids,
    )
    def test_all_frozen_agents_terminates_with_all_speakers_denied(
        self,
        agent_names: list[str],
    ) -> None:
        """When all candidates are frozen, selection terminates with ALL_SPEAKERS_DENIED.

        **Validates: Requirements 3.3**
        """
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent(name) for name in agent_names]

        # Freeze all agents
        for name in agent_names:
            guard.freeze(name)

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: no speaker selected
        assert selected is None, "Should return None when all speakers denied"

        # Verify: audit entry contains ALL_SPEAKERS_DENIED
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1
        last_round = audit[-1]
        assert "ALL_SPEAKERS_DENIED" in last_round.reason_codes, (
            f"Expected ALL_SPEAKERS_DENIED in reason_codes, got {last_round.reason_codes}"
        )
        assert last_round.selected_speaker is None

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=distinct_agent_ids,
    )
    def test_all_policy_denied_terminates_with_all_speakers_denied(
        self,
        agent_names: list[str],
    ) -> None:
        """When TealEngine denies all candidates, terminates with ALL_SPEAKERS_DENIED.

        **Validates: Requirements 3.3**
        """
        # Engine denies all agents
        engine = make_mock_engine(
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent(name) for name in agent_names]

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: no speaker selected
        assert selected is None, "Should return None when all speakers policy-denied"

        # Verify: audit entry contains ALL_SPEAKERS_DENIED
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1
        last_round = audit[-1]
        assert "ALL_SPEAKERS_DENIED" in last_round.reason_codes
        assert last_round.selected_speaker is None

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=distinct_agent_ids,
        budget_limit=st.floats(min_value=0.01, max_value=10.0, allow_nan=False, allow_infinity=False),
    )
    def test_mixed_denial_reasons_terminates_with_all_speakers_denied(
        self,
        agent_names: list[str],
        budget_limit: float,
    ) -> None:
        """When all candidates denied for mixed reasons (frozen + budget + policy), terminates correctly.

        **Validates: Requirements 3.3**
        """
        # Engine denies any agent that reaches evaluation
        engine = make_mock_engine(
            action=GovernanceAction.DENY,
            risk_score=70,
            reason_codes=["POLICY_VIOLATION"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent(name) for name in agent_names]

        # Freeze first agent, over-budget second (if exists), rest will be policy-denied
        guard.freeze(agent_names[0])
        if len(agent_names) > 1:
            guard.set_budget(agent_names[1], budget_limit)
            guard._budget_manager.track_cost(agent_names[1], budget_limit + 0.01)

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: no speaker selected
        assert selected is None, "Should return None when all speakers denied"

        # Verify: audit entry contains ALL_SPEAKERS_DENIED
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1
        last_round = audit[-1]
        assert "ALL_SPEAKERS_DENIED" in last_round.reason_codes
        assert last_round.selected_speaker is None


# ── Property 21: REFER Decision Continues GroupChat ───────────────────────────


@pytest.mark.property
class TestReferDecisionContinuesGroupChat:
    """Property 21: REFER suspends agent but does not terminate group conversation.

    **Validates: Requirements 15.1, 15.3**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=st.lists(agent_ids, min_size=3, max_size=5, unique=True),
    )
    def test_refer_suspends_agent_continues_with_others(
        self,
        agent_names: list[str],
    ) -> None:
        """REFER for one agent does not terminate the group; next eligible agent is selected.

        **Validates: Requirements 15.1, 15.3**
        """
        # Engine returns REFER for first agent, ALLOW for others
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        # Override: first agent gets REFER
        engine.set_decision_for_agent(
            agent_names[0],
            action=GovernanceAction.REFER,
            risk_score=50,
            reason_codes=["REQUIRES_REVIEW"],
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agents = [make_mock_agent(name) for name in agent_names]

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: conversation did NOT terminate — a speaker was selected
        assert selected is not None, (
            "REFER for one agent should not terminate the group conversation"
        )
        # The selected speaker should be one of the non-referred agents
        assert selected.name != agent_names[0], (
            "The referred agent should not be selected"
        )
        assert selected.name in agent_names[1:], (
            f"Selected speaker '{selected.name}' should be one of the eligible agents"
        )

        # Verify audit shows REFER for first agent
        audit = ggc.speaker_selection_audit
        assert len(audit) >= 1
        last_round = audit[-1]

        referred_entries = [
            c for c in last_round.candidates_evaluated
            if c["agent_id"] == agent_names[0]
        ]
        assert len(referred_entries) == 1
        assert referred_entries[0]["decision"] == GovernanceAction.REFER.value

        # Verify: ALL_SPEAKERS_DENIED is NOT in reason codes
        assert "ALL_SPEAKERS_DENIED" not in last_round.reason_codes, (
            "REFER should not cause ALL_SPEAKERS_DENIED when other candidates exist"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_names=st.lists(agent_ids, min_size=3, max_size=5, unique=True),
        refer_count=st.integers(min_value=1, max_value=2),
    )
    def test_multiple_refers_still_continues_if_one_allowed(
        self,
        agent_names: list[str],
        refer_count: int,
    ) -> None:
        """Multiple REFER decisions don't terminate if at least one agent is ALLOW.

        **Validates: Requirements 15.1, 15.3**
        """
        # Clamp refer_count so at least one agent remains eligible
        actual_refer_count = min(refer_count, len(agent_names) - 1)

        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        # Set REFER for the first N agents
        for i in range(actual_refer_count):
            engine.set_decision_for_agent(
                agent_names[i],
                action=GovernanceAction.REFER,
                risk_score=50,
                reason_codes=["REQUIRES_REVIEW"],
            )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agents = [make_mock_agent(name) for name in agent_names]

        ggc = GovernedGroupChat(
            agents=agents,
            guard=guard,
            speaker_selection_method="auto",
        )

        selected = ggc.select_speaker(last_speaker=None, selector=None)

        # Verify: a speaker was selected from the non-referred agents
        assert selected is not None, (
            "With at least one non-referred agent, conversation should continue"
        )
        referred_names = set(agent_names[:actual_refer_count])
        assert selected.name not in referred_names, (
            "Selected speaker should not be a referred agent"
        )


# ── Property 22: REFER Agent Unrelated Action Isolation ───────────────────────


@pytest.mark.property
class TestReferAgentUnrelatedActionIsolation:
    """Property 22: Agent with unresolved REFER for tool X can still use other tools.

    **Validates: Requirements 15.7**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        referred_tool=tool_names,
        other_tool=tool_names,
        other_tool_args=tool_args,
    )
    def test_refer_for_tool_x_does_not_block_tool_y(
        self,
        agent_id: str,
        referred_tool: str,
        other_tool: str,
        other_tool_args: dict[str, Any],
    ) -> None:
        """An agent with REFER for tool X can still use other tools Y.

        **Validates: Requirements 15.7**
        """
        # Ensure tools are different
        if referred_tool == other_tool:
            other_tool = other_tool + "_alt"

        # Engine returns REFER for the referred_tool, ALLOW for others
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        engine.set_decision_for_tool(
            referred_tool,
            action=GovernanceAction.REFER,
            risk_score=50,
            reason_codes=["REQUIRES_REVIEW"],
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")

        # Step 1: Trigger REFER for referred_tool
        refer_messages = [make_tool_call_message(referred_tool, {"key": "value"})]
        refer_result = guard._reply_hook(
            recipient=agent,
            messages=refer_messages,
            sender=sender,
            config=None,
        )

        # Verify REFER was issued (action suspended)
        assert refer_result[0] is True, "REFER should suspend the action"
        assert "pending review" in refer_result[1].lower() or "Action pending" in refer_result[1]

        # Step 2: Now call a different tool — should be ALLOWED
        other_messages = [make_tool_call_message(other_tool, other_tool_args)]
        other_result = guard._reply_hook(
            recipient=agent,
            messages=other_messages,
            sender=sender,
            config=None,
        )

        # Verify: the other tool was allowed (not blocked by the pending REFER)
        assert other_result[0] is False, (
            f"Tool '{other_tool}' should be allowed despite pending REFER for '{referred_tool}'. "
            f"Got result: {other_result}"
        )
        assert other_result[1] is None, (
            "ALLOW result should return None reply"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        referred_tool=tool_names,
    )
    def test_refer_does_not_freeze_agent_globally(
        self,
        agent_id: str,
        referred_tool: str,
    ) -> None:
        """A REFER for one tool does not globally freeze the agent.

        **Validates: Requirements 15.7**
        """
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        engine.set_decision_for_tool(
            referred_tool,
            action=GovernanceAction.REFER,
            risk_score=50,
            reason_codes=["REQUIRES_REVIEW"],
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")

        # Trigger REFER
        refer_messages = [make_tool_call_message(referred_tool, {})]
        guard._reply_hook(
            recipient=agent,
            messages=refer_messages,
            sender=sender,
            config=None,
        )

        # Verify agent is NOT frozen
        assert not guard.is_frozen(agent_id), (
            "REFER should not freeze the agent globally"
        )


# ── Property 23: Escalation Receipt Completeness ─────────────────────────────


@pytest.mark.property
class TestEscalationReceiptCompleteness:
    """Property 23: REFER emits escalation receipt with all required fields.

    **Validates: Requirements 15.2, 15.4**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
    )
    def test_refer_produces_complete_escalation_receipt(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
    ) -> None:
        """REFER decision produces an audit entry with all required escalation fields.

        Required fields per Requirements 15.2, 15.4:
        - decision_id
        - agent_id
        - tool_name
        - conversation_id (from TEEC)
        - turn_id
        - risk_score
        - reason_codes

        **Validates: Requirements 15.2, 15.4**
        """
        engine = make_mock_engine(
            action=GovernanceAction.REFER,
            risk_score=60,
            reason_codes=["REQUIRES_REVIEW"],
            reason="Needs human approval",
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")

        # Trigger REFER
        messages = [make_tool_call_message(tool_name, tool_arguments)]
        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Verify: action was suspended
        assert result[0] is True, "REFER should suspend the action"

        # Verify: audit trail has REFER entry with complete fields
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
            and e.agent_id == agent_id
        ]
        assert len(refer_entries) >= 1, "Should have at least one REFER audit entry"

        entry = refer_entries[-1]

        # Verify all required fields are present and valid
        assert entry.decision_id, "decision_id must be non-empty"
        assert len(entry.decision_id) > 0

        assert entry.agent_id == agent_id, (
            f"agent_id should be '{agent_id}', got '{entry.agent_id}'"
        )

        assert entry.tool_name == tool_name, (
            f"tool_name should be '{tool_name}', got '{entry.tool_name}'"
        )

        # TEEC fields
        assert entry.teec is not None, "TEEC context must be present"
        assert entry.teec.conversation_id, "conversation_id must be non-empty"
        assert entry.teec.turn_id > 0, "turn_id must be positive"

        # Risk score
        assert entry.risk_score >= 0, "risk_score must be non-negative"
        assert entry.risk_score <= 100, "risk_score must be <= 100"

        # Reason codes
        assert len(entry.reason_codes) > 0, "reason_codes must be non-empty"

        # Evaluation time
        assert entry.evaluation_time_ms > 0, "evaluation_time_ms must be positive"

        # Verify decision outcome was cached (for retry idempotency)
        cached_outcome = guard._decision_outcomes.get(entry.decision_id)
        assert cached_outcome is not None, (
            "REFER decision outcome should be cached for retry idempotency"
        )
        assert cached_outcome["action"] == GovernanceAction.REFER.value
        assert cached_outcome["decision_id"] == entry.decision_id

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        risk_score=st.integers(min_value=0, max_value=100),
    )
    def test_refer_receipt_includes_risk_and_reason_codes(
        self,
        agent_id: str,
        tool_name: str,
        risk_score: int,
    ) -> None:
        """REFER receipt captures the exact risk_score and reason_codes from engine.

        **Validates: Requirements 15.2, 15.4**
        """
        reason_codes_list = ["REQUIRES_REVIEW", "HIGH_RISK"]
        engine = make_mock_engine(
            action=GovernanceAction.REFER,
            risk_score=risk_score,
            reason_codes=reason_codes_list,
            reason="Human review needed",
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")
        messages = [make_tool_call_message(tool_name, {"param": "value"})]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Find the REFER entry
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        assert len(refer_entries) >= 1

        entry = refer_entries[-1]

        # Verify risk_score matches what the engine returned
        assert entry.risk_score == risk_score, (
            f"risk_score should be {risk_score}, got {entry.risk_score}"
        )

        # Verify reason_codes match what the engine returned
        for code in reason_codes_list:
            assert code in entry.reason_codes, (
                f"Expected '{code}' in reason_codes, got {entry.reason_codes}"
            )
