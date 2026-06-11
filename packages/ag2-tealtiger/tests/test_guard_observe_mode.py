"""Tests for TealTigerGuard._reply_hook — observe mode path.

Validates:
- Task 6.3: Observe mode produces correct audit entries
- Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6

Tests verify:
- Cost estimation from text length heuristics
- PII detection in tool call arguments
- Tool name and argument summary recording
- AuditEntry with action=ALLOW and reason_codes=["OBSERVE_PASSTHROUGH"]
- Return (False, None) — never blocks
- Frozen agent handling (mode-independent deny)
- Turn_id monotonically increments
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
)


# ── Test Helpers ──────────────────────────────────────────────────────────────


class _MockAgent:
    """Minimal mock AG2 agent for observe mode tests."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []

    def register_reply(
        self, trigger: Any, reply_func: Any, position: int = 0, **kwargs: Any
    ) -> None:
        self._reply_funcs.insert(
            position, {"trigger": trigger, "reply_func": reply_func}
        )


def _tool_call_message(
    tool_name: str, arguments: dict[str, Any] | str | None = None
) -> list[dict[str, Any]]:
    """Create a messages list with a single tool call in AG2 format."""
    if arguments is None:
        arguments = {}
    if isinstance(arguments, dict):
        args_value = arguments
    else:
        args_value = arguments

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
                        "arguments": args_value,
                    },
                }
            ],
        }
    ]


def _text_message(content: str) -> list[dict[str, Any]]:
    """Create a messages list with a plain text message."""
    return [{"role": "assistant", "content": content}]


# ── Observe Mode: Basic Behavior ─────────────────────────────────────────────


