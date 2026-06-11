"""Property test: Nested Chat Correlation Preservation (Property 11).

# Feature: ag2-tealtiger-adapter, Property 11: Nested Chat Correlation Preservation

For any nested chat initiated from a parent conversation, the nested scope SHALL
have a new conversation_id distinct from the parent, preserve parent_conversation_id
linking back to the parent, and maintain an independent monotonically increasing
turn_id counter.

**Validates: Requirements 5.6, 9.1, 9.2, 9.4**
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from ag2_tealtiger.teec_builder import TEECContextBuilder

from .strategies import agent_ids, tool_args, tool_names


# ── Strategy: sorted list of unique turn_ids (monotonically increasing) ───────

_increasing_turn_ids = st.lists(
    st.integers(min_value=1, max_value=10000),
    min_size=2,
    max_size=15,
    unique=True,
).map(sorted)

# Number of parent builds before entering nested chat
_parent_build_counts = st.integers(min_value=1, max_value=10)

# Nesting depth for arbitrary-depth tests
_nesting_depths = st.integers(min_value=2, max_value=5)


@pytest.mark.property
class TestNestedChatCorrelationPreservation:
    """Property 11: Nested Chat Correlation Preservation.

    *For any* nested chat initiated from a parent conversation, the nested scope
    SHALL have a new conversation_id distinct from the parent, preserve
    parent_conversation_id linking back to the parent, and maintain an
    independent monotonically increasing turn_id counter.

    **Validates: Requirements 5.6, 9.1, 9.2, 9.4**
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        parent_agent=agent_ids,
        parent_turn_ids=_increasing_turn_ids,
        nested_agent=agent_ids,
        nested_turn_ids=_increasing_turn_ids,
    )
    def test_nested_chat_gets_new_conversation_id(
        self,
        parent_agent: str,
        parent_turn_ids: list[int],
        nested_agent: str,
        nested_turn_ids: list[int],
    ) -> None:
        """Nested chat has a new conversation_id distinct from parent.

        **Validates: Requirements 5.6**
        """
        parent = TEECContextBuilder()

        # Build some parent contexts
        for turn_id in parent_turn_ids:
            parent.build(agent_id=parent_agent, turn_id=turn_id)

        # Enter nested chat
        nested = parent.enter_nested_chat()

        # Nested conversation_id must differ from parent
        assert nested.conversation_id != parent.conversation_id, (
            f"Nested conversation_id {nested.conversation_id} should differ "
            f"from parent {parent.conversation_id}"
        )

        # Nested conversation_id must be a valid UUID v4
        parsed = uuid.UUID(nested.conversation_id, version=4)
        assert str(parsed) == nested.conversation_id

    @settings(max_examples=100, deadline=5000)
    @given(
        parent_agent=agent_ids,
        parent_turn_ids=_increasing_turn_ids,
        nested_agent=agent_ids,
        nested_turn_ids=_increasing_turn_ids,
    )
    def test_nested_preserves_parent_conversation_id(
        self,
        parent_agent: str,
        parent_turn_ids: list[int],
        nested_agent: str,
        nested_turn_ids: list[int],
    ) -> None:
        """Contexts built with nested builder have parent_conversation_id == parent.conversation_id.

        **Validates: Requirements 9.1**
        """
        parent = TEECContextBuilder()

        # Build parent contexts
        for turn_id in parent_turn_ids:
            parent.build(agent_id=parent_agent, turn_id=turn_id)

        parent_conv_id = parent.conversation_id

        # Enter nested chat
        nested = parent.enter_nested_chat()

        # All contexts built with nested builder must link back to parent
        for turn_id in nested_turn_ids:
            ctx = nested.build(agent_id=nested_agent, turn_id=turn_id)
            assert ctx.parent_conversation_id == parent_conv_id, (
                f"Nested context parent_conversation_id {ctx.parent_conversation_id} "
                f"should equal parent conversation_id {parent_conv_id}"
            )

    @settings(max_examples=100, deadline=5000)
    @given(
        parent_agent=agent_ids,
        parent_turn_ids=_increasing_turn_ids,
        nested_agent=agent_ids,
        nested_turn_ids=_increasing_turn_ids,
    )
    def test_nested_has_independent_turn_counter(
        self,
        parent_agent: str,
        parent_turn_ids: list[int],
        nested_agent: str,
        nested_turn_ids: list[int],
    ) -> None:
        """Nested builder has independent turn_id counter starting at 0.

        The nested turn_id counter is independent of the parent counter,
        and the parent counter is unaffected by nested builds.

        **Validates: Requirements 9.2**
        """
        parent = TEECContextBuilder()

        # Build parent contexts to advance parent counter
        for turn_id in parent_turn_ids:
            parent.build(agent_id=parent_agent, turn_id=turn_id)

        parent_counter_before = parent.current_turn_id

        # Enter nested chat — should start at 0
        nested = parent.enter_nested_chat()
        assert nested.current_turn_id == 0, (
            f"Nested turn counter should start at 0, got {nested.current_turn_id}"
        )

        # Build nested contexts with increasing turn_ids
        for turn_id in nested_turn_ids:
            nested.build(agent_id=nested_agent, turn_id=turn_id)

        # Nested counter tracks its own max
        assert nested.current_turn_id == max(nested_turn_ids)

        # Parent counter is unaffected by nested builds
        assert parent.current_turn_id == parent_counter_before, (
            f"Parent counter changed from {parent_counter_before} to "
            f"{parent.current_turn_id} after nested builds"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        parent_agent=agent_ids,
        nested_agent=agent_ids,
        nested_turn_ids=_increasing_turn_ids,
    )
    def test_nested_turn_ids_are_monotonically_increasing(
        self,
        parent_agent: str,
        nested_agent: str,
        nested_turn_ids: list[int],
    ) -> None:
        """Nested builder maintains monotonically increasing turn_id within its scope.

        **Validates: Requirements 9.2**
        """
        parent = TEECContextBuilder()
        parent.build(agent_id=parent_agent, turn_id=1)

        nested = parent.enter_nested_chat()
        recorded_turn_ids = []

        for turn_id in nested_turn_ids:
            ctx = nested.build(agent_id=nested_agent, turn_id=turn_id)
            recorded_turn_ids.append(ctx.turn_id)

        # Verify monotonically increasing
        for i in range(1, len(recorded_turn_ids)):
            assert recorded_turn_ids[i] > recorded_turn_ids[i - 1], (
                f"Nested turn_id not monotonically increasing at index {i}: "
                f"{recorded_turn_ids[i - 1]} >= {recorded_turn_ids[i]}"
            )

    @settings(max_examples=100, deadline=5000)
    @given(
        depth=_nesting_depths,
        agent=agent_ids,
    )
    def test_arbitrary_nesting_depth_preserves_ancestor_chain(
        self,
        depth: int,
        agent: str,
    ) -> None:
        """Arbitrarily deep nesting preserves the full ancestor chain.

        Each nested level links to its immediate parent, allowing
        reconstruction of the full causal chain from any depth.

        **Validates: Requirements 9.4**
        """
        builders: list[TEECContextBuilder] = []

        # Create the root builder
        root = TEECContextBuilder()
        root.build(agent_id=agent, turn_id=1)
        builders.append(root)

        # Create nested builders up to the specified depth
        for i in range(depth):
            parent_builder = builders[-1]
            child = parent_builder.enter_nested_chat()
            child.build(agent_id=agent, turn_id=1)
            builders.append(child)

        # Verify ancestor chain: each child links to its immediate parent
        for i in range(1, len(builders)):
            child = builders[i]
            parent = builders[i - 1]
            ctx = child.build(agent_id=agent, turn_id=2)
            assert ctx.parent_conversation_id == parent.conversation_id, (
                f"At depth {i}, parent_conversation_id {ctx.parent_conversation_id} "
                f"should equal immediate parent's conversation_id {parent.conversation_id}"
            )

        # All builders have distinct conversation_ids
        conv_ids = [b.conversation_id for b in builders]
        assert len(set(conv_ids)) == len(conv_ids), (
            f"All nested levels should have distinct conversation_ids, "
            f"but got duplicates: {conv_ids}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        parent_agent=agent_ids,
        parent_turn_ids=_increasing_turn_ids,
        nested_agent=agent_ids,
        nested_tool_args=tool_args,
    )
    def test_nested_contexts_share_same_nested_conversation_id(
        self,
        parent_agent: str,
        parent_turn_ids: list[int],
        nested_agent: str,
        nested_tool_args: dict,
    ) -> None:
        """All contexts from a nested builder share the nested conversation_id.

        This is the nested-scope analog of Property 10 (Conversation ID Stability).

        **Validates: Requirements 5.6, 9.2**
        """
        parent = TEECContextBuilder()
        for turn_id in parent_turn_ids:
            parent.build(agent_id=parent_agent, turn_id=turn_id)

        nested = parent.enter_nested_chat()
        nested_conv_id = nested.conversation_id

        # Build several contexts in the nested scope
        contexts = []
        for turn_id in range(1, 6):
            ctx = nested.build(
                agent_id=nested_agent,
                turn_id=turn_id,
                tool_args=nested_tool_args if turn_id % 2 == 0 else None,
            )
            contexts.append(ctx)

        # All nested contexts share the same conversation_id
        for ctx in contexts:
            assert ctx.conversation_id == nested_conv_id, (
                f"Nested context conversation_id {ctx.conversation_id} should "
                f"equal {nested_conv_id}"
            )

        # The nested conversation_id differs from parent
        assert nested_conv_id != parent.conversation_id
