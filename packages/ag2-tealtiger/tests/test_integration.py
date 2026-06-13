"""Integration tests for ag2-tealtiger.

Tests exercise multiple components working together — not individual
unit-level behavior. Each scenario simulates a realistic multi-agent
conversation with governance applied end-to-end.

Validates Requirements: 1.1, 3.1, 4.1, 9.1, 15.1, 18.1
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger import (
    GovernanceAction,
    GovernanceMode,
    GovernedGroupChat,
    TealTigerAuditAgent,
    TealTigerGuard,
)
from ag2_tealtiger.teec_builder import TEECContextBuilder

from tests.conftest import (
    MockConversableAgent,
    MockTealEngine,
    make_mock_agent,
    make_mock_engine,
    make_tool_call_message,
    make_text_message,
)


# ─── Scenario 1: Multi-Agent GroupChat with Governance ────────────────────────


class TestMultiAgentGroupChatWithGovernance:
    """Full conversation flow: GroupChat with 3-5 agents and governance.

    Simulates a realistic multi-agent conversation where some agents
    are allowed and others are denied by policy, verifying that the
    GovernedGroupChat correctly routes turns and records audit entries.

    Validates: Requirement 1.1, 3.1
    """

    def test_groupchat_allows_and_denies_agents(self):
        """GroupChat selects speakers respecting governance decisions."""
        # Setup: 4 agents with per-agent policy decisions
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        engine.set_decision_for_agent(
            "coder",
            GovernanceAction.ALLOW,
            reason="Coder allowed",
        )
        engine.set_decision_for_agent(
            "reviewer",
            GovernanceAction.DENY,
            risk_score=70,
            reason_codes=["ROLE_RESTRICTED"],
            reason="Reviewer denied by policy",
        )
        engine.set_decision_for_agent(
            "executor",
            GovernanceAction.ALLOW,
            reason="Executor allowed",
        )
        engine.set_decision_for_agent(
            "planner",
            GovernanceAction.DENY,
            risk_score=60,
            reason_codes=["QUOTA_EXCEEDED"],
            reason="Planner quota exceeded",
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("reviewer"),
            make_mock_agent("planner"),
            make_mock_agent("coder"),
            make_mock_agent("executor"),
        ]
        for a in agents:
            guard.attach(a)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        # Act: select speaker (should skip reviewer, planner → select coder)
        speaker = ggc.select_speaker()
        assert speaker is not None
        assert speaker.name == "coder"

        # Verify audit
        audit = ggc.speaker_selection_audit
        assert len(audit) == 1
        entry = audit[0]
        assert entry.selected_speaker == "coder"
        # reviewer and planner should show up as DENY
        denied = [c for c in entry.candidates_evaluated if c["decision"] == "DENY"]
        assert len(denied) == 2

    def test_groupchat_multiple_rounds(self):
        """GroupChat operates across multiple rounds with governance."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("alice"),
            make_mock_agent("bob"),
            make_mock_agent("charlie"),
        ]
        for a in agents:
            guard.attach(a)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        # Round 1: first speaker selected
        speaker1 = ggc.select_speaker()
        assert speaker1 is not None

        # Round 2: different speaker (last speaker excluded)
        speaker2 = ggc.select_speaker(last_speaker=speaker1)
        assert speaker2 is not None
        assert speaker2.name != speaker1.name

        # Verify multiple audit rounds
        assert len(ggc.speaker_selection_audit) == 2

    def test_groupchat_tool_call_governance_after_speaker_selection(self):
        """After speaker selection, tool calls on the selected agent are governed."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        coder = make_mock_agent("coder")
        reviewer = make_mock_agent("reviewer")
        guard.attach(coder)
        guard.attach(reviewer)

        ggc = GovernedGroupChat(agents=[coder, reviewer], guard=guard)

        # Select speaker
        speaker = ggc.select_speaker()
        assert speaker is not None

        # Now simulate a tool call on the selected speaker
        messages = [make_tool_call_message("run_code", {"code": "print('hi')"})]
        result = guard._reply_hook(
            recipient=speaker,
            messages=messages,
            sender=reviewer,
            config=None,
        )
        # Should allow through (returns False, None)
        assert result == (False, None)

        # Verify audit trail contains both speaker selection and tool call
        assert len(guard.audit_trail) >= 1
        tool_entries = [e for e in guard.audit_trail if e.tool_name == "run_code"]
        assert len(tool_entries) == 1
        assert tool_entries[0].action == "ALLOW"


# ─── Scenario 2: Nested Chat Correlation ─────────────────────────────────────


class TestNestedChatCorrelation:
    """Verify parent-child conversation tracking via TEECContextBuilder.

    Simulates a parent conversation spawning a nested sub-conversation,
    verifying that correlation IDs are properly maintained across levels.

    Validates: Requirement 9.1
    """

    def test_nested_chat_preserves_parent_correlation(self):
        """Nested chat has new conversation_id but links to parent."""
        guard = TealTigerGuard()

        parent_agent = make_mock_agent("orchestrator")
        child_agent = make_mock_agent("sub_worker")
        guard.attach(parent_agent)
        guard.attach(child_agent)

        # Simulate parent conversation tool call
        parent_messages = [make_tool_call_message("plan", {"task": "write code"})]
        guard._reply_hook(
            recipient=parent_agent,
            messages=parent_messages,
            sender=child_agent,
            config=None,
        )

        parent_conversation_id = guard._teec_builder.conversation_id

        # Enter nested chat via TEECContextBuilder
        nested_builder = guard._teec_builder.enter_nested_chat()

        # Verify nested chat gets distinct conversation_id
        assert nested_builder.conversation_id != parent_conversation_id

        # Verify parent_conversation_id is preserved in the nested builder
        nested_ctx = nested_builder.build(
            agent_id="sub_worker",
            turn_id=1,
            tool_name="execute",
            tool_args={"cmd": "ls"},
        )
        assert nested_ctx.parent_conversation_id == parent_conversation_id
        assert nested_ctx.conversation_id == nested_builder.conversation_id
        assert nested_ctx.conversation_id != parent_conversation_id

    def test_nested_chat_independent_turn_counter(self):
        """Nested chats have independent turn_id counters."""
        builder = TEECContextBuilder()

        # Parent turn increments
        ctx1 = builder.build(agent_id="parent", turn_id=1)
        ctx2 = builder.build(agent_id="parent", turn_id=2)
        assert ctx1.turn_id == 1
        assert ctx2.turn_id == 2

        # Nested builder starts fresh
        nested = builder.enter_nested_chat()
        nested_ctx1 = nested.build(agent_id="child", turn_id=1)
        nested_ctx2 = nested.build(agent_id="child", turn_id=2)
        assert nested_ctx1.turn_id == 1
        assert nested_ctx2.turn_id == 2

        # Parent's counter remains at its own value
        ctx3 = builder.build(agent_id="parent", turn_id=3)
        assert ctx3.turn_id == 3

    def test_deep_nesting_preserves_ancestor_chain(self):
        """Arbitrarily deep nesting levels preserve correlation chain."""
        root = TEECContextBuilder()
        level1 = root.enter_nested_chat()
        level2 = level1.enter_nested_chat()

        # Level 1 points to root
        l1_ctx = level1.build(agent_id="l1_agent", turn_id=1)
        assert l1_ctx.parent_conversation_id == root.conversation_id

        # Level 2 points to level 1
        l2_ctx = level2.build(agent_id="l2_agent", turn_id=1)
        assert l2_ctx.parent_conversation_id == level1.conversation_id

        # All have distinct conversation_ids
        assert root.conversation_id != level1.conversation_id
        assert level1.conversation_id != level2.conversation_id
        assert root.conversation_id != level2.conversation_id


# ─── Scenario 3: Governed Speaker Selection End-to-End ───────────────────────


class TestGovernedSpeakerSelectionEndToEnd:
    """Test GovernedGroupChat speaker selection with mixed agent states.

    Simulates a GroupChat with frozen, over-budget, and policy-denied
    agents, verifying the correct selection logic.

    Validates: Requirement 3.1
    """

    def test_mixed_frozen_budget_denied_agents(self):
        """Speaker selection correctly handles frozen, over-budget, and denied agents."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        # Deny 'critic' by policy
        engine.set_decision_for_agent(
            "critic",
            GovernanceAction.DENY,
            risk_score=90,
            reason_codes=["RESTRICTED_ROLE"],
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("frozen_agent"),
            make_mock_agent("over_budget_agent"),
            make_mock_agent("critic"),
            make_mock_agent("allowed_agent"),
        ]
        for a in agents:
            guard.attach(a)

        # Freeze one agent
        guard.freeze("frozen_agent")

        # Set budget exceeded for another
        guard.set_budget("over_budget_agent", 1.0)
        guard._budget_manager.track_cost("over_budget_agent", 1.5)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        # Select speaker — should skip frozen, over-budget, critic → select allowed_agent
        speaker = ggc.select_speaker()
        assert speaker is not None
        assert speaker.name == "allowed_agent"

        # Verify audit shows all skips
        audit_entry = ggc.speaker_selection_audit[0]
        candidates = audit_entry.candidates_evaluated
        assert len(candidates) == 4

        # Check reasons
        frozen_eval = next(c for c in candidates if c["agent_id"] == "frozen_agent")
        assert frozen_eval["reason"] == "AGENT_FROZEN"

        budget_eval = next(c for c in candidates if c["agent_id"] == "over_budget_agent")
        assert budget_eval["reason"] == "BUDGET_EXCEEDED"

        critic_eval = next(c for c in candidates if c["agent_id"] == "critic")
        assert critic_eval["decision"] == "DENY"

        allowed_eval = next(c for c in candidates if c["agent_id"] == "allowed_agent")
        assert allowed_eval["decision"] == "ALLOW"

    def test_no_engine_calls_for_frozen_or_budget_agents(self):
        """Frozen and over-budget agents are skipped without TealEngine invocation."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("frozen_one"),
            make_mock_agent("budget_one"),
            make_mock_agent("normal_one"),
        ]
        for a in agents:
            guard.attach(a)

        guard.freeze("frozen_one")
        guard.set_budget("budget_one", 0.5)
        guard._budget_manager.track_cost("budget_one", 0.6)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        initial_calls = engine.call_count
        speaker = ggc.select_speaker()

        # Only 1 engine call (for normal_one) — frozen and budget skipped
        assert engine.call_count - initial_calls == 1
        assert speaker is not None
        assert speaker.name == "normal_one"

    def test_all_speakers_denied_termination(self):
        """When all agents are ineligible, round terminates with ALL_SPEAKERS_DENIED."""
        engine = MockTealEngine(
            default_action=GovernanceAction.DENY,
            default_risk_score=80,
            default_reason_codes=["ALL_BLOCKED"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [make_mock_agent("a1"), make_mock_agent("a2"), make_mock_agent("a3")]
        for a in agents:
            guard.attach(a)

        ggc = GovernedGroupChat(agents=agents, guard=guard)
        speaker = ggc.select_speaker()

        assert speaker is None
        audit_entry = ggc.speaker_selection_audit[0]
        assert "ALL_SPEAKERS_DENIED" in audit_entry.reason_codes


# ─── Scenario 4: Freeze Mid-Conversation with GroupChat Continuation ─────────


class TestFreezeMidConversation:
    """Freeze an agent mid-conversation, verify subsequent calls blocked, then unfreeze.

    Validates: Requirement 4.1
    """

    def test_freeze_blocks_tool_calls_then_unfreeze_restores(self):
        """Freezing blocks tool calls; unfreezing restores normal operation."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("executor")
        other = make_mock_agent("user_proxy")
        guard.attach(agent)
        guard.attach(other)

        # Tool call succeeds before freeze
        messages = [make_tool_call_message("run_code", {"code": "x=1"})]
        result_before = guard._reply_hook(
            recipient=agent, messages=messages, sender=other, config=None
        )
        assert result_before == (False, None)  # Allowed through

        # Freeze the agent
        guard.freeze("executor")
        assert guard.is_frozen("executor")

        # Tool call is now blocked
        messages2 = [make_tool_call_message("run_code", {"code": "x=2"})]
        result_frozen = guard._reply_hook(
            recipient=agent, messages=messages2, sender=other, config=None
        )
        assert result_frozen[0] is True  # Blocked
        assert "frozen" in result_frozen[1].lower()

        # Unfreeze the agent
        guard.unfreeze("executor")
        assert not guard.is_frozen("executor")

        # Tool call succeeds again
        messages3 = [make_tool_call_message("run_code", {"code": "x=3"})]
        result_after = guard._reply_hook(
            recipient=agent, messages=messages3, sender=other, config=None
        )
        assert result_after == (False, None)  # Allowed through

    def test_freeze_agent_in_groupchat_skips_in_selection(self):
        """Frozen agent is skipped in GovernedGroupChat speaker selection."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("agent_a"),
            make_mock_agent("agent_b"),
            make_mock_agent("agent_c"),
        ]
        for a in agents:
            guard.attach(a)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        # Select first speaker (should be agent_a)
        speaker1 = ggc.select_speaker()
        assert speaker1 is not None
        assert speaker1.name == "agent_a"

        # Mid-conversation: freeze agent_a
        guard.freeze("agent_a")

        # Next round: agent_a should be skipped
        speaker2 = ggc.select_speaker(last_speaker=speaker1)
        assert speaker2 is not None
        assert speaker2.name != "agent_a"

        # Verify agent_a was recorded as AGENT_FROZEN
        audit = ggc.speaker_selection_audit[-1]
        frozen_candidates = [
            c for c in audit.candidates_evaluated
            if c["agent_id"] == "agent_a"
        ]
        # agent_a may or may not be in candidates (excluded as last_speaker)
        # If present, it should be frozen
        if frozen_candidates:
            assert frozen_candidates[0]["reason"] == "AGENT_FROZEN"

    def test_freeze_does_not_block_other_agents(self):
        """Freezing one agent does not affect other agents in the group."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent_a = make_mock_agent("agent_a")
        agent_b = make_mock_agent("agent_b")
        guard.attach(agent_a)
        guard.attach(agent_b)

        # Freeze agent_a
        guard.freeze("agent_a")

        # agent_b should still work fine
        messages = [make_tool_call_message("analyze", {"data": "test"})]
        result = guard._reply_hook(
            recipient=agent_b, messages=messages, sender=agent_a, config=None
        )
        # sender is frozen → blocked
        assert result[0] is True

        # But agent_b as recipient with non-frozen sender works
        other = make_mock_agent("user_proxy")
        guard.attach(other)
        result2 = guard._reply_hook(
            recipient=agent_b, messages=messages, sender=other, config=None
        )
        assert result2 == (False, None)

    def test_freeze_audit_trail_records_events(self):
        """Freeze and unfreeze events are recorded in the audit trail."""
        guard = TealTigerGuard()
        agent = make_mock_agent("target")
        guard.attach(agent)

        guard.freeze("target")
        guard.unfreeze("target")

        # Look for freeze/unfreeze audit entries
        freeze_entries = [
            e for e in guard.audit_trail
            if "AGENT_FROZEN" in e.reason_codes or "AGENT_UNFROZEN" in e.reason_codes
        ]
        assert len(freeze_entries) >= 2


