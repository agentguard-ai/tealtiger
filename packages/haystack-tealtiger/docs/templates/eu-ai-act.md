# EU AI Act Template

Use `preset="eu-ai-act"` when a Haystack pipeline may perform regulated or
high-risk automated decisions.

## What It Does

- Keeps audit-first deterministic receipts for every decision.
- Requires human escalation for high-risk automation language.
- Marks audit metadata with `data_classification="regulated"`.
- Adds `HUMAN_ESCALATION_REQUIRED` to denied high-risk decisions.

## Usage

```python
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

guard = TealTigerGovernanceComponent(preset="eu-ai-act", raise_on_deny=False)
result = guard.run(text="Automatically reject this candidate for hiring.")

assert result["decision"]["action"] == "DENY"
assert result["decision"]["metadata"]["human_escalation"] is True
```

## Detects And Blocks

This template blocks high-risk automated decision language involving hiring,
credit, benefits, medical, biometric, or law-enforcement contexts until a human
reviewer handles the decision.
