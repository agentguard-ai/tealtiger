"""Tests for TealTigerGuard inter-agent message governance.

Validates:
- Task 6.6: Inter-agent message governance
- Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7

Tests verify:
- Frozen sender blocked with "AGENT_FROZEN" regardless of mode
- Message governance evaluates against TealEngine policies
- Separate decision_ids for tool and message governance in the same turn
- Correct action_kind="message" in audit entries for plain text messages
- Engine receives sender/recipient agent_ids and message content
- DENY in ENFORCE mode blocks message delivery
- DENY in MONITOR mode logs but allows through
"""

from __future__ import annotations

from typing import Any

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
)


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for message governance tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


class _MockTealEngine:
    """Mock TealEngine with configurable decisions."""

    def __init__(
        self,
        default_action: str = "ALLOW",
        default_risk_score: int = 0,
        default_reason_codes: list[str] | None = None,
        default_reason: str = "Mock decision",
    ) -> None:
        self.default_action = default_action
        self.default_risk_score = default_risk_score
        self.default_reason_codes = default_reason_codes or []
        self.default_reason = default_reason
        self.evaluate_calls: list[dict[str, Any]] = []
        self._call_count = 0

    def evaluate(
        self,
        tool_name: str | None = None,
        args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._call_count += 1
        self.evaluate_calls.append(
            {"tool_name": tool_name, "args": args, "context": context}
        )
        return {
            "action": self.default_action,
            "risk_score": self.default_risk_score,
            "reason_codes": self.default_reason_codes,
            "reason": self.default_reason,
        }


def _text_message(content: str) -> list[dict[str, Any]]:
    """Create a messages list with a plain text message."""
    return [{"role": "assistant", "content": content}]


def _tool_call_message(
    tool_name: str, arguments: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """Create a messages list with a tool call."""
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
                        "arguments": arguments or {},
                    },
                }
            ],
        }
    ]


def _invoke(
    guard: TealTigerGuard,
    recipient: _MockAgent,
    messages: list[dict[str, Any]],
    sender: _MockAgent | None = None,
) -> tuple[bool, str | dict[str, Any] | None]:
    """Invoke the guard's reply hook."""
    if sender is None:
        sender = _MockAgent("user")
    return guard._reply_hook(
        recipient=recipient, messages=messages, sender=sender, config=None
    )


# ── Test: Frozen Sender Blocked ───────────────────────────────────────────────


