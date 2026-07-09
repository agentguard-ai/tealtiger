---
title: "Zero-Config Quickstart"
description: "Get governance visibility in 3 lines of code — cost tracking, audit logs, PII detection, and a kill switch with zero configuration."
---

# Zero-Config Quickstart

Go from zero to full-stack governance visibility in under a minute. No policies, no config files, no external services.

---

## 3-Line Quickstart

### TypeScript

```typescript
import { observe } from "tealtiger";
import OpenAI from "openai";

const client = observe(new OpenAI());
```

### Python

```python
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI())
```

That's it. `client` is now a governed client with:

- ✅ Automatic cost tracking per request, session, and agent
- ✅ Full audit trail of every call, response, and error
- ✅ PII detection (report-only — logs findings, never blocks)
- ✅ Behavioral baseline (built automatically from first 100 requests)
- ✅ Emergency kill switch (`freeze()` / `unfreeze()`)

Use `client` exactly like you'd use the unwrapped OpenAI client. Same methods, same parameters, same responses.

---

## Cost Tracking

Every request is automatically costed using provider pricing data:

### TypeScript

```typescript
import { observe } from "tealtiger";
import OpenAI from "openai";

const client = observe(new OpenAI());

// Make some requests
await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What is quantum computing?" }]
});

await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Summarize the above" }]
});

// Check costs
const cost = client.getCost();
console.log(`Session cost: $${cost.session.toFixed(4)}`);     // $0.0082
console.log(`Last request: $${cost.lastRequest.toFixed(4)}`); // $0.0003
console.log(`Total requests: ${cost.requestCount}`);          // 2
```

### Python

```python
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI())

client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is quantum computing?"}]
)

cost = client.get_cost()
print(f"Session cost: ${cost.session:.4f}")      # $0.0079
print(f"Last request: ${cost.last_request:.4f}") # $0.0079
print(f"Total requests: {cost.request_count}")   # 1
```

---

## Audit Log

Every request, response, error, and tool call is automatically logged:

```typescript
const client = observe(new OpenAI(), { agentId: "research-bot" });

await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "john.doe@example.com is my email" }]
});

// Audit log now contains:
// - Request event: agentId, model, timestamp, input tokens
// - PII detection event: EMAIL detected (count: 1)
// - Response event: output tokens, cost, latency
// - All linked by correlationId
```

Audit events are written using TealAudit with `HASH` redaction by default — input/output content is hashed, not stored in plaintext.

---

## Behavioral Baseline

The proxy automatically collects metrics to build a "what's normal" profile:

### TypeScript

```typescript
const client = observe(new OpenAI(), { baselineWindow: 20 });

// Make 20+ requests...
for (let i = 0; i < 25; i++) {
  await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Question ${i}` }]
  });
}

// Baseline is now complete
const baseline = client.getBaseline();
console.log(baseline?.complete);                // true
console.log(baseline?.stats.latency.p50);      // 420ms
console.log(baseline?.stats.cost.p95);         // $0.008
console.log(baseline?.stats.toolCallCount.p99); // 3
```

### Python

```python
client = observe(OpenAI(), baseline_window=20)

# Make 20+ requests...
for i in range(25):
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Question {i}"}]
    )

baseline = client.get_baseline()
print(f"Complete: {baseline.complete}")          # True
print(f"Latency p50: {baseline.stats.latency.p50}ms")  # 420ms
print(f"Cost p95: ${baseline.stats.cost.p95:.4f}")      # $0.0080
```

The baseline includes p50, p95, and p99 for: latency, input tokens, output tokens, cost, and tool call count.

---

## Kill Switch: freeze() / unfreeze()

Emergency stop — no policies required:

### TypeScript

```typescript
import { observe, freeze, unfreeze, FrozenAgentError } from "tealtiger";
import OpenAI from "openai";

const client = observe(new OpenAI(), { agentId: "my-agent" });

// Normal operation
await client.chat.completions.create({ model: "gpt-4o", messages: [/* ... */] });

// Something's wrong — freeze this agent
freeze("my-agent");

// All subsequent requests are blocked
try {
  await client.chat.completions.create({ model: "gpt-4o", messages: [/* ... */] });
} catch (err) {
  if (err instanceof FrozenAgentError) {
    console.log("Agent is frozen!");  // Agent is frozen!
  }
}

// Crisis resolved
unfreeze("my-agent");

// Back to normal
await client.chat.completions.create({ model: "gpt-4o", messages: [/* ... */] });
```

### Python

```python
from tealtiger import observe, freeze, unfreeze, FrozenAgentError
from openai import OpenAI

client = observe(OpenAI(), agent_id="my-agent")

# Freeze all agents (nuclear option)
freeze("*")

try:
    client.chat.completions.create(model="gpt-4o", messages=[...])
except FrozenAgentError as e:
    print(f"Agent {e.agent_id} is frozen!")

# Unfreeze
unfreeze("*")
```

---

## Progressive Path to Explicit Policies

When you're ready to graduate from observe-only to enforcement:

### Step 1: Start with observe (you are here)

```typescript
const client = observe(new OpenAI());
```

### Step 2: Add multi-stage defense

```typescript
import { TealGuard } from "tealtiger";

const guard = new TealGuard({
  depth: "standard",
  guardrails: {
    pre: { pii: true, secrets: true, injection: true }
  }
});

const client = observe(new OpenAI(), { guard });
```

### Step 3: Add post-execution scanning

```typescript
const guard = new TealGuard({
  depth: "standard",
  guardrails: {
    pre: { pii: true, secrets: true, injection: true },
    post: { pii: true, secrets: true }
  }
});
```

### Step 4: Add role-based policies

```typescript
import { perRole } from "tealtiger/policy";

const policy = perRole({
  researcher: { allowed_tools: ["search"], max_cost_per_session: 2.0 },
  writer: { allowed_tools: ["write"], max_cost_per_session: 0.5 }
});

const client = observe(new OpenAI(), { role: "researcher" });
```

### Step 5: Add FREEZE rules (immutable safety)

```typescript
// Coming in v1.5 — immutable safety boundaries that cannot be
// overridden at runtime, even by operators
```

Each step builds on the previous. You never have to rewrite — just add.

---

## With Agent ID and Session ID

```typescript
const client = observe(new OpenAI(), {
  agentId: "research-agent-01",      // Identify this agent
  sessionId: "user-session-abc",     // Group requests into a session
  baselineWindow: 50                 // Build baseline from 50 requests
});
```

```python
client = observe(
    OpenAI(),
    agent_id="research-agent-01",
    session_id="user-session-abc",
    baseline_window=50
)
```

---

## Supported Providers

`observe()` works with all 14 supported providers:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const anthropic = observe(new Anthropic());
const gemini = observe(new GoogleGenerativeAI(apiKey));
const groq = observe(new Groq());
```

```python
import anthropic
import google.generativeai as genai
from groq import Groq

ant = observe(anthropic.Anthropic())
groq = observe(Groq())
```

See the [full provider list](/api-reference/typescript/observe#supported-providers) for all 14 supported clients.
