# LangChain Middleware Integration Plan

## Overview

LangChain v1 introduced a formal **Middleware** system for `create_agent`. TealTiger fits perfectly as a middleware that enforces deterministic governance at the tool-call and model-call boundaries.

**Target:** Get TealTiger listed in LangChain's [Community Middleware integrations page](https://docs.langchain.com/oss/python/integrations/middleware).

---

## Part 1: LangChain Middleware Interface Spec

### How LangChain Middleware Works

Middleware hooks into the agent loop at these points:

| Hook | Type | When it runs |
|------|------|--------------|
| `before_agent` | Node-style | Once before agent starts |
| `before_model` | Node-style | Before each model call |
| `after_model` | Node-style | After each model response |
| `after_agent` | Node-style | Once after agent completes |
| `wrap_model_call` | Wrap-style | Around each model call (retry, transform) |
| `wrap_tool_call` | Wrap-style | Around each tool call (intercept, deny, audit) |

### TealTiger's Natural Fit

TealTiger governance maps to these hooks:

| TealTiger Capability | LangChain Hook | Implementation |
|---------------------|----------------|----------------|
| Tool allowlisting / DENY | `wrap_tool_call` | Intercept tool call → `evaluate()` → allow or short-circuit |
| Cost tracking per request | `wrap_tool_call` + `after_model` | Track token usage + tool costs |
| PII detection on output | `after_model` | Classify model response content |
| Session TTL / rate limits | `before_model` | Check session limits before model call |
| Audit trail / evidence | `after_agent` | Export audit evidence (SARIF) at session end |
| NHI scope enforcement | `wrap_tool_call` | Verify agent identity before tool execution |
| FREEZE rules | `wrap_tool_call` | Block calls to frozen tools/paths |

---

## Part 2: Implementation — `langchain-tealtiger` Package

### Package Structure

```
langchain-tealtiger/
├── pyproject.toml
├── README.md
├── LICENSE                    # Apache 2.0
├── langchain_tealtiger/
│   ├── __init__.py
│   ├── middleware.py          # Main TealTigerMiddleware class
│   ├── _governance.py         # Core evaluate() bridge
│   ├── _types.py              # Type definitions
│   └── _evidence.py           # SARIF export utilities
└── tests/
    ├── test_middleware.py
    └── test_governance.py
```

### Core Implementation

