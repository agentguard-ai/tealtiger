# TealTiger × Dakera: Governance State That Survives Restarts

*Published: June 2026*

## The Problem

TealTiger's governance middleware evaluates policies in under 5ms — deterministic, no LLM in the path. But until now, governance state (cost records, decision receipts, delegation chains) lived in-memory. Process restarts, agent migrations, and horizontal scaling all lost that state.

For single-process prototyping, in-memory is fine. For production multi-agent systems running across multiple processes, you need governance continuity.

## The Solution: Dakera as Governance State Backend

[Dakera](https://dakera.ai) is a self-hosted AI agent memory server with agent-scoped state, decay-weighted retention, and a knowledge graph. It's the first persistent backend for TealTiger's governance layer.

```bash
pip install dakera[tealtiger]
```

Three adapter classes shipped in `dakera v0.12.1`:

- **DakeraCostStorage** — implements all 8 methods of TealTiger's `CostStorage` ABC. Per-agent cost records persist across restarts.
- **DakeraDecisionStore** — governance decisions stored with importance-tiered retention (DENY=0.95, ALLOW=0.80). Critical denials outlive routine approvals.
- **DakeraDelegationHelper** — delegation chains stored as knowledge graph edges (`delegated_from`), enabling full audit-trail traversal.

## Architecture Principle

A key design constraint (credit [@rpelevin](https://github.com/rpelevin) from the AG2 governance discussion):

**Storage = evidence/continuity, NOT authority.**

The storage layer answers:
- "Has this decision already reached a terminal state?" (idempotency)
- "What delegation chain was in force?" (evidence for new decision)

It does NOT answer: "Is this new action authorized?" — that always requires a fresh policy evaluation over the current action envelope.

This means a stored ALLOW from yesterday cannot authorize today's action. Every new request gets a fresh deterministic evaluation. Storage informs; it doesn't permit.

## Usage

```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import DakeraCostStorage

from tealtiger import TealOpenAI, TealOpenAIConfig

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")
cost_storage = DakeraCostStorage(client)

# Every LLM call's cost is now persisted in Dakera
teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
```

## What This Enables

| Scenario | Before (in-memory) | After (Dakera) |
|---|---|---|
| Process restart | Cost budgets reset to zero | Budget state preserved |
| Agent migration | Decision history lost | Full receipt chain available |
| Horizontal scaling | Each instance has its own state | Shared governance state |
| Compliance audit | Manual log reconstruction | Query by agent, time, action type |
| Retry after timeout | Unknown if already executed | Idempotency check returns prior terminal state |

## Links

- Dakera integration page: [dakera.ai/integrations/tealtiger](https://dakera.ai/integrations/tealtiger)
- Dakera blog post: [dakera.ai/blog/dakera-tealtiger-integration](https://dakera.ai/blog/dakera-tealtiger-integration)
- TealTiger integration docs: [docs/integrations/dakera.md](https://github.com/agentguard-ai/tealtiger/blob/main/docs/integrations/dakera.md)
- Design discussion: [Dakera-AI/dakera-deploy#169](https://github.com/Dakera-AI/dakera-deploy/discussions/169)
- PyPI: `pip install dakera[tealtiger]`

## What's Next

- Governance event stream integration (Dakera SSE → TealTiger SARIF export)
- Cross-agent governance network visualization
- TealTiger TypeScript SDK + Dakera JS SDK integration (PR #157 in progress)
