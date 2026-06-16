# TealTiger × Dakera: Governance State That Survives Restarts

**Published:** June 17, 2026  
**Author:** TealTiger Team

---

## TL;DR

TealTiger's deterministic governance now persists across process restarts, agent migrations, and horizontal scaling — via Dakera's agent-scoped memory layer. Install with `pip install dakera[tealtiger]`.

---

## The Problem

TealTiger governs AI agent actions in <5ms — enforcing tool allowlists, detecting PII, tracking cost, and producing structured audit receipts. But until now, that governance state lived in-memory: restart the process and your cost accumulators reset, decision receipts vanish, and delegation chains disappear.

For single-process prototypes, this is fine. For production multi-agent systems — where agents restart, migrate between hosts, or scale horizontally — governance continuity is a hard requirement.

## The Solution

[Dakera](https://dakera.ai) provides agent-scoped persistent memory with importance-weighted retention, semantic search, and a knowledge graph. Three adapter classes now bridge TealTiger's governance interfaces to Dakera's storage:

### DakeraCostStorage

Drop-in replacement for TealTiger's `InMemoryCostStorage`. All 8 `CostStorage` ABC methods implemented — your per-agent cost tracking now survives restarts.

```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import DakeraCostStorage
from tealtiger import TealOpenAI, TealOpenAIConfig

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")
cost_storage = DakeraCostStorage(client)

teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
# Every LLM call tracked and persisted in Dakera
```

### DakeraDecisionStore

Governance decisions persist with importance-weighted retention:
- **DENY** receipts at importance 0.95 — survive memory compaction longest
- **REQUIRE_APPROVAL** at 0.90 — stays until resolved
- **ALLOW** at 0.80 — routine decisions decay naturally

Idempotency check: `is_terminal()` returns prior terminal state for retry scenarios without re-executing the side effect.

### DakeraDelegationHelper

Delegation chains stored as typed knowledge graph edges (`delegated_from`). Traverse multi-hop delegations to answer: "who delegated authority to whom, and what scope was granted?"

## Architecture Principle

**Storage = evidence/continuity, NOT authority.**

This was the key design constraint (credit: @rpelevin from the AG2 governance discussion). A stored ALLOW decision is *not* permission to proceed. Every new action still gets a fresh deterministic evaluation. Storage answers "what was decided before?" — the middleware answers "what is authorized now?"

Three independent questions, three independent answers:
1. **Storage**: What was remembered?
2. **Middleware**: What is authorized now?
3. **Receipt**: What actually executed?

## What This Enables

| Before (in-memory) | After (Dakera backend) |
|---|---|
| Cost resets on restart | Cost accumulates across restarts |
| Decision receipts lost | Receipts persist with tiered retention |
| Delegation chains in flat JSON | Traversable knowledge graph |
| Single-process only | Horizontal scaling, agent migration |
| No semantic search | "Find decisions similar to this denied call" |

## Getting Started

```bash
# Start Dakera (single container, no external deps)
git clone https://github.com/Dakera-AI/dakera-deploy.git
cd dakera-deploy && docker compose up -d

# Install
pip install dakera[tealtiger] tealtiger
```

## Links

- [Dakera Integration Page](https://dakera.ai/integrations/tealtiger)
- [Dakera Blog: TealTiger Integration](https://dakera.ai/blog/dakera-tealtiger-integration)
- [TealTiger Integration Docs](https://github.com/agentguard-ai/tealtiger/blob/main/docs/integrations/dakera.md)
- [Design Discussion](https://github.com/Dakera-AI/dakera-deploy/discussions/169)
- [AG2 Governance Thread](https://github.com/ag2ai/ag2/issues/2967)

---

*TealTiger is an open-source AI agent governance SDK (Apache 2.0). Deterministic policy enforcement, <5ms overhead, no LLM in the governance path.*
