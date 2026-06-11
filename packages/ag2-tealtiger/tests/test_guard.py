"""Tests for TealTigerGuard core — attach, detach, and initialization.

Validates:
- Task 6.1: __init__ with all parameters, attach/detach mechanics
- Requirements: 1.1, 1.2, 1.3, 14.3
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.budget_manager import BudgetStateManager
from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.teec_builder import TEECContextBuilder
from ag2_tealtiger.types import GovernanceMode


# ── Inline helpers for test isolation (mirror conftest factories) ──────────────


class _MockConversableAgent:
    """Lightweight mock of AG2's ConversableAgent for unit testing."""

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

    @property
    def registered_reply_funcs(self) -> list[dict[str, Any]]:
        return self._reply_funcs


class _MockTealEngine:
    """Minimal mock TealEngine for init tests."""

    def evaluate(self, **kwargs: Any) -> dict[str, Any]:
        return {"action": "ALLOW", "risk_score": 0, "reason_codes": [], "reason": "ok"}


class TestTealTigerGuardInit:
    """Test TealTigerGuard initialization and default values."""

    def test_default_initialization(self) -> None:
        """Guard initializes in observe mode with sensible defaults."""
        guard = TealTigerGuard()

        assert guard.engine is None
        assert guard.mode == GovernanceMode.OBSERVE
        assert guard.cost_per_1k_tokens == 0.002
        assert guard.default_expiry_seconds == 3600
        assert guard.fail_closed is True

    def test_initialization_with_engine(self) -> None:
        """Guard accepts a TealEngine instance and custom mode."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.ENFORCE,
        )

        assert guard.engine is engine
        assert guard.mode == GovernanceMode.ENFORCE

    def test_initialization_with_custom_params(self) -> None:
        """Guard accepts all custom initialization parameters."""
        engine = _MockTealEngine()
        guard = TealTigerGuard(
            engine=engine,
            mode=GovernanceMode.MONITOR,
            cost_per_1k_tokens=0.01,
            default_expiry_seconds=7200,
            fail_closed=False,
        )

        assert guard.engine is engine
        assert guard.mode == GovernanceMode.MONITOR
        assert guard.cost_per_1k_tokens == 0.01
        assert guard.default_expiry_seconds == 7200
        assert guard.fail_closed is False

    def test_internal_state_initialized(self) -> None:
        """Guard initializes all required internal state components."""
        guard = TealTigerGuard()

        # Frozen agents set
        assert isinstance(guard._frozen_agents, set)
        assert len(guard._frozen_agents) == 0

        # Audit trail
        assert isinstance(guard._audit_trail, list)
        assert len(guard._audit_trail) == 0

        # Budget manager
        assert isinstance(guard._budget_manager, BudgetStateManager)

        # Decision manager
        assert isinstance(guard._decision_manager, DecisionReceiptManager)

        # TEEC builder
        assert isinstance(guard._teec_builder, TEECContextBuilder)

        # Attached agents
        assert isinstance(guard._attached_agents, dict)
        assert len(guard._attached_agents) == 0

    def test_decision_manager_uses_configured_expiry(self) -> None:
        """DecisionReceiptManager is initialized with guard's expiry setting."""
        guard = TealTigerGuard(default_expiry_seconds=1800)
        assert guard._decision_manager.default_expiry_seconds == 1800

    def test_audit_trail_property_returns_list(self) -> None:
        """audit_trail property returns the internal list."""
        guard = TealTigerGuard()
        assert guard.audit_trail is guard._audit_trail

    def test_attached_agents_property_returns_copy(self) -> None:
        """attached_agents property returns a copy of the internal dict."""
        guard = TealTigerGuard()
        result = guard.attached_agents
        assert result == {}
        # Should be a copy, not the same object
        assert result is not guard._attached_agents