class TestFrozenSenderBlocked:
    """Verify frozen sender messages are blocked with AGENT_FROZEN regardless of mode."""

    def test_frozen_sender_blocked_in_observe_mode(self) -> None:
        """Frozen sender is blocked even in observe mode (mode-independent). Req 17.4"""
        guard = TealTigerGuard()
        recipient = _MockAgent("coder")
        sender = _MockAgent("malicious_agent")

        guard.freeze("malicious_agent")
        result = _invoke(guard, recipient, _text_message("I'll help you"), sender=sender)

        # Should block
        assert result[0] is True
        assert "frozen" in result[1].lower()
        assert "malicious_agent" in result[1]

    def test_frozen_sender_blocked_in_enforce_mode(self) -> None:
        """Frozen sender is blocked in ENFORCE mode. Req 17.4"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        recipient = _MockAgent("coder")
        sender = _MockAgent("bad_agent")

        guard.freeze("bad_agent")
        result = _invoke(guard, recipient, _text_message("Send a secret"), sender=sender)

        assert result[0] is True
        assert "frozen" in result[1].lower()

    def test_frozen_sender_blocked_in_monitor_mode(self) -> None:
        """Frozen sender is blocked in MONITOR mode. Req 17.4"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.MONITOR)
        recipient = _MockAgent("coder")
        sender = _MockAgent("bad_agent")

        guard.freeze("bad_agent")
        result = _invoke(guard, recipient, _text_message("hello"), sender=sender)

        assert result[0] is True
        assert "frozen" in result[1].lower()

    def test_frozen_sender_audit_entry_has_agent_frozen_reason_code(self) -> None:
        """Frozen sender audit entry uses 'AGENT_FROZEN' reason code. Req 4.5, 17.4"""
        guard = TealTigerGuard()
        recipient = _MockAgent("coder")
        sender = _MockAgent("frozen_agent")

        guard.freeze("frozen_agent")
        _invoke(guard, recipient, _text_message("test"), sender=sender)

        # Filter audit entries: one from freeze() call + one from _reply_hook
        reply_entries = [
            e for e in guard.audit_trail
            if e.action_kind == ActionKind.MESSAGE.value
        ]
        assert len(reply_entries) == 1
        entry = reply_entries[0]
        assert "AGENT_FROZEN" in entry.reason_codes
        assert entry.risk_score == 100
        assert entry.agent_id == "frozen_agent"

    def test_frozen_sender_audit_entry_action_kind_message(self) -> None:
        """Frozen sender audit entry has action_kind='message'. Req 17.2"""
        guard = TealTigerGuard()
        recipient = _MockAgent("coder")
        sender = _MockAgent("frozen_agent")

        guard.freeze("frozen_agent")
        _invoke(guard, recipient, _text_message("test"), sender=sender)

        reply_entries = [
            e for e in guard.audit_trail
            if e.action_kind == ActionKind.MESSAGE.value
        ]
        assert len(reply_entries) == 1
        assert reply_entries[0].action_kind == ActionKind.MESSAGE.value

    def test_frozen_sender_does_not_invoke_engine(self) -> None:
        """Frozen sender check happens before engine evaluation. Req 17.4"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        recipient = _MockAgent("coder")
        sender = _MockAgent("frozen_agent")

        guard.freeze("frozen_agent")
        _invoke(guard, recipient, _text_message("test"), sender=sender)

        # Engine should NOT be called — frozen check is first
        assert engine._call_count == 0

    def test_frozen_recipient_blocks_with_correct_action_kind(self) -> None:
        """Frozen recipient also blocks with action_kind based on message type."""
        guard = TealTigerGuard()
        recipient = _MockAgent("frozen_recipient")
        sender = _MockAgent("user")

        guard.freeze("frozen_recipient")
        result = _invoke(guard, recipient, _text_message("hello"), sender=sender)

        assert result[0] is True
        # Check that the action_kind is MESSAGE for a plain text message
        reply_entries = [
            e for e in guard.audit_trail
            if e.agent_id == "frozen_recipient" and e.action_kind == ActionKind.MESSAGE.value
        ]
        assert len(reply_entries) == 1


# ── Test: Separate Decision IDs for Tool vs Message ───────────────────────────


class TestSeparateDecisionIds:
    """Verify tool and message governance produce independent decision_ids. Req 17.7"""

    def test_tool_and_message_have_different_decision_ids(self) -> None:
        """Tool call and plain message produce separate audit entries with different decision_ids."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        # First: a tool call
        _invoke(guard, agent, _tool_call_message("run_code", {"code": "x=1"}), sender=sender)

        # Second: a plain message
        _invoke(guard, agent, _text_message("What did that code do?"), sender=sender)

        # Should have 2 audit entries
        assert len(guard.audit_trail) == 2
        tool_entry = guard.audit_trail[0]
        msg_entry = guard.audit_trail[1]

        # Different decision_ids
        assert tool_entry.decision_id != msg_entry.decision_id

    def test_tool_entry_has_action_kind_tool_call(self) -> None:
        """Tool call audit entry has action_kind='tool_call'."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _tool_call_message("read_file", {"path": "/x"}), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.TOOL_CALL.value

    def test_message_entry_has_action_kind_message(self) -> None:
        """Plain message audit entry has action_kind='message'. Req 17.2"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("Hello world"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.MESSAGE.value

    def test_multiple_messages_each_get_unique_decision_id(self) -> None:
        """Each message governance evaluation gets its own decision_id. Req 17.7"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("msg 1"), sender=sender)
        _invoke(guard, agent, _text_message("msg 2"), sender=sender)
        _invoke(guard, agent, _text_message("msg 3"), sender=sender)

        decision_ids = [e.decision_id for e in guard.audit_trail]
        assert len(set(decision_ids)) == 3  # All unique


# ── Test: Correct action_kind in Audit Entries ────────────────────────────────


class TestActionKindInAuditEntries:
    """Verify action_kind correctly distinguishes tool_call from message."""

    def test_observe_mode_text_message_action_kind_is_message(self) -> None:
        """In observe mode, plain text produces action_kind='message'."""
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("How are you?"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.MESSAGE.value

    def test_observe_mode_tool_call_action_kind_is_tool_call(self) -> None:
        """In observe mode, tool call produces action_kind='tool_call'."""
        guard = TealTigerGuard()  # No engine = observe mode
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _tool_call_message("get_weather", {"city": "NYC"}), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.TOOL_CALL.value

    def test_policy_mode_text_message_action_kind_is_message(self) -> None:
        """In policy mode, plain text produces action_kind='message'. Req 17.2"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("Please do something"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.MESSAGE.value


# ── Test: Engine Receives Correct Message Parameters ──────────────────────────


