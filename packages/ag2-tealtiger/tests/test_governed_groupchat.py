"""Unit tests for GovernedGroupChat speaker selection.

Tests speaker selection with frozen, over-budget, and policy-denied agents.
Verifies requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 15.1, 15.3, 18.6

Uses MockConversableAgent and MockTealEngine from conftest.py.
"""

from __future__ import annotations

from ag2_tealtiger.governed_groupchat import GovernedGroupChat
from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import (
    MockConversableAgent,
    make_mock_agent,
    make_mock_engine,
)


# ── Helper Factories ──────────────────────────────────────────────────────────


def _make_groupchat(
    agents: list[MockConversableAgent],
    guard: TealTigerGuard,
    **kwargs,
) -> GovernedGroupChat:
    """Create a GovernedGroupChat with the given agents and guard."""
    return GovernedGroupChat(
        agents=agents,
        guard=guard,
        **kwargs,
    )


# ── Test: Basic Speaker Selection ─────────────────────────────────────────────


class TestBasicSpeakerSelection:
    """Test basic speaker selection without governance denials."""

    def test_selects_first_eligible_speaker(self):
        """When all agents are allowed, select the first candidate."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is not None
        assert speaker.name == "bob"  # First candidate after last_speaker (alice)

    def test_excludes_last_speaker_from_candidates(self):
        """The last_speaker should not be a candidate for next speaker."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is not None
        assert speaker.name == "bob"

    def test_no_guard_allows_all(self):
        """When guard is None, first available candidate is selected."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        gc = GovernedGroupChat(agents=agents, guard=None)

        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])
        assert speaker is not None
        assert speaker.name == "bob"

    def test_observe_mode_allows_all(self):
        """In observe mode (no engine), all candidates are allowed."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        guard = TealTigerGuard(engine=None, mode=GovernanceMode.OBSERVE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is not None
        assert speaker.name == "bob"


# ── Test: Frozen Agent Skipping ───────────────────────────────────────────────


class TestFrozenAgentSkipping:
    """Test that frozen agents are skipped without TealEngine invocation."""

    def test_frozen_agent_skipped(self):
        """A frozen agent should be skipped during speaker selection."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Freeze bob
        guard.freeze("bob")

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # bob is frozen, so carol should be selected
        assert speaker is not None
        assert speaker.name == "carol"

    def test_frozen_agent_no_engine_call(self):
        """Frozen agents should NOT trigger TealEngine evaluation."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Freeze bob
        guard.freeze("bob")

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # Engine should only be called for carol (bob was skipped before engine)
        # alice is excluded as last_speaker, bob is frozen, carol is evaluated
        assert engine.call_count == 1
        assert engine.evaluate_calls[0]["context"]["agent_id"] == "carol"

    def test_frozen_agent_audit_entry(self):
        """Frozen agents should be recorded in the audit with AGENT_FROZEN reason."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        guard.freeze("bob")

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        audit = gc.speaker_selection_audit
        assert len(audit) == 1

        # Check bob's entry
        bob_eval = next(
            c for c in audit[0].candidates_evaluated if c["agent_id"] == "bob"
        )
        assert bob_eval["decision"] == "DENY"
        assert bob_eval["reason"] == "AGENT_FROZEN"

    def test_all_frozen_returns_none(self):
        """When all candidates are frozen, no speaker is selected."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        guard.freeze("bob")
        guard.freeze("carol")

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is None

        # Verify ALL_SPEAKERS_DENIED reason
        audit = gc.speaker_selection_audit
        assert "ALL_SPEAKERS_DENIED" in audit[0].reason_codes


# ── Test: Over-Budget Agent Skipping ──────────────────────────────────────────


class TestOverBudgetAgentSkipping:
    """Test that over-budget agents are skipped without TealEngine invocation."""

    def test_over_budget_agent_skipped(self):
        """An over-budget agent should be skipped during speaker selection."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Set bob's budget and exceed it
        guard.set_budget("bob", 10.0)
        guard._budget_manager.track_cost("bob", 15.0)  # Over budget

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # bob is over budget, carol should be selected
        assert speaker is not None
        assert speaker.name == "carol"

    def test_over_budget_agent_no_engine_call(self):
        """Over-budget agents should NOT trigger TealEngine evaluation."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Set bob's budget and exceed it
        guard.set_budget("bob", 5.0)
        guard._budget_manager.track_cost("bob", 6.0)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # Engine should only be called for carol (bob was skipped before engine)
        assert engine.call_count == 1
        assert engine.evaluate_calls[0]["context"]["agent_id"] == "carol"

    def test_over_budget_audit_entry(self):
        """Over-budget agents should be recorded in audit with BUDGET_EXCEEDED reason."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        guard.set_budget("bob", 5.0)
        guard._budget_manager.track_cost("bob", 6.0)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        audit = gc.speaker_selection_audit
        bob_eval = next(
            c for c in audit[0].candidates_evaluated if c["agent_id"] == "bob"
        )
        assert bob_eval["decision"] == "DENY"
        assert bob_eval["reason"] == "BUDGET_EXCEEDED"

    def test_within_budget_not_skipped(self):
        """An agent within budget should NOT be skipped."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Set bob's budget but stay within
        guard.set_budget("bob", 10.0)
        guard._budget_manager.track_cost("bob", 5.0)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is not None
        assert speaker.name == "bob"