class TestTealTigerGuardAttach:
    """Test TealTigerGuard.attach() — register_reply hook registration."""

    def test_attach_registers_reply_at_position_zero(self) -> None:
        """attach() registers the reply hook at highest priority (position=0)."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        guard.attach(agent)

        # Verify reply was registered
        assert len(agent.registered_reply_funcs) == 1
        registered = agent.registered_reply_funcs[0]
        # Bound methods create new objects on access, so compare __func__
        assert registered["reply_func"].__func__ is TealTigerGuard._reply_hook
        assert registered["trigger"] is None

    def test_attach_tracks_agent(self) -> None:
        """attach() adds the agent to the attached_agents tracking."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="reviewer")

        guard.attach(agent)

        assert "reviewer" in guard._attached_agents
        assert guard._attached_agents["reviewer"] is agent

    def test_attach_multiple_agents(self) -> None:
        """attach() supports attaching multiple agents to the same guard."""
        guard = TealTigerGuard()
        agent_a = _MockConversableAgent(name="coder")
        agent_b = _MockConversableAgent(name="reviewer")
        agent_c = _MockConversableAgent(name="executor")

        guard.attach(agent_a)
        guard.attach(agent_b)
        guard.attach(agent_c)

        assert len(guard._attached_agents) == 3
        assert "coder" in guard._attached_agents
        assert "reviewer" in guard._attached_agents
        assert "executor" in guard._attached_agents

        # Each agent gets its own reply hook registered
        assert len(agent_a.registered_reply_funcs) == 1
        assert len(agent_b.registered_reply_funcs) == 1
        assert len(agent_c.registered_reply_funcs) == 1

    def test_attach_duplicate_raises_value_error(self) -> None:
        """attach() raises ValueError when agent is already attached."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        guard.attach(agent)

        with pytest.raises(ValueError, match="already attached"):
            guard.attach(agent)

    def test_attach_registers_at_position_zero_with_existing_hooks(self) -> None:
        """attach() inserts at position 0 even if other hooks exist."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        # Pre-register a dummy reply function
        agent.register_reply(trigger=None, reply_func=lambda *a: (False, None), position=0)
        assert len(agent.registered_reply_funcs) == 1

        guard.attach(agent)

        # Guard's hook should be at position 0 (first)
        assert len(agent.registered_reply_funcs) == 2
        assert agent.registered_reply_funcs[0]["reply_func"].__func__ is TealTigerGuard._reply_hook

    def test_attached_agents_property_after_attach(self) -> None:
        """attached_agents property reflects attached state."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="planner")

        guard.attach(agent)

        result = guard.attached_agents
        assert "planner" in result
        assert result["planner"] is agent


class TestTealTigerGuardDetach:
    """Test TealTigerGuard.detach() — reply hook removal."""

    def test_detach_removes_reply_hook(self) -> None:
        """detach() removes the registered reply function from the agent."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        guard.attach(agent)
        assert len(agent.registered_reply_funcs) == 1

        guard.detach(agent)
        assert len(agent.registered_reply_funcs) == 0

    def test_detach_removes_from_tracking(self) -> None:
        """detach() removes the agent from the attached_agents dict."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        guard.attach(agent)
        assert "coder" in guard._attached_agents

        guard.detach(agent)
        assert "coder" not in guard._attached_agents

    def test_detach_unattached_raises_value_error(self) -> None:
        """detach() raises ValueError when agent is not attached."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        with pytest.raises(ValueError, match="not attached"):
            guard.detach(agent)

    def test_detach_preserves_other_hooks(self) -> None:
        """detach() only removes the guard's hook, leaving others intact."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        # Register a separate hook first
        other_hook = lambda *a: (False, None)
        agent.register_reply(trigger=None, reply_func=other_hook, position=0)

        # Attach guard (inserts at position 0)
        guard.attach(agent)
        assert len(agent.registered_reply_funcs) == 2

        # Detach should only remove the guard's hook
        guard.detach(agent)
        assert len(agent.registered_reply_funcs) == 1
        assert agent.registered_reply_funcs[0]["reply_func"] is other_hook

    def test_detach_allows_reattach(self) -> None:
        """After detach(), the same agent can be re-attached."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")

        guard.attach(agent)
        guard.detach(agent)

        # Should not raise
        guard.attach(agent)
        assert "coder" in guard._attached_agents
        assert len(agent.registered_reply_funcs) == 1

    def test_detach_one_agent_preserves_others(self) -> None:
        """detach() only removes the specified agent, others remain attached."""
        guard = TealTigerGuard()
        agent_a = _MockConversableAgent(name="coder")
        agent_b = _MockConversableAgent(name="reviewer")

        guard.attach(agent_a)
        guard.attach(agent_b)

        guard.detach(agent_a)

        assert "coder" not in guard._attached_agents
        assert "reviewer" in guard._attached_agents
        assert len(agent_b.registered_reply_funcs) == 1


class TestTealTigerGuardReplyHookStub:
    """Test the _reply_hook stub behavior."""

    def test_reply_hook_returns_passthrough(self) -> None:
        """_reply_hook stub returns (False, None) to pass through."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")
        sender = _MockConversableAgent(name="user")

        result = guard._reply_hook(
            recipient=agent,
            messages=[{"role": "user", "content": "hello"}],
            sender=sender,
            config=None,
        )

        assert result == (False, None)

    def test_reply_hook_signature_matches_ag2(self) -> None:
        """_reply_hook accepts the AG2-expected parameters."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")
        sender = _MockConversableAgent(name="user")

        # Should not raise — all AG2 expected params provided
        should_terminate, reply = guard._reply_hook(
            recipient=agent,
            messages=[
                {"role": "assistant", "content": None, "tool_calls": []},
            ],
            sender=sender,
            config={"custom": "config"},
        )

        assert isinstance(should_terminate, bool)
        assert reply is None

    def test_reply_hook_with_none_messages(self) -> None:
        """_reply_hook handles None messages gracefully."""
        guard = TealTigerGuard()
        agent = _MockConversableAgent(name="coder")
        sender = _MockConversableAgent(name="user")

        result = guard._reply_hook(
            recipient=agent,
            messages=None,
            sender=sender,
            config=None,
        )

        assert result == (False, None)
