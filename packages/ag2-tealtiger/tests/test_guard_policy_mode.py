"""Tests for TealTigerGuard._reply_hook — policy evaluation path.

Validates task 6.4:
- TealEngine.evaluate() is called with correct tool_name, args, and framework context
- ALLOW: pass through, record audit entry
- DENY in ENFORCE mode: block, return DenialMessage.to_reply_string() as reply
- DENY in MONITOR mode: log, allow through, record audit entry
- REFER: suspend action, emit escalation receipt, record audit entry

Requirements: 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.5, 7.6, 15.1, 15.2, 15.8
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    GovernanceAction,
    GovernanceMode,
)


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for policy mode tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


def _make_tool_call_message(
    tool_name: str,
    arguments: dict[str, Any] | str | None = None,
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
                    "arguments": arguments if arguments is not None else {},
                },
            }
        ],
    }


def _make_text_message(content: str) -> dict[str, Any]:
    """Create a mock text message in AG2 format."""
    return {"role": "assistant", "content": content}


def _invoke(
    guard: TealTigerGuard,
    agent: _MockAgent,
    messages: list[dict[str, Any]],
) -> tuple[bool, str | dict[str, Any] | None]:
    """Invoke the guard's reply hook with standard params."""
    sender = _MockAgent("user")
    return guard._reply_hook(
        recipient=agent, messages=messages, sender=sender, config=None
    )


# ── Test: TealEngine.evaluate() is called correctly ──────────────────────────


class TestPolicyModeEngineCall:
    """Verify TealEngine.evaluate() is invoked with correct parameters."""

    def test_evaluate_called_with_tool_name_and_args(
        self, mock_engine
    ) -> None:
        """Engine receives the tool_name and args from the message."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"language": "python", "code": "x=1"})
        _invoke(guard, agent, [msg])

        assert mock_engine.call_count == 1
        call = mock_engine.evaluate_calls[0]
        assert call["tool_name"] == "run_code"
        assert call["args"] == {"language": "python", "code": "x=1"}

    def test_evaluate_called_with_framework_context(
        self, mock_engine
    ) -> None:
        """Engine receives framework context with ag2, agent_id, conversation_id, cumulative_cost."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])

        call = mock_engine.evaluate_calls[0]
        ctx = call["context"]
        assert ctx["framework"] == "ag2"
        assert ctx["agent_id"] == "coder"
        assert "conversation_id" in ctx
        assert ctx["cumulative_cost"] == 0.0
        assert ctx["action_kind"] == "tool_call"

    def test_evaluate_not_called_when_no_engine(self) -> None:
        """Without engine, observe mode runs instead of policy mode."""
        guard = TealTigerGuard()  # No engine
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "x=1"})
        result = _invoke(guard, agent, [msg])

        # Should be observe mode passthrough
        assert result == (False, None)
        assert guard.audit_trail[-1].reason_codes == ["OBSERVE_PASSTHROUGH"]

    def test_evaluate_handles_string_args(
        self, mock_engine
    ) -> None:
        """Engine handles tool calls with JSON string arguments."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # AG2 sometimes passes args as JSON strings
        msg = _make_tool_call_message("search", '{"query": "hello"}')
        _invoke(guard, agent, [msg])

        call = mock_engine.evaluate_calls[0]
        assert call["tool_name"] == "search"
        assert call["args"] == {"query": "hello"}

    def test_evaluate_empty_tool_calls(
        self, mock_engine
    ) -> None:
        """When no tool calls present, engine evaluates as message governance with sender/recipient."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_text_message("Hello, how are you?")
        _invoke(guard, agent, [msg])

        call = mock_engine.evaluate_calls[0]
        assert call["tool_name"] is None
        # Message governance passes content, sender, and recipient (Req 17.6)
        assert call["args"] == {
            "content": "Hello, how are you?",
            "sender": "user",
            "recipient": "coder",
        }


# ── Test: ALLOW Decision ──────────────────────────────────────────────────────


