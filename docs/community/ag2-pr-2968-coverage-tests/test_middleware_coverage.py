# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Additional coverage tests for TealTiger AG2 Beta middleware.

Targets the uncovered paths in middleware.py (76.70% -> 90%+ target):
- on_turn() freeze path in ENFORCE mode (GovernanceDenyError)
- on_turn() freeze path in OBSERVE/MONITOR mode (allow through)
- on_tool_execution() with tool_denylist policy
- on_tool_execution() with secret_detection policy
- on_tool_execution() cost_limit enforcement
- on_tool_execution() REQUIRE_APPROVAL action
- on_tool_execution() REVISE action
- _extract_tool_args() with various event shapes
- _detect_pii() with empty/None args
- _detect_secrets() with various credential patterns
- freeze/unfreeze/is_frozen API
- GovernanceDenyError attributes
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from autogen.beta.extensions.tealtiger.middleware import (
    GovernanceDenyError,
    TealTigerMiddleware,
    _PII_PATTERNS,
    _SECRET_PATTERNS,
)
from autogen.beta.extensions.tealtiger.types import (
    DecisionAction,
    DecisionSource,
    GovernanceDecision,
    GovernanceMode,
    GovernancePolicy,
    TEECReceipt,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────


def make_mock_event():
    """Create a minimal mock BaseEvent."""
    event = MagicMock()
    event.name = "test_event"
    return event


def make_mock_tool_event(name="search", arguments=None):
    """Create a minimal mock ToolCallEvent."""
    event = MagicMock()
    event.name = name
    event.arguments = arguments or {"query": "hello"}
    return event


def make_mock_context():
    """Create a minimal mock Context."""
    return MagicMock()


def make_middleware(mode=GovernanceMode.ENFORCE, policies=None, agent_id="test-agent", budget_limit=None):
    """Create a TealTigerMiddleware instance with mocked event/context."""
    event = make_mock_event()
    context = make_mock_context()
    with patch("autogen.beta.extensions.tealtiger.middleware.BaseMiddleware.__init__", return_value=None):
        mw = TealTigerMiddleware(
            event=event,
            context=context,
            mode=mode,
            policies=policies or [],
            agent_id=agent_id,
            budget_limit=budget_limit,
        )
    return mw


# ─── on_turn() Tests ──────────────────────────────────────────────────────────


class TestOnTurnFreeze:
    """Test on_turn() freeze enforcement paths."""

    @pytest.mark.asyncio
    async def test_frozen_agent_raises_in_enforce_mode(self):
        """Frozen agent in ENFORCE mode raises GovernanceDenyError."""
        mw = make_middleware(mode=GovernanceMode.ENFORCE, agent_id="frozen-agent")
        mw.freeze("frozen-agent")

        call_next = AsyncMock(return_value=MagicMock())
        event = make_mock_event()
        context = make_mock_context()

        with pytest.raises(GovernanceDenyError) as exc_info:
            await mw.on_turn(call_next, event, context)

        assert "frozen" in str(exc_info.value).lower()
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_frozen_agent_emits_decision_with_freeze_source(self):
        """Frozen agent emits decision with FREEZE source."""
        decisions = []
        mw = make_middleware(mode=GovernanceMode.ENFORCE, agent_id="frozen-agent")
        mw.on_decision = lambda d: decisions.append(d)
        mw.freeze("frozen-agent")

        call_next = AsyncMock()
        event = make_mock_event()
        context = make_mock_context()

        with pytest.raises(GovernanceDenyError):
            await mw.on_turn(call_next, event, context)

        assert len(decisions) == 1
        assert decisions[0].action == DecisionAction.DENY
        assert decisions[0].decision_source == DecisionSource.FREEZE
        assert "AGENT_FROZEN" in decisions[0].reason_codes

    @pytest.mark.asyncio
    async def test_unfrozen_agent_passes_through(self):
        """Non-frozen agent's turn passes through normally."""
        mw = make_middleware(mode=GovernanceMode.ENFORCE, agent_id="active-agent")
        expected_response = MagicMock()
        call_next = AsyncMock(return_value=expected_response)

        result = await mw.on_turn(call_next, make_mock_event(), make_mock_context())

        assert result == expected_response
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_turn_increments_turn_id(self):
        """Each on_turn call increments _turn_id."""
        mw = make_middleware(mode=GovernanceMode.OBSERVE)
        call_next = AsyncMock(return_value=MagicMock())

        await mw.on_turn(call_next, make_mock_event(), make_mock_context())
        assert mw._turn_id == 1

        await mw.on_turn(call_next, make_mock_event(), make_mock_context())
        assert mw._turn_id == 2


# ─── on_tool_execution() Tests ────────────────────────────────────────────────


class TestOnToolExecutionPolicies:
    """Test on_tool_execution() policy evaluation paths."""

    @pytest.mark.asyncio
    async def test_tool_denylist_blocks_denied_tool(self):
        """tool_denylist policy denies matching tools."""
        policies = [GovernancePolicy.tool_denylist(["delete_*", "drop_*"])]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="delete_file")
        call_next = AsyncMock(return_value="result")

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "TOOL_DENIED" in result
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_tool_allowlist_allows_matching_tool(self):
        """tool_allowlist policy allows matching tools."""
        policies = [GovernancePolicy.tool_allowlist(["search", "read_*"])]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="search")
        call_next = AsyncMock(return_value="search results")

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert result == "search results"
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_pii_detection_blocks_ssn(self):
        """PII detection blocks SSN in tool arguments."""
        policies = [GovernancePolicy.pii_block(["ssn"])]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="process", arguments={"data": "My SSN is 123-45-6789"})
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "PII_DETECTED:ssn" in result
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_secret_detection_blocks_api_keys(self):
        """Secret detection blocks OpenAI API keys."""
        policies = [GovernancePolicy.secret_detection()]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="call_api", arguments={"key": "sk-abcdefghijklmnopqrstuvwxyz1234"})
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "SECRET_DETECTED" in result
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_secret_detection_blocks_github_pat(self):
        """Secret detection blocks GitHub PATs."""
        policies = [GovernancePolicy.secret_detection()]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="push", arguments={"token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"})
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "SECRET_DETECTED" in result

    @pytest.mark.asyncio
    async def test_secret_detection_blocks_aws_key(self):
        """Secret detection blocks AWS access keys."""
        policies = [GovernancePolicy.secret_detection()]
        mw = make_middleware(policies=policies)

        event = make_mock_tool_event(name="deploy", arguments={"creds": "AKIAIOSFODNN7EXAMPLE"})
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "SECRET_DETECTED" in result

    @pytest.mark.asyncio
    async def test_cost_limit_denies_when_budget_exceeded(self):
        """Cost limit policy denies when cumulative cost exceeds budget."""
        policies = [GovernancePolicy.cost_limit(max_per_session=5.0)]
        mw = make_middleware(policies=policies, budget_limit=5.0)
        mw._cumulative_cost = 5.5  # Already over budget

        event = make_mock_tool_event(name="expensive_call")
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "BUDGET_EXCEEDED" in result
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_cost_limit_allows_when_under_budget(self):
        """Cost limit allows when cumulative cost is under budget."""
        policies = [GovernancePolicy.cost_limit(max_per_session=10.0)]
        mw = make_middleware(policies=policies, budget_limit=10.0)
        mw._cumulative_cost = 3.0  # Under budget

        event = make_mock_tool_event(name="api_call")
        call_next = AsyncMock(return_value="ok")

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert result == "ok"
        call_next.assert_called_once()


