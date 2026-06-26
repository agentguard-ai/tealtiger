"""Tests for TealTigerCallback — LlamaIndex governance integration.

Covers the 7 acceptance criteria:
1. OBSERVE mode records without changing behavior
2. ENFORCE mode denies before dispatch
3. Denied retriever does not fetch
4. Changed args produce different digest
5. Policy timeout fails closed
6. Result requires proposed_call_id
7. Secrets redacted but digest stable
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest

# Note: conftest.py pre-mocks llama_index.core modules before this import
from llamaindex_tealtiger import GovernanceDenyError, TealTigerCallback
from llamaindex_tealtiger.callback import ADAPTER_SOURCE, GovernanceMode


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_event_type(name: str) -> Any:
    """Get the CBEventType value from the callback module."""
    import llamaindex_tealtiger.callback as cb_mod

    return getattr(cb_mod.CBEventType, name)


# ─── Test 1: OBSERVE mode records without changing behavior ───────────────────


class TestObserveModeRecordsWithoutChangingBehavior:
    """OBSERVE mode logs decisions but never blocks, even for blocklisted tools."""

    def test_blocklisted_tool_allowed_in_observe(self) -> None:
        """A blocklisted tool is still allowed through in OBSERVE mode."""
        cb = TealTigerCallback(
            mode="OBSERVE",
            policies=[{"type": "tool_blocklist", "tools": ["dangerous_tool"]}],
        )

        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "dangerous_tool", "input": {"x": 1}}}

        # Should NOT raise
        result = cb.on_event_start(event_type, payload, event_id="e1")

        assert result == "e1"
        assert len(cb.decisions) == 1
        assert cb.decisions[0].action == "DENY"  # records the denial
        assert cb.decisions[0].mode == "OBSERVE"
        assert cb.decisions[0].adapter_source == ADAPTER_SOURCE

    def test_observe_tracks_cost(self) -> None:
        """OBSERVE mode still tracks cost accumulation."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("LLM")

        cb.on_event_start(event_type, {"model": "gpt-4"}, event_id="e1")

        assert cb.total_cost > 0

    def test_observe_detects_pii(self) -> None:
        """OBSERVE mode detects PII in args."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {
            "tool": {
                "name": "search",
                "input": {"query": "Contact me at user@example.com"},
            }
        }

        cb.on_event_start(event_type, payload, event_id="e1")

        assert len(cb.decisions) == 1
        assert len(cb.decisions[0].pii_findings) > 0
        assert cb.decisions[0].pii_findings[0]["type"] == "email"


# ─── Test 2: ENFORCE mode denies before dispatch ──────────────────────────────


class TestEnforceModeDeniesBeforeDispatch:
    """ENFORCE mode raises GovernanceDenyError for policy violations."""

    def test_blocklisted_tool_raises(self) -> None:
        """Blocklisted tool raises GovernanceDenyError in ENFORCE mode."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_blocklist", "tools": ["rm_rf"]}],
        )

        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "rm_rf", "input": {"path": "/"}}}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="e1")

        assert exc_info.value.decision["action"] == "DENY"
        assert "TOOL_BLOCKED" in exc_info.value.decision["reason_codes"]
        assert exc_info.value.decision["adapter_source"] == ADAPTER_SOURCE

    def test_allowlist_violation_raises(self) -> None:
        """Tool not in allowlist raises GovernanceDenyError in ENFORCE mode."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_allowlist", "tools": ["search", "calc"]}],
        )

        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "delete_all", "input": {}}}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="e1")

        assert "TOOL_NOT_ALLOWED" in exc_info.value.decision["reason_codes"]

    def test_allowed_tool_passes(self) -> None:
        """Allowed tool does not raise in ENFORCE mode."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_allowlist", "tools": ["search"]}],
        )

        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {"q": "hello"}}}

        result = cb.on_event_start(event_type, payload, event_id="e1")
        assert result == "e1"
        assert cb.decisions[0].action == "ALLOW"


# ─── Test 3: Denied retriever does not fetch ──────────────────────────────────


