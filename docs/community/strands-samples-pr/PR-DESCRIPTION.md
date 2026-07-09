## Summary

Adds a governance integration sample demonstrating deterministic tool-call authorization for Strands agents using the native `HookProvider` + `BeforeToolCallEvent` API.

## What it demonstrates

- **Tool allowlist** — block unauthorized tools via `event.cancel_tool`
- **PII detection** — scan tool arguments for SSN, credit cards, emails before execution
- **Session budget** — automatic deny when cost limit is reached
- **Kill switch** — freeze/unfreeze agents at runtime
- **Audit trail** — structured decision records with correlation IDs

## How it integrates

Uses Strands' existing hook system — no patches, no monkey-patching:

```python
from strands import Agent
from governance_hook import TealTigerGovernanceHook

agent = Agent(
    tools=[search_docs, write_report, delete_customer],
    hooks=[TealTigerGovernanceHook(
        mode="enforce",
        policies=[{"type": "tool_allowlist", "allowed": ["search_docs", "write_report"]}],
    )],
)
```

## Runs without API keys

The demo uses mock `BeforeToolCallEvent` objects to demonstrate governance behavior deterministically. No Bedrock/OpenAI credentials required.

## Files

| File | Description |
|------|-------------|
| `python/03-integrate/tealtiger-governance/README.md` | Setup, architecture, usage |
| `python/03-integrate/tealtiger-governance/governance_hook.py` | TealTiger HookProvider |
| `python/03-integrate/tealtiger-governance/main.py` | 5-scenario demo |
| `python/03-integrate/tealtiger-governance/requirements.txt` | Dependencies |

## References

- [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0)
- [Strands Hooks docs](https://strandsagents.com/docs/user-guide/concepts/agents/hooks/)
- OWASP ASI-02 (tool misuse), ASI-03 (access control)

## Checklist

- [x] Follows project structure from `.github/templates/use-cases/structure.md`
- [x] README follows template from `.github/templates/use-cases/readme.md`
- [x] Code runs end-to-end (`python main.py` produces expected output)
- [x] No external API keys required for demo