class TestObserveModePassthrough:
    """Verify observe mode always returns (False, None) — never blocks."""

    def test_returns_false_none_for_tool_call(self) -> None:
        """Observe mode passes through tool calls without blocking."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        assert result == (False, None)

    def test_returns_false_none_for_text_message(self) -> None:
        """Observe mode passes through text messages without blocking."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = guard._reply_hook(
            recipient=agent,
            messages=_text_message("Hello world"),
            sender=sender,
            config=None,
        )

        assert result == (False, None)

    def test_returns_false_none_for_empty_tool_calls(self) -> None:
        """Observe mode handles messages with empty tool_calls list."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        messages = [{"role": "assistant", "content": "test", "tool_calls": []}]
        result = guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        assert result == (False, None)

    def test_returns_false_none_with_none_messages(self) -> None:
        """Observe mode handles None messages gracefully."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = guard._reply_hook(
            recipient=agent, messages=None, sender=sender, config=None
        )

        assert result == (False, None)

    def test_returns_false_none_with_empty_messages(self) -> None:
        """Observe mode handles empty messages list gracefully."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        result = guard._reply_hook(
            recipient=agent, messages=[], sender=sender, config=None
        )

        assert result == (False, None)


# ── Observe Mode: AuditEntry Production ──────────────────────────────────────


class TestObserveModeAuditEntry:
    """Verify observe mode produces correct AuditEntry structure."""

    def test_produces_audit_entry_for_tool_call(self) -> None:
        """Each tool call produces exactly one AuditEntry."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        assert len(guard.audit_trail) == 1

    def test_audit_entry_action_is_allow(self) -> None:
        """Observe mode sets action=ALLOW in the audit entry."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.action == GovernanceAction.ALLOW.value

    def test_audit_entry_reason_codes_observe_passthrough(self) -> None:
        """Observe mode sets reason_codes=["OBSERVE_PASSTHROUGH"]."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "print('hi')"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.reason_codes == ["OBSERVE_PASSTHROUGH"]

    def test_audit_entry_mode_is_observe(self) -> None:
        """Observe mode sets mode=OBSERVE in the audit entry."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("search", {"query": "test"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.mode == GovernanceMode.OBSERVE.value

    def test_audit_entry_risk_score_zero(self) -> None:
        """Observe mode always sets risk_score=0."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("dangerous_tool", {"target": "prod"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.risk_score == 0

    def test_audit_entry_action_kind_is_tool_call(self) -> None:
        """Observe mode sets action_kind=TOOL_CALL for tool call messages."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "1+1"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.action_kind == ActionKind.TOOL_CALL.value

    def test_audit_entry_agent_id_from_recipient(self) -> None:
        """agent_id in the audit entry comes from recipient.name."""
        guard = TealTigerGuard()
        agent = _MockAgent("my_special_agent")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("fetch", {"url": "http://example.com"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.agent_id == "my_special_agent"

    def test_audit_entry_has_evaluation_time_ms(self) -> None:
        """AuditEntry includes positive evaluation_time_ms."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.evaluation_time_ms > 0

    def test_audit_entry_has_valid_teec_context(self) -> None:
        """AuditEntry includes a valid TEEC context with conversation_id and turn_id."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        teec = entry.teec
        assert teec.namespace == "teec.ag2"
        assert teec.conversation_id  # non-empty
        assert teec.turn_id == 1
        assert teec.decision_id  # non-empty UUID
        assert teec.agent_role == "coder"

    def test_audit_entry_has_correlation_id(self) -> None:
        """AuditEntry has a non-empty correlation_id (UUID)."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.correlation_id  # non-empty string
        assert len(entry.correlation_id) == 36  # UUID format

    def test_audit_entry_has_timestamp_ms(self) -> None:
        """AuditEntry has a positive timestamp_ms."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.timestamp_ms > 0


# ── Observe Mode: Tool Name and Argument Recording ───────────────────────────


class TestObserveModeToolRecording:
    """Verify observe mode records tool names and argument summaries."""

    def test_records_tool_name(self) -> None:
        """Audit entry records the tool name from the message."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("execute_shell", {"command": "ls"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.tool_name == "execute_shell"

    def test_records_argument_summary_with_dict_args(self) -> None:
        """Argument summary captures key names and value types."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message(
                "send_email",
                {"to": "user@example.com", "subject": "Hello", "count": 5},
            ),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.tool_args_summary is not None
        assert entry.tool_args_summary["to"] == "str"
        assert entry.tool_args_summary["subject"] == "str"
        assert entry.tool_args_summary["count"] == "int"

    def test_records_argument_summary_with_json_string_args(self) -> None:
        """Argument summary works with JSON-encoded string arguments."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        args_json = json.dumps({"query": "SELECT * FROM users", "limit": 10})
        messages = [
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_001",
                        "type": "function",
                        "function": {
                            "name": "run_sql",
                            "arguments": args_json,
                        },
                    }
                ],
            }
        ]

        guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        entry = guard.audit_trail[0]
        assert entry.tool_name == "run_sql"
        assert entry.tool_args_summary is not None
        assert entry.tool_args_summary["query"] == "str"
        assert entry.tool_args_summary["limit"] == "int"

    def test_no_tool_name_for_text_message(self) -> None:
        """No tool_name recorded for plain text messages."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_text_message("Just a regular message"),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.tool_name is None
        assert entry.tool_args_summary is None


# ── Observe Mode: Cost Tracking ──────────────────────────────────────────────


class TestObserveModeCostTracking:
    """Verify observe mode estimates and tracks costs from text length heuristics."""

    def test_cost_tracked_is_positive_for_content(self) -> None:
        """Cost is estimated and tracked for messages with content."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_text_message("A" * 4000),  # 4000 chars = ~1000 tokens
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.cost_tracked > 0

    def test_cost_estimation_formula(self) -> None:
        """Cost = (chars / 4) * cost_per_1k_tokens / 1000."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.002)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        # 4000 chars -> 1000 tokens -> 1000 * 0.002 / 1000 = 0.002
        guard._reply_hook(
            recipient=agent,
            messages=_text_message("A" * 4000),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        expected_cost = (4000 / 4.0 * 0.002) / 1000.0
        assert abs(entry.cost_tracked - expected_cost) < 1e-10

    def test_cost_includes_tool_call_arguments(self) -> None:
        """Cost estimation includes tool call argument character count."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.002)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        # Arguments add to total character count
        args = {"data": "X" * 400}
        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("process", args),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.cost_tracked > 0

    def test_cumulative_cost_increases_across_calls(self) -> None:
        """Cumulative cost in audit entries increases with each invocation."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_text_message("A" * 100),
            sender=sender,
            config=None,
        )
        guard._reply_hook(
            recipient=agent,
            messages=_text_message("B" * 100),
            sender=sender,
            config=None,
        )

        entry1 = guard.audit_trail[0]
        entry2 = guard.audit_trail[1]
        assert entry2.cumulative_cost > entry1.cumulative_cost
        assert entry2.cumulative_cost == entry1.cost_tracked + entry2.cost_tracked

    def test_cost_zero_for_empty_content_no_tools(self) -> None:
        """Cost is zero when message has no content and no tool calls."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        messages = [{"role": "assistant", "content": None}]
        guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        entry = guard.audit_trail[0]
        assert entry.cost_tracked == 0.0

    def test_custom_cost_rate_used(self) -> None:
        """Custom cost_per_1k_tokens rate is used in estimation."""
        guard = TealTigerGuard(cost_per_1k_tokens=0.01)
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_text_message("A" * 4000),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        expected_cost = (4000 / 4.0 * 0.01) / 1000.0
        assert abs(entry.cost_tracked - expected_cost) < 1e-10