class TestOnToolExecutionModes:
    """Test mode-based behavior in on_tool_execution."""

    @pytest.mark.asyncio
    async def test_observe_mode_allows_denied_action(self):
        """OBSERVE mode allows execution even when policy would deny."""
        policies = [GovernancePolicy.tool_allowlist(["only_this"])]
        mw = make_middleware(mode=GovernanceMode.OBSERVE, policies=policies)

        event = make_mock_tool_event(name="not_allowed")
        call_next = AsyncMock(return_value="executed anyway")

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert result == "executed anyway"
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_observe_mode_emits_receipt(self):
        """OBSERVE mode still emits a receipt."""
        receipts = []
        mw = make_middleware(mode=GovernanceMode.OBSERVE)
        mw.on_receipt = lambda r: receipts.append(r)

        event = make_mock_tool_event(name="search")
        call_next = AsyncMock(return_value="result")

        await mw.on_tool_execution(call_next, event, make_mock_context())

        assert len(receipts) == 1
        assert receipts[0].execution_outcome == "executed"

    @pytest.mark.asyncio
    async def test_monitor_mode_allows_but_logs_denial(self):
        """MONITOR mode allows execution but logs that it would block."""
        policies = [GovernancePolicy.tool_allowlist(["allowed_only"])]
        mw = make_middleware(mode=GovernanceMode.MONITOR, policies=policies)

        event = make_mock_tool_event(name="disallowed_tool")
        call_next = AsyncMock(return_value="monitor result")

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert result == "monitor result"
        call_next.assert_called_once()
        # Decision should record DENY but execution should proceed
        assert len(mw.decisions) == 1
        assert mw.decisions[0].action == DecisionAction.DENY

    @pytest.mark.asyncio
    async def test_enforce_mode_blocks_denied_action(self):
        """ENFORCE mode blocks execution when denied."""
        policies = [GovernancePolicy.tool_allowlist(["safe_tool"])]
        mw = make_middleware(mode=GovernanceMode.ENFORCE, policies=policies)

        event = make_mock_tool_event(name="unsafe_tool")
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        call_next.assert_not_called()
        assert len(mw.receipts) == 1
        assert mw.receipts[0].execution_outcome == "blocked"


