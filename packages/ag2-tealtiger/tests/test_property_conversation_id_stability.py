"""Property test: Conversation ID Stability (Property 10).

# Feature: ag2-tealtiger-adapter, Property 10: Conversation ID Stability

For any sequence of governance evaluations within a single top-level conversation,
all AuditEntries SHALL share the same conversation_id, and turn_id SHALL be
monotonically increasing.

**Validates: Requirements 5.2, 5.3**
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.teec_builder import TEECContextBuilder

from .strategies import agent_ids, tool_args, tool_names


# ── Strategy: sorted list of unique turn_ids (monotonically increasing) ───────

# Generate a sorted list of unique positive integers to simulate increasing turn_ids
_increasing_turn_ids = st.lists(
    st.integers(min_value=1, max_value=10000),
    min_size=2,
    max_size=20,
    unique=True,
).map(sorted)


@pytest.mark.property
class TestConversationIdStability:
    """Property 10: Conversation ID Stability.

    Verifies that all TEECContext objects produced by a single TEECContextBuilder
    share the same conversation_id, and that turn_ids are monotonically increasing.
    """

    @settings(max_examples=100, deadline=5000)
    @given(
        turn_ids=_increasing_turn_ids,
        agents=st.lists(agent_ids, min_size=2, max_size=20),
        tools=st.lists(
            st.one_of(st.none(), tool_names),
            min_size=2,
            max_size=20,
        ),
        args_list=st.lists(
            st.one_of(st.none(), tool_args),
            min_size=2,
            max_size=20,
        ),
    )
    def test_all_entries_share_conversation_id(
        self,
        turn_ids: list[int],
        agents: list[str],
        tools: list[str | None],
        args_list: list[dict | None],
    ) -> None:
        """All TEECContext objects from the same builder share conversation_id.

        **Validates: Requirements 5.2**
        """
        builder = TEECContextBuilder()
        contexts = []

        # Build contexts with increasing turn_ids
        for i, turn_id in enumerate(turn_ids):
            agent_id = agents[i % len(agents)]
            tool_name = tools[i % len(tools)]
            tool_arg = args_list[i % len(args_list)]

            ctx = builder.build(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args=tool_arg,
            )
            contexts.append(ctx)

        # All contexts must share the same conversation_id
        conversation_ids = {ctx.conversation_id for ctx in contexts}
        assert len(conversation_ids) == 1, (
            f"Expected a single conversation_id across all entries, "
            f"got {len(conversation_ids)}: {conversation_ids}"
        )

        # The shared conversation_id must match the builder's conversation_id
        assert contexts[0].conversation_id == builder.conversation_id

    @settings(max_examples=100, deadline=5000)
    @given(
        turn_ids=_increasing_turn_ids,
        agents=st.lists(agent_ids, min_size=2, max_size=20),
    )
    def test_turn_id_monotonically_increasing(
        self,
        turn_ids: list[int],
        agents: list[str],
    ) -> None:
        """turn_id values in built contexts are monotonically increasing.

        **Validates: Requirements 5.3**
        """
        builder = TEECContextBuilder()
        recorded_turn_ids = []

        for i, turn_id in enumerate(turn_ids):
            agent_id = agents[i % len(agents)]
            ctx = builder.build(
                agent_id=agent_id,
                turn_id=turn_id,
            )
            recorded_turn_ids.append(ctx.turn_id)

        # Verify the turn_ids in contexts match what we passed in (increasing)
        assert recorded_turn_ids == turn_ids

        # Verify monotonically increasing
        for i in range(1, len(recorded_turn_ids)):
            assert recorded_turn_ids[i] > recorded_turn_ids[i - 1], (
                f"turn_id not monotonically increasing at index {i}: "
                f"{recorded_turn_ids[i - 1]} >= {recorded_turn_ids[i]}"
            )

    @settings(max_examples=100, deadline=5000)
    @given(
        turn_ids=_increasing_turn_ids,
        agents=st.lists(agent_ids, min_size=2, max_size=20),
        tools=st.lists(tool_names, min_size=2, max_size=20),
        args_list=st.lists(tool_args, min_size=2, max_size=20),
    )
    def test_builder_turn_counter_tracks_max(
        self,
        turn_ids: list[int],
        agents: list[str],
        tools: list[str],
        args_list: list[dict],
    ) -> None:
        """Builder's current_turn_id tracks the maximum turn_id seen.

        **Validates: Requirements 5.3**
        """
        builder = TEECContextBuilder()

        for i, turn_id in enumerate(turn_ids):
            agent_id = agents[i % len(agents)]
            tool_name = tools[i % len(tools)]
            tool_arg = args_list[i % len(args_list)]

            builder.build(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args=tool_arg,
            )

        # After processing all turn_ids, the builder's counter should be the max
        assert builder.current_turn_id == max(turn_ids)

    @settings(max_examples=100, deadline=5000)
    @given(
        turn_ids=_increasing_turn_ids,
        agent_id=agent_ids,
    )
    def test_conversation_id_is_stable_uuid(
        self,
        turn_ids: list[int],
        agent_id: str,
    ) -> None:
        """conversation_id remains the same UUID across all build() calls.

        **Validates: Requirements 5.2**
        """
        builder = TEECContextBuilder()
        initial_conv_id = builder.conversation_id

        for turn_id in turn_ids:
            ctx = builder.build(agent_id=agent_id, turn_id=turn_id)
            assert ctx.conversation_id == initial_conv_id, (
                f"conversation_id changed from {initial_conv_id} to "
                f"{ctx.conversation_id} at turn {turn_id}"
            )

        # Builder's property still returns the same value
        assert builder.conversation_id == initial_conv_id
