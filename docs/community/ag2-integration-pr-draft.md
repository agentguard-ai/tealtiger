# AG2 Integration PR — Draft

## Instructions

1. Fork `ag2ai/ag2` on GitHub
2. Clone your fork locally
3. Create branch: `git checkout -b feat/tealtiger-governance-integration`
4. Add the file below to `website/docs/ecosystem/tealtiger.mdx` (AG2's ecosystem integrations folder)
5. Push and open PR against `ag2ai/ag2` main branch

## PR Title
```
docs: add TealTiger governance integration example
```

## PR Description
```markdown
## Summary

Adds documentation and example for integrating TealTiger deterministic governance with AG2's `register_reply` mechanism. This addresses the governance interceptor feature request in #2942.

**Package:** [`ag2-tealtiger`](https://pypi.org/project/ag2-tealtiger/) (Apache-2.0, published on PyPI)

## What this PR adds

- Integration docs showing how to use `ag2-tealtiger` with ConversableAgent, GroupChat, and nested conversations
- Covers all acceptance criteria from #2942 discussion:
  - Per-agent governance isolation (approval for Agent A doesn't authorize Agent B)
  - Nested chat correlation with parent-child tracking
  - Frozen agent can't send messages through another hook
  - Denied calls produce visible terminal result
  - Retry uses same idempotency key (no duplicate side effects)
  - Audit trail reconstructs which agent caused which external action
  - TEEC namespace with `params_hash`, `decision_id`, `policy_digest`, `decision_source` as orthogonal fields

## Architecture

- **Zero LLM in governance path** — all evaluation is deterministic, <5ms overhead
- **In-process** — no network calls, no sidecar, works offline
- Uses AG2's native `register_reply` mechanism (no monkey-patching)
- 28 property-based tests (Hypothesis) + 22 integration tests

## Testing

```bash
pip install ag2-tealtiger
python -c "from ag2_tealtiger import TealTigerGuard; print('OK')"
```

## Related

- Closes #2942
- Package source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/ag2-tealtiger
- PyPI: https://pypi.org/project/ag2-tealtiger/
```

## File to add: `website/docs/ecosystem/tealtiger.md`

```markdown
---
title: TealTiger Governance
description: Deterministic governance for AG2 agents — policy enforcement, cost tracking, PII detection, and per-agent kill switches.
---

# TealTiger Governance Integration

[TealTiger](https://github.com/agentguard-ai/tealtiger) provides deterministic governance for AG2 agents via the `register_reply` interceptor mechanism. No LLM in the governance path — all policy evaluation is deterministic with <5ms overhead.

## Installation

```bash
pip install ag2-tealtiger
```

## Quick Start

### Zero-Config Observe Mode

Track cost, PII, and tool usage across all agents with zero configuration:

```python
from ag2_tealtiger import TealTigerGuard

# Observe everything, block nothing
guard = TealTigerGuard()
guard.attach(my_agent)

# After some tool calls...
for entry in guard.audit_trail:
    print(f"{entry.agent_id}: {entry.tool_name} → {entry.action} (cost: ${entry.cost_tracked:.4f})")
```

### Policy Enforcement

```python
from ag2_tealtiger import TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=my_engine, mode=GovernanceMode.ENFORCE)
guard.attach(agent)

# Tool calls are now evaluated against policies
# DENY blocks with structured denial message visible in conversation
# ALLOW passes through transparently
```

### ConversableAgent Subclass

```python
from ag2_tealtiger import TealTigerAuditAgent

# Zero-config — governance built in
agent = TealTigerAuditAgent(name="coder")

# With policy engine
agent = TealTigerAuditAgent(
    name="executor",
    engine=my_engine,
    mode=GovernanceMode.ENFORCE,
    budget_limit=5.0,  # Per-agent cost ceiling
)
```

### Governed GroupChat

```python
from ag2_tealtiger import GovernedGroupChat, TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

# Attach guard to all agents
for agent in [coder, reviewer, executor]:
    guard.attach(agent)

# Speaker selection respects governance
group_chat = GovernedGroupChat(agents=[coder, reviewer, executor], guard=guard)
speaker = group_chat.select_speaker(last_speaker=coder)

# Frozen agents skipped (no engine call)
# Over-budget agents skipped (no engine call)
# Policy-denied agents skipped to next candidate
# ALL_SPEAKERS_DENIED terminates the round safely
```

## Per-Agent Kill Switch

```python
# Freeze mid-conversation — blocks ALL actions regardless of mode
guard.freeze("dangerous_agent")

# Other agents continue normally
speaker = group_chat.select_speaker(last_speaker=coder)  # Skips frozen agent

# Unfreeze to restore
guard.unfreeze("dangerous_agent")
```

## Budget Enforcement

```python
guard.set_budget("expensive_agent", limit=5.0)

# After cumulative cost exceeds limit:
# - ENFORCE: blocks with BUDGET_EXCEEDED
# - 80% warning emitted at threshold
# - Reset: guard.reset_budget("expensive_agent")
```

## REFER Escalation

```python
# When TealEngine returns REFER, action is suspended (not terminated)
# GroupChat continues with remaining agents
# Resolve later:
guard.resolve_refer(decision_id, resolution="ALLOW", approval_id="reviewer-123")
```

## Features

| Feature | Observe | Monitor | Enforce |
|---------|:-------:|:-------:|:-------:|
| Cost tracking per agent | ✅ | ✅ | ✅ |
| PII detection in tool args | ✅ | ✅ | ✅ |
| Structured audit (TEEC namespace) | ✅ | ✅ | ✅ |
| Per-agent freeze/unfreeze | ✅ | ✅ | ✅ |
| Policy evaluation | — | ✅ (log) | ✅ (block) |
| Budget enforcement | — | ✅ (log) | ✅ (block) |
| REFER escalation | — | ✅ | ✅ |
| Inter-agent message governance | ✅ | ✅ | ✅ |
| Governed speaker selection | ✅ | ✅ | ✅ |
| JSONL audit export | ✅ | ✅ | ✅ |

## Links

- **PyPI:** [ag2-tealtiger](https://pypi.org/project/ag2-tealtiger/)
- **Source:** [github.com/agentguard-ai/tealtiger/packages/ag2-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/ag2-tealtiger)
- **Examples:** [Zero-config](https://github.com/agentguard-ai/tealtiger/blob/main/packages/ag2-tealtiger/examples/zero_config_observe.py) | [Policy enforcement](https://github.com/agentguard-ai/tealtiger/blob/main/packages/ag2-tealtiger/examples/policy_enforcement.py) | [Governed GroupChat](https://github.com/agentguard-ai/tealtiger/blob/main/packages/ag2-tealtiger/examples/governed_groupchat.py)
- **License:** Apache-2.0
```
