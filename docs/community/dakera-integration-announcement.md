# Dakera Integration — Documentation & Announcements

## 1. README Addition (for TealTiger main README)

Add under the "Framework Adapters" table in the README:

### 🔌 Persistence Backends

| Backend | Package | Install |
|---------|---------|---------|
| Dakera | dakera[tealtiger] | `pip install dakera[tealtiger]` |

### Dakera — Governance State Backend

[Dakera](https://github.com/Dakera-AI/dakera-deploy) serves as a persistent backend for TealTiger's governance state — cost records, decision receipts, and delegation chains survive process restarts, agent migrations, and horizontal scaling.

```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import DakeraCostStorage, DakeraDecisionStore

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")

# Drop-in CostStorage backend
cost_storage = DakeraCostStorage(client)

# Idempotency + audit trail
decision_store = DakeraDecisionStore(client)

# Use with TealTiger
from tealtiger import TealOpenAI, TealOpenAIConfig
teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
```

Key principle: storage provides evidence and continuity, not authority. Every new action still gets a fresh policy evaluation.

- [Dakera Python SDK](https://github.com/Dakera-AI/dakera-py)
- [Integration PR](https://github.com/Dakera-AI/dakera-py/pull/141)
- [Architecture discussion](https://github.com/Dakera-AI/dakera-deploy/discussions/169)

---

## 2. LinkedIn Announcement

```
TealTiger + Dakera — persistent governance state for multi-agent systems 🐯

When your AI agents restart, migrate, or scale horizontally — governance state shouldn't disappear.

We've partnered with Dakera (self-hosted AI agent memory server) to provide a persistent backend for TealTiger's governance layer:

→ Cost records survive process restarts
→ Decision receipts persist across agent migrations
→ Delegation chains are traversable via knowledge graph
→ Idempotency checks prevent duplicate side effects
→ Importance-weighted retention: DENY decisions outlast routine ALLOWs

Key architectural principle (credit @rpelevin): storage = evidence/continuity, not authority. A stored ALLOW is never a blanket permission — every action still gets fresh policy evaluation.

Install: pip install dakera[tealtiger]
Deploy: docker compose up (single container, no external deps)

This means:
- In-memory governance for prototyping (zero config)
- Dakera-backed governance for production (persistent, scalable)
- Same API, same middleware, same deterministic evaluation

Links:
- Integration: https://github.com/Dakera-AI/dakera-py/pull/141
- Architecture: https://github.com/Dakera-AI/dakera-deploy/discussions/169
- TealTiger: https://github.com/agentguard-ai/tealtiger
- Dakera: https://github.com/Dakera-AI/dakera-deploy

#AI #Governance #MultiAgent #OpenSource #TealTiger #Dakera
```

---

## 3. Twitter/X Announcement

```
TealTiger + Dakera 🐯

Governance state for multi-agent systems that survives restarts, migrations, and scaling.

• Cost records persist across processes
• Decision receipts with importance-weighted retention
• Delegation chains via knowledge graph
• Idempotency — no duplicate side effects

pip install dakera[tealtiger]

Storage = evidence, not authority. Fresh decision every time.

https://github.com/Dakera-AI/dakera-py/pull/141
```

---

## 4. Discord/Slack Announcement

```
🎉 New Integration: TealTiger + Dakera

Dakera (self-hosted AI agent memory server) is now an optional persistent backend for TealTiger governance state.

**What this means:**
- 🔄 Governance state survives restarts and migrations
- 💰 Cost records persist across processes (DakeraCostStorage)
- 📋 Decision receipts with decay-weighted retention (DENY=0.95, ALLOW=0.80)
- 🔗 Delegation chains traversable via knowledge graph
- ✅ Idempotency checks prevent duplicate side effects

**Install:**
```
pip install dakera[tealtiger]
docker compose up  # Dakera server (single container)
```

**Key principle:** Storage provides evidence and continuity — never authority. Every action still gets fresh policy evaluation.

**Links:**
• Integration PR: https://github.com/Dakera-AI/dakera-py/pull/141
• Architecture discussion: https://github.com/Dakera-AI/dakera-deploy/discussions/169
• Deploy guide: https://github.com/Dakera-AI/dakera-deploy

Thanks to @ferhimedamine for the fast implementation and @rpelevin for the "evidence not authority" architectural constraint.

Questions or feedback? Drop them here 👇
```

---

## 5. GitHub Discussion Announcement (TealTiger repo)

**Title:** `🔌 New Backend: Dakera persistent governance state`

**Category:** Announcements

**Body:**

TealTiger governance state (cost records, decision receipts, delegation chains) can now be persisted via [Dakera](https://github.com/Dakera-AI/dakera-deploy) — a self-hosted AI agent memory server.

**Why this matters:**
- In-memory storage is fine for prototyping, but production multi-agent systems need governance continuity across restarts, migrations, and horizontal scaling
- Dakera provides agent-scoped, decay-weighted persistence with knowledge graph traversal
- Single `docker compose up` — no external dependencies, data stays on-premise

**Install:**
```
pip install dakera[tealtiger]
```

**Usage:**
```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import DakeraCostStorage

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")
cost_storage = DakeraCostStorage(client)

from tealtiger import TealOpenAI, TealOpenAIConfig
teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
```

**Links:**
- Integration PR: https://github.com/Dakera-AI/dakera-py/pull/141
- Architecture discussion: https://github.com/Dakera-AI/dakera-deploy/discussions/169

Feedback welcome.
