"""Tests for TealTigerGuard error handling — fail-closed, fail-open, and non-serializable args.

Validates:
- Task 6.5: Fail-closed and fail-open error handling
- Requirements: 7.3, 7.4

Scenarios:
- TealEngine exception in ENFORCE mode with fail_closed=True -> DENY with ENGINE_ERROR + FAIL_CLOSED
- TealEngine exception in MONITOR mode -> ALLOW with ENGINE_ERROR + FAIL_OPEN
- TealEngine exception in OBSERVE mode (with engine) -> ALLOW with ENGINE_ERROR + FAIL_OPEN
- TealEngine exception in ENFORCE mode with fail_closed=False -> ALLOW with ENGINE_ERROR + FAIL_OPEN
- Non-serializable tool args -> log warning, evaluate without params_hash
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import GovernanceAction, GovernanceMode


# ── Inline helpers (mirror conftest patterns) ─────────────────────────────────


class _MockAgent:
    """Lightweight mock of AG2's ConversableAgent for unit testing."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self,
        trigger: Any,
        reply_func: Any,
        position: int = 0,
        config: Any = None,
        reset_config: Any = None,
        **kwargs: Any,
    ) -> None:
        self._reply_funcs.insert(
            position,
            {
                "trigger": trigger,
                "reply_func": reply_func,
                "config": config,
                "reset_config": reset_config,
            },
        )


class _ErrorEngine:
    """Engine that always raises on evaluate()."""

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error or RuntimeError("Engine evaluation failed")
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
        raise self.error


class _AllowEngine:
    """Engine that always returns ALLOW."""

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
            "action": "ALLOW",
            "risk_score": 0,
            "reason_codes": [],
            "reason": "Allowed",
        }


def _make_tool_call_message(
    tool_name: str,
    arguments: dict[str, Any] | str | None = None,
) -> dict[str, Any]:
    """Create a tool call message in AG2 format."""
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": f"call_{tool_name}_001",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": arguments if arguments is not None else {},
                },
            }
        ],
    }


# ── Fail-Closed Tests (ENFORCE mode + fail_closed=True) ──────────────────────


class TestFailClosed:
    """Test fail-closed behavior: ENFORCE mode with engine exceptions."""

    def test_engine_error_in_enforce_mode_denies(self) -> None:
        """ENFORCE + fail_closed=True: engine exception -> DENY with ENGINE_ERROR + FAIL_CLOSED."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("run_code", {"code": "x=1"})]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should block the tool call
        assert should_terminate is True
        assert reply is not None
        assert "GOVERNANCE DENIAL" in reply
        assert "Engine error" in reply
        assert "Fail-closed" in reply

    def test_engine_error_in_enforce_records_audit_entry(self) -> None:
        """Fail-closed produces an AuditEntry with ENGINE_ERROR and FAIL_CLOSED reason codes."""
        engine = _ErrorEngine(RuntimeError("Connection timeout"))
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="executor")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("delete_file", {"path": "/tmp/x"})]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Check audit trail
        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.DENY.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_CLOSED" in entry.reason_codes
        assert entry.risk_score == 100
        assert entry.agent_id == "executor"
        assert entry.tool_name == "delete_file"
        assert entry.mode == GovernanceMode.ENFORCE.value
        assert entry.evaluation_time_ms > 0

    def test_engine_error_includes_exception_in_reason(self) -> None:
        """Audit entry reason includes the exception message."""
        engine = _ErrorEngine(ValueError("Invalid policy config"))
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("search", {"q": "test"})]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert "Invalid policy config" in entry.reason

    def test_engine_error_in_enforce_with_fail_closed_false_allows(self) -> None:
        """ENFORCE + fail_closed=False: engine exception -> ALLOW (fail-open)."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=False,  # Override fail-closed behavior
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("run_code", {"code": "x=1"})]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should allow through (fail-open)
        assert should_terminate is False
        assert reply is None

        # Audit entry should show ALLOW with FAIL_OPEN
        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.ALLOW.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_OPEN" in entry.reason_codes


