# Zero Config Template

Use `preset="zero-config"` when you want the explicit template form of
observe-only TealTiger governance.

## What It Does

- Allows all text through unchanged.
- Detects PII and records telemetry.
- Tracks estimated and actual token cost.
- Produces structured audit entries with no blocking.

## Usage

```python
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

guard = TealTigerGovernanceComponent(preset="zero-config")
result = guard.run(text="Contact Jane at jane@example.com.")

assert result["text"] == "Contact Jane at jane@example.com."
assert result["decision"]["action"] == "ALLOW"
```

## Detects And Blocks

This template detects PII for telemetry, but it intentionally does not block or
modify the request.