# ── Observe Mode: PII Detection ──────────────────────────────────────────────


class TestObserveModePiiDetection:
    """Verify observe mode detects PII in tool call arguments."""

    def test_detects_email_in_tool_args(self) -> None:
        """PII detection finds email addresses in tool call arguments."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message(
                "send_message", {"to": "john@example.com", "body": "Hello"}
            ),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert len(entry.pii_detected) > 0
        pii_types = [p["type"] for p in entry.pii_detected]
        assert "email" in pii_types

    def test_detects_ssn_in_tool_args(self) -> None:
        """PII detection finds SSN patterns in tool arguments."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message(
                "store_record", {"ssn": "123-45-6789", "name": "Alice"}
            ),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        pii_types = [p["type"] for p in entry.pii_detected]
        assert "ssn" in pii_types

    def test_detects_pii_in_json_string_args(self) -> None:
        """PII detection works with JSON-encoded string arguments."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        args_json = json.dumps({"email": "alice@corp.com", "phone": "555-123-4567"})
        messages = [
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_001",
                        "type": "function",
                        "function": {
                            "name": "update_contact",
                            "arguments": args_json,
                        },
                    }
                ],
            }
        ]

        guard._reply_hook(
            recipient=agent, messages=messages, sender=sender, config=None
        )

        entry = guard.audit_trail[0]
        pii_types = [p["type"] for p in entry.pii_detected]
        assert "email" in pii_types
        assert "phone_number" in pii_types

    def test_no_pii_detected_for_clean_args(self) -> None:
        """PII list is empty when arguments contain no PII."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("calculate", {"a": 5, "b": 10}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.pii_detected == []

    def test_no_pii_detected_for_text_message(self) -> None:
        """PII detection is only applied to tool call arguments."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        # PII in message content (not tool args) — not scanned in observe mode
        guard._reply_hook(
            recipient=agent,
            messages=_text_message("My email is john@example.com"),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.pii_detected == []


# ── Observe Mode: Turn ID Tracking ───────────────────────────────────────────


class TestObserveModeTurnId:
    """Verify turn_id increments monotonically per _reply_hook invocation."""

    def test_turn_id_starts_at_one(self) -> None:
        """First invocation produces turn_id=1."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.teec.turn_id == 1

    def test_turn_id_increments_monotonically(self) -> None:
        """Subsequent invocations produce increasing turn_ids."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        for _ in range(5):
            guard._reply_hook(
                recipient=agent,
                messages=_tool_call_message("run", {}),
                sender=sender,
                config=None,
            )

        for i, entry in enumerate(guard.audit_trail):
            assert entry.teec.turn_id == i + 1

    def test_turn_id_increments_across_different_agents(self) -> None:
        """Turn_id increments globally across all agents sharing the guard."""
        guard = TealTigerGuard()
        agent_a = _MockAgent("coder")
        agent_b = _MockAgent("reviewer")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent_a,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )
        guard._reply_hook(
            recipient=agent_b,
            messages=_tool_call_message("review", {}),
            sender=sender,
            config=None,
        )

        assert guard.audit_trail[0].teec.turn_id == 1
        assert guard.audit_trail[1].teec.turn_id == 2


# ── Observe Mode: Frozen Agent Handling ──────────────────────────────────────


class TestObserveModeFrozenAgent:
    """Verify frozen agents are denied even in observe mode."""

    def test_frozen_agent_returns_true_with_denial(self) -> None:
        """Frozen agent causes (True, denial_message) — blocks even in observe mode."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard.freeze("coder")

        result = guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )

        should_terminate, reply = result
        assert should_terminate is True
        assert reply is not None
        assert "frozen" in reply.lower()

    def test_frozen_agent_audit_entry_deny(self) -> None:
        """Frozen agent produces DENY audit entry with AGENT_FROZEN."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard.freeze("coder")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )

        # The freeze itself adds one audit entry, then the reply_hook adds another
        deny_entries = [
            e for e in guard.audit_trail
            if e.action_kind == ActionKind.TOOL_CALL.value
            and e.action == GovernanceAction.DENY.value
        ]
        assert len(deny_entries) == 1
        entry = deny_entries[0]
        assert entry.reason_codes == ["AGENT_FROZEN"]
        assert entry.risk_score == 100
        assert entry.agent_id == "coder"

    def test_unfrozen_agent_passes_through(self) -> None:
        """After unfreeze, agent passes through in observe mode again."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard.freeze("coder")
        guard.unfreeze("coder")

        result = guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )

        assert result == (False, None)