# ── Fail-Open Tests (MONITOR/OBSERVE modes) ──────────────────────────────────


class TestFailOpen:
    """Test fail-open behavior: MONITOR/OBSERVE modes with engine exceptions."""

    def test_engine_error_in_monitor_mode_allows(self) -> None:
        """MONITOR mode: engine exception -> ALLOW with ENGINE_ERROR + FAIL_OPEN."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.MONITOR,
            fail_closed=True,  # fail_closed only matters in ENFORCE
        )
        agent = _MockAgent(name="reviewer")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("review_code", {"pr": 42})]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should allow through
        assert should_terminate is False
        assert reply is None

    def test_engine_error_in_monitor_records_audit_entry(self) -> None:
        """MONITOR mode: audit entry has ENGINE_ERROR + FAIL_OPEN reason codes."""
        engine = _ErrorEngine(OSError("Disk full"))
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.MONITOR,
        )
        agent = _MockAgent(name="planner")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("plan_task", {"task": "deploy"})]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.ALLOW.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_OPEN" in entry.reason_codes
        assert entry.risk_score == 0
        assert entry.agent_id == "planner"
        assert entry.mode == GovernanceMode.MONITOR.value
        assert "Disk full" in entry.reason

    def test_engine_error_in_observe_with_engine_allows(self) -> None:
        """OBSERVE mode with engine: engine exception -> ALLOW with FAIL_OPEN.

        Even though OBSERVE mode normally doesn't use a policy engine, if one
        is explicitly provided (e.g., for testing), exceptions should fail-open.
        """
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.OBSERVE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("run", {"cmd": "ls"})]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        assert should_terminate is False
        assert reply is None

        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.ALLOW.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_OPEN" in entry.reason_codes

    def test_multiple_engine_errors_all_logged(self) -> None:
        """Multiple consecutive engine errors each produce their own audit entry."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.MONITOR,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        for i in range(3):
            messages = [_make_tool_call_message(f"tool_{i}", {"i": i})]
            guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )

        assert len(guard.audit_trail) == 3
        for entry in guard.audit_trail:
            assert "ENGINE_ERROR" in entry.reason_codes
            assert "FAIL_OPEN" in entry.reason_codes
            assert entry.action == GovernanceAction.ALLOW.value


# ── Non-Serializable Tool Args Tests ─────────────────────────────────────────


