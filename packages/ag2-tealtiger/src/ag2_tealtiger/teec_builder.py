"""TEECContextBuilder — builds teec.ag2 namespace objects for audit entries.

Provides structured telemetry context for every governance decision,
supporting conversation correlation, nested chat tracking, and
monotonically increasing turn IDs per conversation scope.
"""

from __future__ import annotations

import uuid

from ag2_tealtiger.idempotency import compute_params_hash, derive_idempotency_key
from ag2_tealtiger.types import TEECContext


class TEECContextBuilder:
    """Builds teec.ag2 namespace objects for audit entries.

    Each builder instance is scoped to a single conversation (top-level or nested).
    It maintains a stable conversation_id (UUID v4) and a monotonically increasing
    turn_id counter. Nested chats get their own builder via `enter_nested_chat()`,
    which preserves the parent conversation_id for correlation.

    Usage:
        builder = TEECContextBuilder()
        ctx = builder.build(agent_id="coder", turn_id=1, tool_name="run_code", tool_args={"code": "x=1"})

        # Nested chat
        nested = builder.enter_nested_chat()
        nested_ctx = nested.build(agent_id="reviewer", turn_id=1)
    """

    def __init__(self, conversation_id: str | None = None) -> None:
        """Initialize a new TEECContextBuilder.

        Args:
            conversation_id: Optional conversation ID to use. If not provided,
                a new UUID v4 is generated automatically.
        """
        self._conversation_id: str = conversation_id or str(uuid.uuid4())
        self._turn_counter: int = 0
        self._parent_conversation_id: str | None = None

    @property
    def conversation_id(self) -> str:
        """The stable conversation ID for this builder's scope."""
        return self._conversation_id

    @property
    def current_turn_id(self) -> int:
        """The current (most recently used) turn ID value."""
        return self._turn_counter

    def build(
        self,
        agent_id: str,
        turn_id: int,
        tool_name: str | None = None,
        tool_args: dict | None = None,
        group_chat_id: str | None = None,
        parent_conversation_id: str | None = None,
    ) -> TEECContext:
        """Build a TEECContext for a governance evaluation.

        Generates a fresh decision_id (UUID v4) each time, computes params_hash
        from tool_args if provided, and derives the idempotency_key from the
        decision_id and params_hash combination.

        The turn_id counter is updated to the provided value, enforcing
        monotonically increasing turns within this conversation scope.

        Args:
            agent_id: The identity of the agent being evaluated.
            turn_id: The turn number for this evaluation. Must be >= current counter.
            tool_name: Optional name of the tool being called.
            tool_args: Optional dictionary of tool call parameters for hash computation.
            group_chat_id: Optional GroupChat session identifier.
            parent_conversation_id: Optional override for parent conversation ID.
                If not provided, uses the builder's stored parent (set by enter_nested_chat).

        Returns:
            A fully populated TEECContext with all correlation fields set.
        """
        # Update the turn counter (monotonically increasing)
        if turn_id > self._turn_counter:
            self._turn_counter = turn_id

        # Generate unique decision_id for this evaluation
        decision_id = str(uuid.uuid4())

        # Compute params_hash from tool_args if provided
        params_hash: str | None = None
        if tool_args is not None:
            params_hash = compute_params_hash(tool_args)

        # Derive idempotency_key from decision_id + params_hash
        idempotency_key: str | None = None
        if params_hash is not None:
            idempotency_key = derive_idempotency_key(decision_id, params_hash)

        # Resolve parent_conversation_id: explicit arg > stored value
        resolved_parent = parent_conversation_id or self._parent_conversation_id

        return TEECContext(
            namespace="teec.ag2",
            conversation_id=self._conversation_id,
            turn_id=turn_id,
            agent_role=agent_id,
            group_chat_id=group_chat_id,
            params_hash=params_hash,
            parent_conversation_id=resolved_parent,
            decision_id=decision_id,
            idempotency_key=idempotency_key,
            policy_digest=None,
            decision_source="default_mode",
            execution_outcome=None,
            approval_id=None,
        )

    def enter_nested_chat(self) -> TEECContextBuilder:
        """Create a new builder for a nested chat scope.

        The nested builder has:
        - A fresh conversation_id (new UUID v4)
        - The current builder's conversation_id stored as parent_conversation_id
        - An independent turn_id counter starting at 0

        Returns:
            A new TEECContextBuilder for the nested chat scope.
        """
        nested = TEECContextBuilder()
        nested._parent_conversation_id = self._conversation_id
        return nested
