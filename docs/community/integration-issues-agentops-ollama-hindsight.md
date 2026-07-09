# Integration Issues — AgentOps, Ollama, Hindsight

Create these at: https://github.com/agentguard-ai/tealtiger/issues/new

---

## Issue 1: AgentOps Integration

**Title:** `[Integration]: Export TealTiger governance decisions to AgentOps`

**Labels:** `enhancement`, `integrations`, `community`

**Body:**

### Summary

[AgentOps](https://github.com/AgentOps-AI/agentops) provides observability for AI agents — session replay, cost tracking, LLM monitoring, and benchmarking. TealTiger governance decisions should be exportable as AgentOps events so teams can see governance enforcement alongside their existing agent telemetry.

### Why this integration?

AgentOps already integrates with CrewAI, LangChain, AG2, OpenAI Agents SDK, and others. TealTiger adds a dimension that none of those frameworks provide: **deterministic governance events** — which tools were denied, why, what risk score was assigned, and how much budget remains.

Combining both gives teams:
- Agent execution timeline (AgentOps) + governance decision points (TealTiger)
- Cost tracking from two angles: LLM spend (AgentOps) + budget enforcement (TealTiger)
- Session replay that shows exactly where and why a tool call was blocked

### Proposed approach

1. **TealTiger → AgentOps event emitter**: A callback that emits governance decisions as AgentOps events
2. **Event schema**: Map TealTiger's `GovernanceDecision` to AgentOps' event format
3. **Dashboard visibility**: Governance denials appear in the AgentOps session timeline

### Example usage

```python
import agentops
from tealtiger import TealOpenAI
from tealtiger.integrations.agentops import AgentOpsGovernanceReporter

agentops.init(api_key="your-agentops-key")

reporter = AgentOpsGovernanceReporter()

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"pii_detection": True, "secret_detection": True},
    on_decision=reporter.report,  # Every decision → AgentOps event
)
```

### Deliverables

- [ ] `tealtiger.integrations.agentops` module
- [ ] Maps `GovernanceDecision` → AgentOps `ActionEvent`
- [ ] Decision metadata (risk_score, reason_codes, latency) visible in AgentOps UI
- [ ] Example script showing combined usage
- [ ] PR to AgentOps docs listing TealTiger as a compatible integration

### Links

- AgentOps repo: https://github.com/AgentOps-AI/agentops
- AgentOps docs: https://docs.agentops.ai/
- TealTiger TEEC receipt spec: https://docs.tealtiger.ai/engine/

---

## Issue 2: Ollama Integration

**Title:** `[Integration]: TealTiger governance for local LLM calls via Ollama`

**Labels:** `enhancement`, `integrations`, `community`

**Body:**

### Summary

[Ollama](https://github.com/ollama/ollama) runs LLMs locally. When developers use Ollama for agent workflows, they lose the governance layer that cloud API providers offer (rate limits, content filtering). TealTiger can fill that gap — providing PII detection, secret scanning, cost estimation, and policy enforcement for local LLM calls.

### Why this integration?

Ollama's OpenAI-compatible API means TealTiger already works via `TealOpenAI` pointed at `http://localhost:11434`. But there are Ollama-specific concerns:

- **No built-in content filtering** — Ollama models respond to anything
- **No cost tracking** — local models have no usage API, but compute cost still exists
- **No audit trail** — no provider-side logging of what was asked/answered
- **Tool use without governance** — Ollama supports function calling, but with no access control

### Proposed approach

1. **`TealOllama` client wrapper** — wraps Ollama's API with governance (builds on OpenAI-compat)
2. **Compute cost estimation** — estimate local inference cost based on model size, tokens, and hardware
3. **Full guardrails** — PII, secrets, prompt injection for local models that have no built-in safety
4. **Audit trail** — structured TEEC receipts for every local model interaction

### Example usage

```python
from tealtiger.integrations.ollama import TealOllama

client = TealOllama(
    host="http://localhost:11434",
    guardrails={
        "pii_detection": True,
        "secret_detection": True,
        "prompt_injection": True,
    },
    budget={
        "max_requests_per_session": 100,  # Rate limit for local models
    },
)

response = client.chat(
    model="llama3.1",
    messages=[{"role": "user", "content": "Summarize user data"}],
)
# Governance evaluated before and after the local model call
```

### Deliverables

- [ ] `tealtiger.integrations.ollama` module
- [ ] `TealOllama` client wrapping Ollama's OpenAI-compatible API
- [ ] Local compute cost estimation (tokens × model-size factor)
- [ ] Full guardrail suite for unfiltered local models
- [ ] Example: governed local agent with Ollama + TealTiger
- [ ] Blog post: "Why local LLMs need governance too"

### Links

- Ollama repo: https://github.com/ollama/ollama
- Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- Ollama OpenAI compatibility: https://github.com/ollama/ollama/blob/main/docs/openai.md

---

## Issue 3: Hindsight Integration

**Title:** `[Integration]: Governance-aware agent memory with Hindsight`

**Labels:** `enhancement`, `integrations`, `community`

**Body:**

### Summary

[Hindsight](https://github.com/vectorize-io/hindsight) provides agent memory that works like human memory — with importance-based retention, forgetting curves, and contextual recall. TealTiger governance decisions are a natural fit for Hindsight's memory system: governance events have varying importance, should decay over time, and need to be recallable during future decisions.

### Why this integration?

Currently, TealTiger governance decisions are either in-memory (lost on restart) or persisted in flat storage. Hindsight adds intelligence to governance memory:

- **Importance-based retention** — DENY decisions (high risk) persist longer than routine ALLOWs
- **Contextual recall** — "What governance decisions were made for this agent in similar contexts?"
- **Forgetting curves** — Old, low-importance approvals naturally age out
- **Pattern detection** — Recall clusters of denials to detect systematic policy violations

### Proposed approach

1. **`HindsightGovernanceMemory`** — stores TealTiger decisions in Hindsight with importance scoring
2. **Decision importance mapping**: DENY=0.95, ALLOW=0.60, MONITOR=0.70 (mirrors Dakera pattern)
3. **Contextual governance recall** — before making a new decision, recall similar past decisions
4. **Anomaly detection** — flag when an agent's denial rate spikes vs. historical baseline

### Example usage

```python
from hindsight import HindsightClient
from tealtiger.integrations.hindsight import HindsightGovernanceMemory

hindsight = HindsightClient(api_key="your-key")

governance_memory = HindsightGovernanceMemory(
    client=hindsight,
    importance_map={
        "deny": 0.95,
        "allow": 0.60,
        "monitor": 0.70,
    },
)

# Every governance decision is stored with importance-weighted retention
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"pii_detection": True},
    on_decision=governance_memory.store,
)

# Later: recall governance history for context
history = governance_memory.recall(
    agent_id="research-agent",
    context="tool call to web_search",
    limit=5,
)
```

### Deliverables

- [ ] `tealtiger.integrations.hindsight` module
- [ ] `HindsightGovernanceMemory` class implementing importance-weighted storage
- [ ] Contextual recall for governance-aware decision making
- [ ] Example: agent that learns from past governance denials
- [ ] PR to Hindsight cookbook showing TealTiger integration

### Links

- Hindsight repo: https://github.com/vectorize-io/hindsight
- Hindsight cookbook: https://github.com/vectorize-io/hindsight-cookbook
- TealTiger Dakera integration (similar pattern): https://docs.tealtiger.ai/integrations/dakera/

---

## External Issues (Optional — submit to target repos)

### AgentOps (submit to `AgentOps-AI/agentops`)

**Title:** `[Feature Request] TealTiger governance event integration`

**Body:**

Would love to see TealTiger governance decisions surfaced in the AgentOps dashboard. TealTiger provides deterministic governance for AI agents (tool allowlists, PII detection, cost enforcement) and produces structured decision events that would map cleanly to AgentOps' event system.

The integration would let teams see:
- Which tool calls were blocked by governance (and why)
- Risk scores and reason codes alongside LLM traces
- Budget enforcement events in the session timeline

We already have an integration module built — happy to submit a PR to your docs or examples if you're interested.

- TealTiger: https://github.com/agentguard-ai/tealtiger
- PyPI: https://pypi.org/project/tealtiger/

---

### Hindsight (submit to `vectorize-io/hindsight`)

**Title:** `[Feature Request] Governance decision storage with importance-weighted retention`

**Body:**

Proposing an integration where AI governance decisions (from TealTiger) are stored in Hindsight with importance-based retention. Security-critical denials (risk_score > 80) persist with high importance (0.95), while routine approvals decay normally (0.60).

This enables:
- Governance memory that survives process restarts
- Contextual recall: "what decisions were made in similar situations?"
- Natural forgetting of low-value approvals while retaining critical denials
- Anomaly detection when denial patterns deviate from baseline

Happy to contribute an example to the Hindsight cookbook showing this pattern.

- TealTiger: https://github.com/agentguard-ai/tealtiger
- Similar pattern (Dakera integration): https://github.com/agentguard-ai/tealtiger/blob/main/docs/integrations/dakera.md
