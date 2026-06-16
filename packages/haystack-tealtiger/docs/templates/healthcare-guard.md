# Healthcare Guard Template

Use `preset="healthcare-guard"` for healthcare RAG or support paths that may
handle PHI or regulated customer records.

## What It Does

- Detects emails, phone numbers, SSNs, credit cards, IP addresses, and related PII.
- Redacts detected PII with `[REDACTED]` before downstream components receive text.
- Marks audit metadata with `data_classification="restricted"`.
- Keeps deterministic audit receipts for every decision.

## Usage

```python
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

guard = TealTigerGovernanceComponent(preset="healthcare-guard")
result = guard.run(text="Patient Jane: jane@example.com, SSN 123-45-6789")

assert result["decision"]["action"] == "MODIFY"
assert "[REDACTED]" in result["text"]
```

## Detects And Blocks

This template detects PHI/PII and redacts it. It does not block clean requests
by default because the common healthcare workflow is sanitize-then-answer.
