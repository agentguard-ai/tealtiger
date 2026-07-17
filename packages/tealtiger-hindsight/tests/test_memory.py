"""Tests for tealtiger-hindsight governance memory."""

import pytest
from unittest.mock import MagicMock, patch


def _make_mock_client():
    """Create a mock Hindsight client."""
    client = MagicMock()
    client.retain.return_value = {"status": "ok", "id": "mem-123"}
    client.recall.return_value = [
        {"content": "Governance decision: DENY | Agent: agent-1", "importance": 0.9}
    ]
    client.reflect.return_value = "Agent-1 has been denied 5 times for PII."
    return client


def _make_memory(**kwargs):
    """Create HindsightGovernanceMemory with mock client."""
    from tealtiger_hindsight import HindsightGovernanceMemory
    client = _make_mock_client()
    memory = HindsightGovernanceMemory(client=client, **kwargs)
    return memory, client


class TestStore:
    def test_store_deny_high_importance(self):
        memory, client = _make_memory()

        memory.store({
            "action": "DENY",
            "correlation_id": "d1",
            "agent_id": "agent-1",
            "tool_name": "send_email",
            "reason_codes": ["PII_DETECTED:ssn"],
            "risk_score": 90,
            "mode": "ENFORCE",
        })

        client.retain.assert_called_once()
        call_kwargs = client.retain.call_args[1]
        assert call_kwargs["importance"] == 0.90
        assert call_kwargs["bank_id"] == "governance"
        assert "DENY" in call_kwargs["content"]
        assert "send_email" in call_kwargs["content"]

    def test_store_allow_low_importance(self):
        memory, client = _make_memory()

        memory.store({
            "action": "ALLOW",
            "correlation_id": "a1",
            "agent_id": "agent-2",
            "tool_name": "search",
        })

        call_kwargs = client.retain.call_args[1]
        assert call_kwargs["importance"] == 0.55

    def test_store_monitor_medium_importance(self):
        memory, client = _make_memory()

        memory.store({
            "action": "MONITOR",
            "correlation_id": "m1",
            "reason_codes": ["COST_WARNING"],
        })

        call_kwargs = client.retain.call_args[1]
        assert call_kwargs["importance"] == 0.70

    def test_custom_importance_fn(self):
        def custom_fn(decision):
            return 0.99 if decision.get("risk_score", 0) > 80 else 0.40

        memory, client = _make_memory(importance_fn=custom_fn)

        memory.store({"action": "DENY", "risk_score": 95, "correlation_id": "c1"})
        assert client.retain.call_args[1]["importance"] == 0.99

        memory.store({"action": "ALLOW", "risk_score": 10, "correlation_id": "c2"})
        assert client.retain.call_args[1]["importance"] == 0.40

    def test_store_includes_tags(self):
        memory, client = _make_memory()

        memory.store({
            "action": "DENY",
            "correlation_id": "t1",
            "agent_id": "coder",
            "tool_name": "shell",
        })

        call_kwargs = client.retain.call_args[1]
        tags = call_kwargs["tags"]
        assert "tealtiger" in tags
        assert "governance" in tags
        assert "action:deny" in tags
        assert "agent:coder" in tags
        assert "tool:shell" in tags

    def test_store_count_increments(self):
        memory, _ = _make_memory()

        memory.store({"action": "ALLOW", "correlation_id": "1"})
        memory.store({"action": "DENY", "correlation_id": "2", "reason_codes": ["X"]})

        assert memory.store_count == 2

    def test_custom_bank_id(self):
        memory, client = _make_memory(bank_id="my-governance-bank")

        memory.store({"action": "ALLOW", "correlation_id": "b1"})

        assert client.retain.call_args[1]["bank_id"] == "my-governance-bank"


class TestRecall:
    def test_recall_by_agent(self):
        memory, client = _make_memory()

        results = memory.recall(agent_id="agent-1", limit=3)

        client.recall.assert_called_once()
        call_kwargs = client.recall.call_args[1]
        assert "agent-1" in call_kwargs["query"]
        assert call_kwargs["max_results"] == 3

    def test_recall_with_context(self):
        memory, client = _make_memory()

        memory.recall(agent_id="agent-1", context="tool:send_email")

        call_kwargs = client.recall.call_args[1]
        assert "agent-1" in call_kwargs["query"]
        assert "tool:send_email" in call_kwargs["query"]

    def test_recall_with_custom_query(self):
        memory, client = _make_memory()

        memory.recall(query="PII denials in the last week")

        call_kwargs = client.recall.call_args[1]
        assert call_kwargs["query"] == "PII denials in the last week"

    def test_recall_count_increments(self):
        memory, _ = _make_memory()

        memory.recall(agent_id="a")
        memory.recall(agent_id="b")

        assert memory.recall_count == 2


class TestReflect:
    def test_reflect_on_agent(self):
        memory, client = _make_memory()

        result = memory.reflect(agent_id="agent-1")

        client.reflect.assert_called_once()
        call_kwargs = client.reflect.call_args[1]
        assert "agent-1" in call_kwargs["query"]

    def test_reflect_custom_query(self):
        memory, client = _make_memory()

        memory.reflect(query="What patterns emerge from denial history?")

        call_kwargs = client.reflect.call_args[1]
        assert call_kwargs["query"] == "What patterns emerge from denial history?"


class TestContentFormatting:
    def test_content_includes_key_fields(self):
        memory, client = _make_memory()

        memory.store({
            "action": "DENY",
            "correlation_id": "fmt-1",
            "agent_id": "coder",
            "tool_name": "delete_file",
            "reason_codes": ["TOOL_NOT_ALLOWED"],
            "risk_score": 80,
            "mode": "ENFORCE",
        })

        content = client.retain.call_args[1]["content"]
        assert "DENY" in content
        assert "coder" in content
        assert "delete_file" in content
        assert "ENFORCE" in content
        assert "80" in content
        assert "TOOL_NOT_ALLOWED" in content

    def test_content_includes_cost(self):
        memory, client = _make_memory()

        memory.store({
            "action": "ALLOW",
            "correlation_id": "cost-1",
            "cost_tracked": 0.005,
            "cumulative_cost": 1.23,
        })

        content = client.retain.call_args[1]["content"]
        assert "0.0050" in content
        assert "1.2300" in content