# ── Test: Policy-Denied Agent Skipping ────────────────────────────────────────


class TestPolicyDeniedAgentSkipping:
    """Test that policy-denied agents are skipped to next candidate."""

    def test_denied_agent_skipped_to_next(self):
        """When first candidate is denied by policy, next is selected."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        # Deny bob specifically
        engine.set_decision_for_agent(
            "bob",
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
            reason="Policy denied bob",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # bob is denied, carol should be selected
        assert speaker is not None
        assert speaker.name == "carol"

    def test_multiple_denied_agents(self):
        """When multiple candidates are denied, select the first allowed."""
        agents = [
            make_mock_agent("alice"),
            make_mock_agent("bob"),
            make_mock_agent("carol"),
            make_mock_agent("dave"),
        ]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        engine.set_decision_for_agent("bob", action=GovernanceAction.DENY)
        engine.set_decision_for_agent("carol", action=GovernanceAction.DENY)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[3])

        assert speaker is not None
        assert speaker.name == "dave"


# ── Test: REFER Decision Handling ─────────────────────────────────────────────


class TestReferDecisionHandling:
    """Test REFER decision suspends candidate and continues with others."""

    def test_refer_agent_suspended_continue_others(self):
        """REFER should suspend candidate and select next available."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        # Refer bob
        engine.set_decision_for_agent(
            "bob",
            action=GovernanceAction.REFER,
            risk_score=50,
            reason_codes=["REQUIRES_REVIEW"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # bob is referred/suspended, carol should be selected
        assert speaker is not None
        assert speaker.name == "carol"

    def test_refer_audit_entry_records_suspended(self):
        """REFER decision should be recorded in audit as REFER."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        engine.set_decision_for_agent(
            "bob",
            action=GovernanceAction.REFER,
            reason="",  # Empty reason triggers fallback to "REQUIRES_REVIEW"
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        audit = gc.speaker_selection_audit
        bob_eval = next(
            c for c in audit[0].candidates_evaluated if c["agent_id"] == "bob"
        )
        assert bob_eval["decision"] == "REFER"
        assert bob_eval["reason"] == "REQUIRES_REVIEW"

    def test_refer_does_not_terminate_groupchat(self):
        """REFER should not terminate the group conversation."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        engine.set_decision_for_agent("bob", action=GovernanceAction.REFER)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # GroupChat continues — carol is selected
        assert speaker is not None
        assert "ALL_SPEAKERS_DENIED" not in gc.speaker_selection_audit[0].reason_codes


# ── Test: ALL_SPEAKERS_DENIED Termination ─────────────────────────────────────


class TestAllSpeakersDenied:
    """Test termination when all candidates are denied."""

    def test_all_denied_returns_none(self):
        """When all candidates denied by policy, return None."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is None

    def test_all_denied_audit_reason_code(self):
        """ALL_SPEAKERS_DENIED reason code should be in audit."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.DENY)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        audit = gc.speaker_selection_audit
        assert len(audit) == 1
        assert "ALL_SPEAKERS_DENIED" in audit[0].reason_codes
        assert audit[0].selected_speaker is None

    def test_mixed_frozen_budget_denied_all_blocked(self):
        """Combination of frozen, over-budget, and denied results in ALL_SPEAKERS_DENIED."""
        agents = [
            make_mock_agent("alice"),
            make_mock_agent("bob"),
            make_mock_agent("carol"),
            make_mock_agent("dave"),
        ]
        engine = make_mock_engine(action=GovernanceAction.DENY)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Freeze bob
        guard.freeze("bob")
        # Over-budget carol
        guard.set_budget("carol", 5.0)
        guard._budget_manager.track_cost("carol", 10.0)
        # dave denied by policy (engine default is DENY)

        gc = _make_groupchat(agents=agents, guard=guard)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        assert speaker is None
        audit = gc.speaker_selection_audit[0]
        assert "ALL_SPEAKERS_DENIED" in audit.reason_codes

        # Verify each agent has a deny entry
        agent_reasons = {c["agent_id"]: c["reason"] for c in audit.candidates_evaluated}
        assert agent_reasons["bob"] == "AGENT_FROZEN"
        assert agent_reasons["carol"] == "BUDGET_EXCEEDED"
        assert "dave" in agent_reasons


# ── Test: Speaker Selection Audit ─────────────────────────────────────────────


class TestSpeakerSelectionAudit:
    """Test that speaker selection produces correct audit entries."""

    def test_audit_records_all_candidates(self):
        """Audit entry should contain all evaluated candidates."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        audit = gc.speaker_selection_audit
        assert len(audit) == 1
        # bob is the first candidate evaluated (after alice is excluded)
        # Once bob is ALLOW'd, carol is not evaluated
        assert len(audit[0].candidates_evaluated) >= 1
        assert audit[0].candidates_evaluated[0]["agent_id"] == "bob"

    def test_audit_records_selected_speaker(self):
        """Audit entry should contain the selected speaker name."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        audit = gc.speaker_selection_audit
        assert audit[0].selected_speaker == "bob"
        # When a speaker is successfully selected without any denials,
        # reason_codes may be empty (no denial reasons to record)
        assert "ALL_SPEAKERS_DENIED" not in audit[0].reason_codes

    def test_audit_has_group_chat_id(self):
        """Audit entry should include the group_chat_id."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard, group_chat_id="test-gc-123")
        gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        audit = gc.speaker_selection_audit
        assert audit[0].group_chat_id == "test-gc-123"

    def test_audit_has_round_id_and_timestamp(self):
        """Audit entry should have a round_id (UUID) and timestamp_ms."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[1])

        audit = gc.speaker_selection_audit
        assert audit[0].round_id  # Non-empty UUID
        assert audit[0].timestamp_ms > 0

    def test_multiple_rounds_accumulate_audit(self):
        """Multiple selection rounds should accumulate audit entries."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard)
        gc.select_speaker(last_speaker=agents[0], selector=agents[2])
        gc.select_speaker(last_speaker=agents[1], selector=agents[0])

        audit = gc.speaker_selection_audit
        assert len(audit) == 2


# ── Test: Engine Error Handling ───────────────────────────────────────────────


class TestEngineErrorHandling:
    """Test behavior when TealEngine raises exceptions during evaluation."""

    def test_engine_error_skips_candidate(self):
        """Engine error during evaluation should skip that candidate."""
        agents = [make_mock_agent("alice"), make_mock_agent("bob"), make_mock_agent("carol")]
        engine = make_mock_engine(action=GovernanceAction.ALLOW)
        # Make engine raise for bob
        engine.set_decision_for_agent("bob", action=GovernanceAction.ALLOW)
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Replace evaluate to raise for bob specifically
        original_evaluate = engine.evaluate

        def raise_for_bob(**kwargs):
            context = kwargs.get("context") or {}
            if context.get("agent_id") == "bob":
                raise RuntimeError("Engine failed for bob")
            return original_evaluate(**kwargs)

        engine.evaluate = lambda tool_name=None, args=None, context=None: (
            (_ for _ in ()).throw(RuntimeError("Engine failed for bob"))
            if context and context.get("agent_id") == "bob"
            else original_evaluate(tool_name=tool_name, args=args, context=context)
        )

        # Simpler approach: use set_error then clear
        # Actually let's use a custom engine
        class ErrorForBobEngine:
            def __init__(self):
                self.call_count = 0
                self.evaluate_calls = []

            def evaluate(self, tool_name=None, args=None, context=None):
                self.call_count += 1
                self.evaluate_calls.append({"tool_name": tool_name, "args": args, "context": context})
                if context and context.get("agent_id") == "bob":
                    raise RuntimeError("Engine failed for bob")
                return {"action": "ALLOW", "risk_score": 0, "reason_codes": [], "reason": "OK"}

        error_engine = ErrorForBobEngine()
        guard2 = TealTigerGuard(engine=error_engine, mode=GovernanceMode.ENFORCE)

        gc = _make_groupchat(agents=agents, guard=guard2)
        speaker = gc.select_speaker(last_speaker=agents[0], selector=agents[2])

        # bob should be skipped due to engine error, carol selected
        assert speaker is not None
        assert speaker.name == "carol"

        # Verify audit captures engine error for bob
        audit = gc.speaker_selection_audit[0]
        bob_eval = next(c for c in audit.candidates_evaluated if c["agent_id"] == "bob")
        assert bob_eval["decision"] == "DENY"
        assert bob_eval["reason"] == "ENGINE_ERROR"
