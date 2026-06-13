"""Tests for resolve_refer and retry idempotency in TealTigerGuard.

Validates:
- resolve_refer(decision_id, resolution, approval_id) resumes or denies suspended actions
- Retry with same decision_id returns prior outcome (idempotency)
- Retry with different params produces new decision_id (params_hash change)
- Same agent/tool/args in different turns produce distinct decision_ids

Requirements: 11.1, 11.3, 11.4, 11.5, 15.5, 15.6
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for resolve_refer tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


def _tool_msg(
    tool_name: str,
    arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a mock tool call message in AG2 format."""
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": f"call_{tool_name}_001",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": arguments or {},
                },
            }
        ],
    }


def _engine(
    action: GovernanceAction = GovernanceAction.ALLOW,
    risk_score: int = 0,
    reason_codes: list[str] | None = None,
    reason: str = "Mock decision",
) -> Any:
    """Create a mock TealEngine returning a fixed decision."""

    class _Eng:
        def __init__(self) -> None:
            self.evaluate_calls: list[dict[str, Any]] = []

        def evaluate(
            self,
            tool_name: str | None = None,
            args: dict[str, Any] | None = None,
            context: dict[str, Any] | None = None,
        ) -> dict[str, Any]:
            self.evaluate_calls.append(
                {"tool_name": tool_name, "args": args, "context": context}
            )
            return {
                "action": action.value,
                "risk_score": risk_score,
                "reason_codes": reason_codes or [],
                "reason": reason,
            }

    return _Eng()


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def refer_guard() -> TealTigerGuard:
    """Create a guard with REFER engine in ENFORCE mode."""
    eng = _engine(
        action=GovernanceAction.REFER,
        risk_score=50,
        reason_codes=["REQUIRES_REVIEW"],
        reason="Action requires human review",
    )
    return TealTigerGuard(engine=eng, mode=GovernanceMode.ENFORCE)


@pytest.fixture
def allow_guard() -> TealTigerGuard:
    """Create a guard with ALLOW engine in ENFORCE mode."""
    eng = _engine(
        action=GovernanceAction.ALLOW,
        risk_score=0,
        reason_codes=["POLICY_PASS"],
        reason="Allowed",
    )
    return TealTigerGuard(engine=eng, mode=GovernanceMode.ENFORCE)


# ── resolve_refer tests ───────────────────────────────────────────────────────


