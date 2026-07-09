# llamaindex-tealtiger

> Deterministic governance callback handler for LlamaIndex — policy enforcement, cost tracking, PII detection, and structured audit for RAG pipelines. No LLM in the governance path.

[![PyPI](https://img.shields.io/pypi/v/llamaindex-tealtiger)](https://pypi.org/project/llamaindex-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/llamaindex-tealtiger)](https://pypi.org/project/llamaindex-tealtiger/)

## Install

```bash
pip install llamaindex-tealtiger
```

## Zero-Config Quickstart (3 lines)

```python
from llama_index.core import Settings
from llamaindex_tealtiger import TealTigerCallback

Settings.callback_manager.add_handler(TealTigerCallback())
```

That's it. Every LLM call, retriever fetch, and tool invocation is now
logged with cost tracking and PII detection — nothing is blocked.

## Enforce Mode — Block Policy Violations

```python
from llama_index.core import Settings
from llamaindex_tealtiger import TealTigerCallback, GovernanceDenyError

handler = TealTigerCallback(
    mode="ENFORCE",
    policies=[
        {"type": "tool_allowlist", "tools": ["search", "calculator"]},
    ],
    budget=5.00,  # USD session limit
    agent_id="rag-pipeline-prod",
)
Settings.callback_manager.add_handler(handler)

# Any tool not in the allowlist raises GovernanceDenyError
# before the tool executes — no wasted compute.
try:
    index.as_query_engine().query("Run dangerous_tool now")
except GovernanceDenyError as e:
    print(f"Blocked: {e.decision['reason']}")
    print(f"Codes:   {e.decision['reason_codes']}")
```

## Use with TealEngine (Advanced Policies)

```python
from tealtiger.core.engine import TealEngine
from llamaindex_tealtiger import TealTigerCallback

engine = TealEngine(policies=[...])

handler = TealTigerCallback(
    mode="ENFORCE",
    engine=engine,
    budget=10.00,
)
```

## Features

| Feature | Description |
|---------|-------------|
| **Three Modes** | OBSERVE (log only), MONITOR (log + warn), ENFORCE (log + block) |
| **Cost Tracking** | Per-request and session-level cost accumulation using TealTiger pricing |
| **Budget Limits** | Session-level USD budget with automatic DENY on breach |
| **PII Detection** | Email, phone, SSN, credit card, IP address patterns |
| **Secret Detection** | API keys, tokens, Bearer headers, AWS keys, GitHub PATs |
| **Params Hashing** | SHA-256 digest of JCS-canonicalized args for reproducibility |
| **Policy Engine** | Built-in allowlist/blocklist or plug in TealEngine for advanced rules |
| **Fail Closed** | Policy timeouts and errors always result in DENY |
| **Audit Trail** | Full decision history with correlation IDs and proposed_call_id |
| **OpenTelemetry** | Automatic trace_id capture when OTel is available |
| **Adapter Source** | Every event tagged with `adapter_source: llamaindex-tealtiger` |

## Governance Modes

| Mode | Behavior |
|------|----------|
| `OBSERVE` | Allow all, log decisions, track cost (default) |
| `MONITOR` | Allow all, log denials as warnings |
| `ENFORCE` | Block denied actions, raise `GovernanceDenyError` |

## Session Report

```python
report = handler.report()
# {
#   "session_id": "...",
#   "mode": "ENFORCE",
#   "total_evaluations": 42,
#   "allowed": 40,
#   "denied": 2,
#   "total_cost_usd": 0.0847,
#   "budget_usd": 5.00,
#   "pii_findings_total": 3,
#   "secrets_detected_total": 1,
# }
```

## Requirements

- Python ≥ 3.9
- `llama-index-core >= 0.11.0`
- `tealtiger >= 1.3.0`

## Links

- [TealTiger Documentation](https://docs.tealtiger.ai)
- [LlamaIndex Integration Guide](https://docs.tealtiger.ai/integrations/llamaindex)
- [GitHub Repository](https://github.com/agentguard-ai/tealtiger)
- [PyPI Package](https://pypi.org/project/llamaindex-tealtiger/)

## License

Apache-2.0
