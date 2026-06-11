"""Unit tests for TealTigerAuditAgent.

Tests the ConversableAgent subclass with built-in governance:
- Extends ConversableAgent (or fallback base) and auto-registers TealTigerGuard
- Accepts all ConversableAgent kwargs without modification
- Zero-config observe mode when no TealEngine provided
- Exposes guard, audit_trail, and summary properties
- Optional budget_limit parameter

Requirements validated: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
"""

from __future__ import annotations

from ag2_tealtiger.audit_agent import TealTigerAuditAgent
from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    AuditEntry,
    GovernanceAction,
    GovernanceMode,
)
from .conftest import (
    make_mock_engine,
    make_tool_call_message,
    make_text_message,
)


# ── Initialization Tests ──────────────────────────────────────────────────────


class TestAuditAgentInit:
    """Tests for TealTigerAuditAgent initialization."""

    def test_creates_with_name(self) -> None:
        """Agent initializes with a name attribute."""
        agent = TealTigerAuditAgent(name="coder")
        assert agent.name == "coder"

    def test_default_observe_mode_no_engine(self) -> None:
        """Without engine, agent operates in observe mode (zero-config)."""
        agent = TealTigerAuditAgent(name="coder")
        assert agent.guard.engine is None
        assert agent.guard.mode == GovernanceMode.OBSERVE

    def test_with_engine_enforce_mode(self) -> None:
        """With engine and mode, agent operates in specified mode."""
        engine = make_mock_engine()
        agent = TealTigerAuditAgent(
            name="executor",
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        assert agent.guard.engine is engine
        assert agent.guard.mode == GovernanceMode.ENFORCE

    def test_with_engine_monitor_mode(self) -> None:
        """Agent can be initialized in MONITOR mode."""
        engine = make_mock_engine()
        agent = TealTigerAuditAgent(
            name="reviewer",
            engine=engine,
            mode=GovernanceMode.MONITOR,
        )
        assert agent.guard.mode == GovernanceMode.MONITOR

    def test_registers_guard_on_init(self) -> None:
        """Guard is automatically attached during initialization."""
        agent = TealTigerAuditAgent(name="coder")
        # Guard should track this agent as attached
        assert "coder" in agent.guard.attached_agents

    def test_accepts_kwargs_without_modification(self) -> None:
        """All ConversableAgent kwargs are passed through to parent."""
        agent = TealTigerAuditAgent(
            name="coder",
            system_message="You are a coder",
            max_consecutive_auto_reply=5,
            human_input_mode="NEVER",
        )
        assert agent.name == "coder"
        # The agent should still have its guard working
        assert agent.guard is not None

    def test_budget_limit_sets_budget_on_guard(self) -> None:
        """When budget_limit is provided, guard.set_budget is called."""
        agent = TealTigerAuditAgent(name="executor", budget_limit=2.5)
        budget_state = agent.guard.get_budget_state("executor")
        assert budget_state.budget_limit == 2.5

    def test_no_budget_limit_by_default(self) -> None:
        """When budget_limit is None, no budget is configured."""
        agent = TealTigerAuditAgent(name="coder")
        budget_state = agent.guard.get_budget_state("coder")
        assert budget_state.budget_limit is None


# ── Guard Property Tests ──────────────────────────────────────────────────────


class TestGuardProperty:
    """Tests for the guard property."""

    def test_returns_tealtiger_guard(self) -> None:
        """guard property returns a TealTigerGuard instance."""
        agent = TealTigerAuditAgent(name="coder")
        assert isinstance(agent.guard, TealTigerGuard)

    def test_guard_is_same_instance(self) -> None:
        """guard property returns the same instance on multiple accesses."""
        agent = TealTigerAuditAgent(name="coder")
        first_guard = agent.guard
        assert agent.guard is first_guard

    def test_guard_has_correct_mode(self) -> None:
        """Guard mode matches what was specified during init."""
        engine = make_mock_engine()
        agent = TealTigerAuditAgent(
            name="coder",
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        assert agent.guard.mode == GovernanceMode.ENFORCE


# ── Audit Trail Property Tests ────────────────────────────────────────────────


class TestAuditTrailProperty:
    """Tests for the audit_trail property."""

    def test_empty_audit_trail_initially(self) -> None:
        """audit_trail is empty when no evaluations have occurred."""
        agent = TealTigerAuditAgent(name="coder")
        assert agent.audit_trail == []

    def test_audit_trail_records_evaluations(self) -> None:
        """audit_trail accumulates entries after governance evaluations."""
        agent = TealTigerAuditAgent(name="coder")

        # Simulate a tool call message through the guard's reply hook
        messages = [make_tool_call_message("run_code", {"code": "print('hi')"})]
        sender = type("MockSender", (), {"name": "user"})()

        agent.guard._reply_hook(agent, messages, sender, None)

        assert len(agent.audit_trail) > 0

    def test_audit_trail_returns_ordered_list(self) -> None:
        """audit_trail returns AuditEntry objects in chronological order."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        # Multiple tool calls
        for tool in ["run_code", "web_search", "read_file"]:
            messages = [make_tool_call_message(tool, {"input": "test"})]
            agent.guard._reply_hook(agent, messages, sender, None)

        assert len(agent.audit_trail) >= 3
        # Verify ordering by timestamp
        timestamps = [e.timestamp_ms for e in agent.audit_trail]
        assert timestamps == sorted(timestamps)

    def test_audit_trail_entries_are_audit_entry_type(self) -> None:
        """All entries in audit_trail are AuditEntry instances."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()
        messages = [make_tool_call_message("run_code", {"code": "x=1"})]

        agent.guard._reply_hook(agent, messages, sender, None)

        for entry in agent.audit_trail:
            assert isinstance(entry, AuditEntry)

    def test_audit_trail_delegates_to_guard(self) -> None:
        """audit_trail property returns the same list as guard.audit_trail."""
        agent = TealTigerAuditAgent(name="coder")
        assert agent.audit_trail is agent.guard.audit_trail


# ── Summary Property Tests ────────────────────────────────────────────────────


class TestSummaryProperty:
    """Tests for the summary property."""

    def test_empty_summary_initially(self) -> None:
        """summary returns zero totals when no evaluations occurred."""
        agent = TealTigerAuditAgent(name="coder")
        summary = agent.summary
        assert summary == {
            "tools": {},
            "total_cost": 0.0,
            "total_calls": 0,
        }

    def test_summary_groups_by_tool_name(self) -> None:
        """summary groups call counts and costs by tool name."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        # Simulate multiple tool calls
        for _ in range(3):
            messages = [make_tool_call_message("run_code", {"code": "x=1"})]
            agent.guard._reply_hook(agent, messages, sender, None)

        for _ in range(2):
            messages = [make_tool_call_message("web_search", {"query": "test"})]
            agent.guard._reply_hook(agent, messages, sender, None)

        summary = agent.summary
        assert "run_code" in summary["tools"]
        assert "web_search" in summary["tools"]
        assert summary["tools"]["run_code"]["calls"] == 3
        assert summary["tools"]["web_search"]["calls"] == 2
        assert summary["total_calls"] == 5

    def test_summary_total_calls_matches_tool_sum(self) -> None:
        """total_calls equals the sum of per-tool call counts."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        tools = ["run_code", "web_search", "run_code", "read_file"]
        for tool in tools:
            messages = [make_tool_call_message(tool, {"input": "x"})]
            agent.guard._reply_hook(agent, messages, sender, None)

        summary = agent.summary
        per_tool_sum = sum(t["calls"] for t in summary["tools"].values())
        assert summary["total_calls"] == per_tool_sum

    def test_summary_does_not_count_message_actions(self) -> None:
        """summary only counts tool_call action kinds, not messages."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        # Send a plain text message (no tool calls)
        messages = [make_text_message("Hello, world!")]
        agent.guard._reply_hook(agent, messages, sender, None)

        summary = agent.summary
        assert summary["total_calls"] == 0

    def test_summary_structure(self) -> None:
        """summary returns the expected dict structure."""
        agent = TealTigerAuditAgent(name="coder")
        summary = agent.summary
        assert "tools" in summary
        assert "total_cost" in summary
        assert "total_calls" in summary
        assert isinstance(summary["tools"], dict)
        assert isinstance(summary["total_cost"], float)
        assert isinstance(summary["total_calls"], int)


# ── Zero-Config Observe Mode Tests ───────────────────────────────────────────


class TestZeroConfigObserveMode:
    """Tests for zero-config observe mode behavior."""

    def test_observe_mode_allows_all_tool_calls(self) -> None:
        """In observe mode, all tool calls pass through without blocking."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        messages = [make_tool_call_message("dangerous_tool", {"target": "system"})]
        result = agent.guard._reply_hook(agent, messages, sender, None)

        # (False, None) means pass through — not blocked
        assert result == (False, None)

    def test_observe_mode_records_audit_entries(self) -> None:
        """In observe mode, audit entries are still recorded."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        messages = [make_tool_call_message("run_code", {"code": "x=1"})]
        agent.guard._reply_hook(agent, messages, sender, None)

        assert len(agent.audit_trail) > 0
        entry = agent.audit_trail[-1]
        assert entry.action == GovernanceAction.ALLOW.value
        assert "OBSERVE_PASSTHROUGH" in entry.reason_codes

    def test_observe_mode_tracks_tool_names(self) -> None:
        """In observe mode, tool names are tracked in audit entries."""
        agent = TealTigerAuditAgent(name="coder")
        sender = type("MockSender", (), {"name": "user"})()

        messages = [make_tool_call_message("run_code", {"code": "x=1"})]
        agent.guard._reply_hook(agent, messages, sender, None)

        # Check that tool_name is recorded
        tool_call_entries = [
            e for e in agent.audit_trail if e.action_kind == "tool_call"
        ]
        assert len(tool_call_entries) > 0
        assert tool_call_entries[0].tool_name == "run_code"


# ── Budget Limit Integration Tests ───────────────────────────────────────────


class TestBudgetLimitIntegration:
    """Tests for budget_limit parameter integration."""

    def test_budget_limit_configures_guard(self) -> None:
        """budget_limit parameter configures the guard's budget manager."""
        agent = TealTigerAuditAgent(name="executor", budget_limit=5.0)
        state = agent.guard.get_budget_state("executor")
        assert state.budget_limit == 5.0
        assert state.current_spend == 0.0

    def test_budget_limit_zero_spend_initially(self) -> None:
        """Budget starts at zero spend when configured."""
        agent = TealTigerAuditAgent(name="executor", budget_limit=10.0)
        state = agent.guard.get_budget_state("executor")
        assert state.remaining_budget == 10.0

    def test_no_budget_without_parameter(self) -> None:
        """Without budget_limit, no budget constraint is applied."""
        agent = TealTigerAuditAgent(name="coder")
        state = agent.guard.get_budget_state("coder")
        assert state.budget_limit is None
        assert state.remaining_budget is None


# ── ConversableAgent Kwargs Passthrough Tests ─────────────────────────────────


class TestKwargsPassthrough:
    """Tests that ConversableAgent kwargs are passed through unchanged."""

    def test_multiple_kwargs_accepted(self) -> None:
        """Multiple kwargs can be passed without error."""
        # These kwargs are typical ConversableAgent params
        agent = TealTigerAuditAgent(
            name="coder",
            system_message="You are a helpful coder",
            max_consecutive_auto_reply=10,
            human_input_mode="NEVER",
            llm_config={"model": "gpt-4"},
            code_execution_config={"work_dir": "/tmp"},
        )
        assert agent.name == "coder"
        # Guard should still be functional
        assert isinstance(agent.guard, TealTigerGuard)

    def test_kwargs_do_not_interfere_with_guard(self) -> None:
        """ConversableAgent kwargs don't break guard registration."""
        agent = TealTigerAuditAgent(
            name="agent",
            system_message="test",
            is_termination_msg=lambda msg: False,
        )
        assert "agent" in agent.guard.attached_agents

    def test_engine_kwarg_goes_to_guard_not_parent(self) -> None:
        """engine param is consumed by TealTigerAuditAgent, not passed to parent."""
        engine = make_mock_engine()
        agent = TealTigerAuditAgent(name="agent", engine=engine)
        assert agent.guard.engine is engine


# ── Policy Mode Integration Tests ─────────────────────────────────────────────


class TestPolicyModeIntegration:
    """Tests for TealTigerAuditAgent with policy engine."""

    def test_enforce_mode_blocks_denied_calls(self) -> None:
        """In ENFORCE mode with DENY engine, tool calls are blocked."""
        engine = make_mock_engine(
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
        )
        agent = TealTigerAuditAgent(
            name="executor",
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )
        sender = type("MockSender", (), {"name": "user"})()

        messages = [make_tool_call_message("run_code", {"code": "rm -rf /"})]
        result = agent.guard._reply_hook(agent, messages, sender, None)

        # (True, message) means blocked
        assert result[0] is True
        assert "GOVERNANCE DENIAL" in str(result[1])

    def test_monitor_mode_allows_denied_calls(self) -> None:
        """In MONITOR mode with DENY engine, tool calls pass through."""
        engine = make_mock_engine(
            action=GovernanceAction.DENY,
            risk_score=80,
            reason_codes=["POLICY_VIOLATION"],
        )
        agent = TealTigerAuditAgent(
            name="executor",
            engine=engine,
            mode=GovernanceMode.MONITOR,
        )
        sender = type("MockSender", (), {"name": "user"})()

        messages = [make_tool_call_message("run_code", {"code": "rm -rf /"})]
        result = agent.guard._reply_hook(agent, messages, sender, None)

        # (False, None) means pass through
        assert result == (False, None)
