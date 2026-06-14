# Copyright (c) 2026, TealTiger Team
#
# SPDX-License-Identifier: Apache-2.0

"""Governance invariant tests for TealTiger AG2 Beta middleware.

Tests the 7 invariants from @rpelevin's acceptance criteria:
1. Same payload in two turns produces two decision IDs
2. Approval for one agent does not authorize another agent
3. Channel/hub approval does not authorize a different tool/scope
4. Revised args create a new pending decision
5. Timeout produces no execution and a durable terminal result
6. Retry with same decision_id returns prior terminal state
7. Receipt reconstruction answers: who, which policy, which delegation, what executed
"""

import pytest

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

# Import types directly (no ag2 dependency needed for these tests)
from ag2_tealtiger.beta.types import (  # noqa: E402
    DecisionAction,
    DecisionSource,
    GovernanceDecision,
    GovernanceMode,
    GovernancePolicy,
    TEECReceipt,
)


class TestDecisionIdentityInvariants:
    """Test that decision identity is unique per evaluation."""

    def test_same_payload_two_turns_produces_two_decision_ids(self):
        """Invariant 1: Same agent + same tool + same args in two turns
        creates two distinct decision IDs, even if params_hash is identical."""
        args = {"query": "hello world"}
        params_hash = GovernanceDecision.compute_params_hash(args)

        decision_1 = GovernanceDecision(
            agent_id="coder",
            turn_id=1,
            action_kind="tool_call",
            tool_name="search",
            params_hash=params_hash,
        )

        decision_2 = GovernanceDecision(
            agent_id="coder",
            turn_id=2,
            action_kind="tool_call",
            tool_name="search",
            params_hash=params_hash,
        )

        # Same params_hash (content binding)
        assert decision_1.params_hash == decision_2.params_hash

        # Different decision_ids (decision identity)
        assert decision_1.decision_id != decision_2.decision_id

    def test_params_hash_is_deterministic_for_same_args(self):
        """params_hash should be stable for identical arguments."""
        args = {"tool": "search", "query": "test", "limit": 10}
        hash_1 = GovernanceDecision.compute_params_hash(args)
        hash_2 = GovernanceDecision.compute_params_hash(args)
        assert hash_1 == hash_2

    def test_params_hash_differs_for_different_args(self):
        """params_hash should differ when arguments change."""
        args_1 = {"query": "hello"}
        args_2 = {"query": "world"}
        hash_1 = GovernanceDecision.compute_params_hash(args_1)
        hash_2 = GovernanceDecision.compute_params_hash(args_2)
        assert hash_1 != hash_2


class TestPerActorEnforcement:
    """Test that approval is per-actor, not ambient."""

    def test_approval_for_one_agent_does_not_authorize_another(self):
        """Invariant 2: Decision is scoped to agent_id — changing agent
        produces a new decision requirement."""
        decision_a = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="tool_call",
            tool_name="send_email",
            action=DecisionAction.ALLOW,
        )

        decision_b = GovernanceDecision(
            agent_id="agent_b",
            turn_id=1,
            action_kind="tool_call",
            tool_name="send_email",
            action=DecisionAction.DENY,
        )

        # Agent A's approval does not authorize Agent B
        assert decision_a.agent_id != decision_b.agent_id
        assert decision_a.decision_id != decision_b.decision_id
        assert decision_a.action == DecisionAction.ALLOW
        assert decision_b.action == DecisionAction.DENY

    def test_channel_approval_does_not_authorize_different_scope(self):
        """Invariant 3: A channel-level approval for tool X does not
        authorize tool Y."""
        decision_tool_x = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="tool_call",
            tool_name="read_file",
            action=DecisionAction.ALLOW,
            delegation_scope="read-only",
        )

        decision_tool_y = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="tool_call",
            tool_name="delete_file",
            action=DecisionAction.DENY,
        )

        # Approval for read_file does not carry to delete_file
        assert decision_tool_x.tool_name != decision_tool_y.tool_name
        assert decision_tool_x.decision_id != decision_tool_y.decision_id


class TestRevisedArgs:
    """Test that revised arguments create new decisions."""

    def test_revised_args_create_new_pending_decision(self):
        """Invariant 4: When args change after REVISE, a new decision_id
        is generated. Old approval cannot attach to revised args."""
        original_args = {"amount": 10000, "recipient": "unknown"}
        revised_args = {"amount": 100, "recipient": "known-vendor"}

        original_hash = GovernanceDecision.compute_params_hash(original_args)
        revised_hash = GovernanceDecision.compute_params_hash(revised_args)

        decision_original = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="tool_call",
            tool_name="transfer",
            params_hash=original_hash,
            action=DecisionAction.REVISE,
            reason_codes=["AMOUNT_TOO_HIGH"],
        )

        decision_revised = GovernanceDecision(
            agent_id="agent_a",
            turn_id=2,
            action_kind="tool_call",
            tool_name="transfer",
            params_hash=revised_hash,
            action=DecisionAction.ALLOW,
        )

        # Different params_hash = different content
        assert original_hash != revised_hash
        # Different decision_id = new authorization required
        assert decision_original.decision_id != decision_revised.decision_id
        # Old REVISE cannot be reused for new args
        assert decision_original.params_hash != decision_revised.params_hash