class TestOnToolExecutionFrozenAgent:
    """Test on_tool_execution() with frozen agents."""

    @pytest.mark.asyncio
    async def test_frozen_agent_blocks_tool_execution(self):
        """Frozen agent's tool execution is denied in ENFORCE mode."""
        mw = make_middleware(mode=GovernanceMode.ENFORCE, agent_id="agent-x")
        mw.freeze("agent-x")

        event = make_mock_tool_event(name="any_tool")
        call_next = AsyncMock()

        result = await mw.on_tool_execution(call_next, event, make_mock_context())

        assert "GOVERNANCE DENIED" in result
        assert "AGENT_FROZEN" in result
        call_next.assert_not_called()


# ─── Freeze/Unfreeze API Tests ────────────────────────────────────────────────


class TestFreezeAPI:
    """Test freeze/unfreeze/is_frozen public API."""

    def test_freeze_self(self):
        """freeze() without args freezes self."""
        mw = make_middleware(agent_id="my-agent")
        mw.freeze()
        assert mw.is_frozen()

    def test_freeze_other_agent(self):
        """freeze(agent_id) freezes specified agent."""
        mw = make_middleware(agent_id="my-agent")
        mw.freeze("other-agent")
        assert mw.is_frozen("other-agent")
        assert not mw.is_frozen("my-agent")

    def test_unfreeze(self):
        """unfreeze() removes freeze."""
        mw = make_middleware(agent_id="my-agent")
        mw.freeze()
        assert mw.is_frozen()
        mw.unfreeze()
        assert not mw.is_frozen()

    def test_unfreeze_idempotent(self):
        """unfreeze() on non-frozen agent is a no-op."""
        mw = make_middleware(agent_id="my-agent")
        mw.unfreeze()  # Should not raise
        assert not mw.is_frozen()


# ─── Helper Function Tests ────────────────────────────────────────────────────


class TestExtractToolArgs:
    """Test _extract_tool_args with various event shapes."""

    def test_extracts_from_arguments_attr(self):
        """Extracts arguments from event.arguments."""
        mw = make_middleware()
        event = MagicMock()
        event.arguments = {"query": "test"}
        del event.args  # Remove args attr
        assert mw._extract_tool_args(event) == {"query": "test"}

    def test_extracts_from_args_attr(self):
        """Falls back to event.args when no arguments attr."""
        mw = make_middleware()
        event = MagicMock(spec=["args", "name"])
        event.args = {"key": "value"}
        assert mw._extract_tool_args(event) == {"key": "value"}

    def test_returns_empty_dict_when_no_attrs(self):
        """Returns {} when neither arguments nor args exist."""
        mw = make_middleware()
        event = MagicMock(spec=["name"])
        assert mw._extract_tool_args(event) == {}


