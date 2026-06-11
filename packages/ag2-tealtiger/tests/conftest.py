"""Shared fixtures for ag2-tealtiger tests.

Provides mock TealEngine factories, AG2 agent factories, and
common test utilities used across the test suite.
"""

from __future__ import annotations

from typing import Any

import pytest

from ag2_tealtiger.guard import TealTigerGuard
from ag2_tealtiger.types import (
    GovernanceAction,
    GovernanceMode,
)


# ── Mock TealEngine Factories ─────────────────────────────────────────────────


class MockTealEngine:
    """Mock TealEngine that returns configurable decisions.

    Provides a drop-in replacement for tealtiger.TealEngine in tests,
    allowing deterministic governance decisions without requiring the
    full tealtiger-core dependency.

    Supports:
    - Default decision for all evaluations
    - Per-tool decision overrides
    - Per-agent decision overrides
    - Call recording for assertions
    - Error injection via should_raise flag
    """

    def __init__(
        self,
        default_action: GovernanceAction = GovernanceAction.ALLOW,
        default_risk_score: int = 0,
        default_reason_codes: list[str] | None = None,
        default_reason: str = "Mock decision",
    ) -> None:
        self.default_action = default_action
        self.default_risk_score = default_risk_score
        self.default_reason_codes = default_reason_codes or []
        self.default_reason = default_reason
        self.evaluate_calls: list[dict[str, Any]] = []
        self._override_decisions: dict[str, dict[str, Any]] = {}
        self._agent_decisions: dict[str, dict[str, Any]] = {}
        self._should_raise: Exception | None = None
        self._call_count = 0

    def set_decision_for_tool(
        self,
        tool_name: str,
        action: GovernanceAction,
        risk_score: int = 0,
        reason_codes: list[str] | None = None,
        reason: str = "Tool-specific decision",
    ) -> None:
        """Configure a specific decision outcome for a tool name."""
        self._override_decisions[tool_name] = {
            "action": action.value,
            "risk_score": risk_score,
            "reason_codes": reason_codes or [],
            "reason": reason,
        }

    def set_decision_for_agent(
        self,
        agent_id: str,
        action: GovernanceAction,
        risk_score: int = 0,
        reason_codes: list[str] | None = None,
        reason: str = "Agent-specific decision",
    ) -> None:
        """Configure a specific decision outcome for an agent identity."""
        self._agent_decisions[agent_id] = {
            "action": action.value,
            "risk_score": risk_score,
            "reason_codes": reason_codes or [],
            "reason": reason,
        }

    def set_error(self, error: Exception) -> None:
        """Configure the engine to raise an error on next evaluate call."""
        self._should_raise = error

    def clear_error(self) -> None:
        """Clear any configured error injection."""
        self._should_raise = None

    @property
    def call_count(self) -> int:
        """Number of times evaluate() has been called."""
        return self._call_count

    def evaluate(
        self,
        tool_name: str | None = None,
        args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Evaluate a governance request and return a decision.

        Checks overrides in order: error injection -> agent-specific ->
        tool-specific -> default decision.
        """
        self._call_count += 1
        self.evaluate_calls.append(
            {"tool_name": tool_name, "args": args, "context": context}
        )

        # Error injection takes priority
        if self._should_raise is not None:
            error = self._should_raise
            raise error

        # Agent-specific override (from context)
        if context and "agent_id" in context:
            agent_id = context["agent_id"]
            if agent_id in self._agent_decisions:
                return self._agent_decisions[agent_id]

        # Tool-specific override
        if tool_name and tool_name in self._override_decisions:
            return self._override_decisions[tool_name]

        # Default decision
        return {
            "action": self.default_action.value,
            "risk_score": self.default_risk_score,
            "reason_codes": self.default_reason_codes,
            "reason": self.default_reason,
        }

    def reset(self) -> None:
        """Reset all state: calls, overrides, and error injection."""
        self.evaluate_calls.clear()
        self._override_decisions.clear()
        self._agent_decisions.clear()
        self._should_raise = None
        self._call_count = 0


class ErrorTealEngine:
    """Mock TealEngine that raises exceptions on evaluate.

    Used to test fail-closed and fail-open error handling paths.
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


# ── Mock TealEngine Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def mock_engine() -> MockTealEngine:
    """Create a mock TealEngine that returns ALLOW by default."""
    return MockTealEngine()


@pytest.fixture
def deny_engine() -> MockTealEngine:
    """Create a mock TealEngine that returns DENY by default."""
    return MockTealEngine(
        default_action=GovernanceAction.DENY,
        default_risk_score=80,
        default_reason_codes=["POLICY_VIOLATION"],
        default_reason="Policy denied the action",
    )


@pytest.fixture
def refer_engine() -> MockTealEngine:
    """Create a mock TealEngine that returns REFER by default."""
    return MockTealEngine(
        default_action=GovernanceAction.REFER,
        default_risk_score=50,
        default_reason_codes=["REQUIRES_REVIEW"],
        default_reason="Action requires human review",
    )


@pytest.fixture
def error_engine() -> ErrorTealEngine:
    """Create a mock TealEngine that raises errors on evaluation."""
    return ErrorTealEngine()


def make_mock_engine(
    action: GovernanceAction = GovernanceAction.ALLOW,
    risk_score: int = 0,
    reason_codes: list[str] | None = None,
    reason: str = "Mock decision",
) -> MockTealEngine:
    """Factory function for creating MockTealEngine instances.

    Use this in property-based tests where fixtures aren't available.
    """
    return MockTealEngine(
        default_action=action,
        default_risk_score=risk_score,
        default_reason_codes=reason_codes,
        default_reason=reason,
    )


# ── TealTigerGuard Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def guard() -> TealTigerGuard:
    """Create a basic TealTigerGuard in observe mode (no engine)."""
    return TealTigerGuard()


@pytest.fixture
def enforce_guard(mock_engine: MockTealEngine) -> TealTigerGuard:
    """Create a TealTigerGuard in ENFORCE mode with mock engine."""
    return TealTigerGuard(
        engine=mock_engine,
        mode=GovernanceMode.ENFORCE,
    )


@pytest.fixture
def monitor_guard(mock_engine: MockTealEngine) -> TealTigerGuard:
    """Create a TealTigerGuard in MONITOR mode with mock engine."""
    return TealTigerGuard(
        engine=mock_engine,
        mode=GovernanceMode.MONITOR,
    )


# ── AG2 Agent Factory Fixtures ────────────────────────────────────────────────


class MockConversableAgent:
    """Lightweight mock of AG2's ConversableAgent for unit testing.

    Provides the minimal interface needed by TealTigerGuard:
    - name attribute (agent identity)
    - register_reply method
    - Configurable reply hooks list

    This avoids importing ag2 in unit tests while preserving
    the register_reply interface contract.
    """

    def __init__(self, name: str, **kwargs: Any) -> None:
        self.name = name
        self._reply_funcs: list[dict[str, Any]] = []
        self._kwargs = kwargs

    def register_reply(
        self,
        trigger: Any,
        reply_func: Any,
        position: int = 0,
        config: Any = None,
        reset_config: Any = None,
        **kwargs: Any,
    ) -> None:
        """Register a reply function — mirrors AG2's ConversableAgent API."""
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
        """Access registered reply functions for test assertions."""
        return self._reply_funcs


class MockGroupChat:
    """Lightweight mock of AG2's GroupChat for unit testing.

    Provides the minimal interface for GovernedGroupChat tests:
    - agents list
    - messages list
    - max_round configuration
    - speaker_selection_method
    """

    def __init__(
        self,
        agents: list[MockConversableAgent] | None = None,
        messages: list[dict[str, Any]] | None = None,
        max_round: int = 10,
        speaker_selection_method: str = "auto",
    ) -> None:
        self.agents = agents or []
        self.messages = messages or []
        self.max_round = max_round
        self.speaker_selection_method = speaker_selection_method


@pytest.fixture
def make_agent():
    """Factory fixture for creating MockConversableAgent instances.

    Usage:
        agent = make_agent("coder")
        agent = make_agent("reviewer", system_message="Review code")
    """

    def _factory(name: str, **kwargs: Any) -> MockConversableAgent:
        return MockConversableAgent(name=name, **kwargs)

    return _factory


@pytest.fixture
def agent_coder() -> MockConversableAgent:
    """Pre-built coder agent for common test scenarios."""
    return MockConversableAgent(name="coder")


@pytest.fixture
def agent_reviewer() -> MockConversableAgent:
    """Pre-built reviewer agent for common test scenarios."""
    return MockConversableAgent(name="reviewer")


@pytest.fixture
def agent_executor() -> MockConversableAgent:
    """Pre-built executor agent for common test scenarios."""
    return MockConversableAgent(name="executor")


@pytest.fixture
def agent_planner() -> MockConversableAgent:
    """Pre-built planner agent for common test scenarios."""
    return MockConversableAgent(name="planner")


@pytest.fixture
def multi_agent_group(
    agent_coder: MockConversableAgent,
    agent_reviewer: MockConversableAgent,
    agent_executor: MockConversableAgent,
) -> list[MockConversableAgent]:
    """A group of 3 agents for GroupChat test scenarios."""
    return [agent_coder, agent_reviewer, agent_executor]


@pytest.fixture
def large_agent_group(make_agent) -> list[MockConversableAgent]:
    """A group of 5+ agents for REFER decision test scenarios."""
    return [
        make_agent("coder"),
        make_agent("reviewer"),
        make_agent("executor"),
        make_agent("planner"),
        make_agent("critic"),
    ]


def make_mock_agent(name: str, **kwargs: Any) -> MockConversableAgent:
    """Factory function for creating MockConversableAgent in property tests.

    Use this in property-based tests where fixtures aren't available.
    """
    return MockConversableAgent(name=name, **kwargs)


# ── Test Utility Helpers ──────────────────────────────────────────────────────


def make_tool_call_message(
    tool_name: str,
    arguments: dict[str, Any] | None = None,
    sender_name: str = "user",
) -> dict[str, Any]:
    """Create a mock tool call message in AG2 format.

    AG2 represents tool calls as messages with a specific structure.
    This helper creates that structure for test assertions.
    """
    return {
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
        "name": sender_name,
    }


def make_text_message(
    content: str,
    sender_name: str = "user",
    role: str = "assistant",
) -> dict[str, Any]:
    """Create a mock text message in AG2 format."""
    return {
        "role": role,
        "content": content,
        "name": sender_name,
    }