```python
"""langchain_tealtiger/middleware.py"""

from typing import Any, Callable
from langchain.agents.middleware import (
    AgentMiddleware,
    AgentState,
    ModelRequest,
    ModelResponse,
)
from langchain.messages import AIMessage
from langchain.tools.tool_node import ToolCallRequest
from langgraph.types import Command
from langgraph.runtime import Runtime

from ._governance import TealGovernanceEngine
from ._types import GovernanceConfig, Decision


class TealTigerMiddleware(AgentMiddleware):
    """Deterministic governance middleware for LangChain agents.
    
    Enforces policy rules (tool allowlisting, cost limits, rate limits,
    PII detection, FREEZE rules) without any LLM in the governance path.
    Adds <5ms latency per evaluation.
    
    Usage:
        from langchain.agents import create_agent
        from langchain_tealtiger import TealTigerMiddleware
        
        agent = create_agent(
            model="claude-sonnet-4-6",
            tools=[...],
            middleware=[
                TealTigerMiddleware(
                    policies=[
                        {"type": "cost_limit", "max_per_session": 5.00},
                        {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                        {"type": "rate_limit", "max_calls": 100, "window": "1h"},
                    ]
                )
            ],
        )
    """

    def __init__(
        self,
        policies: list[dict[str, Any]] | None = None,
        agent_id: str | None = None,
        mode: str = "ENFORCE",  # ENFORCE | MONITOR | REPORT_ONLY
        freeze_tools: list[str] | None = None,
        max_session_cost: float | None = None,
        export_evidence: bool = True,
    ):
        self._engine = TealGovernanceEngine(
            policies=policies or [],
            mode=mode,
        )
        self._agent_id = agent_id
        self._freeze_tools = set(freeze_tools or [])
        self._max_session_cost = max_session_cost
        self._export_evidence = export_evidence
        self._session_cost = 0.0
        self._call_count = 0
        self._evidence_log: list[dict] = []

    def before_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        """Initialize governance session."""
        self._session_cost = 0.0
        self._call_count = 0
        self._evidence_log = []
        return None

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Any],
    ) -> Any:
        """Governance gate before every tool call.
        
        Evaluates policies deterministically. If DENY, short-circuits
        the tool call and returns a denial message. If ALLOW, proceeds.
        """
        tool_name = request.tool_call["name"]
        tool_args = request.tool_call["args"]

        # FREEZE check — immediate deny, no evaluation needed
        if tool_name in self._freeze_tools:
            return self._deny_tool_call(
                request, reason=f"FREEZE: tool '{tool_name}' is frozen"
            )

        # Full policy evaluation
        decision = self._engine.evaluate(
            action=f"tool.invoke",
            tool=tool_name,
            tool_params=tool_args,
            agent_id=self._agent_id,
            session_cost=self._session_cost,
            call_count=self._call_count,
        )

        # Log evidence
        self._evidence_log.append(decision.to_evidence())
        self._call_count += 1

        if decision.action == "DENY":
            return self._deny_tool_call(request, reason=decision.reason)
        elif decision.action == "MODIFY":
            # Modify tool args per policy
            modified_request = self._apply_modifications(request, decision)
            return handler(modified_request)
        else:
            # ALLOW
            result = handler(request)
            # Track cost if applicable
            if hasattr(result, "cost"):
                self._session_cost += result.cost
            return result

    def after_model(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        """Post-model governance: PII detection, content classification."""
        last_message = state["messages"][-1]
        if not isinstance(last_message, AIMessage):
            return None

        # PII/secrets check on model output
        content = last_message.content if isinstance(last_message.content, str) else ""
        classification = self._engine.classify_content(content)

        if classification.has_pii and self._engine.mode == "ENFORCE":
            # Redact and replace
            redacted = classification.redacted_content
            return {
                "messages": [AIMessage(content=redacted)],
            }

        return None

    def after_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        """Export governance evidence at session end."""
        if self._export_evidence and self._evidence_log:
            # Evidence is available for SARIF export
            pass  # Caller can access via middleware instance
        return None

    def _deny_tool_call(self, request: ToolCallRequest, reason: str) -> Any:
        """Return a ToolMessage indicating denial."""
        from langchain.messages import ToolMessage
        return ToolMessage(
            content=f"[GOVERNANCE DENIED] {reason}",
            tool_call_id=request.tool_call["id"],
        )

    def _apply_modifications(self, request: ToolCallRequest, decision: Decision) -> ToolCallRequest:
        """Apply policy modifications to tool call args."""
        # Implementation: modify args per decision.modifications
        return request

    @property
    def evidence(self) -> list[dict]:
        """Access governance evidence for export."""
        return self._evidence_log

    @property
    def session_summary(self) -> dict:
        """Get session governance summary."""
        return {
            "total_calls": self._call_count,
            "session_cost": self._session_cost,
            "denials": sum(1 for e in self._evidence_log if e.get("action") == "DENY"),
            "mode": self._engine.mode,
        }
```

### pyproject.toml

```toml
[project]
name = "langchain-tealtiger"
version = "0.1.0"
description = "Deterministic governance middleware for LangChain agents — policy enforcement, cost limits, tool allowlisting, and audit evidence without any LLM in the governance path."
readme = "README.md"
license = "Apache-2.0"
requires-python = ">=3.10"
authors = [
    {name = "TealTiger", email = "hello@tealtiger.dev"},
]
keywords = ["langchain", "governance", "security", "ai-agents", "guardrails", "middleware"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3",
    "Topic :: Security",
    "Topic :: Software Development :: Libraries",
]

dependencies = [
    "langchain>=1.0.0",
    "tealtiger>=1.1.0",
]

[project.urls]
Homepage = "https://github.com/agentguard-ai/tealtiger"
Documentation = "https://docs.tealtiger.dev"
Repository = "https://github.com/agentguard-ai/langchain-tealtiger"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

## Part 3: LangChain Docs PR

### PR Target

Repository: `github.com/langchain-ai/docs`  
File to edit: `src/oss/python/integrations/middleware/index.mdx`  
Section: Community integrations table

### Row to Add

```markdown
| TealTiger | Deterministic governance middleware. Policy enforcement, cost limits, tool allowlisting, NHI scope controls, PII detection, and SARIF audit evidence — no LLM in the governance path. | agentguard-ai/langchain-tealtiger |
```

### PR Title

```
docs: add TealTiger deterministic governance middleware to community integrations
```

### PR Description

```markdown
## Summary

Adds TealTiger to the community middleware integrations page.

**Package:** `langchain-tealtiger` (PyPI)  
**Repository:** https://github.com/agentguard-ai/langchain-tealtiger  
**License:** Apache 2.0

## What TealTiger middleware does

TealTiger provides deterministic governance for LangChain agents:

