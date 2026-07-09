# langchain-tealtiger

[![PyPI version](https://img.shields.io/pypi/v/langchain-tealtiger.svg)](https://pypi.org/project/langchain-tealtiger/)
[![Python versions](https://img.shields.io/pypi/pyversions/langchain-tealtiger.svg)](https://pypi.org/project/langchain-tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**TealTiger governance for LangChain.** Deterministic policy enforcement, cost tracking, and audit logging as LangChain middleware. Zero-config entry point via observe mode. <5ms overhead, no LLM in the governance path.

---

## Zero-Config: Observe Mode

Drop in `TealTigerMiddleware()` with no arguments. Defaults to observe mode — full instrumentation, nothing blocked.

```python
from langchain_tealtiger import TealTigerMiddleware
from langchain_openai import ChatOpenAI

middleware = TealTigerMiddleware()  # zero config — observe mode
llm = ChatOpenAI(model="gpt-4o")

chain = middleware | llm
response = chain.invoke("Summarize this document.")
# Cost tracked. Audit logged. Behavioral baseline building. PII scanned (REPORT_ONLY).
```

---

## Progressive Disclosure

Start with zero config, add governance when you're ready.

### Level 0: Observe (no args)

```python
from langchain_tealtiger import TealTigerMiddleware

middleware = TealTigerMiddleware()
# Everything instrumented, nothing blocked
```

### Level 1: Explicit policies

```python
from langchain_tealtiger import TealTigerMiddleware

middleware = TealTigerMiddleware(
    guardrails={"pii_detection": True, "prompt_injection": True},
    budget={"max_cost_per_request": 0.50, "max_cost_per_day": 25.00},
)
```

### Level 2: FREEZE — Emergency kill switch

```python
from langchain_tealtiger import TealTigerMiddleware
from tealtiger import freeze, unfreeze

middleware = TealTigerMiddleware(
    guardrails={"pii_detection": True, "prompt_injection": True},
    budget={"max_cost_per_request": 0.50},
)

# In production — something goes wrong:
freeze()      # all governed chains halt immediately (<5ms)
unfreeze()    # resume when resolved
```

---

## Features

### Middleware Hooks
- **Pre-invocation** — Evaluate policies before the LLM call fires
- **Post-invocation** — Scan outputs for PII, secrets, policy violations
- **Error handling** — Structured audit events on failures

### Chain Governance
- Cost tracking across entire chain execution
- Per-chain and per-agent budget enforcement
- Correlation IDs propagated through chain steps
- Behavioral baseline across chain invocations

### Tool Governance
- Pre-execution policy evaluation on tool calls
- Argument-level scanning (PII, secrets, injection)
- Per-tool budget attribution
- Tool call frequency tracking in behavioral baseline

---

## Usage with LangChain Agents

```python
from langchain_tealtiger import TealTigerMiddleware
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Results for: {query}"

middleware = TealTigerMiddleware(
    guardrails={"pii_detection": True},
    budget={"max_cost_per_request": 1.00},
)

llm = ChatOpenAI(model="gpt-4o")
agent = create_tool_calling_agent(llm, [search_web], prompt)
executor = AgentExecutor(agent=agent, tools=[search_web], middleware=[middleware])

result = executor.invoke({"input": "Find recent news about AI governance"})
# Every tool call governed. Cost tracked per-tool. Full audit trail.
```

---

## Install

```bash
pip install langchain-tealtiger
```

### Dependencies

| Package | Required Version |
|---------|-----------------|
| `tealtiger` | >=1.4.0 |
| `langchain` | >=1.0.0 |
| `langchain-core` | >=0.3.0 |

---

## Configuration Reference

```python
TealTigerMiddleware(
    # Observe mode (default when no args)
    mode="observe",  # "observe" | "enforce" | "monitor"

    # Guardrails
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
        "secret_detection": True,
    },

    # Budget
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 25.00,
        "max_cost_per_session": 5.00,
    },

    # Identity
    agent_id="my-agent",
    session_id="session-123",
)
```

---

## Key Properties

- **Deterministic** — Same input + same policy = same decision, every time
- **No LLM in governance path** — Pure logic, no probabilistic filters
- **<5ms overhead** — Runs in-process, no network hops
- **Offline-capable** — No SaaS dependency
- **Apache 2.0** — Fully open source

---

## Documentation

- [TealTiger Docs](https://docs.tealtiger.ai)
- [LangChain Integration Guide](https://docs.tealtiger.ai/integrations/langchain)
- [API Reference](https://docs.tealtiger.ai/api/langchain-middleware)
- [Examples](https://github.com/agentguard-ai/tealtiger/tree/main/examples/langchain)

---

## License

Apache 2.0 — [LICENSE](https://github.com/agentguard-ai/tealtiger/blob/main/LICENSE)