class TestPolicyModeAllow:
    """Verify ALLOW decision passes through and records audit entry."""

    def test_allow_returns_passthrough(self, mock_engine) -> None:
        """ALLOW decision returns (False, None) — agent continues."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        result = _invoke(guard, agent, [msg])

        assert result == (False, None)

    def test_allow_records_audit_entry(self, mock_engine) -> None:
        """ALLOW decision produces an audit entry with action=ALLOW."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == "ALLOW"
        assert entry.agent_id == "coder"
        assert entry.tool_name == "read_file"
        assert entry.mode == "ENFORCE"
        assert entry.evaluation_time_ms > 0

    def test_allow_audit_has_teec_context(self, mock_engine) -> None:
        """ALLOW audit entry has valid TEEC context with conversation_id and decision_id."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])

        entry = guard.audit_trail[0]
        assert entry.teec.conversation_id != ""
        assert entry.teec.decision_id != ""
        assert entry.teec.namespace == "teec.ag2"

    def test_allow_stores_decision_receipt(self, mock_engine) -> None:
        """ALLOW decision creates a decision receipt in the manager."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])

        decision_id = guard.audit_trail[0].teec.decision_id
        assert guard._decision_manager.is_valid(decision_id)

    def test_allow_in_monitor_mode(self, mock_engine) -> None:
        """ALLOW works the same in MONITOR mode — pass through."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        result = _invoke(guard, agent, [msg])

        assert result == (False, None)
        assert guard.audit_trail[-1].action == "ALLOW"


# ── Test: DENY Decision in ENFORCE Mode ───────────────────────────────────────


class TestPolicyModeDenyEnforce:
    """Verify DENY in ENFORCE mode blocks and returns DenialMessage."""

    def test_deny_enforce_blocks_tool_call(self, deny_engine) -> None:
        """DENY in ENFORCE mode returns (True, denial_string)."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "rm -rf /"})
        should_terminate, reply = _invoke(guard, agent, [msg])

        assert should_terminate is True
        assert reply is not None

    def test_deny_enforce_returns_denial_message_format(self, deny_engine) -> None:
        """DENY reply is formatted as DenialMessage.to_reply_string()."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "rm -rf /"})
        _, reply = _invoke(guard, agent, [msg])

        # Verify the reply string format from DenialMessage.to_reply_string()
        assert "[GOVERNANCE DENIAL]" in reply
        assert "Tool: run_code" in reply
        assert "Action: DENY" in reply
        assert "Risk: 80" in reply
        assert "POLICY_VIOLATION" in reply
        assert "Decision:" in reply

    def test_deny_enforce_records_audit_entry(self, deny_engine) -> None:
        """DENY in ENFORCE records an audit entry with action=DENY."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "rm -rf /"})
        _invoke(guard, agent, [msg])

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == "DENY"
        assert entry.agent_id == "coder"
        assert entry.tool_name == "run_code"
        assert entry.risk_score == 80
        assert "POLICY_VIOLATION" in entry.reason_codes
        assert entry.mode == "ENFORCE"

    def test_deny_enforce_denial_contains_decision_id(self, deny_engine) -> None:
        """DENY reply contains the decision_id for audit lookup."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "x=1"})
        _, reply = _invoke(guard, agent, [msg])

        decision_id = guard.audit_trail[0].teec.decision_id
        assert decision_id in reply

    def test_deny_enforce_stores_decision_receipt(self, deny_engine) -> None:
        """DENY in ENFORCE creates a DENY decision receipt."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "x=1"})
        _invoke(guard, agent, [msg])

        decision_id = guard.audit_trail[0].teec.decision_id
        receipt = guard._decision_manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.action == GovernanceAction.DENY


# ── Test: DENY Decision in MONITOR Mode ───────────────────────────────────────