- **Tool allowlisting** — ALLOW/DENY/MODIFY decisions before every tool call
- **Cost governance** — Per-session, per-agent, and per-request cost limits
- **Rate limiting** — Configurable call limits with time windows
- **FREEZE rules** — Immutable deny rules for critical tools/paths
- **PII detection** — Content classification on model outputs
- **Audit evidence** — Structured evidence export (SARIF v2.1.0)
- **NHI scope enforcement** — Per-agent identity and scope controls

Key differentiator: No LLM in the governance path. All policy evaluation is
deterministic, adding <5ms latency per evaluation.

## Integration details

- Implements `AgentMiddleware` (class-based)
- Uses `wrap_tool_call` for tool governance
- Uses `after_model` for output classification  
- Uses `before_agent`/`after_agent` for session lifecycle
- Works with `create_agent` and LangGraph `StateGraph` composition

## Checklist

- [x] Package published to PyPI
- [x] Working integration with tests
- [x] README with usage examples
- [x] Apache 2.0 license
- [x] Actively maintained (weekly commits)
```

### Additional Docs Page (Optional — own repo)

If LangChain accepts a dedicated page (like some integrations get), here's the content for `src/oss/python/integrations/middleware/tealtiger.mdx`:

```mdx
---
title: TealTiger
description: "Deterministic governance middleware — policy enforcement, cost limits, and audit evidence for LangChain agents."
---

# TealTiger Governance Middleware

TealTiger provides deterministic governance for LangChain agents. No LLM in the governance path — all policy evaluation is rule-based, adding <5ms latency.

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
            mode="ENFORCE",
        )
    ],
)
```

## How it works

TealTiger hooks into the agent loop via LangChain's middleware system:

| Hook | What TealTiger does |
|------|-------------------|
| `before_agent` | Initialize governance session, reset counters |
| `wrap_tool_call` | Evaluate policies before each tool call → ALLOW/DENY/MODIFY |
| `after_model` | PII detection and content classification on outputs |
| `after_agent` | Export audit evidence (SARIF) |

## Governance modes

| Mode | Behavior |
|------|----------|
| `ENFORCE` | Block denied actions, redact PII |
| `MONITOR` | Allow all actions, log decisions |
| `REPORT_ONLY` | Allow all, generate reports only |

## Policy types

```python
# Tool allowlisting
{"type": "tool_allowlist", "tools": ["search", "calculator"]}

# Cost limits
{"type": "cost_limit", "max_per_session": 5.00, "max_per_request": 0.50}

# Rate limiting
{"type": "rate_limit", "max_calls": 100, "window": "1h"}

# Time-of-day restrictions
{"type": "time_restriction", "tools": ["database_write"], 
 "allowed_hours": {"start": "09:00", "end": "17:00"}}
```

## FREEZE rules

Immutable deny rules that cannot be overridden:

```python
TealTigerMiddleware(
    freeze_tools=["delete_all", "drop_table", "rm_rf"],
)
```

## Accessing audit evidence

```python
middleware = TealTigerMiddleware(...)
agent = create_agent(model="...", tools=[...], middleware=[middleware])

result = agent.invoke({"messages": [HumanMessage("...")]})

# After execution
print(middleware.session_summary)
# {"total_calls": 12, "session_cost": 1.23, "denials": 2, "mode": "ENFORCE"}

# Export SARIF evidence
sarif = middleware.export_sarif()
```

## Resources

- [GitHub](https://github.com/agentguard-ai/langchain-tealtiger)
- [TealTiger Documentation](https://docs.tealtiger.dev)
- [PyPI](https://pypi.org/project/langchain-tealtiger/)
```

---

## Part 4: Execution Checklist

| # | Step | Dependency | Est. Effort |
|---|------|-----------|-------------|
| 1 | Create `langchain-tealtiger` repo | None | 1 day |
| 2 | Implement `TealTigerMiddleware` class | Step 1 | 3-4 days |
| 3 | Write tests (unit + integration) | Step 2 | 2 days |
| 4 | Publish to PyPI | Step 3 | 1 hour |
| 5 | Open PR to `langchain-ai/docs` | Step 4 | 1 hour |
| 6 | Post update on LangChain forum thread | Step 5 | 30 min |
| 7 | (Optional) Request co-marketing | Step 5 merged | 1 email |

**Total estimated time to docs PR: ~1 week**

---

## Key Decisions Needed

1. **Package name:** `langchain-tealtiger` (matches LangChain convention `langchain-{provider}`)
2. **Repo location:** Separate repo (`agentguard-ai/langchain-tealtiger`) or monorepo subfolder?
3. **Python SDK dependency:** Does `tealtiger` Python SDK on PyPI have the `evaluate()` API needed, or does the middleware need to bundle governance logic?
4. **Minimum LangChain version:** `langchain>=1.0.0` (middleware was introduced in v1)