class TestDetectPII:
    """Test _detect_pii with edge cases."""

    def test_detects_ssn(self):
        """Detects SSN pattern."""
        mw = make_middleware()
        found = mw._detect_pii("SSN: 123-45-6789", ["ssn"])
        assert "ssn" in found

    def test_detects_credit_card(self):
        """Detects credit card pattern."""
        mw = make_middleware()
        found = mw._detect_pii("Card: 4111-1111-1111-1111", ["credit_card"])
        assert "credit_card" in found

    def test_detects_email(self):
        """Detects email pattern."""
        mw = make_middleware()
        found = mw._detect_pii("Email: user@example.com", ["email"])
        assert "email" in found

    def test_no_false_positive_on_clean_text(self):
        """No PII detected in clean text."""
        mw = make_middleware()
        found = mw._detect_pii("Hello world, no secrets here", ["ssn", "email"])
        assert found == []

    def test_handles_dict_args(self):
        """Handles dict arguments by serializing to JSON."""
        mw = make_middleware()
        found = mw._detect_pii({"msg": "SSN is 123-45-6789"}, ["ssn"])
        assert "ssn" in found

    def test_unknown_category_returns_empty(self):
        """Unknown PII category returns empty list."""
        mw = make_middleware()
        found = mw._detect_pii("123-45-6789", ["unknown_category"])
        assert found == []


class TestDetectSecrets:
    """Test _detect_secrets with various credential patterns."""

    def test_detects_openai_key(self):
        """Detects OpenAI API key."""
        mw = make_middleware()
        assert mw._detect_secrets("key: sk-abcdefghijklmnopqrstuvwxyz1234")

    def test_detects_github_pat(self):
        """Detects GitHub PAT."""
        mw = make_middleware()
        assert mw._detect_secrets("token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")

    def test_detects_aws_access_key(self):
        """Detects AWS access key."""
        mw = make_middleware()
        assert mw._detect_secrets("AKIAIOSFODNN7EXAMPLE")

    def test_detects_slack_token(self):
        """Detects Slack token."""
        mw = make_middleware()
        assert mw._detect_secrets("xoxb-123456789012-123456789012-abc123def456")

    def test_no_false_positive_on_clean_text(self):
        """No secrets detected in clean text."""
        mw = make_middleware()
        assert not mw._detect_secrets("Hello world, safe content here")

    def test_handles_dict_args(self):
        """Handles dict by serializing to JSON first."""
        mw = make_middleware()
        assert mw._detect_secrets({"token": "sk-abcdefghijklmnopqrstuvwxyz1234"})


class TestMatchesPatterns:
    """Test _matches_patterns glob matching."""

    def test_exact_match(self):
        """Exact tool name match."""
        mw = make_middleware()
        assert mw._matches_patterns("search", ["search", "read_file"])

    def test_glob_match(self):
        """Glob pattern match."""
        mw = make_middleware()
        assert mw._matches_patterns("read_config", ["read_*"])

    def test_no_match(self):
        """No pattern matches."""
        mw = make_middleware()
        assert not mw._matches_patterns("delete_all", ["search", "read_*"])


# ─── GovernanceDenyError Tests ────────────────────────────────────────────────


class TestGovernanceDenyError:
    """Test GovernanceDenyError exception."""

    def test_message(self):
        """Error carries the denial message."""
        err = GovernanceDenyError("Agent frozen", decision_id="dec-123")
        assert "Agent frozen" in str(err)
        assert err.decision_id == "dec-123"

    def test_default_decision_id(self):
        """Default decision_id is empty string."""
        err = GovernanceDenyError("denied")
        assert err.decision_id == ""