class TestDeniedRetrieverDoesNotFetch:
    """When retriever is denied in ENFORCE mode, it cannot execute."""

    def test_retriever_blocked_by_allowlist(self) -> None:
        """Retriever event blocked when 'retriever' not in tool allowlist."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_allowlist", "tools": ["llm"]}],
        )

        event_type = _get_event_type("RETRIEVE")
        payload = {"query_str": "What is TealTiger?"}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="r1")

        # The retriever never executes — error raised BEFORE dispatch
        assert exc_info.value.decision["action"] == "DENY"
        assert "TOOL_NOT_ALLOWED" in exc_info.value.decision["reason_codes"]

    def test_retriever_blocked_by_blocklist(self) -> None:
        """Retriever explicitly blocklisted cannot run."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_blocklist", "tools": ["retriever"]}],
        )

        event_type = _get_event_type("RETRIEVE")
        payload = {"query_str": "Sensitive query"}

        with pytest.raises(GovernanceDenyError):
            cb.on_event_start(event_type, payload, event_id="r1")

    def test_retriever_allowed_when_in_allowlist(self) -> None:
        """Retriever passes when explicitly allowed."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_allowlist", "tools": ["retriever", "llm"]}],
        )

        event_type = _get_event_type("RETRIEVE")
        payload = {"query_str": "How does governance work?"}

        result = cb.on_event_start(event_type, payload, event_id="r1")
        assert result == "r1"


# ─── Test 4: Changed args produce different digest ────────────────────────────


class TestChangedArgsProduceDifferentDigest:
    """Different tool arguments must produce different params_hash values."""

    def test_different_args_different_hash(self) -> None:
        """Two calls with different args produce different params_hash."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        payload_a = {"tool": {"name": "search", "input": {"query": "hello"}}}
        payload_b = {"tool": {"name": "search", "input": {"query": "world"}}}

        cb.on_event_start(event_type, payload_a, event_id="e1")
        cb.on_event_start(event_type, payload_b, event_id="e2")

        hash_a = cb.decisions[0].params_hash
        hash_b = cb.decisions[1].params_hash

        assert hash_a is not None
        assert hash_b is not None
        assert hash_a != hash_b

    def test_same_args_same_hash(self) -> None:
        """Two calls with identical args produce the same params_hash."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        payload = {"tool": {"name": "search", "input": {"query": "hello"}}}

        cb.on_event_start(event_type, payload, event_id="e1")
        cb.on_event_start(event_type, payload, event_id="e2")

        assert cb.decisions[0].params_hash == cb.decisions[1].params_hash

    def test_key_order_does_not_affect_hash(self) -> None:
        """Params hash uses canonical JSON — key order is irrelevant."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        payload_a = {"tool": {"name": "t", "input": {"a": 1, "b": 2}}}
        payload_b = {"tool": {"name": "t", "input": {"b": 2, "a": 1}}}

        cb.on_event_start(event_type, payload_a, event_id="e1")
        cb.on_event_start(event_type, payload_b, event_id="e2")

        assert cb.decisions[0].params_hash == cb.decisions[1].params_hash

    def test_hash_is_sha256(self) -> None:
        """Params hash is a valid SHA-256 hex digest (64 characters)."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        payload = {"tool": {"name": "t", "input": {"key": "value"}}}
        cb.on_event_start(event_type, payload, event_id="e1")

        h = cb.decisions[0].params_hash
        assert h is not None
        assert len(h) == 64
        # Verify it matches manual computation
        canonical = json.dumps({"key": "value"}, sort_keys=True, separators=(",", ":"))
        expected = hashlib.sha256(canonical.encode()).hexdigest()
        assert h == expected


# ─── Test 5: Policy timeout fails closed ──────────────────────────────────────


class TestPolicyTimeoutFailsClosed:
    """When the policy engine times out, the system must fail closed (DENY)."""

    def test_engine_timeout_raises_deny(self) -> None:
        """Engine raising TimeoutError results in DENY in ENFORCE mode."""
        engine = MagicMock()
        engine.evaluate.side_effect = TimeoutError("Policy evaluation timed out")

        cb = TealTigerCallback(mode="ENFORCE", engine=engine)
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {"q": "test"}}}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="e1")

        assert exc_info.value.decision["action"] == "DENY"
        assert "POLICY_TIMEOUT" in exc_info.value.decision["reason_codes"]

    def test_engine_timeout_in_observe_records_deny(self) -> None:
        """Engine timeout in OBSERVE mode records DENY but doesn't raise."""
        engine = MagicMock()
        engine.evaluate.side_effect = TimeoutError("Timeout")

        cb = TealTigerCallback(mode="OBSERVE", engine=engine)
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {"q": "test"}}}

        # Should NOT raise in OBSERVE mode
        result = cb.on_event_start(event_type, payload, event_id="e1")
        assert result == "e1"
        assert cb.decisions[0].action == "DENY"
        assert "POLICY_TIMEOUT" in cb.decisions[0].reason_codes

    def test_engine_generic_error_fails_closed(self) -> None:
        """Any engine exception results in fail-closed (DENY)."""
        engine = MagicMock()
        engine.evaluate.side_effect = RuntimeError("Connection refused")

        cb = TealTigerCallback(mode="ENFORCE", engine=engine)
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {}}}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="e1")

        assert "POLICY_ERROR" in exc_info.value.decision["reason_codes"]


