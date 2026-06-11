"""Unit tests for TEECContextBuilder.

Tests cover:
- UUID v4 conversation_id generation
- Monotonically increasing turn_id counter
- build() method field population (all TEECContext fields)
- params_hash computation from tool_args
- idempotency_key derivation
- decision_id uniqueness per build() call
- enter_nested_chat() — fresh conversation_id, preserved parent, independent counter
"""

from __future__ import annotations

import uuid

from ag2_tealtiger.idempotency import compute_params_hash, derive_idempotency_key
from ag2_tealtiger.teec_builder import TEECContextBuilder
from ag2_tealtiger.types import TEECContext


class TestTEECContextBuilderInit:
    """Tests for TEECContextBuilder.__init__."""

    def test_auto_generates_uuid4_conversation_id(self) -> None:
        builder = TEECContextBuilder()
        # Should be a valid UUID v4
        parsed = uuid.UUID(builder.conversation_id, version=4)
        assert str(parsed) == builder.conversation_id

    def test_accepts_explicit_conversation_id(self) -> None:
        custom_id = "custom-conv-123"
        builder = TEECContextBuilder(conversation_id=custom_id)
        assert builder.conversation_id == custom_id

    def test_initial_turn_id_is_zero(self) -> None:
        builder = TEECContextBuilder()
        assert builder.current_turn_id == 0


