# Agent Loop Safe Template

Use `preset="agent-loop-safe"` for agent loops where runaway cost or repeated
automation should stop deterministically.

## What It Does

- Enforces a default session budget of `$0.50`.
- Enforces a default maximum of 10 governance evaluations per session.
- Produces structured audit evidence for every loop step.
- Keeps all behavior deterministic and independent of an LLM.

## Usage

```python
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

guard = TealTigerGovernanceComponent(
    preset="agent-loop-safe",
    cost_per_1k_tokens=1.0,
    raise_on_deny=False,
)
result = guard.run(text="tool output", token_usage={"total_tokens": 501})

assert result["decision"]["action"] == "DENY"
assert "BUDGET_LIMIT" in result["decision"]["reason_codes"]
```

## Detects And Blocks

This template blocks requests when cumulative tracked cost exceeds the default
budget or the session exceeds the default evaluation cap.