# ── Observe Mode: TEEC Context ───────────────────────────────────────────────


class TestObserveModeTeecContext:
    """Verify TEEC context is populated correctly in observe mode."""

    def test_teec_has_stable_conversation_id(self) -> None:
        """All entries from the same guard share conversation_id."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )
        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("build", {}),
            sender=sender,
            config=None,
        )

        conv_id_1 = guard.audit_trail[0].teec.conversation_id
        conv_id_2 = guard.audit_trail[1].teec.conversation_id
        assert conv_id_1 == conv_id_2
        assert conv_id_1  # non-empty

    def test_teec_has_unique_decision_ids(self) -> None:
        """Each invocation gets a unique decision_id."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {"code": "x=1"}),
            sender=sender,
            config=None,
        )
        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {"code": "x=1"}),
            sender=sender,
            config=None,
        )

        id1 = guard.audit_trail[0].teec.decision_id
        id2 = guard.audit_trail[1].teec.decision_id
        assert id1 != id2

    def test_teec_has_params_hash_for_tool_calls(self) -> None:
        """TEEC includes params_hash when tool_args are present."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run_code", {"code": "x = 1"}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.teec.params_hash is not None
        assert len(entry.teec.params_hash) == 64  # SHA-256 hex

    def test_teec_no_params_hash_for_text_message(self) -> None:
        """TEEC has no params_hash when no tool call is present."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_text_message("Hello"),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.teec.params_hash is None

    def test_teec_decision_source_is_default_mode(self) -> None:
        """In observe mode, decision_source is 'default_mode'."""
        guard = TealTigerGuard()
        agent = _MockAgent("coder")
        sender = _MockAgent("user")

        guard._reply_hook(
            recipient=agent,
            messages=_tool_call_message("run", {}),
            sender=sender,
            config=None,
        )

        entry = guard.audit_trail[0]
        assert entry.teec.decision_source == "default_mode"