class TestTEECContextBuilderBuild:
    """Tests for TEECContextBuilder.build() method."""

    def test_returns_teec_context(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert isinstance(ctx, TEECContext)

    def test_populates_namespace(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.namespace == "teec.ag2"

    def test_populates_conversation_id(self) -> None:
        builder = TEECContextBuilder(conversation_id="conv-abc")
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.conversation_id == "conv-abc"

    def test_populates_turn_id(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=5)
        assert ctx.turn_id == 5

    def test_populates_agent_role(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="reviewer", turn_id=1)
        assert ctx.agent_role == "reviewer"

    def test_populates_group_chat_id(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1, group_chat_id="gc-001")
        assert ctx.group_chat_id == "gc-001"

    def test_group_chat_id_defaults_to_none(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.group_chat_id is None

    def test_generates_unique_decision_id_per_call(self) -> None:
        builder = TEECContextBuilder()
        ctx1 = builder.build(agent_id="coder", turn_id=1)
        ctx2 = builder.build(agent_id="coder", turn_id=2)
        assert ctx1.decision_id != ctx2.decision_id
        # Both should be valid UUIDs
        uuid.UUID(ctx1.decision_id, version=4)
        uuid.UUID(ctx2.decision_id, version=4)

    def test_computes_params_hash_from_tool_args(self) -> None:
        builder = TEECContextBuilder()
        tool_args = {"code": "print('hello')", "language": "python"}
        ctx = builder.build(agent_id="coder", turn_id=1, tool_args=tool_args)
        expected_hash = compute_params_hash(tool_args)
        assert ctx.params_hash == expected_hash

    def test_params_hash_none_when_no_tool_args(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.params_hash is None

    def test_derives_idempotency_key_when_tool_args_present(self) -> None:
        builder = TEECContextBuilder()
        tool_args = {"file": "main.py"}
        ctx = builder.build(agent_id="coder", turn_id=1, tool_args=tool_args)
        expected_key = derive_idempotency_key(ctx.decision_id, ctx.params_hash)
        assert ctx.idempotency_key == expected_key

    def test_idempotency_key_none_when_no_tool_args(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.idempotency_key is None

    def test_populates_parent_conversation_id(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(
            agent_id="coder", turn_id=1, parent_conversation_id="parent-123"
        )
        assert ctx.parent_conversation_id == "parent-123"

    def test_parent_conversation_id_defaults_to_none(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.parent_conversation_id is None

    def test_default_decision_source(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.decision_source == "default_mode"

    def test_default_execution_outcome_is_none(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.execution_outcome is None

    def test_default_approval_id_is_none(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.approval_id is None

    def test_default_policy_digest_is_none(self) -> None:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1)
        assert ctx.policy_digest is None


class TestTEECContextBuilderTurnId:
    """Tests for monotonically increasing turn_id counter."""

    def test_turn_counter_updates_to_provided_value(self) -> None:
        builder = TEECContextBuilder()
        builder.build(agent_id="coder", turn_id=3)
        assert builder.current_turn_id == 3

    def test_turn_counter_increases_monotonically(self) -> None:
        builder = TEECContextBuilder()
        builder.build(agent_id="coder", turn_id=1)
        assert builder.current_turn_id == 1
        builder.build(agent_id="coder", turn_id=5)
        assert builder.current_turn_id == 5
        builder.build(agent_id="coder", turn_id=10)
        assert builder.current_turn_id == 10

    def test_turn_counter_does_not_decrease(self) -> None:
        builder = TEECContextBuilder()
        builder.build(agent_id="coder", turn_id=5)
        assert builder.current_turn_id == 5
        # Providing a lower turn_id should not decrease the counter
        builder.build(agent_id="coder", turn_id=3)
        assert builder.current_turn_id == 5

    def test_turn_counter_stays_same_for_equal_value(self) -> None:
        builder = TEECContextBuilder()
        builder.build(agent_id="coder", turn_id=4)
        builder.build(agent_id="coder", turn_id=4)
        assert builder.current_turn_id == 4


class TestTEECContextBuilderNestedChat:
    """Tests for enter_nested_chat() method."""

    def test_nested_builder_has_fresh_conversation_id(self) -> None:
        parent = TEECContextBuilder(conversation_id="parent-conv")
        nested = parent.enter_nested_chat()
        assert nested.conversation_id != "parent-conv"
        # Nested should be a valid UUID v4
        uuid.UUID(nested.conversation_id, version=4)

    def test_nested_builder_preserves_parent_conversation_id(self) -> None:
        parent = TEECContextBuilder(conversation_id="parent-conv")
        nested = parent.enter_nested_chat()
        ctx = nested.build(agent_id="reviewer", turn_id=1)
        assert ctx.parent_conversation_id == "parent-conv"

    def test_nested_builder_has_independent_turn_counter(self) -> None:
        parent = TEECContextBuilder()
        parent.build(agent_id="coder", turn_id=10)
        assert parent.current_turn_id == 10

        nested = parent.enter_nested_chat()
        assert nested.current_turn_id == 0
        nested.build(agent_id="reviewer", turn_id=1)
        assert nested.current_turn_id == 1
        # Parent counter unaffected
        assert parent.current_turn_id == 10

    def test_nested_of_nested_preserves_immediate_parent(self) -> None:
        grandparent = TEECContextBuilder(conversation_id="gp-conv")
        parent = grandparent.enter_nested_chat()
        child = parent.enter_nested_chat()

        child_ctx = child.build(agent_id="executor", turn_id=1)
        # Child's parent should be the parent's conversation_id, not grandparent's
        assert child_ctx.parent_conversation_id == parent.conversation_id
        assert child_ctx.parent_conversation_id != "gp-conv"

    def test_explicit_parent_conversation_id_overrides_stored(self) -> None:
        parent = TEECContextBuilder(conversation_id="parent-conv")
        nested = parent.enter_nested_chat()
        ctx = nested.build(
            agent_id="reviewer",
            turn_id=1,
            parent_conversation_id="override-id",
        )
        assert ctx.parent_conversation_id == "override-id"

    def test_parent_builder_unaffected_by_nested_builds(self) -> None:
        parent = TEECContextBuilder(conversation_id="parent-conv")
        parent.build(agent_id="coder", turn_id=1)

        nested = parent.enter_nested_chat()
        nested.build(agent_id="reviewer", turn_id=5)

        # Parent state unchanged
        assert parent.conversation_id == "parent-conv"
        assert parent.current_turn_id == 1

    def test_multiple_nested_chats_are_independent(self) -> None:
        parent = TEECContextBuilder(conversation_id="parent-conv")
        nested1 = parent.enter_nested_chat()
        nested2 = parent.enter_nested_chat()

        # Different conversation IDs
        assert nested1.conversation_id != nested2.conversation_id
        # Both link back to the same parent
        ctx1 = nested1.build(agent_id="a", turn_id=1)
        ctx2 = nested2.build(agent_id="b", turn_id=1)
        assert ctx1.parent_conversation_id == "parent-conv"
        assert ctx2.parent_conversation_id == "parent-conv"