class TestResolveRefer:
    """Tests for resolve_refer method."""

    def test_resolve_allow_creates_audit_entry(self, refer_guard: TealTigerGuard) -> None:
        """WHEN resolution == ALLOW, record audit entry with ALLOW and REFER_RESOLVED."""
        agent = _MockAgent("coder")
        refer_guard.attach(agent)

        # Trigger a REFER decision
        msg = _tool_msg("run_code", {"code": "print('hi')"})
        result = refer_guard._reply_hook(agent, [msg], agent, None)
        assert result[0] is True  # Action suspended

        # Extract decision_id from audit trail
        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        assert len(refer_entries) == 1
        decision_id = refer_entries[0].decision_id

        # Resolve with ALLOW
        outcome = refer_guard.resolve_refer(decision_id, "ALLOW", "approval-001")

        assert outcome["decision_id"] == decision_id
        assert outcome["action"] == GovernanceAction.ALLOW.value
        assert outcome["approval_id"] == "approval-001"
        assert "REFER_RESOLVED" in outcome["reason_codes"]
        assert outcome["already_resolved"] is False

        # Verify audit entry was recorded
        resolution_entries = [
            e for e in refer_guard.audit_trail
            if "REFER_RESOLVED" in e.reason_codes
        ]
        assert len(resolution_entries) == 1
        assert resolution_entries[0].action == GovernanceAction.ALLOW.value
        assert resolution_entries[0].teec.approval_id == "approval-001"

    def test_resolve_deny_expires_receipt(self, refer_guard: TealTigerGuard) -> None:
        """WHEN resolution == DENY, expire receipt with REFER_DENIED."""
        agent = _MockAgent("coder")
        refer_guard.attach(agent)

        # Trigger a REFER decision
        msg = _tool_msg("run_code", {"code": "print('hi')"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        # Get the decision_id
        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        # Resolve with DENY
        outcome = refer_guard.resolve_refer(decision_id, "DENY", "approval-002")

        assert outcome["decision_id"] == decision_id
        assert outcome["action"] == GovernanceAction.DENY.value
        assert outcome["approval_id"] == "approval-002"
        assert "REFER_DENIED" in outcome["reason_codes"]
        assert outcome["already_resolved"] is False

        # Verify receipt is expired
        receipt = refer_guard._decision_manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.is_expired is True
        assert receipt.execution_outcome == "REFER_DENIED"

        # Verify audit entry was recorded
        deny_entries = [
            e for e in refer_guard.audit_trail
            if "REFER_DENIED" in e.reason_codes
        ]
        assert len(deny_entries) == 1
        assert deny_entries[0].action == GovernanceAction.DENY.value

    def test_resolve_invalid_resolution_raises(self, refer_guard: TealTigerGuard) -> None:
        """WHEN resolution is invalid, raise ValueError."""
        agent = _MockAgent("coder")
        refer_guard.attach(agent)

        msg = _tool_msg("run_code", {"code": "x"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        with pytest.raises(ValueError, match="Invalid resolution"):
            refer_guard.resolve_refer(decision_id, "MODIFY", "approval-003")

    def test_resolve_unknown_decision_id_raises(self, refer_guard: TealTigerGuard) -> None:
        """WHEN decision_id is not found, raise KeyError."""
        with pytest.raises(KeyError, match="Decision receipt not found"):
            refer_guard.resolve_refer("nonexistent-id", "ALLOW", "approval-004")

    def test_resolve_allow_stores_approval_on_receipt(self, refer_guard: TealTigerGuard) -> None:
        """WHEN resolution == ALLOW, the receipt should have the approval_id set."""
        agent = _MockAgent("executor")
        refer_guard.attach(agent)

        msg = _tool_msg("delete_file", {"path": "/tmp/x"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        refer_guard.resolve_refer(decision_id, "ALLOW", "reviewer-42")

        receipt = refer_guard._decision_manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.approval_id == "reviewer-42"
        assert receipt.execution_outcome == "approved"


# ── Retry Idempotency tests ──────────────────────────────────────────────────


class TestRetryIdempotency:
    """Tests for retry idempotency guarantees."""

    def test_retry_same_decision_id_returns_prior_outcome(
        self, refer_guard: TealTigerGuard
    ) -> None:
        """WHEN same decision_id is retried after resolution, return prior outcome.

        Requirements: 11.1, 11.5
        """
        agent = _MockAgent("coder")
        refer_guard.attach(agent)

        msg = _tool_msg("run_code", {"code": "x"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        # First resolution
        outcome_1 = refer_guard.resolve_refer(decision_id, "ALLOW", "approval-A")
        assert outcome_1["already_resolved"] is False

        # Retry with same decision_id — should return prior outcome
        outcome_2 = refer_guard.resolve_refer(decision_id, "ALLOW", "approval-A")
        assert outcome_2["already_resolved"] is True
        assert outcome_2["decision_id"] == decision_id
        assert outcome_2["action"] == GovernanceAction.ALLOW.value
        assert outcome_2["approval_id"] == "approval-A"

    def test_retry_same_decision_id_no_duplicate_audit_entries(
        self, refer_guard: TealTigerGuard
    ) -> None:
        """Retry with same decision_id should NOT create duplicate audit entries.

        Requirements: 11.1, 11.5
        """
        agent = _MockAgent("coder")
        refer_guard.attach(agent)

        msg = _tool_msg("run_code", {"code": "y"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        trail_len_before = len(refer_guard.audit_trail)

        # First resolution
        refer_guard.resolve_refer(decision_id, "DENY", "approval-B")
        trail_len_after_first = len(refer_guard.audit_trail)
        assert trail_len_after_first == trail_len_before + 1  # One new entry

        # Retry — should NOT add another audit entry
        refer_guard.resolve_refer(decision_id, "DENY", "approval-B")
        trail_len_after_retry = len(refer_guard.audit_trail)
        assert trail_len_after_retry == trail_len_after_first  # No new entry

    def test_get_prior_outcome_returns_cached_decision(
        self, allow_guard: TealTigerGuard
    ) -> None:
        """get_prior_outcome returns the cached decision for a known decision_id.

        Requirements: 11.1, 11.5
        """
        agent = _MockAgent("coder")
        allow_guard.attach(agent)

        msg = _tool_msg("search", {"query": "hello"})
        allow_guard._reply_hook(agent, [msg], agent, None)

        # The ALLOW decision should be cached
        allow_entries = [
            e for e in allow_guard.audit_trail
            if e.action == GovernanceAction.ALLOW.value
        ]
        assert len(allow_entries) >= 1
        decision_id = allow_entries[0].decision_id

        prior = allow_guard.get_prior_outcome(decision_id)
        assert prior is not None
        assert prior["decision_id"] == decision_id
        assert prior["action"] == GovernanceAction.ALLOW.value

    def test_get_prior_outcome_returns_none_for_unknown(
        self, allow_guard: TealTigerGuard
    ) -> None:
        """get_prior_outcome returns None for an unknown decision_id."""
        assert allow_guard.get_prior_outcome("nonexistent-id") is None


# ── Different params → different decision_id tests ────────────────────────────


class TestDifferentParamsDifferentDecisionId:
    """Tests that different params produce different decision_ids.

    Requirements: 11.3
    """

    def test_different_args_produce_different_decision_ids(
        self, allow_guard: TealTigerGuard
    ) -> None:
        """WHEN tool call has different parameters, generate new decision_id.

        Because params_hash changes → TEEC builder generates a new decision_id anyway.
        """
        agent = _MockAgent("coder")
        allow_guard.attach(agent)

        # First call
        msg_1 = _tool_msg("search", {"query": "hello"})
        allow_guard._reply_hook(agent, [msg_1], agent, None)

        # Second call with different args
        msg_2 = _tool_msg("search", {"query": "world"})
        allow_guard._reply_hook(agent, [msg_2], agent, None)

        allow_entries = [
            e for e in allow_guard.audit_trail
            if e.action == GovernanceAction.ALLOW.value
        ]
        assert len(allow_entries) >= 2

        # Decision IDs must be different
        decision_id_1 = allow_entries[0].decision_id
        decision_id_2 = allow_entries[1].decision_id
        assert decision_id_1 != decision_id_2

        # Params hashes must also be different
        assert allow_entries[0].teec.params_hash != allow_entries[1].teec.params_hash


# ── Same agent/tool/args in different turns → distinct decision_ids ───────────


class TestDistinctDecisionIdsAcrossTurns:
    """Tests that same agent/tool/args in different turns produce distinct decision_ids.

    Requirements: 11.4
    """

    def test_same_call_different_turns_distinct_decision_ids(
        self, allow_guard: TealTigerGuard
    ) -> None:
        """Same agent calls same tool with identical args in two turns → distinct decision_ids.

        Even though params_hash is the same, each turn gets a unique decision_id
        because TEECContextBuilder.build() generates a fresh UUID v4 each time.
        """
        agent = _MockAgent("executor")
        allow_guard.attach(agent)

        msg = _tool_msg("run_code", {"code": "print(1)"})

        # Turn 1
        allow_guard._reply_hook(agent, [msg], agent, None)

        # Turn 2 (same message/args)
        allow_guard._reply_hook(agent, [msg], agent, None)

        allow_entries = [
            e for e in allow_guard.audit_trail
            if e.action == GovernanceAction.ALLOW.value
        ]
        assert len(allow_entries) >= 2

        decision_id_1 = allow_entries[0].decision_id
        decision_id_2 = allow_entries[1].decision_id

        # Decision IDs must be distinct even with same args
        assert decision_id_1 != decision_id_2

        # Params hashes should be the same (same args)
        assert allow_entries[0].teec.params_hash == allow_entries[1].teec.params_hash

    def test_multiple_turns_all_unique_decision_ids(
        self, allow_guard: TealTigerGuard
    ) -> None:
        """Multiple turns with identical tool calls all produce unique decision_ids."""
        agent = _MockAgent("worker")
        allow_guard.attach(agent)

        msg = _tool_msg("fetch_data", {"url": "http://example.com"})

        for _ in range(5):
            allow_guard._reply_hook(agent, [msg], agent, None)

        allow_entries = [
            e for e in allow_guard.audit_trail
            if e.action == GovernanceAction.ALLOW.value
        ]
        decision_ids = [e.decision_id for e in allow_entries]

        # All decision IDs must be unique
        assert len(decision_ids) == len(set(decision_ids))

    def test_deny_decisions_also_get_distinct_ids_across_turns(self) -> None:
        """DENY decisions in different turns also produce distinct decision_ids."""
        eng = _engine(
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
        )
        guard = TealTigerGuard(engine=eng, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("risky_agent")
        guard.attach(agent)

        msg = _tool_msg("dangerous_tool", {"target": "prod"})

        # Two separate turns
        guard._reply_hook(agent, [msg], agent, None)
        guard._reply_hook(agent, [msg], agent, None)

        deny_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.DENY.value
        ]
        assert len(deny_entries) >= 2

        decision_id_1 = deny_entries[0].decision_id
        decision_id_2 = deny_entries[1].decision_id
        assert decision_id_1 != decision_id_2


# ── Decision outcome caching tests ───────────────────────────────────────────


class TestDecisionOutcomeCaching:
    """Tests that decision outcomes are cached for all decision types."""

    def test_allow_decision_cached(self, allow_guard: TealTigerGuard) -> None:
        """ALLOW decisions are cached for later retrieval."""
        agent = _MockAgent("coder")
        allow_guard.attach(agent)

        msg = _tool_msg("search", {"q": "test"})
        allow_guard._reply_hook(agent, [msg], agent, None)

        allow_entries = [
            e for e in allow_guard.audit_trail
            if e.action == GovernanceAction.ALLOW.value
        ]
        decision_id = allow_entries[0].decision_id

        cached = allow_guard.get_prior_outcome(decision_id)
        assert cached is not None
        assert cached["action"] == "ALLOW"

    def test_deny_decision_cached(self) -> None:
        """DENY decisions are cached for later retrieval."""
        eng = _engine(
            action=GovernanceAction.DENY,
            risk_score=90,
            reason_codes=["BLOCKED"],
        )
        guard = TealTigerGuard(engine=eng, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("agent")
        guard.attach(agent)

        msg = _tool_msg("rm_rf", {"path": "/"})
        guard._reply_hook(agent, [msg], agent, None)

        deny_entries = [
            e for e in guard.audit_trail
            if e.action == GovernanceAction.DENY.value
        ]
        decision_id = deny_entries[0].decision_id

        cached = guard.get_prior_outcome(decision_id)
        assert cached is not None
        assert cached["action"] == "DENY"
        assert cached["risk_score"] == 90

    def test_refer_decision_cached(self, refer_guard: TealTigerGuard) -> None:
        """REFER decisions are cached for later retrieval."""
        agent = _MockAgent("agent")
        refer_guard.attach(agent)

        msg = _tool_msg("send_email", {"to": "admin@corp.com"})
        refer_guard._reply_hook(agent, [msg], agent, None)

        refer_entries = [
            e for e in refer_guard.audit_trail
            if e.action == GovernanceAction.REFER.value
        ]
        decision_id = refer_entries[0].decision_id

        cached = refer_guard.get_prior_outcome(decision_id)
        assert cached is not None
        assert cached["action"] == "REFER"
        assert cached["risk_score"] == 50
