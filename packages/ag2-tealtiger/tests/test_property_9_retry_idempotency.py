"""Property-based test: Retry Idempotency (Property 9).

# Feature: ag2-tealtiger-adapter, Property 9: Retry Idempotency

*For any* governance decision that is retried with the same decision_id,
the system SHALL return the prior outcome without generating a new decision_id
or triggering duplicate side effects.

**Validates: Requirements 11.1, 11.5**
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import MockConversableAgent, MockTealEngine, make_tool_call_message
from .strategies import agent_ids, tool_args, tool_names


# ── Strategy: resolution choices ─────────────────────────────────────────────

resolutions: st.SearchStrategy[str] = st.sampled_from(["ALLOW", "DENY"])

approval_ids: st.SearchStrategy[str] = st.from_regex(
    r"approval-[a-z0-9]{4,12}", fullmatch=True
)


@pytest.mark.property
class TestRetryIdempotency:
    """Property 9: Retry Idempotency.

    For any governance decision that is retried with the same decision_id,
    the system SHALL return the prior outcome without generating a new
    decision_id or triggering duplicate side effects.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        resolution=resolutions,
        approval_id=approval_ids,
    )
    def test_retry_after_resolve_returns_prior_outcome_with_already_resolved(
        self,
        agent_name: str,
        tool_name: str,
        args: dict,
        resolution: str,
        approval_id: str,
    ) -> None:
        """Validates: Requirements 11.1, 11.5

        Trigger a REFER decision, resolve it, then retry the resolution with
        the same decision_id. The retry SHALL return the prior outcome with
        already_resolved=True, without generating a new decision_id.
        """
        # Set up guard with REFER engine
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=50,
            default_reason_codes=["REQUIRES_REVIEW"],
            default_reason="Action requires human review",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Attach agent and trigger a REFER
        agent = MockConversableAgent(name=agent_name)
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        result = guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=agent,
            config=None,
        )

        # The hook should suspend the action (True = terminate with reply)
        assert result[0] is True, "REFER should suspend the action"

        # Extract decision_id from the REFER audit entry
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        assert len(refer_entries) >= 1, "Should have at least one REFER entry"
        decision_id = refer_entries[-1].decision_id

        # First resolution
        outcome_1 = guard.resolve_refer(decision_id, resolution, approval_id)
        assert outcome_1["already_resolved"] is False
        assert outcome_1["decision_id"] == decision_id

        # Retry with same decision_id — should return prior outcome
        outcome_2 = guard.resolve_refer(decision_id, resolution, approval_id)
        assert outcome_2["already_resolved"] is True
        assert outcome_2["decision_id"] == decision_id
        assert outcome_2["action"] == outcome_1["action"]
        assert outcome_2["approval_id"] == outcome_1["approval_id"]
        assert outcome_2["reason_codes"] == outcome_1["reason_codes"]

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        resolution=resolutions,
        approval_id=approval_ids,
    )
    def test_retry_does_not_create_duplicate_audit_entries(
        self,
        agent_name: str,
        tool_name: str,
        args: dict,
        resolution: str,
        approval_id: str,
    ) -> None:
        """Validates: Requirements 11.1, 11.5

        Retrying with same decision_id SHALL NOT produce duplicate audit
        entries — no new side effects are triggered.
        """
        # Set up guard with REFER engine
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=50,
            default_reason_codes=["REQUIRES_REVIEW"],
            default_reason="Action requires human review",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Attach agent and trigger REFER
        agent = MockConversableAgent(name=agent_name)
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=agent,
            config=None,
        )

        # Extract decision_id
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[-1].decision_id

        # First resolution — produces 1 audit entry
        guard.resolve_refer(decision_id, resolution, approval_id)
        trail_len_after_first = len(guard.audit_trail)

        # Retry — should NOT produce additional audit entries
        guard.resolve_refer(decision_id, resolution, approval_id)
        trail_len_after_retry = len(guard.audit_trail)

        assert trail_len_after_retry == trail_len_after_first, (
            f"Retry should not create duplicate audit entries. "
            f"Trail grew from {trail_len_after_first} to {trail_len_after_retry}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        resolution=resolutions,
        approval_id=approval_ids,
    )
    def test_get_prior_outcome_returns_cached_resolution(
        self,
        agent_name: str,
        tool_name: str,
        args: dict,
        resolution: str,
        approval_id: str,
    ) -> None:
        """Validates: Requirements 11.1, 11.5

        After a REFER is resolved, get_prior_outcome(decision_id) SHALL return
        the cached resolution — proving the outcome is stored for idempotent
        retrieval without re-evaluation.
        """
        # Set up guard with REFER engine
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=50,
            default_reason_codes=["REQUIRES_REVIEW"],
            default_reason="Action requires human review",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Attach agent and trigger REFER
        agent = MockConversableAgent(name=agent_name)
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=agent,
            config=None,
        )

        # Extract decision_id
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[-1].decision_id

        # Resolve the REFER
        outcome = guard.resolve_refer(decision_id, resolution, approval_id)

        # Verify get_prior_outcome returns the cached decision
        cached = guard.get_prior_outcome(decision_id)
        assert cached is not None, (
            "get_prior_outcome should return cached outcome after resolution"
        )
        assert cached["decision_id"] == decision_id
        assert cached["action"] == outcome["action"]
        assert cached["approval_id"] == approval_id

        # The cached outcome should reflect the final resolution (not REFER)
        expected_action = (
            GovernanceAction.ALLOW.value
            if resolution == "ALLOW"
            else GovernanceAction.DENY.value
        )
        assert cached["action"] == expected_action, (
            f"Cached action should be '{expected_action}' after resolution "
            f"'{resolution}', got '{cached['action']}'"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        approval_id=approval_ids,
        retry_count=st.integers(min_value=2, max_value=5),
    )
    def test_multiple_retries_all_return_same_prior_outcome(
        self,
        agent_name: str,
        tool_name: str,
        args: dict,
        approval_id: str,
        retry_count: int,
    ) -> None:
        """Validates: Requirements 11.1, 11.5

        Multiple retries with the same decision_id SHALL all return the
        identical prior outcome, confirming stable idempotent behavior.
        """
        # Set up guard with REFER engine
        engine = MockTealEngine(
            default_action=GovernanceAction.REFER,
            default_risk_score=50,
            default_reason_codes=["REQUIRES_REVIEW"],
            default_reason="Action requires human review",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

        # Attach agent and trigger REFER
        agent = MockConversableAgent(name=agent_name)
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=agent,
            config=None,
        )

        # Extract decision_id
        refer_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[-1].decision_id

        # First resolution
        first_outcome = guard.resolve_refer(decision_id, "ALLOW", approval_id)
        assert first_outcome["already_resolved"] is False

        # Multiple retries — all should return identical prior outcome
        for i in range(retry_count):
            retry_outcome = guard.resolve_refer(decision_id, "ALLOW", approval_id)
            assert retry_outcome["already_resolved"] is True, (
                f"Retry {i + 1} should have already_resolved=True"
            )
            assert retry_outcome["decision_id"] == first_outcome["decision_id"]
            assert retry_outcome["action"] == first_outcome["action"]
            assert retry_outcome["approval_id"] == first_outcome["approval_id"]
            assert retry_outcome["reason_codes"] == first_outcome["reason_codes"]
