# langchain-tealtiger

Deterministic governance middleware for LangChain agents. Policy enforcement, cost limits, tool allowlisting, and audit evidence — **no LLM in the governance path**.

[![PyPI](https://img.shields.io/pypi/v/langchain-tealtiger)](https://pypi.org/project/langchain-tealtiger/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/pypi/pyversions/langchain-tealtiger)](https://pypi.org/project/langchain-tealtiger/)

## Installation

```bash
pip install langchain-tealtiger
```

## Quick Start

```python
from langchain.agents import create_agent
from langchain_tealtiger import TealTigerMiddleware

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[search, calculator, file_write],
    middleware=[
        TealTigerMiddleware(
            policies=[
                {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                {"type": "cost_limit", "max_per_session": 5.00},
                {"type": "rate_limit", "max_calls": 100, "window": "1h"},
            ],
            freeze_tools=["rm_rf", "drop_database"],
        )
    ],
)
```

That's it. Every tool call now goes through deterministic governance evaluation before execution.

## How It Works

TealTiger middleware hooks into LangChain's agent loop:

| Hook | What happens |
|------|-------------|
| `before_agent` | Initialize governance session |
| `wrap_tool_call` | **Evaluate policies before every tool call** → ALLOW / DENY |
| `after_model` | Optional PII detection on model output |
| `after_agent` | Finalize evidence trail |

```
User → Agent → Model → Tool Call → [TealTiger: ALLOW?] → Execute Tool
                                   └── [DENY] → Return denial message
```

## Policy Types

### Tool Allowlist

Only permit specific tools:

```python
{"type": "tool_allowlist", "tools": ["search", "calculator", "read_file"]}
```

### Tool Blocklist

Block specific dangerous tools:

```python
{"type": "tool_blocklist", "tools": ["delete_file", "execute_sql"]}
```

### Cost Limits

Cap spending per session or per request:

```python
{"type": "cost_limit", "max_per_session": 5.00, "max_per_request": 0.50}
```

### Rate Limits

Limit tool call frequency:

```python
{"type": "rate_limit", "max_calls": 100, "window": "1h"}
```

### FREEZE Rules

Immutable deny rules — always enforced regardless of governance mode:

```python
TealTigerMiddleware(
    freeze_tools=["rm_rf", "drop_database", "format_disk"],
)
```

## Governance Modes

| Mode | Behavior | Use case |
|------|----------|----------|
| `ENFORCE` | Block denied actions | Production |
| `MONITOR` | Allow all, log violations | Staging / testing |
| `REPORT_ONLY` | Allow all, generate reports | Initial rollout |

```python
# Start in MONITOR mode to observe, then switch to ENFORCE
TealTigerMiddleware(policies=[...], mode="MONITOR")
```

## Accessing Governance Evidence

After agent execution, access the full decision trail:

```python
middleware = TealTigerMiddleware(policies=[...])
agent = create_agent(model="...", tools=[...], middleware=[middleware])

result = agent.invoke({"messages": [HumanMessage("...")]})

# Session summary
print(middleware.summary)
# SessionSummary(total_evaluations=8, allowed=7, denied=1, session_cost=2.34)

# Full evidence trail
for decision in middleware.evidence:
    print(f"{decision.tool_name}: {decision.action} ({decision.reason})")
```

Each decision includes:
- Correlation ID (UUID) for tracing
- Evaluation time (<5ms typical)
- Triggered policies
- Risk score (0-100)
- Reason codes

## Use with LangGraph

Works seamlessly when agents are composed into LangGraph workflows:

```python
from langgraph.graph import START, StateGraph
from langchain.agents import AgentState, create_agent

governed_agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[...],
    middleware=[TealTigerMiddleware(policies=[...])],
)

graph = (
    StateGraph(AgentState)
    .add_node("agent", governed_agent)
    .add_edge(START, "agent")
    .compile()
)
```

## Key Properties

- **Deterministic**: No LLM in the governance path. Same input → same decision, every time.
- **Fast**: <5ms evaluation latency per tool call.
- **Auditable**: Full evidence trail with correlation IDs for compliance.
- **Graph-native**: Visible in LangSmith traces, works with LangGraph checkpointing.
- **Composable**: Drop into any agent, works with subgraphs.

## Related

- [TealTiger Documentation](https://docs.tealtiger.ai)
- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [LangChain Middleware Docs](https://docs.langchain.com/oss/python/langchain/middleware/overview)

## License

Apache 2.0
