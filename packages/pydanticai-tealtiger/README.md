# pydanticai-tealtiger

**Deterministic governance guard for [Pydantic AI](https://ai.pydantic.dev/) agents** — policy enforcement, PII detection, cost tracking, kill switch, and structured audit evidence.

No LLM in the governance path. All policy evaluation is deterministic, adding <2ms latency per call.

[![PyPI](https://img.shields.io/pypi/v/pydanticai-tealtiger)](https://pypi.org/project/pydanticai-tealtiger/)
[![Python](https://img.shields.io/pypi/pyversions/pydanticai-tealtiger)](https://pypi.org/project/pydanticai-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Installation

```bash
pip install pydanticai-tealtiger
```

## Quick Start

```python
from pydantic_ai import Agent
from pydanticai_tealtiger import TealTigerGuard

# Zero-config: observe, track cost, detect PII, allow all
guard = TealTigerGuard()

agent = Agent('openai:gpt-4', deps_type=TealTigerGuard)

@agent.tool
async def search(ctx, query: str) -> str:
    # Governance check before execution
    ctx.deps.evaluate(tool="search", args={"query": query})
    result = perform_search(query)
    # Record cost after execution
    ctx.deps.post_call(tool_name="search", result=result)
    return result

# Run with governance
result = await agent.run("Find AI safety papers", deps=guard)

# Inspect governance data
print(guard.cumulative_cost)
print(guard.audit_trail)
print(guard.summary)
```

## Features

| Feature | Description |
|---------|-------------|
| **Zero-config mode** | Observe all tool calls, track cost, detect PII — no setup required |
| **Policy mode** | Evaluate TealEngine policies, block on DENY in ENFORCE mode |
| **PII detection** | Detect email, SSN, credit card, phone, IP in tool arguments |
| **Cost tracking** | Per-tool, per-session cost accumulation |
| **Budget limits** | Set max spend per session — deny when exceeded |
| **Tool allowlist** | Restrict which tools can be invoked |
| **Kill switch** | `freeze()` / `unfreeze()` to halt all tool execution |
| **Audit trail** | Structured entries with UUID v4 correlation IDs |
| **TEEC namespace** | `teec.pydanticai` evidence contract fields |

## Governance Modes

| Mode | Behavior |
|------|----------|
| `OBSERVE` | Allow all, log decisions, track cost (default) |
| `MONITOR` | Allow all, log denials as warnings |
| `ENFORCE` | Block denied actions, raise `GovernanceDenyError` |

## Usage Patterns

### Policy Mode with TealEngine

```python
from tealtiger import TealEngine
from pydanticai_tealtiger import TealTigerGuard

engine = TealEngine(policies=[
    {"type": "cost_limit", "max_per_session": 5.00},
    {"type": "pii_block", "action": "DENY"},
])

guard = TealTigerGuard(engine=engine, mode="ENFORCE")
```

### Tool Allowlist

```python
guard = TealTigerGuard(
    mode="ENFORCE",
    tool_allowlist=["search", "compute", "read_file"],
)
```

### Budget Limit

```python
guard = TealTigerGuard(
    mode="ENFORCE",
    budget_limit=1.00,  # $1.00 max per session
)
```

### Kill Switch

```python
guard = TealTigerGuard(mode="ENFORCE")

# Emergency stop — blocks all subsequent calls
guard.freeze()

# Resume operations
guard.unfreeze()
```

### pre_call / post_call Pattern

```python
@agent.tool
async def my_tool(ctx, arg: str) -> str:
    # pre_call is an alias for evaluate
    ctx.deps.pre_call(tool_name="my_tool", args={"arg": arg})

    result = do_work(arg)

    # Record actual cost
    ctx.deps.post_call(
        tool_name="my_tool",
        result=result,
        token_usage={"total_tokens": 500},
    )
    return result
```

## API Reference

### `TealTigerGuard`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `engine` | `TealEngine \| None` | `None` | Policy engine for evaluation |
| `mode` | `str` | `"OBSERVE"` | Governance mode |
| `cost_per_1k_tokens` | `float` | `0.002` | Cost estimation rate |
| `session_id` | `str \| None` | auto-generated | Session identifier |
| `tool_allowlist` | `list[str] \| None` | `None` | Allowed tool names |
| `budget_limit` | `float \| None` | `None` | Max cost per session (USD) |

### Methods

| Method | Description |
|--------|-------------|
| `evaluate(tool, args, agent_id)` | Evaluate governance before tool execution |
| `pre_call(tool_name, args)` | Alias for `evaluate()` |
| `post_call(tool_name, result, token_usage)` | Record cost after tool execution |
| `freeze()` | Activate kill switch |
| `unfreeze()` | Deactivate kill switch |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `audit_trail` | `list[AuditEntry]` | Full governance audit trail |
| `summary` | `dict[str, ToolSummary]` | Cost/call counts per tool |
| `cumulative_cost` | `float` | Total session cost |
| `session_id` | `str` | Session identifier |

## Development

```bash
cd packages/pydanticai-tealtiger
pip install -e ".[dev]"
pytest
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
