"""Tests for TealTigerCircuitBreaker."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from haystack_integrations.components.connectors.tealtiger import TealTigerCircuitBreaker


def test_cost_threshold_terminates_loop_with_clear_message() -> None:
    """A session stops cleanly when cumulative cost exceeds the configured cap."""
    breaker = TealTigerCircuitBreaker(
        max_cost_per_session=0.50,
        cost_per_1k_tokens=1.0,
    )

    result = breaker.run(text="tool response", token_usage={"total_tokens": 501})

    assert result["should_continue"] is False
    assert result["action"] == "terminate"
    assert result["text"] == ""
    assert result["message"] == "Circuit breaker triggered: cost exceeded $0.50"
    assert result["audit"]["triggered"] is True
    assert result["audit"]["trigger_reason"] == "cost"
    assert result["audit"]["iteration"] == 1
    assert result["audit"]["cumulative_cost"] == pytest.approx(0.501)


def test_max_iterations_terminates_on_triggering_iteration() -> None:
    """The audit entry identifies the exact iteration that tripped the breaker."""
    breaker = TealTigerCircuitBreaker(max_iterations=2)

    first = breaker.run(text="first tool call")
    second = breaker.run(text="second tool call")

    assert first["should_continue"] is True
    assert second["should_continue"] is False
    assert second["audit"]["iteration"] == 2
    assert second["audit"]["trigger_reason"] == "iterations"
    assert "max iterations reached" in second["message"]


def test_consecutive_failures_trigger_breaker() -> None:
    """Repeated failed tool calls trip the consecutive-failure guard."""
    breaker = TealTigerCircuitBreaker(max_consecutive_failures=2)

    first = breaker.run(text="tool failed", success=False)
    second = breaker.run(text="tool failed again", success=False)

    assert first["should_continue"] is True
    assert first["audit"]["consecutive_failures"] == 1
    assert second["should_continue"] is False
    assert second["audit"]["consecutive_failures"] == 2
    assert second["audit"]["trigger_reason"] == "consecutive_failures"


def test_refer_action_escalates_to_human_review() -> None:
    """Refer mode stops automation while marking the break for human escalation."""
    breaker = TealTigerCircuitBreaker(max_iterations=1, action_on_break="refer")

    result = breaker.run(text="needs escalation")

    assert result["should_continue"] is False
    assert result["action"] == "refer"
    assert result["text"] == "needs escalation"
    assert result["audit"]["human_escalation"] is True
    assert result["audit"]["reason_codes"] == ["MAX_ITERATIONS", "HUMAN_ESCALATION"]


def test_successful_call_resets_consecutive_failure_count() -> None:
    """A successful iteration resets failure streak accounting."""
    breaker = TealTigerCircuitBreaker(max_consecutive_failures=2)

    breaker.run(text="failed", success=False)
    recovered = breaker.run(text="recovered", success=True)
    failed_again = breaker.run(text="failed again", success=False)

    assert recovered["audit"]["consecutive_failures"] == 0
    assert failed_again["should_continue"] is True
    assert failed_again["audit"]["consecutive_failures"] == 1


def test_audit_trail_export_and_reset(tmp_path: Path) -> None:
    """Audit trail can be exported as JSONL and reset between sessions."""
    breaker = TealTigerCircuitBreaker(max_iterations=3)
    breaker.run(text="one")
    breaker.run(text="two")
    export_path = tmp_path / "circuit-breaker-audit.jsonl"

    count = breaker.export_audit_trail(str(export_path))
    exported = [json.loads(line) for line in export_path.read_text(encoding="utf-8").splitlines()]

    assert count == 2
    assert [entry["iteration"] for entry in exported] == [1, 2]

    breaker.reset()

    assert breaker.iteration_count == 0
    assert breaker.cumulative_cost == 0.0
    assert breaker.audit_trail == []


def test_circuit_breaker_rejects_unknown_break_action() -> None:
    """Only terminate and refer are valid break actions."""
    with pytest.raises(ValueError, match="action_on_break must be one of"):
        TealTigerCircuitBreaker(action_on_break="pause")


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"max_cost_per_session": 0}, "max_cost_per_session"),
        ({"max_consecutive_failures": 0}, "max_consecutive_failures"),
        ({"max_iterations": 0}, "max_iterations"),
        ({"cost_per_1k_tokens": 0}, "cost_per_1k_tokens"),
    ],
)
def test_circuit_breaker_rejects_non_positive_limits(
    kwargs: dict[str, float | int],
    message: str,
) -> None:
    """Circuit breaker limits must be positive."""
    with pytest.raises(ValueError, match=message):
        TealTigerCircuitBreaker(**kwargs)
