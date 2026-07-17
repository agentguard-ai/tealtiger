# Issue Title

feat: Add TealTiger governance integration for deterministic policy enforcement

# Issue Body

## Summary

We've published [`tealtiger-adk`](https://pypi.org/project/tealtiger-adk/) — a standalone governance callback package that integrates with Google ADK's `before_tool_callback` / `after_tool_callback` hooks to provide deterministic policy enforcement, PII detection, cost tracking, and audit evidence for ADK agents.

## What it does

`tealtiger-adk` provides a `TealTigerCallback` class that plugs into ADK's existing callback system:

```python
from google.adk import Agent
from tealtiger_adk import TealTigerCallback

governance = TealTigerCallback(
    policies=[
        {"type": "pii_block", "categories": ["ssn", "credit_card"]},
        {"type": "cost_limit", "max_per_session": 5.00},
        {"type": "tool_allowlist", "allowed": ["google_search", "code_*"]},
        {"type": "secret_detection"},
    ],
    mode="ENFORCE",  # OBSERVE | MONITOR | ENFORCE
)

agent = Agent(
    model="gemini-2.0-flash",
    tools=[google_search, code_execution],
    before_tool_callback=governance.before_tool,
    after_tool_callback=governance.after_tool,
)
```

## Key Features

| Feature | Description |
|---------|-------------|
| PII Detection | Block SSN, credit cards, emails, phone numbers, IP addresses |
| Secret Detection | Prevent API key leaks (OpenAI, GitHub, AWS, Google, Groq) |
| Cost Tracking | Per-session budget limits with automatic enforcement |
| Tool Allowlisting | Restrict tools with wildcard support |
| Kill Switch | Instant freeze/unfreeze of agent tool access |
| Audit Trail | Structured decision log with correlation IDs and risk scores |

## Architecture

- **Zero LLM in governance path** — all evaluation is deterministic regex/rule-based
- **Sub-millisecond overhead** — <0.1ms per evaluation (30 tests pass in <1s total)
- **Three modes**: OBSERVE (log only), MONITOR (log + warn), ENFORCE (log + block)
- **Native ADK integration** — uses `before_tool_callback`/`after_tool_callback` exactly as designed

## Why this matters for ADK users

1. **Compliance** — Prove governance was applied (audit trail with correlation IDs)
2. **Safety** — Prevent PII/secrets from leaking through tool calls
3. **Cost control** — Budget limits prevent runaway agent costs
4. **Kill switch** — Emergency stop without redeploying

## Installation

```bash
pip install tealtiger-adk
```

## Links

- PyPI: https://pypi.org/project/tealtiger-adk/
- Source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-adk
- TealTiger: https://tealtiger.ai
- Docs: https://docs.tealtiger.ai/integrations/google-adk

## Request

Would the team be open to:
1. Listing `tealtiger-adk` in the ADK ecosystem/integrations documentation?
2. Any feedback on how we're using the callback API — happy to adjust to better fit ADK patterns.

We're part of NVIDIA Inception and have existing integrations with LangChain, Haystack, AG2, CrewAI, Strands, and PydanticAI.

## Labels

`enhancement`, `integration`
