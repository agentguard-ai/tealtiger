# tealtiger-hindsight

**Importance-weighted governance decision memory** using [Hindsight](https://github.com/vectorize-io/hindsight) — contextual recall and natural decay for AI agent compliance.

[![PyPI](https://img.shields.io/pypi/v/tealtiger-hindsight)](https://pypi.org/project/tealtiger-hindsight/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)

Part of the [TealTiger](https://tealtiger.ai) ecosystem — deterministic AI agent governance.

---

## What it does

`tealtiger-hindsight` stores governance decisions with importance-weighted retention:

- 🔴 **Critical DENYs** (PII detected, secrets blocked) → importance 0.90 → retained for months
- 🟡 **Notable MONITORs** (flagged but allowed) → importance 0.70 → retained for weeks
- 🟢 **Routine ALLOWs** (passed all checks) → importance 0.55 → natural decay within days

Enables **contextual recall**: "what governance decisions were made for this agent in similar situations?" — informing future policy evaluation without overriding deterministic enforcement.

## Design Principle

**Storage = evidence/continuity, NOT authority.**

A stored ALLOW from yesterday cannot authorize today's action. Every new request gets a fresh deterministic evaluation. Storage informs; it doesn't permit.

## Installation

```bash
pip install tealtiger-hindsight
```

## Quick Start

```python
from hindsight_client import Hindsight
from tealtiger_hindsight import HindsightGovernanceMemory

# Connect to Hindsight
client = Hindsight(base_url="http://localhost:8888")

# Create governance memory
memory = HindsightGovernanceMemory(
    client=client,
    bank_id="governance",
)

# Store a governance decision (from TealTiger's on_decision callback)
memory.store({
    "action": "DENY",
    "correlation_id": "dec-001",
    "agent_id": "research-agent",
    "tool_name": "send_email",
    "reason_codes": ["PII_DETECTED:ssn"],
    "risk_score": 90,
    "mode": "ENFORCE",
})

# Recall past decisions for context
past_decisions = memory.recall(
    agent_id="research-agent",
    context="tool:send_email",
    limit=5,
)

# Reflect on governance patterns
insights = memory.reflect(
    agent_id="research-agent",
    query="What are the most common denial reasons?"
)
```

## With TealTiger observe()

```python
from tealtiger import observe
from tealtiger_hindsight import HindsightGovernanceMemory
from hindsight_client import Hindsight
from openai import OpenAI

client = Hindsight(base_url="http://localhost:8888")
memory = HindsightGovernanceMemory(client=client)

# Every governance decision auto-stored with importance weighting
llm = observe(
    OpenAI(),
    guardrails={"pii_detection": True},
    on_decision=memory.store,
)
```

## Custom Importance Function

Override the default importance mapping for richer decay behavior:

```python
def custom_importance(decision) -> float:
    """Custom importance: risk_score + recurrence boost."""
    base = {"DENY": 0.85, "MONITOR": 0.65, "ALLOW": 0.50}
    score = base.get(decision.get("action", "ALLOW"), 0.55)

    # Risk contributes but doesn't dominate
    risk_boost = (decision.get("risk_score", 0) / 100) * 0.15

    # Repeated patterns are more important to remember
    if decision.get("is_recurring"):
        score += 0.10

    return min(score + risk_boost, 1.0)

memory = HindsightGovernanceMemory(
    client=client,
    importance_fn=custom_importance,
)
```

## How Memory Decay Works

| Decision Type | Default Importance | Retention Behavior |
|---------------|-------------------|-------------------|
| DENY (PII, secrets) | 0.90 | Persists for months — compliance evidence |
| REFER/REQUIRE_APPROVAL | 0.85 | Persists for weeks — approval tracking |
| MONITOR (flagged) | 0.70 | Weeks — pattern detection baseline |
| ALLOW (routine) | 0.55 | Days — fades from context, doesn't pollute recall |

Hindsight's importance-based memory means routine ALLOWs naturally fade from recall context while critical DENYs remain easily retrievable for compliance audits.

## Use Cases

1. **Contextual governance**: Before evaluating a new tool call, recall similar past decisions. If an agent was denied 5 times for PII in web_search results, that context is available.
2. **Anomaly detection**: Query "agents whose denial rate spiked vs. historical baseline" — natural with importance-weighted memory.
3. **Compliance audits**: Critical DENYs persist indefinitely. `recall(min_importance=0.85)` retrieves only security-relevant events.
4. **Storage efficiency**: Routine ALLOWs decay naturally — no manual cleanup needed.

## Requirements

- Python 3.10+
- `hindsight-client >= 0.4.0`
- A running Hindsight server (or [Hindsight Cloud](https://ui.hindsight.vectorize.io/signup))

## Links

- 📖 [TealTiger Docs](https://docs.tealtiger.ai)
- 🧠 [Hindsight Docs](https://hindsight.vectorize.io)
- 🐙 [GitHub](https://github.com/agentguard-ai/tealtiger)
- 📦 [PyPI](https://pypi.org/project/tealtiger-hindsight/)
- Issue: [vectorize-io/hindsight#2284](https://github.com/vectorize-io/hindsight/issues/2284)

## License

Apache 2.0 — see [LICENSE](LICENSE).
