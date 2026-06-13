"""Haystack agent loop circuit breaker example.

Run with:
    pip install haystack-ai tealtiger-haystack
    python examples/agent_circuit_breaker.py
"""

from __future__ import annotations

from haystack import Pipeline, component

from haystack_integrations.components.connectors.tealtiger import TealTigerCircuitBreaker


@component
class SimulatedToolAgent:
    """Small stand-in for an agent that repeatedly calls tools."""

    def __init__(self) -> None:
        self._iteration = 0

    @component.output_types(text=str)
    def run(self, prompt: str) -> dict[str, object]:
        """Return a synthetic tool result for one loop step."""
        self._iteration += 1
        return {
            "text": f"iteration={self._iteration}; prompt={prompt}",
        }


def build_pipeline() -> Pipeline:
    """Build a one-step agent pipeline guarded by TealTigerCircuitBreaker."""
    pipeline = Pipeline()
    pipeline.add_component("agent", SimulatedToolAgent())
    pipeline.add_component(
        "circuit_breaker",
        TealTigerCircuitBreaker(
            max_cost_per_session=0.50,
            max_consecutive_failures=2,
            max_iterations=4,
            action_on_break="terminate",
            cost_per_1k_tokens=1.0,
        ),
    )
    pipeline.connect("agent.text", "circuit_breaker.text")
    return pipeline


if __name__ == "__main__":
    guarded_agent = build_pipeline()

    for _ in range(10):
        result = guarded_agent.run(
            {
                "agent": {"prompt": "research next action"},
                "circuit_breaker": {
                    "token_usage": {"total_tokens": 180},
                    "success": True,
                },
            }
        )
        breaker = result["circuit_breaker"]
        print(breaker["message"])
        if not breaker["should_continue"]:
            print(breaker["audit"])
            break
