# Issue Title

feat: Add TealTiger governance spans as a community integration

# Issue Body

## Summary

We've published [`tealtiger-phoenix`](https://pypi.org/project/tealtiger-phoenix/) — a lightweight package that exports AI agent governance decisions as OpenTelemetry spans into Phoenix. This gives teams visibility into **why tool calls were blocked** directly in the Phoenix trace viewer.

## What it does

`tealtiger-phoenix` creates OTel spans for every governance decision made by [TealTiger](https://tealtiger.ai) (deterministic AI agent governance). In Phoenix, you see:

- **DENY** decisions as red ERROR spans — "tool X was blocked because PII detected"
- **ALLOW** decisions as green OK spans — "tool Y passed all policy checks"
- **MONITOR** decisions as yellow UNSET spans — "flagged but not blocked"

Each span carries attributes like `risk_score`, `reason_codes`, `evaluation_time_ms`, `cost_tracked`, and `policy_digest`.

## Usage

```python
from phoenix.otel import register
from tealtiger_phoenix import PhoenixGovernanceSpanExporter
from tealtiger import observe
from openai import OpenAI

# Register Phoenix
tracer_provider = register(project_name="governed-agent")

# Create governance exporter
exporter = PhoenixGovernanceSpanExporter()

# Wrap LLM client with governance
client = observe(
    OpenAI(),
    guardrails={"pii_detection": True, "cost_limit": 5.00},
    on_decision=exporter.export,
)

# Use normally — governance spans appear in Phoenix alongside LLM spans
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Summarize this data"}],
)
```

## Span attributes

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
| `tealtiger.governance.policy_digest` | `sha256:abc123` |

## Why this is useful for Phoenix users

1. **Explainability** — Traces show not just what happened, but why certain actions *didn't* happen
2. **Compliance** — Governance evidence lives alongside execution evidence in one viewer
3. **Debugging** — When an agent fails to complete a task, governance spans reveal if a policy blocked it
4. **Cost visibility** — Track governance-level cost limits and budget consumption per trace

## Architecture

- Pure OTel spans — uses `opentelemetry-api` and `opentelemetry-sdk`
- No Phoenix-specific code — works with any OTel-compatible backend
- Sub-millisecond overhead — deterministic evaluation, no LLM in governance path
- Zero additional dependencies beyond OTel

## Installation

```bash
pip install tealtiger-phoenix arize-phoenix-otel
```

## Links

- PyPI: https://pypi.org/project/tealtiger-phoenix/
- Source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-phoenix
- TealTiger: https://tealtiger.ai (NVIDIA Inception member)
- Docs: https://docs.tealtiger.ai

## Request

Would the Phoenix team be open to:
1. Listing `tealtiger-phoenix` in the integrations/community section of Phoenix docs?
2. Any feedback on the span attribute naming convention — happy to align with OpenInference semantic conventions if preferred.

We already have integrations with LangChain, Haystack, AG2, CrewAI, Strands, PydanticAI, Google ADK, Composio, Langfuse, AgentOps, and Opik.