# ─── Test 6: Result requires proposed_call_id ─────────────────────────────────


class TestResultRequiresProposedCallId:
    """Every governance decision must include a proposed_call_id for tracing."""

    def test_decision_has_proposed_call_id(self) -> None:
        """Standard ALLOW decision includes proposed_call_id."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {"q": "test"}}}

        cb.on_event_start(event_type, payload, event_id="e1")

        decision = cb.decisions[0]
        assert decision.proposed_call_id is not None
        assert len(decision.proposed_call_id) == 36  # UUID format

    def test_deny_decision_has_proposed_call_id(self) -> None:
        """DENY decision also includes proposed_call_id."""
        cb = TealTigerCallback(
            mode="ENFORCE",
            policies=[{"type": "tool_blocklist", "tools": ["bad_tool"]}],
        )
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "bad_tool", "input": {}}}

        with pytest.raises(GovernanceDenyError) as exc_info:
            cb.on_event_start(event_type, payload, event_id="e1")

        assert "proposed_call_id" in exc_info.value.decision
        assert len(exc_info.value.decision["proposed_call_id"]) == 36

    def test_each_call_gets_unique_proposed_call_id(self) -> None:
        """Each evaluation generates a unique proposed_call_id."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {"tool": {"name": "search", "input": {"q": "test"}}}

        cb.on_event_start(event_type, payload, event_id="e1")
        cb.on_event_start(event_type, payload, event_id="e2")

        id_1 = cb.decisions[0].proposed_call_id
        id_2 = cb.decisions[1].proposed_call_id

        assert id_1 != id_2


# ─── Test 7: Secrets redacted but digest stable ───────────────────────────────


class TestSecretsRedactedButDigestStable:
    """Secrets are detected/counted but the params_hash is computed on raw args."""

    def test_secrets_are_detected(self) -> None:
        """Secret patterns in args are detected and counted."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")
        payload = {
            "tool": {
                "name": "deploy",
                "input": {
                    "config": "api_key=sk-abcdefghijklmnopqrstuvwxyz123456"
                },
            }
        }

        cb.on_event_start(event_type, payload, event_id="e1")

        decision = cb.decisions[0]
        assert decision.secrets_detected > 0

    def test_digest_stable_regardless_of_secrets(self) -> None:
        """Params hash is computed on raw args (not redacted), so it's stable."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        args = {"token": "ghp_AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDDEEEE"}
        payload = {"tool": {"name": "git_push", "input": args}}

        cb.on_event_start(event_type, payload, event_id="e1")

        decision = cb.decisions[0]
        # Hash should match manual computation on raw args
        canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        expected_hash = hashlib.sha256(canonical.encode()).hexdigest()

        assert decision.params_hash == expected_hash
        assert decision.secrets_detected > 0

    def test_same_secret_args_produce_same_hash(self) -> None:
        """Repeated calls with same secret-bearing args yield same digest."""
        cb = TealTigerCallback(mode="OBSERVE")
        event_type = _get_event_type("FUNCTION_CALL")

        args = {"key": "Bearer eyJhbGciOiJIUzI1NiJ9.test.signature"}
        payload = {"tool": {"name": "api_call", "input": args}}

        cb.on_event_start(event_type, payload, event_id="e1")
        cb.on_event_start(event_type, payload, event_id="e2")

        assert cb.decisions[0].params_hash == cb.decisions[1].params_hash
        assert cb.decisions[0].secrets_detected > 0
