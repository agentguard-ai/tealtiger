---
layout: post
title: "TealTiger × Dakera: Governance State That Survives Restarts"
date: 2026-06-15
author: Naga Satish
tags: [integration, dakera, governance, persistence, multi-agent]
description: "How Dakera's agent-scoped memory layer gives TealTiger's deterministic governance state persistence across restarts, migrations, and horizontal scaling."
---

# TealTiger × Dakera: Governance State That Survives Restarts

TealTiger's governance middleware evaluates policies in under 5ms — deterministic, no LLM in the path. But until now, governance state lived in-memory. Process restarts meant cost budgets reset to zero, decision receipts vanished, and delegation chains broke.

Today we're announcing the **Dakera integration** — the first persistent backend for TealTiger's governance layer. Shipped in `dakera v0.12.1`, available now.

```bash
pip install dakera[tealtiger]
```

![TealTiger × Dakera Architecture](/assets/images/tealtiger-dakera-architecture.svg)

## The Problem: Governance Amnesia

In production multi-agent systems, governance state matters:

- **Cost tracking** — "Agent X has spent $4.80 of its $5.00 budget this session"
- **Decision receipts** — "This exact request was already denied 30 seconds ago"
- **Delegation chains** — "Agent B was delegated read-only scope by Agent A"

With in-memory storage, all three reset on restart. Your agent that was 96% through its budget suddenly has a fresh $5.00 allowance. A denied request that was correctly blocked gets re-evaluated and might pass under slightly different conditions.

## The Solution: Dakera as Governance Backend

[Dakera](https://dakera.ai) is a self-hosted AI agent memory server — single Docker container, no external dependencies. It provides:

- **Agent-scoped isolation** — queries for one agent never return another's state
- **Decay-weighted retention** — critical DENY decisions persist longer than routine ALLOWs
- **Knowledge graph** — traversable delegation chains via typed edges
- **Sub-30ms queries** — fast enough for the governance hot path

## Three Components Shipped

### 1. DakeraCostStorage

Implements all 8 methods of TealTiger's `CostStorage` ABC:

```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import DakeraCostStorage
from tealtiger import TealOpenAI, TealOpenAIConfig

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")
cost_storage = DakeraCostStorage(client)

# Every LLM call's cost persists across restarts
teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
```

### 2. DakeraDecisionStore

Governance decisions stored with importance-tiered retention:

| Decision | Importance | Effect |
|----------|-----------|--------|
| DENY | 0.95 | Persists longest — audit trail |
| REQUIRE_APPROVAL | 0.90 | Stays until resolved |
| ALLOW | 0.80 | Normal retention |

The `is_terminal()` check correctly distinguishes pending states from terminal ones — `REQUIRE_APPROVAL` returns `False` because it's waiting for a reviewer, not settled.

### 3. DakeraDelegationHelper

Delegation chains as knowledge graph edges:

```python
from dakera.integrations.tealtiger import DakeraDelegationHelper

delegation = DakeraDelegationHelper(client)

# Store: Agent A delegates to Agent B
await delegation.link_delegation(child_id=b_decision_id, parent_id=a_decision_id)

# Traverse: reconstruct the full chain
chain = await delegation.get_delegation_chain("agent-b", root_id, max_depth=5)
```

## The Key Architectural Constraint

Credit to [@rpelevin](https://github.com/rpelevin) for this invariant:

> **Storage = evidence/continuity, NOT authority.**

The storage layer answers:
- "Has this decision already reached a terminal state?" → idempotency
- "What delegation chain was in force?" → evidence for new evaluation

It does NOT answer: "Is this new action authorized?" — that always requires a fresh policy evaluation.

A stored ALLOW from yesterday cannot authorize today's action. The middleware remains stateless per-evaluation. Storage informs the decision; it doesn't make it.

## What This Enables

| Before (in-memory) | After (Dakera) |
|---|---|
| Budget resets on restart | Budget persists |
| Decision history lost on migration | Full receipt chain available |
| Each process has isolated state | Shared governance state |
| Manual log reconstruction for audits | Query by agent, time, action type |
| Retry status unknown | Idempotency check returns prior outcome |

## Try It

```bash
# Start Dakera (single container, no deps)
git clone https://github.com/Dakera-AI/dakera-deploy.git
cd dakera-deploy && docker compose up -d

# Install
pip install dakera[tealtiger] tealtiger
```

## Links

- [Dakera integration page](https://dakera.ai/integrations/tealtiger)
- [Dakera blog post](https://dakera.ai/blog/dakera-tealtiger-integration)
- [Design discussion](https://github.com/Dakera-AI/dakera-deploy/discussions/169)
- [TealTiger integration docs](https://github.com/agentguard-ai/tealtiger/blob/main/docs/integrations/dakera.md)
- [AG2 governance thread](https://github.com/ag2ai/ag2/issues/2967) — where the architecture was designed

---

*TealTiger is an open-source AI agent security platform (Apache 2.0). Deterministic governance, guardrails, cost tracking, and policy management for LLM applications.*