class TestPolicyModeDenyMonitor:
    """Verify DENY in MONITOR mode logs but allows through."""

    def test_deny_monitor_allows_through(self, deny_engine) -> None:
        """DENY in MONITOR mode returns (False, None) — agent continues."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "rm -rf /"})
        result = _invoke(guard, agent, [msg])

        assert result == (False, None)

    def test_deny_monitor_records_audit_entry(self, deny_engine) -> None:
        """DENY in MONITOR still records an audit entry with action=DENY."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "rm -rf /"})
        _invoke(guard, agent, [msg])

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == "DENY"
        assert entry.mode == "MONITOR"
        assert entry.agent_id == "coder"
        assert entry.risk_score == 80

    def test_deny_monitor_does_not_return_denial_string(self, deny_engine) -> None:
        """DENY in MONITOR mode does not produce a denial reply string."""
        guard = TealTigerGuard(engine=deny_engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("run_code", {"code": "x=1"})
        should_terminate, reply = _invoke(guard, agent, [msg])

        assert should_terminate is False
        assert reply is None


# ── Test: REFER Decision ──────────────────────────────────────────────────────


class TestPolicyModeRefer:
    """Verify REFER decision suspends action and emits escalation receipt."""

    def test_refer_suspends_action(self, refer_engine) -> None:
        """REFER returns (True, 'Action pending review: {decision_id}')."""
        guard = TealTigerGuard(engine=refer_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("deploy", {"env": "production"})
        should_terminate, reply = _invoke(guard, agent, [msg])

        assert should_terminate is True
        assert "Action pending review:" in reply

    def test_refer_reply_contains_decision_id(self, refer_engine) -> None:
        """REFER reply includes the decision_id for reference."""
        guard = TealTigerGuard(engine=refer_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("deploy", {"env": "production"})
        _, reply = _invoke(guard, agent, [msg])

        decision_id = guard.audit_trail[0].teec.decision_id
        assert decision_id in reply

    def test_refer_records_audit_entry(self, refer_engine) -> None:
        """REFER records an audit entry with action=REFER."""
        guard = TealTigerGuard(engine=refer_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("deploy", {"env": "production"})
        _invoke(guard, agent, [msg])

        assert len(guard.audit_trail) == 1
        entry = guard.audit_trail[0]
        assert entry.action == "REFER"
        assert entry.agent_id == "coder"
        assert entry.tool_name == "deploy"
        assert entry.risk_score == 50
        assert "REQUIRES_REVIEW" in entry.reason_codes

    def test_refer_creates_decision_receipt(self, refer_engine) -> None:
        """REFER creates a decision receipt with REFER action."""
        guard = TealTigerGuard(engine=refer_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("deploy", {"env": "production"})
        _invoke(guard, agent, [msg])

        decision_id = guard.audit_trail[0].teec.decision_id
        receipt = guard._decision_manager.get_receipt(decision_id)
        assert receipt is not None
        assert receipt.action == GovernanceAction.REFER
        assert receipt.execution_outcome == "pending_review"

    def test_refer_audit_entry_has_teec_context(self, refer_engine) -> None:
        """REFER audit entry has valid TEEC context."""
        guard = TealTigerGuard(engine=refer_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("deploy", {"env": "production"})
        _invoke(guard, agent, [msg])

        entry = guard.audit_trail[0]
        assert entry.teec.conversation_id != ""
        assert entry.teec.decision_id != ""
        assert entry.teec.namespace == "teec.ag2"


# ── Test: TEEC Context Built Correctly ────────────────────────────────────────


class TestPolicyModeTEECContext:
    """Verify TEEC context is built correctly for policy evaluations."""

    def test_teec_has_params_hash_for_tool_calls(self, mock_engine) -> None:
        """TEEC context includes params_hash when tool args are present."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])

        entry = guard.audit_trail[0]
        assert entry.teec.params_hash is not None
        assert len(entry.teec.params_hash) == 64  # SHA-256 hex

    def test_teec_decision_id_unique_per_evaluation(self, mock_engine) -> None:
        """Each evaluation produces a unique decision_id."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])
        _invoke(guard, agent, [msg])

        ids = [e.teec.decision_id for e in guard.audit_trail]
        assert len(set(ids)) == 2  # Both unique

    def test_teec_conversation_id_stable_across_evaluations(self, mock_engine) -> None:
        """Conversation ID stays the same across multiple evaluations."""
        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        msg = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        _invoke(guard, agent, [msg])
        _invoke(guard, agent, [msg])

        conv_ids = [e.teec.conversation_id for e in guard.audit_trail]
        assert conv_ids[0] == conv_ids[1]


# ── Test: Per-Tool Decision Overrides ─────────────────────────────────────────


class TestPolicyModeToolOverrides:
    """Verify per-tool decision overrides work with MockTealEngine."""

    def test_specific_tool_denied_while_others_allowed(self, mock_engine) -> None:
        """Engine can deny a specific tool while allowing others."""
        mock_engine.set_decision_for_tool(
            "delete_file",
            GovernanceAction.DENY,
            risk_score=90,
            reason_codes=["DESTRUCTIVE_ACTION"],
            reason="Destructive file operation",
        )

        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        guard.attach(agent)

        # Allowed tool
        msg_read = _make_tool_call_message("read_file", {"path": "/tmp/x"})
        result_read = _invoke(guard, agent, [msg_read])
        assert result_read == (False, None)

        # Denied tool
        msg_delete = _make_tool_call_message("delete_file", {"path": "/tmp/x"})
        should_terminate, reply = _invoke(guard, agent, [msg_delete])
        assert should_terminate is True
        assert "DESTRUCTIVE_ACTION" in reply

    def test_per_agent_decision_isolation(self, mock_engine) -> None:
        """Engine applies per-agent decisions independently."""
        mock_engine.set_decision_for_agent(
            "untrusted",
            GovernanceAction.DENY,
            risk_score=100,
            reason_codes=["UNTRUSTED_AGENT"],
        )

        guard = TealTigerGuard(engine=mock_engine, mode=GovernanceMode.ENFORCE)
        trusted_agent = _MockAgent("trusted")
        untrusted_agent = _MockAgent("untrusted")
        guard.attach(trusted_agent)
        guard.attach(untrusted_agent)

        msg = _make_tool_call_message("run_code", {"code": "x=1"})

        # Trusted agent allowed
        result_trusted = _invoke(guard, trusted_agent, [msg])
        assert result_trusted == (False, None)

        # Untrusted agent denied
        should_terminate, reply = _invoke(guard, untrusted_agent, [msg])
        assert should_terminate is True
        assert "UNTRUSTED_AGENT" in reply
