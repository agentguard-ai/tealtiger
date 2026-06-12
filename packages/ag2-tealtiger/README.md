# ag2-tealtiger

Deterministic governance adapter for [AG2](https://github.com/ag2ai/ag2) — policy enforcement, PII detection, cost tracking, per-agent kill switch, governed speaker selection, and structured audit evidence.

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

```python
from ag2_tealtiger import TealTigerGuard

guard = TealTigerGuard()  # No engine = observe mode
guard.attach(my_agent)
# Cost, PII, and tool usage tracked automatically. Nothing blocked.
```

Or the convenience subclass:

```python
from ag2_tealtiger import TealTigerAuditAgent

agent = TealTigerAuditAgent(name="coder")  # Zero config, observe mode built-in
```

### Policy Enforcement

```python
from ag2_tealtiger import TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=my_engine, mode=GovernanceMode.ENFORCE)
guard.attach(agent)
# DENY blocks the call with a structured denial message
```

### Governed GroupChat

```python
from ag2_tealtiger import GovernedGroupChat, TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
group_chat = GovernedGroupChat(agents=[agent1, agent2, agent3], guard=guard)
speaker = group_chat.select_speaker(last_speaker=agent1)
```

## Features

| Feature | Observe | Monitor | Enforce |
|---------|:-------:|:-------:|:-------:|
| Cost tracking per agent | ✅ | ✅ | ✅ |
| PII detection in tool args | ✅ | ✅ | ✅ |
| Structured audit entries (TEEC) | ✅ | ✅ | ✅ |
| Per-agent freeze/unfreeze | ✅ | ✅ | ✅ |
| Policy evaluation | — | ✅ (log) | ✅ (block) |
| Budget enforcement | — | ✅ (log) | ✅ (block) |
| REFER escalation | — | ✅ | ✅ |
| Inter-agent message governance | ✅ | ✅ | ✅ |
| Governed speaker selection | ✅ | ✅ | ✅ |
| JSONL audit export | ✅ | ✅ | ✅ |

## License

Apache-2.0
