"""Property-based test: Observe Mode Passthrough Invariant (Property 2).

# Feature: ag2-tealtiger-adapter, Property 2: Observe Mode Passthrough Invariant

*For any* tool call or message evaluated in observe mode (no TealEngine configured),
the governance decision SHALL be ALLOW with reason_codes containing "OBSERVE_PASSTHROUGH",
and no GovernanceDenyError SHALL be raised.

**Validates: Requirements 6.5, 6.6**
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.exceptions import GovernanceDenyError
from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .strategies import agent_ids, tool_args, tool_names


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for property tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


def _make_tool_call_messages(
    tool_name: str, arguments: dict[str, Any]
) -> list[dict[str, Any]]:
    """Create a messages list with a single tool call in AG2 format."""
    return [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": f"call_{tool_name}_001",
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": arguments,
                    },
                }
            ],
        }
    ]


def _make_text_messages(content: str) -> list[dict[str, Any]]:
    """Create a messages list with a plain text message in AG2 format."""
    return [{"role": "assistant", "content": content}]


# ── Strategy: Text content for messages ───────────────────────────────────────

_text_content: st.SearchStrategy[str] = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "S", "Z")),
    min_size=0,
    max_size=500,
)


# ── Property Test Class ───────────────────────────────────────────────────────


@pytest.mark.property
class TestObserveModePassthroughInvariant:
    """Property 2: Observe Mode Passthrough Invariant.

    For any tool call or message evaluated in observe mode (no TealEngine
    configured), the governance decision SHALL be ALLOW with reason_codes
    containing "OBSERVE_PASSTHROUGH", and no GovernanceDenyError SHALL be raised.
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        sender_name=agent_ids,
        tool_name=tool_names,
        arguments=tool_args,
    )
    def test_tool_call_always_allowed_in_observe_mode(
        self,
        agent_name: str,
        sender_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> None:
        """**Validates: Requirements 6.5, 6.6**

        For any tool call in observe mode, the guard SHALL:
        - Return (False, None) — never block
        - Produce an AuditEntry with action=ALLOW
        - Include "OBSERVE_PASSTHROUGH" in reason_codes
        - Never raise GovernanceDenyError
        """
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent(agent_name)
        sender = _MockAgent(sender_name)

        messages = _make_tool_call_messages(tool_name, arguments)

        # SHALL NOT raise GovernanceDenyError
        try:
            result = guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )
        except GovernanceDenyError:
            pytest.fail(
                f"GovernanceDenyError raised in observe mode for tool '{tool_name}' "
                f"with agent '{agent_name}'"
            )

        # SHALL return (False, None) — never blocks
        assert result == (False, None), (
            f"Expected (False, None) in observe mode, got {result} "
            f"for tool '{tool_name}', agent '{agent_name}'"
        )

        # SHALL produce an AuditEntry with action=ALLOW
        assert len(guard.audit_trail) >= 1, "Expected at least one audit entry"
        entry = guard.audit_trail[-1]
        assert entry.action == GovernanceAction.ALLOW.value, (
            f"Expected action=ALLOW, got {entry.action}"
        )

        # SHALL have "OBSERVE_PASSTHROUGH" in reason_codes
        assert "OBSERVE_PASSTHROUGH" in entry.reason_codes, (
            f"Expected 'OBSERVE_PASSTHROUGH' in reason_codes, got {entry.reason_codes}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        sender_name=agent_ids,
        content=_text_content,
    )
    def test_text_message_always_allowed_in_observe_mode(
        self,
        agent_name: str,
        sender_name: str,
        content: str,
    ) -> None:
        """**Validates: Requirements 6.5, 6.6**

        For any text message in observe mode, the guard SHALL:
        - Return (False, None) — never block
        - Produce an AuditEntry with action=ALLOW
        - Include "OBSERVE_PASSTHROUGH" in reason_codes
        - Never raise GovernanceDenyError
        """
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent(agent_name)
        sender = _MockAgent(sender_name)

        messages = _make_text_messages(content)

        # SHALL NOT raise GovernanceDenyError
        try:
            result = guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )
        except GovernanceDenyError:
            pytest.fail(
                f"GovernanceDenyError raised in observe mode for text message "
                f"from agent '{agent_name}'"
            )

        # SHALL return (False, None) — never blocks
        assert result == (False, None), (
            f"Expected (False, None) in observe mode, got {result} "
            f"for text message from agent '{agent_name}'"
        )

        # SHALL produce an AuditEntry with action=ALLOW
        assert len(guard.audit_trail) >= 1, "Expected at least one audit entry"
        entry = guard.audit_trail[-1]
        assert entry.action == GovernanceAction.ALLOW.value, (
            f"Expected action=ALLOW, got {entry.action}"
        )

        # SHALL have "OBSERVE_PASSTHROUGH" in reason_codes
        assert "OBSERVE_PASSTHROUGH" in entry.reason_codes, (
            f"Expected 'OBSERVE_PASSTHROUGH' in reason_codes, got {entry.reason_codes}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        sender_name=agent_ids,
        tool_name=tool_names,
        arguments=tool_args,
    )
    def test_no_governance_deny_error_raised_for_any_tool_call(
        self,
        agent_name: str,
        sender_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> None:
        """**Validates: Requirements 6.5, 6.6**

        For any arbitrary tool call in observe mode, no GovernanceDenyError
        SHALL be raised regardless of tool name or arguments provided.
        """
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent(agent_name)
        sender = _MockAgent(sender_name)

        messages = _make_tool_call_messages(tool_name, arguments)

        # This must not raise any GovernanceDenyError subclass
        try:
            guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )
        except GovernanceDenyError as e:
            pytest.fail(
                f"GovernanceDenyError raised in observe mode: {e} "
                f"(tool='{tool_name}', agent='{agent_name}', args keys={list(arguments.keys())})"
            )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        agent_name=agent_ids,
        sender_name=agent_ids,
        tool_name=tool_names,
        arguments=tool_args,
    )
    def test_audit_entry_mode_is_observe(
        self,
        agent_name: str,
        sender_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> None:
        """**Validates: Requirements 6.5, 6.6**

        For any governance evaluation in observe mode, the resulting AuditEntry
        SHALL have mode set to "OBSERVE".
        """
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent(agent_name)
        sender = _MockAgent(sender_name)

        messages = _make_tool_call_messages(tool_name, arguments)

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[-1]
        assert entry.mode == GovernanceMode.OBSERVE.value, (
            f"Expected mode=OBSERVE, got {entry.mode}"
        )
