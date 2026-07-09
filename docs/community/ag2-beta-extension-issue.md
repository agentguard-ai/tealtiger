# Issue Title

TealTiger governance middleware Extension for AG2 Beta

# Labels

beta, enhancement

# Body

## Summary

Proposing a TealTiger governance Extension for AG2 Beta — implementing deterministic policy enforcement as composable middleware under `autogen/beta/extensions/tealtiger/`.

This follows the merged classic integration (#2962, ecosystem docs) and Mark's suggestion to target the beta track.

## What this Extension would provide

A middleware that intercepts tool calls and agent communication to enforce governance policies deterministically (<5ms, no LLM in the path):

```python
from autogen.beta import Agent
from autogen.beta.config import OpenAIConfig
from autogen.beta.extensions.tealtiger import TealTigerMiddleware

agent = Agent(
    "assistant",
    prompt="You are a helpful assistant.",
    config=OpenAIConfig("gpt-4o-mini"),
    tools=[my_tool],
    middleware=[
        TealTigerMiddleware(
            mode="enforce",  # observe | monitor | enforce
            policies=[
                {"type": "tool_allowlist", "allowed": ["search", "read_file"]},
                {"type": "pii_block", "categories": ["ssn", "credit_card"]},
                {"type": "cost_limit", "max_per_session": 5.00},
            ],
        )
    ],
)

reply = await agent.ask("Find information about project X")
# Tool calls are governed — unauthorized tools denied, PII redacted, budget enforced
```

## Capabilities

| Capability | How it works in Beta |
|---|---|
| Tool allowlisting | Middleware intercepts tool execution, checks policy |
| PII detection in arguments | Scans tool args before execution, redacts or blocks |
| Cost governance | Tracks cumulative cost per agent, enforces ceilings |
| Per-agent kill switch | `middleware.freeze(agent_id)` blocks all actions |
| Structured audit trail | Subscribes to MemoryStream, emits TEEC receipts |
| REFER escalation | Suspends action, emits receipt for human review |
| Decision receipts | Every tool call produces auditable evidence (SARIF/JUnit XML) |

## How it fits AG2 Beta architecture

- **Middleware** — TealTiger composes naturally with AG2 Beta's middleware system (retries, logging, token limits)
- **Event stream** — governance decisions emitted as events via MemoryStream, observable by UI/logging
- **Async-first** — all evaluation is async-compatible (though governance itself is sub-5ms sync)
- **Dependency injection** — uses `Context` for accessing agent state, correlation IDs
- **No Core dependencies added** — `tealtiger` is an optional dependency guarded with `try/except ImportError`

## Contribution plan (per Extension policy)

- **Named maintainer:** @nagasatish007
- **Location:** `autogen/beta/extensions/tealtiger/`
- **Tests:** Property-based tests (Hypothesis) + integration tests covering multi-agent invariants
- **Docs:** Module docstring, class/function docstrings (Google-style), docs page under Extensions
- **Dependencies:** `tealtiger>=1.3.0` as additional dependency (not pyproject extra), guarded with `missing_additional_dependency`

## Prior art

- Classic AG2 integration merged: #2962
- Feature request with community design input: #2942
- Field model designed with @rpelevin's acceptance tests (decision_id vs params_hash separation, policy_digest vs decision_source split)
- Package live on PyPI: https://pypi.org/project/ag2-tealtiger/

## Questions for the team

1. Is the middleware layer the right integration point, or would a harness plugin be preferred?
2. Should this also integrate with the Multi-Agent Network (hub/channel level governance)?
3. Any preferences on the docs page location under Extensions?

Happy to start with a draft PR once there's alignment on approach.
