# Dakera — Persistent Governance State Backend

[Dakera](https://github.com/Dakera-AI/dakera-py) provides a persistent, agent-scoped memory layer that TealTiger uses as a backend for governance state — cost records, decision receipts, and delegation chains that survive process restarts, agent migrations, and horizontal scaling.

## Installation

```bash
pip install dakera[tealtiger]
```

## Quick Start

```python
from dakera.async_client import AsyncDakeraClient
from dakera.integrations.tealtiger import (
    DakeraCostStorage,
    DakeraDecisionStore,
    DakeraDelegationHelper,
)

client = AsyncDakeraClient("http://localhost:3000", api_key="dk-mykey")

# Drop-in CostStorage backend for TealTiger
cost_storage = DakeraCostStorage(client)

from tealtiger import TealOpenAI, TealOpenAIConfig
teal_client = TealOpenAI(config=TealOpenAIConfig(cost_storage=cost_storage))
```

## Components

| Component | Purpose |
|---|---|
| `DakeraCostStorage` | All 8 `CostStorage` ABC methods — persistent cost tracking |
| `DakeraDecisionStore` | Decision receipts with importance-tiered retention |
| `DakeraDelegationHelper` | Delegation chain traversal via knowledge graph |

## Architecture Principle

**Storage = evidence/continuity, NOT authority.**

Dakera answers: "what was decided before?" and "is this a retry?"
TealTiger answers: "is this new action authorized now?"

Stored decisions inform fresh evaluations — they never become ambient permission.

## Links

- PyPI: `pip install dakera[tealtiger]`
- Source: [Dakera-AI/dakera-py](https://github.com/Dakera-AI/dakera-py)
- Discussion: [dakera-deploy#169](https://github.com/Dakera-AI/dakera-deploy/discussions/169)
