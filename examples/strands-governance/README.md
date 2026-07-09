# Strands Agents + TealTiger Governance

> Deterministic governance for AWS Strands Agents — policy-based tool authorization, cost tracking, PII detection, and kill switch. No LLM in the governance path.

## What This Demonstrates

1. **Policy-based tool authorization** — Allow/deny tools per agent role
2. **Per-agent cost tracking** — Session-level budget with automatic deny on breach
3. **PII detection** — Block tool calls containing sensitive data (SSN, credit cards, emails)
4. **Kill switch** — Freeze/unfreeze agents at runtime
5. **Structured audit trail** — Every decision logged with correlation IDs

All governance runs in **< 5ms** using TealTiger's deterministic engine. No LLM calls in the governance path.

## Quick Start

```bash
pip install strands-agents tealtiger
```

```python
from strands import Agent
from strands_governance import TealTigerGovernanceHook

agent = Agent(
    tools=[search_tool, write_tool, delete_tool],
    hooks=[TealTigerGovernanceHook(
        mode="enforce",
        policies=[
            {"type": "tool_allowlist", "allowed": ["search_tool", "write_tool"]},
            {"type": "pii_block", "categories": ["ssn", "credit_card"]},
            {"type": "cost_limit", "max_per_session": 5.00},
        ],
    )],
)

# search_tool: allowed
# delete_tool: BLOCKED (not in allowlist)
# write_tool with SSN in args: BLOCKED (PII detected)
```

## Run the Example

```bash
# No API keys needed — uses deterministic demo mode
python strands_governance_demo.py
```

## Files

| File | Description |
|------|-------------|
| `strands_governance.py` | TealTiger governance hook for Strands (HookProvider) |
| `strands_governance_demo.py` | Full working demo with all governance features |
| `README.md` | This file |

## Governance Modes

| Mode | Behavior |
|------|----------|
| `observe` | Allow all, log decisions (zero-config visibility) |
| `monitor` | Allow all, log denials as warnings |
| `enforce` | Block denied actions, cancel tool via `event.cancel_tool` |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Strands Agent                                        │
│                                                      │
│  Model decides → BeforeToolCallEvent → Tool executes │
│                        │                             │
│                        ▼                             │
│              TealTigerGovernanceHook                  │
│              ┌─────────────────────┐                 │
│              │ Policy evaluation   │ < 5ms           │
│              │ Cost tracking       │ deterministic   │
│              │ PII detection       │ no LLM          │
│              │ Audit logging       │                 │
│              └─────────┬───────────┘                 │
│                        │                             │
│              ALLOW → proceed / DENY → cancel_tool    │
└─────────────────────────────────────────────────────┘
```

## Links

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0 governance engine
- [Strands Agents](https://strandsagents.com/) — AWS open-source agent SDK
- [Strands Hooks Documentation](https://strandsagents.com/docs/user-guide/concepts/agents/hooks/)
