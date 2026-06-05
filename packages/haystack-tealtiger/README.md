# tealtiger-haystack

Deterministic governance component for [Haystack](https://haystack.deepset.ai/) pipelines — policy enforcement, PII detection, cost tracking, and structured audit evidence.

**No LLM in the governance path.** All policy evaluation is deterministic, adding <2ms latency.

[![PyPI](https://img.shields.io/pypi/v/tealtiger-haystack)](https://pypi.org/project/tealtiger-haystack/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/tealtiger-haystack)](https://pypi.org/project/tealtiger-haystack/)

## Installation

```bash
pip install tealtiger-haystack
```

## Quick Start

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
| Cost tracking per evaluation | ✅ | ✅ |
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
- US phone numbers
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
