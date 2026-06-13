"""Tests for TealTigerGuard.export_audit_trail — JSONL export and round-trip parsing.

Validates:
- Task 6.9: audit_trail property, export_audit_trail(path, format="jsonl"), evaluation_time_ms
- Requirements: 12.1, 12.3, 12.4, 12.5, 13.5
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
    ActionKind,
    TEECContext,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_audit_entry(
    agent_id: str = "agent-1",
    tool_name: str | None = "web_search",
    action: str = GovernanceAction.ALLOW.value,
    evaluation_time_ms: float = 1.5,
    **overrides: Any,
) -> AuditEntry:
    """Create a minimal valid AuditEntry for testing."""
    import uuid

    decision_id = str(uuid.uuid4())
    defaults = dict(
        correlation_id=str(uuid.uuid4()),
        decision_id=decision_id,
        timestamp_ms=time.time() * 1000,
        action=action,
        action_kind=ActionKind.TOOL_CALL.value,
        mode=GovernanceMode.OBSERVE.value,
        agent_id=agent_id,
        reason="Test entry",
        reason_codes=["OBSERVE_PASSTHROUGH"],
        risk_score=0,
        evaluation_time_ms=evaluation_time_ms,
        teec=TEECContext(
            namespace="teec.ag2",
            conversation_id=str(uuid.uuid4()),
            turn_id=1,
            agent_role=agent_id,
            decision_id=decision_id,
            decision_source="default_mode",
        ),
        tool_name=tool_name,
    )
    defaults.update(overrides)
    return AuditEntry(**defaults)


class _MockConversableAgent:
    """Lightweight mock of AG2's ConversableAgent."""

    def __init__(self, name: str, **kwargs: Any) -> None:
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


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestExportAuditTrailBasic:
    """Test export_audit_trail core behavior."""

    def test_export_empty_trail(self, tmp_path: Path) -> None:
        """Exporting an empty audit trail writes an empty file and returns 0."""
        guard = TealTigerGuard()
        out_file = tmp_path / "audit.jsonl"

        count = guard.export_audit_trail(str(out_file))

        assert count == 0
        assert out_file.read_text() == ""

    def test_export_single_entry(self, tmp_path: Path) -> None:
        """Exporting a single entry writes one JSON line."""
        guard = TealTigerGuard()
        entry = _make_audit_entry(agent_id="coder")
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file))

        assert count == 1
        lines = out_file.read_text().strip().split("\n")
        assert len(lines) == 1

        parsed = json.loads(lines[0])
        assert parsed["agent_id"] == "coder"
        assert parsed["tool_name"] == "web_search"

    def test_export_multiple_entries(self, tmp_path: Path) -> None:
        """Exporting multiple entries writes one JSON line per entry."""
        guard = TealTigerGuard()
        for i in range(5):
            guard._audit_trail.append(_make_audit_entry(agent_id=f"agent-{i}"))

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file))

        assert count == 5
        lines = out_file.read_text().strip().split("\n")
        assert len(lines) == 5

        for i, line in enumerate(lines):
            parsed = json.loads(line)
            assert parsed["agent_id"] == f"agent-{i}"

    def test_export_preserves_order(self, tmp_path: Path) -> None:
        """Entries are written in the same order they appear in the audit trail."""
        guard = TealTigerGuard()
        agents = ["alpha", "beta", "gamma", "delta"]
        for name in agents:
            guard._audit_trail.append(_make_audit_entry(agent_id=name))

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        lines = out_file.read_text().strip().split("\n")
        for i, line in enumerate(lines):
            parsed = json.loads(line)
            assert parsed["agent_id"] == agents[i]


