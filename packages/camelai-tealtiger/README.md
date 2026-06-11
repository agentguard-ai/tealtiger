# camelai-tealtiger

Deterministic governance hook for [CAMEL-AI](https://github.com/camel-ai/camel) multi-agent systems — policy enforcement, PII detection, cost tracking, kill switch, and structured audit evidence.

**No LLM in the governance path.** All policy evaluation is deterministic, adding <2ms latency.

[![PyPI](https://img.shields.io/pypi/v/camelai-tealtiger)](https://pypi.org/project/camelai-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/camelai-tealtiger)](https://pypi.org/project/camelai-tealtiger/)
[![Coverage](https://codecov.io/gh/agentguard-ai/tealtiger/branch/main/graph/badge.svg?flag=camelai-tealtiger)](https://app.codecov.io/gh/agentguard-ai/tealtiger?flags%5B0%5D=camelai-tealtiger)

## Installation

```bash
pip install camelai-tealtiger
```

## Quick Start

### Zero-Config Mode (Observe)

Add governance to any CAMEL-AI multi-agent system with zero configuration. In this mode, TealTiger observes all traffic, tracks cost estimates, detects PII, and allows everything through — producing structured audit entries for observability.

```python
from camelai_tealtiger import TealTigerAgentHook

hook = TealTigerAgentHook()

# Before each agent step
decision = hook.pre_step(
    agent_id="assistant-001",
    step_content="Summarize this document about AI safety...",
    tool_name="web_search",
    tool_args={"query": "AI safety papers"},
    agent_role="researcher",
)
# decision["action"] == "ALLOW"
# decision["pii_detected"] == []
# decision["cost_tracked"] == 0.000025
# decision["teec"]["namespace"] == "teec.camelai"

# After each agent step
hook.post_step(
    agent_id="assistant-001",
    step_result="Here is the summary of 3 papers...",
    token_usage={"prompt_tokens": 200, "completion_tokens": 150},
)

# Access cost summary
print(hook.summary)  # Per-agent cost, step counts, PII findings
```

### Policy Mode (Enforce)

When you provide a `TealEngine` instance, the hook evaluates configured policies and blocks steps that violate governance rules.

```python
from tealtiger import TealEngine
from camelai_tealtiger import TealTigerAgentHook, GovernanceDenyError

engine = TealEngine(policies=[
    {"type": "cost_limit", "max_per_session": 5.00},
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
])

hook = TealTigerAgentHook(
    engine=engine,
    mode="ENFORCE",
    task_prompt="Research AI safety",
    society_id="research-team-001",
)

try:
    decision = hook.pre_step(
        agent_id="agent-1",
        step_content="Process this request",
        agent_role="researcher",
    )
except GovernanceDenyError as e:
    print(f"Blocked: {e.decision['reason']}")
```

## Features

| Feature | Zero-Config | Policy Mode |
|---------|:-----------:|:-----------:|
| PII detection (email, SSN, credit card, phone, IP) | ✅ | ✅ |
| Cost tracking per agent/session/task | ✅ | ✅ |
| Structured audit entries | ✅ | ✅ |
| Correlation IDs (UUID v4) | ✅ | ✅ |
| TEEC namespace (teec.camelai) | ✅ | ✅ |
| Kill switch (freeze/unfreeze) | ✅ | ✅ |
| Behavioral baseline | ✅ | ✅ |
| Policy enforcement (DENY/ALLOW) | — | ✅ |
| Fail-closed on engine error | — | ✅ |
| Role validation (allowlist) | ✅ | ✅ |
| Risk scoring | ✅ | ✅ |

## Hook API

### `pre_step(agent_id, step_content, tool_name=None, tool_args=None, agent_role=None, role_type=None)`

Evaluate governance before an agent step. Returns a decision dict. Raises `GovernanceDenyError` in ENFORCE mode when blocked.

### `post_step(agent_id, step_result, token_usage=None, agent_role=None, role_type=None)`

Track cost and audit after an agent step completes. Accepts optional `token_usage` dict for accurate cost tracking.

### `freeze(agent_id)` / `unfreeze(agent_id)`

Kill switch — blocks all subsequent `pre_step` calls for the specified agent. `unfreeze` restores normal operation.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `audit_trail` | `List[AuditEntry]` | Full audit trail of governance decisions |
| `summary` | `Dict[str, AgentSummary]` | Cost/step counts per agent |
| `cumulative_cost` | `float` | Total tracked cost for the session |
| `session_id` | `str` | Session identifier |

### `get_baseline()`

Returns a behavioral baseline summary per agent, including average cost per step, common tools, PII frequency, and typical risk scores.

## Constructor Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `engine` | `TealEngine \| None` | `None` | TealEngine for policy evaluation |
| `mode` | `str` | `"OBSERVE"` | Mode: `OBSERVE`, `MONITOR`, or `ENFORCE` |
| `cost_per_1k_tokens` | `float` | `0.002` | Estimated cost per 1000 tokens |
| `session_id` | `str \| None` | Auto-generated | Session identifier |
| `society_id` | `str \| None` | `None` | Multi-agent society/group identifier |
| `task_prompt` | `str \| None` | `None` | Task prompt (hashed for TEEC) |
| `role_allowlist` | `List[str] \| None` | `None` | Allowed agent roles |

## Governance Modes

- **OBSERVE** — Zero-config default. Allow all, track cost, detect PII, produce audit entries.
- **MONITOR** — Policy mode with logging only. Evaluate policies but allow all requests through.
- **ENFORCE** — Production mode. Block steps that violate policies. Fail-closed on engine errors.

## TEEC Namespace (teec.camelai)

Every audit entry includes TEEC (Typed Evidence & Evidence Contract) fields:

```python
{
    "teec": {
        "namespace": "teec.camelai",
        "session_id": "550e8400-e29b-41d4-a716-446655440000",
        "step_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "task_prompt": "a3f2b8c1...",  # SHA-256 hash
        "agent_role": "researcher",
        "role_type": "assistant",
        "society_id": "debate-team-001"
    }
}
```

## Kill Switch

Emergency agent termination without restarting the system:

```python
hook = TealTigerAgentHook(mode="ENFORCE")

# Agent misbehaving? Freeze it immediately
hook.freeze("rogue-agent-001")

# All subsequent steps for this agent are blocked
# Other agents continue normally

# Restore when ready
hook.unfreeze("rogue-agent-001")
```

## Role Validation

Restrict which roles can operate in your multi-agent system:

```python
hook = TealTigerAgentHook(
    mode="ENFORCE",
    role_allowlist=["assistant", "critic", "researcher"],
)

# Allowed
hook.pre_step(agent_id="a1", step_content="...", agent_role="assistant")

# Blocked — raises GovernanceDenyError
hook.pre_step(agent_id="a2", step_content="...", agent_role="admin")
```

## Audit Entry Structure

Every evaluation produces a structured audit entry:

```python
{
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp_ms": 1709234567890.0,
    "action": "ALLOW",
    "mode": "OBSERVE",
    "phase": "pre_step",
    "agent_id": "assistant-001",
    "reason": "Allowed: zero-config observe mode",
    "reason_codes": ["OBSERVE_PASSTHROUGH"],
    "risk_score": 0,
    "pii_detected": [],
    "cost_tracked": 0.000025,
    "cumulative_cost": 0.000075,
    "evaluation_time_ms": 0.38,
    "teec": {
        "namespace": "teec.camelai",
        "session_id": "...",
        "step_id": "..."
    },
    "metadata": {
        "step_count": 3,
        "tool_name": "web_search",
        "tool_args": {"query": "..."},
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

PII findings are reported in audit entries with redacted values. In OBSERVE/MONITOR modes, steps proceed normally with PII flagged in the audit trail.

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
