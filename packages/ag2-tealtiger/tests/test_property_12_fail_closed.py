"""Property test: Fail-Closed in ENFORCE Mode (Property 12).

**Property 12:** For any TealEngine exception during policy evaluation in ENFORCE
mode, the governance decision SHALL be DENY with reason_codes containing both
"ENGINE_ERROR" and "FAIL_CLOSED".

**Validates: Requirements 7.3**

Uses Hypothesis to generate arbitrary tool calls with an ErrorEngine that always
raises, verifying that ENFORCE mode with fail_closed=True always produces a DENY
decision with the correct reason codes and risk_score=100.
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import make_mock_agent, make_tool_call_message
from .strategies import agent_ids, tool_names, tool_args


# ── ErrorEngine that always raises ────────────────────────────────────────────

# Strategy for exception types to vary the error thrown
exception_types = st.sampled_from([
    RuntimeError,
    ValueError,
    TypeError,
    OSError,
    KeyError,
    IOError,
    ConnectionError,
    TimeoutError,
])

# Strategy for error messages
error_messages = st.text(
    alphabet="abcdefghijklmnopqrstuvwxyz _-.",
    min_size=1,
    max_size=80,
)


class ErrorEngine:
    """Engine that always raises the configured exception on evaluate()."""

    def __init__(self, error: Exception) -> None:
        self.error = error
        self.call_count = 0

    def evaluate(
        self,
        tool_name: str | None = None,
        args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.call_count += 1
        raise self.error


# ── Property 12: Fail-Closed in ENFORCE Mode ─────────────────────────────────


@pytest.mark.property
class TestFailClosedEnforceMode:
    """Property 12: TealEngine exception in ENFORCE produces DENY with ENGINE_ERROR + FAIL_CLOSED."""

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
        exc_type=exception_types,
        exc_msg=error_messages,
    )
    def test_engine_exception_produces_deny_with_fail_closed(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
        exc_type: type,
        exc_msg: str,
    ) -> None:
        """For any tool call where TealEngine raises, ENFORCE mode denies with ENGINE_ERROR + FAIL_CLOSED.

        **Validates: Requirements 7.3**
        """
        # Setup: ErrorEngine that always raises the given exception
        error = exc_type(exc_msg)
        engine = ErrorEngine(error)

        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )

        # Create and attach agent
        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        # Simulate a tool call
        sender = make_mock_agent("user_proxy")
        messages = [make_tool_call_message(tool_name, tool_arguments)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Verify: result is (True, denial_string) — blocked
        assert result[0] is True, (
            f"Fail-closed in ENFORCE mode must block (True), got {result[0]}"
        )
        assert isinstance(result[1], str), (
            f"Denial result must be a string, got {type(result[1])}"
        )

        # Verify: audit entry has ENGINE_ERROR + FAIL_CLOSED + risk_score 100
        assert len(guard.audit_trail) >= 1, "Must record at least one audit entry"

        entry = guard.audit_trail[-1]
        assert entry.action == GovernanceAction.DENY.value, (
            f"Fail-closed must produce DENY, got {entry.action}"
        )
        assert "ENGINE_ERROR" in entry.reason_codes, (
            f"Must contain ENGINE_ERROR in reason_codes, got {entry.reason_codes}"
        )
        assert "FAIL_CLOSED" in entry.reason_codes, (
            f"Must contain FAIL_CLOSED in reason_codes, got {entry.reason_codes}"
        )
        assert entry.risk_score == 100, (
            f"Fail-closed must have risk_score=100, got {entry.risk_score}"
        )
        assert entry.agent_id == agent_id, (
            f"Audit entry must record correct agent_id, got {entry.agent_id}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
        exc_type=exception_types,
        exc_msg=error_messages,
    )
    def test_engine_exception_denial_message_visible(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
        exc_type: type,
        exc_msg: str,
    ) -> None:
        """For any engine exception, the denial string contains GOVERNANCE DENIAL marker.

        **Validates: Requirements 7.3**
        """
        error = exc_type(exc_msg)
        engine = ErrorEngine(error)

        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )

        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")
        messages = [make_tool_call_message(tool_name, tool_arguments)]

        result = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Denial message must be visible and identifiable
        denial_str = result[1]
        assert "GOVERNANCE DENIAL" in denial_str, (
            f"Denial message must contain 'GOVERNANCE DENIAL', got: {denial_str}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(
        agent_id=agent_ids,
        tool_name=tool_names,
        tool_arguments=tool_args,
        exc_type=exception_types,
        exc_msg=error_messages,
    )
    def test_engine_exception_audit_entry_has_valid_teec(
        self,
        agent_id: str,
        tool_name: str,
        tool_arguments: dict[str, Any],
        exc_type: type,
        exc_msg: str,
    ) -> None:
        """For any engine exception, the audit entry has valid TEEC context fields.

        **Validates: Requirements 7.3**
        """
        error = exc_type(exc_msg)
        engine = ErrorEngine(error)

        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )

        agent = make_mock_agent(agent_id)
        guard.attach(agent)

        sender = make_mock_agent("user_proxy")
        messages = [make_tool_call_message(tool_name, tool_arguments)]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[-1]

        # TEEC context must be populated even on engine error
        assert entry.teec.conversation_id is not None
        assert len(entry.teec.conversation_id) > 0
        assert entry.teec.decision_id is not None
        assert len(entry.teec.decision_id) > 0
        assert entry.teec.turn_id > 0
        assert entry.evaluation_time_ms > 0
        assert entry.mode == GovernanceMode.ENFORCE.value
