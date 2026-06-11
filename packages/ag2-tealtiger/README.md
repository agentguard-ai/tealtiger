# ag2-tealtiger

Deterministic governance adapter for [AG2](https://github.com/ag2ai/ag2) (AutoGen fork) — policy enforcement, PII detection, cost tracking, per-agent kill switch, governed speaker selection, and structured audit evidence.

**No LLM in the governance path.** All policy evaluation is deterministic, adding <5ms latency.

[![PyPI](https://img.shields.io/pypi/v/ag2-tealtiger)](https://pypi.org/project/ag2-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/ag2-tealtiger)](https://pypi.org/project/ag2-tealtiger/)

## Installation

```bash
pip install ag2-tealtiger
```

## Quick Start

### Zero-Config Observe Mode

Add governance to any AG2 agent with zero configuration:

```python
from ag2_tealtiger import TealTigerGuard

guard = TealTigerGuard()  # No engine = observe mode
guard.attach(my_agent)

# That's it. Cost, PII, and tool usage tracked automatically.
# All tool calls pass through unchanged.
print(guard.audit_trail)
```

Or use the convenience subclass:

```python
from ag2_tealtiger import TealTigerAuditAgent

agent = TealTigerAuditAgent(name="coder")
# Built-in governance, zero config
```

### Policy Enforcement

```python
from ag2_tealtiger import TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=my_engine, mode=GovernanceMode.ENFORCE)
guard.attach(agent)

# Tool calls are now evaluated against policies
# DENY blocks the call and returns a structured denial message
# ALLOW passes through transparently
```

### Governed GroupChat

```python
from ag2_tealtiger import GovernedGroupChat, TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
group_chat = GovernedGroupChat(agents=[agent1, agent2, agent3], guard=guard)

# Speaker selection respects governance:
# - Frozen agents skipped (no engine call)
# - Over-budget agents skipped (no engine call)
# - Policy-denied agents skipped to next candidate
speaker = group_chat.select_speaker(last_speaker=agent1)
```

## Features

| Feature | Observe | Monitor | Enforce |
|---------|:-------:|:-------:|:-------:|
| Cost tracking per agent | ✅ | ✅ | ✅ |
| PII detection in tool args | ✅ | ✅ | ✅ |
| Structured audit entries (TEEC) | ✅ | ✅ | ✅ |
| Correlation IDs (UUID v4) | ✅ | ✅ | ✅ |
| Policy evaluation | — | ✅ (log only) | ✅ (block) |
| Per-agent freeze/unfreeze | ✅ | ✅ | ✅ |
| Budget enforcement | — | ✅ (log only) | ✅ (block) |
| REFER escalation | — | ✅ | ✅ |
| Inter-agent message governance | ✅ | ✅ | ✅ |
| Governed speaker selection | ✅ | ✅ | ✅ |
| Decision receipt expiry | — | ✅ | ✅ |
| JSONL audit export | ✅ | ✅ | ✅ |

## Per-Agent Kill Switch

```python
# Freeze an agent mid-conversation — blocks ALL actions regardless of mode
guard.freeze("dangerous_agent")

# Unfreeze to restore normal governance
guard.unfreeze("dangerous_agent")
```

## Budget Enforcement

```python
guard.set_budget("agent_id", limit=5.0)  # $5 budget

# After cumulative cost exceeds limit:
# - ENFORCE mode: blocks with BUDGET_EXCEEDED
# - 80% warning emitted at threshold
# - Reset with guard.reset_budget("agent_id")
```

## Audit Trail Export

```python
# Export as JSONL (one entry per line)
entries_written = guard.export_audit_trail("audit.jsonl")
```

## Governance Modes

- **OBSERVE** — Zero-config default. Track everything, block nothing.
- **MONITOR** — Evaluate policies, log decisions, allow all through.
- **ENFORCE** — Evaluate policies, block denied actions.

## Error Handling

| Scenario | ENFORCE | MONITOR/OBSERVE |
|----------|---------|-----------------|
| Engine returns DENY | Block | Log + allow |
| Engine throws exception | Fail-closed (deny) | Fail-open (allow) |
| Agent frozen | Block (always) | Block (always) |
| Budget exceeded | Block | Log + allow |

## Development

```bash
pip install -e ".[dev]"
pytest
mypy src/
ruff check src/ tests/
```

## License

Apache-2.0
