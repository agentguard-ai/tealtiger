"""Property-based test: Fail-Open in MONITOR/OBSERVE Mode (Property 13).

# Feature: ag2-tealtiger-adapter, Property 13: Fail-Open in MONITOR/OBSERVE Mode

*For any* TealEngine exception during policy evaluation in MONITOR or OBSERVE mode,
the governance decision SHALL be ALLOW with reason_codes containing both
"ENGINE_ERROR" and "FAIL_OPEN".

**Validates: Requirements 7.4**
"""

from __future__ import annotations

from typing import Any

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode

from .conftest import MockConversableAgent, make_tool_call_message
from .strategies import agent_ids, tool_args, tool_names


# ── ErrorEngine: always raises on evaluate ────────────────────────────────────


class ErrorEngine:
    """A TealEngine mock that always raises an exception on evaluate().

    Used to verify fail-open behavior in MONITOR/OBSERVE modes.
    """

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error or RuntimeError("Engine evaluation failed")
        self.evaluate_calls: list[dict[str, Any]] = []

    def evaluate(
        self,
        tool_name: str | None = None,
        args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Always raises the configured exception."""
        self.evaluate_calls.append(
            {"tool_name": tool_name, "args": args, "context": context}
        )
        raise self.error


# ── Strategy for MONITOR/OBSERVE modes ────────────────────────────────────────

fail_open_modes: st.SearchStrategy[GovernanceMode] = st.sampled_from(
    [GovernanceMode.MONITOR, GovernanceMode.OBSERVE]
)

# Strategy for various exception types that the engine might throw
exception_types: st.SearchStrategy[Exception] = st.sampled_from(
    [
        RuntimeError("Engine evaluation failed"),
        ValueError("Invalid policy configuration"),
        TypeError("Unexpected argument type"),
        OSError("Disk full"),
        KeyError("missing_key"),
        ConnectionError("Network unreachable"),
        TimeoutError("Evaluation timed out"),
    ]
)


@pytest.mark.property
class TestFailOpenMonitorObserveMode:
    """Property 13: Fail-Open in MONITOR/OBSERVE Mode.

    For any TealEngine exception during policy evaluation in MONITOR or OBSERVE
    mode, the governance decision SHALL be ALLOW with reason_codes containing
    both "ENGINE_ERROR" and "FAIL_OPEN".
    """

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        mode=fail_open_modes,
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_engine_exception_produces_allow_with_fail_open(
        self,
        mode: GovernanceMode,
        agent_name: str,
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 7.4

        For any tool call in MONITOR or OBSERVE mode, when TealEngine raises
        an exception, the result SHALL be (False, None) — meaning the tool call
        is allowed to proceed — and the audit entry SHALL have action=ALLOW with
        reason_codes containing "ENGINE_ERROR" and "FAIL_OPEN".
        """
        engine = ErrorEngine()
        guard = TealTigerGuard(engine=engine, mode=mode)

        agent = MockConversableAgent(name=agent_name)
        sender = MockConversableAgent(name="sender")
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Fail-open: the tool call MUST be allowed through
        assert should_terminate is False, (
            f"Mode={mode.value}: Engine error should fail-open (allow), "
            f"but got should_terminate=True"
        )
        assert reply is None, (
            f"Mode={mode.value}: Fail-open should return None reply, got: {reply}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        mode=fail_open_modes,
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_audit_entry_has_engine_error_and_fail_open_reason_codes(
        self,
        mode: GovernanceMode,
        agent_name: str,
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 7.4

        The audit entry produced on engine error in MONITOR/OBSERVE mode SHALL
        contain both "ENGINE_ERROR" and "FAIL_OPEN" in reason_codes.
        """
        engine = ErrorEngine()
        guard = TealTigerGuard(engine=engine, mode=mode)

        agent = MockConversableAgent(name=agent_name)
        sender = MockConversableAgent(name="sender")
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Must have at least one audit entry
        assert len(guard.audit_trail) >= 1, (
            "Expected at least 1 audit entry after engine error"
        )

        entry = guard.audit_trail[-1]

        # Action must be ALLOW
        assert entry.action == GovernanceAction.ALLOW.value, (
            f"Mode={mode.value}: Expected action=ALLOW on engine error, "
            f"got action={entry.action}"
        )

        # Reason codes must contain ENGINE_ERROR and FAIL_OPEN
        assert "ENGINE_ERROR" in entry.reason_codes, (
            f"Mode={mode.value}: 'ENGINE_ERROR' not found in reason_codes: "
            f"{entry.reason_codes}"
        )
        assert "FAIL_OPEN" in entry.reason_codes, (
            f"Mode={mode.value}: 'FAIL_OPEN' not found in reason_codes: "
            f"{entry.reason_codes}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        mode=fail_open_modes,
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
    )
    def test_audit_entry_risk_score_zero_on_fail_open(
        self,
        mode: GovernanceMode,
        agent_name: str,
        tool_name: str,
        args: dict,
    ) -> None:
        """Validates: Requirements 7.4

        The audit entry produced on engine error in MONITOR/OBSERVE mode SHALL
        have risk_score=0, since the system is allowing through without blocking.
        """
        engine = ErrorEngine()
        guard = TealTigerGuard(engine=engine, mode=mode)

        agent = MockConversableAgent(name=agent_name)
        sender = MockConversableAgent(name="sender")
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[-1]
        assert entry.risk_score == 0, (
            f"Mode={mode.value}: Expected risk_score=0 on fail-open, "
            f"got risk_score={entry.risk_score}"
        )

    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    @given(
        mode=fail_open_modes,
        agent_name=agent_ids,
        tool_name=tool_names,
        args=tool_args,
        error=exception_types,
    )
    def test_fail_open_for_various_exception_types(
        self,
        mode: GovernanceMode,
        agent_name: str,
        tool_name: str,
        args: dict,
        error: Exception,
    ) -> None:
        """Validates: Requirements 7.4

        For any type of exception raised by TealEngine (RuntimeError, ValueError,
        TypeError, OSError, etc.), the fail-open behavior SHALL be consistent:
        result is (False, None) and audit entry has ENGINE_ERROR + FAIL_OPEN.
        """
        engine = ErrorEngine(error=error)
        guard = TealTigerGuard(engine=engine, mode=mode)

        agent = MockConversableAgent(name=agent_name)
        sender = MockConversableAgent(name="sender")
        guard.attach(agent)

        msg = make_tool_call_message(tool_name=tool_name, arguments=args)
        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=[msg],
            sender=sender,
            config=None,
        )

        # Must fail-open: allow through
        assert should_terminate is False, (
            f"Mode={mode.value}, Error={type(error).__name__}: "
            f"Should fail-open but got should_terminate=True"
        )
        assert reply is None

        # Audit entry must have correct reason codes
        entry = guard.audit_trail[-1]
        assert entry.action == GovernanceAction.ALLOW.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_OPEN" in entry.reason_codes
        assert entry.risk_score == 0