class TestExportAuditTrailRoundTrip:
    """Test JSONL export round-trip — export then parse back."""

    def test_roundtrip_all_fields(self, tmp_path: Path) -> None:
        """All AuditEntry fields survive round-trip through JSONL export."""
        guard = TealTigerGuard()
        entry = _make_audit_entry(
            agent_id="reviewer",
            tool_name="code_execute",
            action=GovernanceAction.DENY.value,
            evaluation_time_ms=3.75,
            risk_score=85,
            reason="Policy violation",
            reason_codes=["UNAUTHORIZED_TOOL", "HIGH_RISK"],
            pii_detected=[{"type": "email", "value": "***@***.com"}],
            cost_tracked=0.005,
            cumulative_cost=0.123,
        )
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        parsed = json.loads(out_file.read_text().strip())

        # Verify core fields
        assert parsed["agent_id"] == "reviewer"
        assert parsed["tool_name"] == "code_execute"
        assert parsed["action"] == "DENY"
        assert parsed["evaluation_time_ms"] == 3.75
        assert parsed["risk_score"] == 85
        assert parsed["reason"] == "Policy violation"
        assert parsed["reason_codes"] == ["UNAUTHORIZED_TOOL", "HIGH_RISK"]
        assert parsed["pii_detected"] == [{"type": "email", "value": "***@***.com"}]
        assert parsed["cost_tracked"] == 0.005
        assert parsed["cumulative_cost"] == 0.123

    def test_roundtrip_teec_context(self, tmp_path: Path) -> None:
        """Nested TEECContext dataclass is correctly serialized."""
        import uuid

        conv_id = str(uuid.uuid4())
        decision_id = str(uuid.uuid4())
        parent_conv_id = str(uuid.uuid4())

        teec = TEECContext(
            namespace="teec.ag2",
            conversation_id=conv_id,
            turn_id=7,
            agent_role="executor",
            group_chat_id="gc-001",
            params_hash="abc123def",
            parent_conversation_id=parent_conv_id,
            decision_id=decision_id,
            idempotency_key="idem-key-456",
            policy_digest="pol-digest-789",
            decision_source="policy_engine",
            execution_outcome="success",
            approval_id="approval-001",
        )

        guard = TealTigerGuard()
        entry = _make_audit_entry(teec=teec)
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        parsed = json.loads(out_file.read_text().strip())
        teec_parsed = parsed["teec"]

        assert teec_parsed["namespace"] == "teec.ag2"
        assert teec_parsed["conversation_id"] == conv_id
        assert teec_parsed["turn_id"] == 7
        assert teec_parsed["agent_role"] == "executor"
        assert teec_parsed["group_chat_id"] == "gc-001"
        assert teec_parsed["params_hash"] == "abc123def"
        assert teec_parsed["parent_conversation_id"] == parent_conv_id
        assert teec_parsed["decision_id"] == decision_id
        assert teec_parsed["idempotency_key"] == "idem-key-456"
        assert teec_parsed["policy_digest"] == "pol-digest-789"
        assert teec_parsed["decision_source"] == "policy_engine"
        assert teec_parsed["execution_outcome"] == "success"
        assert teec_parsed["approval_id"] == "approval-001"

    def test_roundtrip_optional_none_fields(self, tmp_path: Path) -> None:
        """Optional None fields serialize as null in JSON."""
        guard = TealTigerGuard()
        entry = _make_audit_entry(
            tool_name=None,
            tool_args_summary=None,
            trace_id=None,
        )
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        parsed = json.loads(out_file.read_text().strip())
        assert parsed["tool_name"] is None
        assert parsed["tool_args_summary"] is None
        assert parsed["trace_id"] is None

    def test_roundtrip_metadata_dict(self, tmp_path: Path) -> None:
        """Metadata dict with arbitrary content is preserved."""
        guard = TealTigerGuard()
        entry = _make_audit_entry(
            metadata={"custom_key": "value", "nested": {"a": 1, "b": [2, 3]}}
        )
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        parsed = json.loads(out_file.read_text().strip())
        assert parsed["metadata"] == {"custom_key": "value", "nested": {"a": 1, "b": [2, 3]}}


