# tealtiger-haystack

Deterministic governance component for [Haystack](https://haystack.deepset.ai/) pipelines — policy enforcement, PII detection, cost tracking, and structured audit evidence.

**No LLM in the governance path.** All policy evaluation is deterministic, adding <2ms latency.

[![PyPI](https://img.shields.io/pypi/v/tealtiger-haystack)](https://pypi.org/project/tealtiger-haystack/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/tealtiger-haystack)](https://pypi.org/project/tealtiger-haystack/)
[![Coverage](https://codecov.io/gh/agentguard-ai/tealtiger/branch/main/graph/badge.svg?flag=haystack-tealtiger)](https://app.codecov.io/gh/agentguard-ai/tealtiger?flags%5B0%5D=haystack-tealtiger)

## Installation

```bash
pip install tealtiger-haystack
```

## Quick Start

### Recipe B: Infinite Agent Loop Circuit Breaker

Place `TealTigerCircuitBreaker` after an agent or tool-calling component inside
a Haystack loop. It stops automation when cumulative cost, consecutive failures,
or total iterations exceed your session limits.

```python
from haystack import Pipeline, component
from haystack_integrations.components.connectors.tealtiger import TealTigerCircuitBreaker


@component
class ToolCallingAgent:
    @component.output_types(text=str)
    def run(self, prompt: str) -> dict[str, object]:
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

See the full recipe in
[`docs/recipes/agent-circuit-breaker.md`](docs/recipes/agent-circuit-breaker.md)
and the runnable example in
[`examples/agent_circuit_breaker.py`](examples/agent_circuit_breaker.py).
### Recipe A: Compliant Enterprise RAG Pipeline

Place `TealTigerPIIRedactor` after your Haystack retriever and before your
prompt or generator. Retrieved documents keep their metadata, but emails, SSNs,
credit cards, phone numbers, and API keys are replaced before the LLM sees them.

```python
from haystack import Document, Pipeline
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.utils import Secret
from haystack_integrations.components.connectors.tealtiger import TealTigerPIIRedactor

document_store = InMemoryDocumentStore()
document_store.write_documents([
    Document(content="Jane's email is jane@example.com and SSN is 123-45-6789."),
    Document(content="Support policy says never send raw PII to an LLM."),
])

prompt_template = """
Answer using only the sanitized context.

Context:
{% for document in documents %}
- {{ document.content }}
{% endfor %}

Question: {{ question }}
Answer:
"""

pipeline = Pipeline()
pipeline.add_component("retriever", InMemoryBM25Retriever(document_store=document_store))
pipeline.add_component("pii_redactor", TealTigerPIIRedactor(action="redact"))
pipeline.add_component(
    "prompt",
    PromptBuilder(
        template=prompt_template,
        required_variables=["documents", "question"],
    ),
)
pipeline.add_component(
    "generator",
    OpenAIGenerator(api_key=Secret.from_env_var("OPENAI_API_KEY")),
)

pipeline.connect("retriever.documents", "pii_redactor.documents")
pipeline.connect("pii_redactor.clean_documents", "prompt.documents")
pipeline.connect("prompt.prompt", "generator.prompt")
```

See the full recipe in
[`docs/recipes/compliant-enterprise-rag.md`](docs/recipes/compliant-enterprise-rag.md)
and the runnable example in
[`examples/compliant_enterprise_rag.py`](examples/compliant_enterprise_rag.py).

### Zero-Config Mode (Observe)

Add governance to any Haystack pipeline with zero configuration. In this mode, TealTiger observes all traffic, tracks cost estimates, detects PII, and allows everything through unchanged — producing structured audit entries for observability.

```python
from haystack import Pipeline
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

pipeline = Pipeline()
pipeline.add_component("governance", TealTigerGovernanceComponent())
pipeline.add_component("llm", your_generator)
pipeline.connect("governance.text", "llm.prompt")

result = pipeline.run({"governance": {"text": "What is the capital of France?"}})
# result["governance"]["decision"] contains:
# - correlation_id: UUID v4 for tracing
# - action: "ALLOW"
# - pii_detected: []
# - cost_tracked: 0.000014
# - cumulative_cost: 0.000014
# - evaluation_time_ms: 0.42
```

### Policy Mode (Enforce)

When you provide a `TealEngine` instance, the component evaluates configured policies and can block requests that violate governance rules.

```python
from tealtiger import TealEngine
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)

engine = TealEngine(policies=[
    {"type": "cost_limit", "max_per_session": 5.00},
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
])

pipeline = Pipeline()
pipeline.add_component(
    "governance",
    TealTigerGovernanceComponent(engine=engine, mode="ENFORCE"),
)
pipeline.add_component("llm", your_generator)
pipeline.connect("governance.text", "llm.prompt")

# Raises GovernanceDenyError if policy violated
result = pipeline.run({"governance": {"text": "Process this request"}})
```

## Features

| Feature | Zero-Config | Policy Mode |
|---------|:-----------:|:-----------:|
| PII detection (email, SSN, credit card, phone, IP) | ✅ | ✅ |
| Retrieved-document PII redaction before generation | ✅ | ✅ |
| Cost tracking per evaluation | ✅ | ✅ |
| Agent loop circuit breaking | ✅ | ✅ |
| Structured audit entries | ✅ | ✅ |
| Correlation IDs (UUID v4) | ✅ | ✅ |
| Policy enforcement (DENY/ALLOW) | — | ✅ |
| Fail-closed on engine error | — | ✅ |
| Risk scoring | ✅ | ✅ |

## Component API

### Input

| Name | Type | Description |
|------|------|-------------|
| `text` | `str` | Input text to evaluate |

### Output

| Name | Type | Description |
|------|------|-------------|
| `text` | `str` | Passthrough text (unchanged if allowed, empty if denied) |
| `decision` | `dict` | Structured audit entry with governance decision |

### Constructor Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `engine` | `TealEngine \| None` | `None` | TealEngine for policy evaluation |
| `mode` | `str` | `"OBSERVE"` | Mode: `OBSERVE`, `MONITOR`, or `ENFORCE` |
| `cost_per_1k_tokens` | `float` | `0.002` | Estimated cost per 1000 tokens |
| `raise_on_deny` | `bool` | `True` | Raise exception on DENY (vs. return empty) |
| `agent_id` | `str \| None` | Auto-generated | Agent identifier for audit correlation |

## Governance Modes

- **OBSERVE** — Zero-config default. Allow all, track cost, detect PII, produce audit entries.
- **MONITOR** — Policy mode with logging only. Evaluate policies but allow all requests through.
- **ENFORCE** — Production mode. Block requests that violate policies.

## Audit Entry Structure

Every evaluation produces a structured audit entry:

```python
{
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp_ms": 1709234567890.0,
    "action": "ALLOW",
    "mode": "OBSERVE",
    "reason": "Allowed: zero-config observe mode",
    "reason_codes": ["OBSERVE_PASSTHROUGH"],
    "risk_score": 0,
    "pii_detected": [
        {"type": "email", "start": 12, "end": 30, "redacted": "jo**********om"}
    ],
    "cost_tracked": 0.000014,
    "cumulative_cost": 0.000042,
    "evaluation_time_ms": 0.38,
    "metadata": {
        "agent_id": "haystack-pipeline-a1b2c3d4",
        "evaluation_number": 3,
        "input_length": 45,
        "estimated_tokens": 11
    }
}
```

## PII Detection

Built-in pattern detection for:
- Email addresses
- US, UK, EU, and India phone numbers
- Social Security Numbers (SSN)
- Credit card numbers
- IP addresses

PII findings are reported in audit entries with redacted values — the original text passes through unchanged in OBSERVE/MONITOR modes.

## Error Handling

In ENFORCE mode with `raise_on_deny=True`:

```python
from haystack_integrations.components.connectors.tealtiger.governance_component import (
    GovernanceDenyError,
)

try:
    result = pipeline.run({"governance": {"text": input_text}})
except GovernanceDenyError as e:
    print(f"Blocked: {e.decision['reason']}")
    print(f"Codes: {e.decision['reason_codes']}")
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy src/

# Linting
ruff check src/ tests/
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