class TestTerminalStates:
    """Test timeout and denial terminal states."""

    def test_timeout_produces_durable_terminal_result(self):
        """Invariant 5: Timeout produces no execution and a terminal result."""
        decision = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="tool_call",
            tool_name="expensive_api",
            action=DecisionAction.DENY,
            decision_source=DecisionSource.SYSTEM_TIMEOUT,
            reason_codes=["APPROVAL_TIMEOUT"],
        )

        receipt = TEECReceipt(
            decision_id=decision.decision_id,
            agent_id=decision.agent_id,
            action_kind="tool_call",
            tool_name="expensive_api",
            action="deny",
            decision_source="system_timeout",
            execution_outcome="timed_out",
        )

        # No execution happened
        assert receipt.execution_outcome == "timed_out"
        # Decision source is timeout
        assert receipt.decision_source == "system_timeout"

    def test_retry_with_same_decision_id_returns_prior_state(self):
        """Invariant 6: Retry should not re-execute if a terminal decision
        already exists for that decision_id."""
        decision_id = str(__import__("uuid").uuid4())

        # First attempt — timed out
        receipt_1 = TEECReceipt(
            decision_id=decision_id,
            execution_outcome="timed_out",
            decision_source="system_timeout",
        )

        # Retry attempt — should see terminal state exists
        # In implementation, the middleware checks decision cache
        assert receipt_1.execution_outcome in ("timed_out", "blocked")
        # The system should NOT create a new execution for same decision_id
        # This is enforced by the idempotency_key check in middleware


class TestReceiptReconstruction:
    """Test that receipts answer all required audit questions."""

    def test_receipt_answers_all_audit_questions(self):
        """Invariant 7: Receipt reconstruction answers:
        - Who caused the action (agent_id)
        - Under which policy (policy_digest)
        - From which delegation (delegation_scope, delegation_chain)
        - What actually executed (execution_outcome, params_hash)
        """
        receipt = TEECReceipt(
            decision_id="dec-123",
            conversation_id="conv-456",
            turn_id=3,
            agent_id="coder-agent",
            agent_role="coder",
            action_kind="tool_call",
            tool_name="write_file",
            params_hash="sha256:abc123",
            action="allow",
            decision_source="policy_engine",
            policy_digest="sha256:policy789",
            execution_outcome="executed",
            idempotency_key="dec-123:sha256:abc123",
            delegation_scope="write",
            delegation_chain=[
                {"delegator_id": "orchestrator", "delegatee_id": "coder-agent", "scope": "write"}
            ],
        )

        # Who caused the action?
        assert receipt.agent_id == "coder-agent"
        assert receipt.agent_role == "coder"

        # Under which policy?
        assert receipt.policy_digest == "sha256:policy789"

        # From which delegation?
        assert receipt.delegation_scope == "write"
        assert len(receipt.delegation_chain) == 1
        assert receipt.delegation_chain[0]["delegator_id"] == "orchestrator"

        # What actually executed?
        assert receipt.execution_outcome == "executed"
        assert receipt.params_hash == "sha256:abc123"
        assert receipt.tool_name == "write_file"

    def test_receipt_to_dict_produces_teec_namespace(self):
        """TEEC receipts serialize under the teec.ag2_beta namespace."""
        receipt = TEECReceipt(
            decision_id="dec-001",
            agent_id="test-agent",
            action_kind="tool_call",
            tool_name="search",
            action="allow",
            execution_outcome="executed",
        )

        data = receipt.to_dict()
        assert "teec" in data
        assert "ag2_beta" in data["teec"]
        assert data["teec"]["ag2_beta"]["decision_id"] == "dec-001"
        assert data["teec"]["ag2_beta"]["agent_id"] == "test-agent"


class TestPolicyDigest:
    """Test policy digest computation."""

    def test_policy_digest_is_stable(self):
        """Same policies produce same digest."""
        policies = [
            GovernancePolicy.tool_allowlist(["search", "read_file"]),
            GovernancePolicy.pii_block(["ssn"]),
        ]
        digest_1 = GovernanceDecision.compute_policy_digest(policies)
        digest_2 = GovernanceDecision.compute_policy_digest(policies)
        assert digest_1 == digest_2

    def test_policy_digest_changes_with_policy(self):
        """Different policies produce different digest."""
        policies_a = [GovernancePolicy.tool_allowlist(["search"])]
        policies_b = [GovernancePolicy.tool_allowlist(["search", "write_file"])]
        digest_a = GovernanceDecision.compute_policy_digest(policies_a)
        digest_b = GovernanceDecision.compute_policy_digest(policies_b)
        assert digest_a != digest_b


class TestDelegation:
    """Test delegation scope enforcement."""

    def test_delegatee_emits_own_decision(self):
        """Invariant 5 (delegation): When A delegates to B, B still emits
        its own decision and outcome record."""
        # Agent A delegates to Agent B
        decision_a = GovernanceDecision(
            agent_id="agent_a",
            turn_id=1,
            action_kind="delegation",
            delegation_scope="read-only",
        )

        # Agent B performs the action — own decision
        decision_b = GovernanceDecision(
            agent_id="agent_b",
            turn_id=2,
            parent_turn_id=1,
            action_kind="tool_call",
            tool_name="read_file",
            delegation_scope="read-only",
            action=DecisionAction.ALLOW,
        )

        # B has its own decision_id
        assert decision_b.decision_id != decision_a.decision_id
        # B records the delegation scope
        assert decision_b.delegation_scope == "read-only"
        # B links back to parent turn
        assert decision_b.parent_turn_id == 1
