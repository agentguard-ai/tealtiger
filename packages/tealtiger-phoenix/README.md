# tealtiger-phoenix

**Governance spans in [Arize Phoenix](https://github.com/Arize-ai/phoenix) LLM trace viewer** — see why tool calls were blocked, which policies fired, and what governance costs look like, directly in your traces.

[![PyPI](https://img.shields.io/pypi/v/tealtiger-phoenix)](https://pypi.org/project/tealtiger-phoenix/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)

Part of the [TealTiger](https://tealtiger.ai) ecosystem — deterministic AI agent governance.

---

## What it does

`tealtiger-phoenix` exports TealTiger governance decisions as OpenTelemetry spans that Phoenix auto-ingests. Every ALLOW, DENY, or MONITOR decision appears inline with your LLM traces — answering **"why didn't this tool call happen?"** directly in the trace viewer.

## Installation

```bash
pip install tealtiger-phoenix arize-phoenix-otel
```

## Quick Start

```python
import os
from openai import OpenAI
from phoenix.otel import register
from tealtiger_phoenix import PhoenixGovernanceSpanExporter
from tealtiger import observe

# 1. Register Phoenix tracer
tracer_provider = register(project_name="governed-agent")

# 2. Create governance span exporter
exporter = PhoenixGovernanceSpanExporter()

# 3. Wrap your LLM client with TealTiger governance
client = observe(
    OpenAI(api_key=os.environ["OPENAI_API_KEY"]),
    guardrails={"pii_detection": True, "cost_limit": 5.00},
    on_decision=exporter.export,
)

# 4. Use normally — governance spans appear in Phoenix
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Summarize this data"}],
)
```

Open Phoenix at `http://localhost:6006` — you'll see governance spans alongside your LLM spans.

## How it looks in Phoenix

Each governance decision creates a span with:

| Attribute | Example |
|-----------|---------|
| `tealtiger.governance.action` | `DENY` |
| `tealtiger.governance.reason_codes` | `["PII_DETECTED:ssn"]` |
| `tealtiger.governance.risk_score` | `90` |
| `tealtiger.governance.tool_name` | `send_email` |
| `tealtiger.governance.mode` | `ENFORCE` |
| `tealtiger.governance.evaluation_time_ms` | `0.42` |
| `tealtiger.governance.cost_tracked` | `0.002` |
| `tealtiger.governance.cumulative_cost` | `1.50` |

**DENY** decisions show as ERROR spans (red in Phoenix).  
**ALLOW** decisions show as OK spans (green).  
**MONITOR** decisions show as UNSET spans (yellow).

## Configuration

```python
exporter = PhoenixGovernanceSpanExporter(
    # Custom tracer name (default: "tealtiger.governance")
    tracer_name="tealtiger.governance",

    # Custom span name (default: "tealtiger.governance.decision")
    span_name="tealtiger.governance.decision",

    # Only record DENY/MONITOR decisions to reduce noise (default: True)
    record_allows=False,

    # Include cost tracking attributes (default: True)
    include_cost=True,
)
```

## Usage with TealEngine

```python
from tealtiger_phoenix import PhoenixGovernanceSpanExporter

exporter = PhoenixGovernanceSpanExporter()

# Works with any TealTiger governance callback
engine = TealEngine(
    policies=[...],
    on_decision=exporter.export,
)
```

## Usage with Google ADK + TealTiger

```python
from tealtiger_adk import TealTigerCallback
from tealtiger_phoenix import PhoenixGovernanceSpanExporter

exporter = PhoenixGovernanceSpanExporter()

governance = TealTigerCallback(
    policies=[{"type": "pii_block", "categories": ["ssn"]}],
    mode="ENFORCE",
    on_decision=exporter.export,  # Sends to Phoenix
)
```

## Batch Export

```python
# Export multiple decisions at once
exporter.export_batch(decisions_list)

# Check counters
print(f"Exported: {exporter.decision_count}")
print(f"Denied: {exporter.deny_count}")
```

## Requirements

- Python 3.10+
- `opentelemetry-api >= 1.20.0`
- `opentelemetry-sdk >= 1.20.0`
- `arize-phoenix-otel >= 0.16.0` (for Phoenix setup)

## Links

- 📖 [TealTiger Documentation](https://docs.tealtiger.ai)
- 🔭 [Phoenix Documentation](https://docs.arize.com/phoenix)
- 🐙 [GitHub](https://github.com/agentguard-ai/tealtiger)
- 📦 [PyPI](https://pypi.org/project/tealtiger-phoenix/)
- 🌐 [tealtiger.ai](https://tealtiger.ai)

## License

Apache 2.0 — see [LICENSE](LICENSE).
