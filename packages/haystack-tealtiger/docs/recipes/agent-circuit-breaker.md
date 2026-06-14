# Recipe B: Infinite Agent Loop Circuit Breaker

Use `TealTigerCircuitBreaker` inside Haystack agent or tool-calling loops to
stop runaway cost and repeated failures before they burn through a session
budget.

The component is stateful for one session. Each loop step calls `run(...)` with
the current tool result, optional token usage, and success/failure status. The
component returns `should_continue`, an action (`continue`, `terminate`, or
`refer`), a clear message, and structured audit data showing the iteration that
triggered the break.

## Install

```bash
pip install haystack-ai tealtiger-haystack
```

## Pipeline

```python
from haystack import Pipeline, component
from haystack_integrations.components.connectors.tealtiger import TealTigerCircuitBreaker


@component
class ToolCallingAgent:
    @component.output_types(text=str)
    def run(self, prompt: str) -> dict[str, object]:
        # Replace this with your Haystack agent or tool-calling component.
        return {"text": f"tool result for {prompt}"}


pipeline = Pipeline()
pipeline.add_component("agent", ToolCallingAgent())
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

for _ in range(10):
    result = pipeline.run({
        "agent": {"prompt": "research next action"},
        "circuit_breaker": {
            "token_usage": {"total_tokens": 180},
            "success": True,
        },
    })
    breaker = result["circuit_breaker"]
    if not breaker["should_continue"]:
        print(breaker["message"])
        print(breaker["audit"])
        break
```

## Break Actions

`action_on_break="terminate"` clears downstream text and stops automated loop
execution. This is the right default for production systems.

`action_on_break="refer"` preserves the current text and marks the audit entry
with `human_escalation=True`. Use this when the next step should be handled by a
human reviewer instead of another autonomous agent iteration.

## Audit Trail

Every call appends a structured audit entry:

```python
{
    "iteration": 3,
    "action": "terminate",
    "triggered": True,
    "trigger_reason": "cost",
    "message": "Circuit breaker triggered: cost exceeded $0.50",
    "reason_codes": ["COST_EXCEEDED"],
    "cost_tracked": 0.18,
    "cumulative_cost": 0.54,
    "consecutive_failures": 0,
    "human_escalation": False,
}
```

Use `export_audit_trail("audit.jsonl")` to persist the session trail and
`reset()` before starting a new independent session.
