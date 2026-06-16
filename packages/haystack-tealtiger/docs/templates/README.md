# Pre-Built Policy Templates

TealTiger Haystack templates package common enterprise guardrail settings under
one `preset` parameter:

```python
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

guard = TealTigerGovernanceComponent(preset="financial-rag")
```

## Templates

| Preset | Use Case | Behavior |
|--------|----------|----------|
| `healthcare-guard` | Healthcare support and RAG | Redacts PHI/PII and marks restricted data |
| `financial-rag` | Financial retrieval pipelines | Blocks prompt injection and records data-boundary matches |
| `agent-loop-safe` | Agent and tool loops | Blocks excessive session cost or iteration count |
| `eu-ai-act` | Regulated automated decisions | Requires human escalation for high-risk decisions |
| `zero-config` | Observe-only rollout | Allows all text while recording telemetry |