# ─── Scenario 5: Budget Enforcement Across Multiple Tool Calls ───────────────


class TestBudgetEnforcementMultipleToolCalls:
    """Track costs across multiple tool calls until budget exceeded.

    Validates: Requirement 18.1
    """

    def test_budget_exceeded_after_multiple_calls(self):
        """Agent is denied after cumulative cost exceeds budget limit."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("expensive_agent")
        sender = make_mock_agent("coordinator")
        guard.attach(agent)
        guard.attach(sender)

        # Set a tight budget
        guard.set_budget("expensive_agent", 0.01)

        # Simulate multiple tool calls that accumulate cost
        for i in range(5):
            messages = [make_tool_call_message(f"tool_{i}", {"step": i})]
            guard._reply_hook(
                recipient=agent, messages=messages, sender=sender, config=None
            )

        # Manually track cost to simulate real cost accumulation
        # (since observe mode estimates cost from text length)
        guard._budget_manager.track_cost("expensive_agent", 0.005)
        guard._budget_manager.track_cost("expensive_agent", 0.006)

        # Now budget is exceeded (0.011 > 0.01)
        budget_state = guard.get_budget_state("expensive_agent")
        assert budget_state.current_spend > budget_state.budget_limit

        # Next tool call should be denied
        messages = [make_tool_call_message("final_tool", {"data": "important"})]
        result = guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )
        assert result[0] is True  # Blocked
        assert "BUDGET_EXCEEDED" in result[1]

    def test_budget_exceeded_agent_skipped_in_groupchat(self):
        """Over-budget agent is skipped in GovernedGroupChat speaker selection."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("expensive"),
            make_mock_agent("cheap"),
        ]
        for a in agents:
            guard.attach(a)

        # Set tight budget for expensive agent and exceed it
        guard.set_budget("expensive", 0.5)
        guard._budget_manager.track_cost("expensive", 0.6)

        ggc = GovernedGroupChat(agents=agents, guard=guard)
        speaker = ggc.select_speaker()

        assert speaker is not None
        assert speaker.name == "cheap"

        # Verify audit shows BUDGET_EXCEEDED
        audit = ggc.speaker_selection_audit[0]
        expensive_eval = next(
            c for c in audit.candidates_evaluated if c["agent_id"] == "expensive"
        )
        assert expensive_eval["reason"] == "BUDGET_EXCEEDED"

    def test_budget_warning_at_80_percent(self):
        """Budget warning emitted when crossing 80% threshold."""
        guard = TealTigerGuard()
        agent = make_mock_agent("monitored")
        guard.attach(agent)

        guard.set_budget("monitored", 1.0)

        # Track cost up to 80% threshold
        guard._budget_manager.track_cost("monitored", 0.81)

        budget_state = guard.get_budget_state("monitored")
        assert budget_state.current_spend >= 0.8 * budget_state.budget_limit
        assert budget_state.warning_emitted is True

    def test_budget_reset_allows_resumption(self):
        """Resetting budget allows the agent to resume operations."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("worker")
        sender = make_mock_agent("user")
        guard.attach(agent)
        guard.attach(sender)

        # Exceed budget
        guard.set_budget("worker", 0.5)
        guard._budget_manager.track_cost("worker", 0.6)

        # Verify denied
        messages = [make_tool_call_message("work", {"task": "build"})]
        result = guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )
        assert result[0] is True  # Blocked

        # Reset budget
        guard.reset_budget("worker")

        # Now allowed again
        messages2 = [make_tool_call_message("work", {"task": "test"})]
        result2 = guard._reply_hook(
            recipient=agent, messages=messages2, sender=sender, config=None
        )
        assert result2 == (False, None)


# ─── Scenario 6: REFER Escalation with Resolution ────────────────────────────


class TestReferEscalationWithResolution:
    """Test REFER decision lifecycle: trigger, resolve, verify audit trail.

    Validates: Requirement 15.1, 18.1
    """

    def test_refer_triggers_suspension_and_resolution_allows(self):
        """REFER suspends action, resolve_refer with ALLOW resumes it."""
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=50,
            default_reason_codes=["REQUIRES_REVIEW"],
            default_reason="Action requires human review",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("executor")
        sender = make_mock_agent("manager")
        guard.attach(agent)
        guard.attach(sender)

        # Trigger tool call → should get REFER
        messages = [make_tool_call_message("deploy", {"env": "production"})]
        result = guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )
        assert result[0] is True  # Suspended
        assert "pending review" in result[1].lower() or "review" in result[1].lower()

        # Find the decision_id from audit trail
        refer_entries = [
            e for e in guard.audit_trail if e.action == "REFER"
        ]
        assert len(refer_entries) == 1
        decision_id = refer_entries[0].decision_id

        # Resolve with ALLOW
        resolution = guard.resolve_refer(
            decision_id=decision_id,
            resolution="ALLOW",
            approval_id="reviewer-123",
        )
        assert resolution["action"] == "ALLOW"
        assert resolution["approval_id"] == "reviewer-123"
        assert resolution["already_resolved"] is False

        # Verify audit trail shows complete lifecycle
        all_entries = guard.audit_trail
        refer_audit = [e for e in all_entries if e.action == "REFER"]
        allow_audit = [e for e in all_entries if "REFER_RESOLVED" in e.reason_codes]
        assert len(refer_audit) == 1
        assert len(allow_audit) == 1

    def test_refer_resolve_deny_permanently_blocks(self):
        """REFER resolved with DENY permanently blocks the action."""
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=90,
            default_reason_codes=["HIGH_RISK"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("risky_agent")
        sender = make_mock_agent("user")
        guard.attach(agent)
        guard.attach(sender)

        # Trigger REFER
        messages = [make_tool_call_message("delete_all", {"confirm": True})]
        guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        # Get decision_id
        refer_entries = [e for e in guard.audit_trail if e.action == "REFER"]
        decision_id = refer_entries[0].decision_id

        # Resolve with DENY
        resolution = guard.resolve_refer(
            decision_id=decision_id,
            resolution="DENY",
            approval_id="reviewer-456",
        )
        assert resolution["action"] == "DENY"
        assert "REFER_DENIED" in resolution["reason_codes"]

        # Verify audit trail shows DENY resolution
        deny_entries = [
            e for e in guard.audit_trail if "REFER_DENIED" in e.reason_codes
        ]
        assert len(deny_entries) == 1

    def test_refer_in_groupchat_continues_with_other_agents(self):
        """REFER for one agent doesn't stop the GroupChat — others continue."""
        engine = MockTealEngine(default_action=GovernanceAction.ALLOW)
        # Only the first agent gets REFER
        engine.set_decision_for_agent(
            "risky",
            GovernanceAction.REFER,
            risk_score=70,
            reason_codes=["NEEDS_REVIEW"],
        )

        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agents = [
            make_mock_agent("risky"),
            make_mock_agent("safe_one"),
            make_mock_agent("safe_two"),
        ]
        for a in agents:
            guard.attach(a)

        ggc = GovernedGroupChat(agents=agents, guard=guard)

        # Select speaker — risky gets REFER, should continue to safe_one
        speaker = ggc.select_speaker()
        assert speaker is not None
        assert speaker.name == "safe_one"

        # Verify audit records the REFER suspension
        audit = ggc.speaker_selection_audit[0]
        risky_eval = next(
            c for c in audit.candidates_evaluated if c["agent_id"] == "risky"
        )
        assert risky_eval["decision"] == "REFER"
        assert "REFER_SUSPENDED" in audit.reason_codes

    def test_refer_retry_idempotency(self):
        """Resolving the same REFER twice returns the prior outcome."""
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=60,
            default_reason_codes=["REVIEW_NEEDED"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("agent_x")
        sender = make_mock_agent("trigger")
        guard.attach(agent)
        guard.attach(sender)

        # Trigger REFER
        messages = [make_tool_call_message("sensitive_op", {"target": "db"})]
        guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        refer_entries = [e for e in guard.audit_trail if e.action == "REFER"]
        decision_id = refer_entries[0].decision_id

        # Resolve once
        result1 = guard.resolve_refer(decision_id, "ALLOW", "approver-1")
        assert result1["already_resolved"] is False

        # Resolve again — idempotent
        result2 = guard.resolve_refer(decision_id, "ALLOW", "approver-1")
        assert result2["already_resolved"] is True
        assert result2["action"] == "ALLOW"

    def test_refer_full_audit_lifecycle(self):
        """Full REFER lifecycle: trigger → suspend → resolve → audit trail complete."""
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=55,
            default_reason_codes=["ESCALATE"],
            default_reason="Escalation required",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        agent = make_mock_agent("worker")
        sender = make_mock_agent("orchestrator")
        guard.attach(agent)
        guard.attach(sender)

        # Step 1: Trigger REFER via tool call
        messages = [make_tool_call_message("external_api", {"url": "https://api.example.com"})]
        result = guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )
        assert result[0] is True  # Suspended

        # Step 2: Verify REFER audit entry has all required fields
        refer_entries = [e for e in guard.audit_trail if e.action == "REFER"]
        assert len(refer_entries) == 1
        refer_entry = refer_entries[0]
        assert refer_entry.agent_id == "worker"
        assert refer_entry.tool_name == "external_api"
        assert refer_entry.teec.conversation_id != ""
        assert refer_entry.teec.decision_id != ""
        assert refer_entry.evaluation_time_ms > 0

        decision_id = refer_entry.decision_id

        # Step 3: Resolve REFER
        guard.resolve_refer(decision_id, "ALLOW", "human-reviewer-abc")

        # Step 4: Verify complete audit lifecycle
        all_entries = guard.audit_trail
        # Should have: freeze/unfreeze entries (if any) + REFER + resolution
        refer_related = [
            e for e in all_entries
            if e.decision_id == decision_id or "REFER_RESOLVED" in e.reason_codes
        ]
        # At minimum: the REFER entry and the resolution entry
        assert len(refer_related) >= 2