class TestEngineMessageParameters:
    """Verify TealEngine receives sender/recipient/content for message governance. Req 17.6"""

    def test_engine_receives_message_content(self) -> None:
        """Engine args contains message content."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("Please review this code"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["args"]["content"] == "Please review this code"

    def test_engine_receives_sender_name(self) -> None:
        """Engine args contains sender agent_id. Req 17.6"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("hello"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["args"]["sender"] == "reviewer"

    def test_engine_receives_recipient_name(self) -> None:
        """Engine args contains recipient agent_id. Req 17.6"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("hello"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["args"]["recipient"] == "coder"

    def test_engine_receives_action_kind_message_in_context(self) -> None:
        """Engine context contains action_kind='message'. Req 17.6"""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("hello"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["context"]["action_kind"] == "message"

    def test_engine_receives_tool_name_none_for_messages(self) -> None:
        """Engine tool_name is None for message governance."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("hello"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["tool_name"] is None


# ── Test: Message DENY in ENFORCE Mode ────────────────────────────────────────


class TestMessageDenyEnforce:
    """Verify message denial in ENFORCE mode. Req 17.3"""

    def test_message_denied_in_enforce_blocks_delivery(self) -> None:
        """DENY in ENFORCE mode returns (True, denial_message). Req 17.3"""
        engine = _MockTealEngine(
            default_action="DENY",
            default_risk_score=70,
            default_reason_codes=["CONTENT_POLICY"],
            default_reason="Message content violates policy",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = _invoke(guard, agent, _text_message("harmful content"), sender=sender)

        assert result[0] is True  # Blocked
        assert "GOVERNANCE DENIAL" in result[1]

    def test_message_denied_audit_entry_has_message_denied_code(self) -> None:
        """DENY audit entry includes 'MESSAGE_DENIED' reason code. Req 17.3"""
        engine = _MockTealEngine(
            default_action="DENY",
            default_risk_score=70,
            default_reason_codes=["CONTENT_POLICY"],
            default_reason="Policy violation",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("bad content"), sender=sender)

        entry = guard.audit_trail[0]
        assert "MESSAGE_DENIED" in entry.reason_codes
        assert entry.action == GovernanceAction.DENY.value
        assert entry.action_kind == ActionKind.MESSAGE.value


# ── Test: Message DENY in MONITOR Mode ────────────────────────────────────────


class TestMessageDenyMonitor:
    """Verify message denial in MONITOR mode logs but allows through."""

    def test_message_denied_in_monitor_allows_through(self) -> None:
        """DENY in MONITOR mode returns (False, None) — message allowed."""
        engine = _MockTealEngine(
            default_action="DENY",
            default_risk_score=70,
            default_reason_codes=["CONTENT_POLICY"],
            default_reason="Policy violation",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = _invoke(guard, agent, _text_message("bad content"), sender=sender)

        assert result == (False, None)

    def test_message_denied_in_monitor_records_audit_entry(self) -> None:
        """DENY in MONITOR mode still records audit entry with correct action_kind."""
        engine = _MockTealEngine(
            default_action="DENY",
            default_risk_score=70,
            default_reason_codes=["CONTENT_POLICY"],
            default_reason="Policy violation",
        )
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.MONITOR)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("bad content"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.DENY.value
        assert entry.action_kind == ActionKind.MESSAGE.value
        assert "MESSAGE_DENIED" in entry.reason_codes


# ── Test: Message ALLOW ───────────────────────────────────────────────────────


class TestMessageAllow:
    """Verify message ALLOW passes through correctly."""

    def test_message_allowed_passes_through(self) -> None:
        """ALLOW returns (False, None) — message delivered."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = _invoke(guard, agent, _text_message("Hello!"), sender=sender)

        assert result == (False, None)

    def test_message_allowed_records_audit_entry(self) -> None:
        """ALLOW records audit entry with action_kind='message'."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        _invoke(guard, agent, _text_message("Hello!"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.ALLOW.value
        assert entry.action_kind == ActionKind.MESSAGE.value


# ── Test: Originating Actor Identification ────────────────────────────────────


class TestOriginatingActorIdentification:
    """Verify the originating actor is correctly identified. Req 17.5"""

    def test_audit_entry_identifies_recipient_as_agent_id(self) -> None:
        """Audit entry agent_id is the recipient (the governed agent)."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("Please fix"), sender=sender)

        entry = guard.audit_trail[0]
        assert entry.agent_id == "coder"

    def test_engine_context_identifies_agent(self) -> None:
        """Engine context includes agent_id for policy scoping."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        agent = _MockAgent("coder")
        sender = _MockAgent("reviewer")

        _invoke(guard, agent, _text_message("hello"), sender=sender)

        call = engine.evaluate_calls[0]
        assert call["context"]["agent_id"] == "coder"