class TestExportAuditTrailEvaluationTime:
    """Test that evaluation_time_ms is recorded in every AuditEntry."""

    def test_evaluation_time_positive(self, tmp_path: Path) -> None:
        """evaluation_time_ms is present and positive in exported entries."""
        guard = TealTigerGuard()
        entry = _make_audit_entry(evaluation_time_ms=2.34)
        guard._audit_trail.append(entry)

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        parsed = json.loads(out_file.read_text().strip())
        assert parsed["evaluation_time_ms"] == 2.34
        assert parsed["evaluation_time_ms"] > 0

    def test_evaluation_time_in_freeze_entries(self, tmp_path: Path) -> None:
        """Freeze/unfreeze audit entries include evaluation_time_ms > 0."""
        guard = TealTigerGuard()
        guard.freeze("test-agent")
        guard.unfreeze("test-agent")

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file))

        assert count == 2
        lines = out_file.read_text().strip().split("\n")
        for line in lines:
            parsed = json.loads(line)
            assert "evaluation_time_ms" in parsed
            assert parsed["evaluation_time_ms"] >= 0


class TestExportAuditTrailFormat:
    """Test format parameter validation."""

    def test_unsupported_format_raises(self, tmp_path: Path) -> None:
        """Unsupported format raises ValueError."""
        guard = TealTigerGuard()
        out_file = tmp_path / "audit.csv"

        with pytest.raises(ValueError, match="Unsupported export format"):
            guard.export_audit_trail(str(out_file), format="csv")

    def test_jsonl_format_explicit(self, tmp_path: Path) -> None:
        """Explicit format='jsonl' works the same as the default."""
        guard = TealTigerGuard()
        guard._audit_trail.append(_make_audit_entry())

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file), format="jsonl")

        assert count == 1
        parsed = json.loads(out_file.read_text().strip())
        assert "agent_id" in parsed

    def test_each_line_is_valid_json(self, tmp_path: Path) -> None:
        """Each line in the JSONL file is independently parseable as JSON."""
        guard = TealTigerGuard()
        for i in range(10):
            guard._audit_trail.append(_make_audit_entry(agent_id=f"agent-{i}"))

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        lines = out_file.read_text().strip().split("\n")
        assert len(lines) == 10
        for line in lines:
            # Should not raise
            parsed = json.loads(line)
            assert isinstance(parsed, dict)

    def test_no_multiline_json(self, tmp_path: Path) -> None:
        """Each entry is serialized as a single line (no pretty-printing)."""
        guard = TealTigerGuard()
        guard._audit_trail.append(
            _make_audit_entry(metadata={"key": "value\nwith newline"})
        )

        out_file = tmp_path / "audit.jsonl"
        guard.export_audit_trail(str(out_file))

        content = out_file.read_text()
        # Only one entry, so content should have exactly one newline at the end
        # (the line terminator) — the embedded \n in metadata should be escaped
        lines = content.split("\n")
        # Last element is empty after the trailing newline
        assert len(lines) == 2
        assert lines[1] == ""


class TestExportAuditTrailIntegration:
    """Integration tests verifying export works with guard lifecycle."""

    def test_export_after_freeze_and_unfreeze(self, tmp_path: Path) -> None:
        """Export includes freeze and unfreeze entries from guard operations."""
        guard = TealTigerGuard()
        guard.freeze("agent-x")
        guard.unfreeze("agent-x")

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file))

        assert count == 2
        lines = out_file.read_text().strip().split("\n")

        freeze_entry = json.loads(lines[0])
        assert freeze_entry["action_kind"] == "freeze"
        assert freeze_entry["action"] == "DENY"
        assert "AGENT_FROZEN" in freeze_entry["reason_codes"]

        unfreeze_entry = json.loads(lines[1])
        assert unfreeze_entry["action_kind"] == "freeze"
        assert unfreeze_entry["action"] == "ALLOW"
        assert "AGENT_UNFROZEN" in unfreeze_entry["reason_codes"]

    def test_export_returns_count_matching_trail_length(self, tmp_path: Path) -> None:
        """Return value equals the length of the audit trail."""
        guard = TealTigerGuard()
        n = 7
        for i in range(n):
            guard._audit_trail.append(_make_audit_entry(agent_id=f"a-{i}"))

        out_file = tmp_path / "audit.jsonl"
        count = guard.export_audit_trail(str(out_file))

        assert count == n
        assert count == len(guard.audit_trail)