class TestNonSerializableArgs:
    """Test handling of non-serializable tool arguments.

    When tool args contain values that can't be JSON-serialized for params_hash
    computation (e.g., circular references, custom objects), the guard should:
    - Log a warning
    - Set params_hash=None in the TEEC context
    - Continue with evaluation (don't block)
    """

    def test_non_serializable_args_allow_evaluation(self) -> None:
        """Non-serializable args don't block evaluation — tool call proceeds."""
        engine = _AllowEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        # Create args that will raise TypeError during JSON serialization
        # Using a set which is not JSON-serializable
        non_serializable_args = {"data": {"nested": object()}}

        messages = [_make_tool_call_message("process", non_serializable_args)]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should allow through (engine returned ALLOW)
        assert should_terminate is False
        assert reply is None

    def test_non_serializable_args_params_hash_is_none(self) -> None:
        """Non-serializable args result in params_hash=None in TEEC context."""
        engine = _AllowEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        # Use an object() which cannot be JSON-serialized
        non_serializable_args = {"callback": object()}

        messages = [_make_tool_call_message("process", non_serializable_args)]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Check audit entry — params_hash in teec should be None
        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.teec.params_hash is None

    def test_non_serializable_args_logs_warning(self, caplog: pytest.LogCaptureFixture) -> None:
        """Non-serializable args emit a warning log."""
        engine = _AllowEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        non_serializable_args = {"func": object()}

        messages = [_make_tool_call_message("invoke", non_serializable_args)]

        with caplog.at_level(logging.WARNING, logger="ag2_tealtiger.guard"):
            guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )

        # Should have logged a warning about non-serializable args
        assert len(caplog.records) >= 1
        warning_msg = caplog.records[0].message
        assert "Non-serializable" in warning_msg or "non-serializable" in warning_msg.lower()

    def test_non_serializable_args_engine_still_called(self) -> None:
        """Engine is still called even when params_hash computation fails."""
        engine = _AllowEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        non_serializable_args = {"obj": object()}

        messages = [_make_tool_call_message("run", non_serializable_args)]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Engine should have been called
        assert len(engine.evaluate_calls) == 1
        call = engine.evaluate_calls[0]
        assert call["tool_name"] == "run"

    def test_serializable_args_params_hash_populated(self) -> None:
        """Normal serializable args produce a valid params_hash (control test)."""
        engine = _AllowEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        # Normal dict args that can be serialized
        normal_args = {"query": "hello", "limit": 10}

        messages = [_make_tool_call_message("search", normal_args)]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # params_hash should be populated
        entry = guard.audit_trail[0]
        assert entry.teec.params_hash is not None
        assert len(entry.teec.params_hash) == 64  # SHA-256 hex

    def test_non_serializable_with_engine_error_fail_closed(self) -> None:
        """Non-serializable args + engine error in ENFORCE mode -> fail-closed DENY."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        non_serializable_args = {"obj": object()}

        messages = [_make_tool_call_message("dangerous", non_serializable_args)]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        # Should deny (fail-closed)
        assert should_terminate is True
        assert "GOVERNANCE DENIAL" in reply

        # Audit entry
        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.DENY.value
        assert "ENGINE_ERROR" in entry.reason_codes
        assert "FAIL_CLOSED" in entry.reason_codes
        # params_hash should be None since args weren't serializable
        assert entry.teec.params_hash is None


# ── Edge Cases ────────────────────────────────────────────────────────────────


class TestErrorHandlingEdgeCases:
    """Edge cases for error handling behavior."""

    def test_different_exception_types_handled(self) -> None:
        """Various exception types are all caught and handled."""
        for exc_type in [RuntimeError, ValueError, TypeError, OSError, KeyError]:
            engine = _ErrorEngine(exc_type("test error"))
            guard = TealTigerGuard(
                engine=engine,
                mode=GovernanceMode.ENFORCE,
                fail_closed=True,
            )
            agent = _MockAgent(name="coder")
            sender = _MockAgent(name="user")

            messages = [_make_tool_call_message("tool", {"x": 1})]

            should_terminate, reply = guard._reply_hook(
                recipient=agent,
                messages=messages,
                sender=sender,
                config=None,
            )

            assert should_terminate is True, f"Failed for {exc_type.__name__}"
            assert "GOVERNANCE DENIAL" in reply

    def test_tool_call_without_args_handled(self) -> None:
        """Tool calls with empty/no args still handle engine errors properly."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("no_args_tool", {})]

        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        assert should_terminate is True
        entry = guard.audit_trail[0]
        assert entry.tool_name == "no_args_tool"
        assert "ENGINE_ERROR" in entry.reason_codes

    def test_teec_context_populated_on_engine_error(self) -> None:
        """TEEC context fields are populated even when engine errors occur."""
        engine = _ErrorEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
            fail_closed=True,
        )
        agent = _MockAgent(name="coder")
        sender = _MockAgent(name="user")

        messages = [_make_tool_call_message("search", {"q": "test"})]

        guard._reply_hook(
            recipient=agent,
            messages=messages,
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        # TEEC should still have valid fields
        assert entry.teec.conversation_id is not None
        assert len(entry.teec.conversation_id) > 0
        assert entry.teec.decision_id is not None
        assert len(entry.teec.decision_id) > 0
        assert entry.teec.turn_id > 0
        assert entry.teec.agent_role == "coder"
