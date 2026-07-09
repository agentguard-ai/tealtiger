---
title: "observe() — TypeScript API"
description: "Complete API reference for observe(), ObserveConfig, ObserveProxy, freeze(), and unfreeze() in the TypeScript SDK."
---

# observe() — TypeScript API

The zero-config entry point to TealTiger governance. Wraps any supported LLM provider client with cost tracking, audit logging, PII detection, and behavioral baseline construction.

---

## observe()

```typescript
function observe(client: ProviderClient, config?: ObserveConfig): ObserveProxy
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | `ProviderClient` | Yes | Any of the 14 supported LLM provider client instances |
| `config` | `ObserveConfig` | No | Optional configuration for agent ID, session ID, and baseline window |

### Returns

`ObserveProxy` — A transparent proxy with the same API surface as the original client, plus governance methods.

### Throws

| Error | When |
|-------|------|
| `UnsupportedProviderError` | The `client` argument is not one of the 14 supported provider types |

### Example

```typescript
import { observe } from "tealtiger";
import OpenAI from "openai";

// Minimal — zero config
const client = observe(new OpenAI());

// With configuration
const client = observe(new OpenAI(), {
  agentId: "research-agent-01",
  sessionId: "session-abc-123",
  baselineWindow: 50
});

// Use exactly like the original client
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Explain quantum computing" }]
});
```

---

## ObserveConfig

```typescript
interface ObserveConfig {
  agentId?: string;
  sessionId?: string;
  baselineWindow?: number;
  role?: string;
  exporters?: GovernanceExporter[];
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `agentId` | `string` | Auto-generated UUID v4 | Unique identifier for this agent |
| `sessionId` | `string` | Auto-generated UUID v4 | Unique identifier for this session |
| `baselineWindow` | `number` | `100` | Number of requests used to build the behavioral baseline |
| `role` | `string` | `undefined` | Agent role for role-based governance (e.g., "researcher", "writer") |
| `exporters` | `GovernanceExporter[]` | `[]` | Observability platform exporters (Langfuse, AgentOps, Phoenix) |

---

## ObserveProxy

The proxy returned by `observe()`. It has the same method surface as the original client, plus these governance methods:

### getCost()

```typescript
getCost(): CostSummary
```

Returns the accumulated cost for this session and agent.

```typescript
interface CostSummary {
  session: number;       // Total cost for this session (USD)
  agent: number;         // Total cost for this agent across all sessions (USD)
  lastRequest: number;   // Cost of the most recent request (USD)
  requestCount: number;  // Number of requests processed
}
```

**Example:**

```typescript
const client = observe(new OpenAI());

await client.chat.completions.create({ /* ... */ });
await client.chat.completions.create({ /* ... */ });

console.log(client.getCost());
// { session: 0.0067, agent: 0.0067, lastRequest: 0.0031, requestCount: 2 }
```

---

### getBaseline()

```typescript
getBaseline(): Baseline | null
```

Returns the behavioral baseline, or `null` if the baseline window hasn't been filled yet.

```typescript
interface Baseline {
  requestCount: number;
  complete: boolean;
  stats: {
    latency: PercentileStats;
    inputTokens: PercentileStats;
    outputTokens: PercentileStats;
    cost: PercentileStats;
    toolCallCount: PercentileStats;
  };
}

interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
}
```

**Example:**

```typescript
const client = observe(new OpenAI(), { baselineWindow: 50 });

// After 50 requests...
const baseline = client.getBaseline();
// {
//   requestCount: 50,
//   complete: true,
//   stats: {
//     latency: { p50: 480, p95: 1250, p99: 2100 },
//     inputTokens: { p50: 150, p95: 500, p99: 1200 },
//     outputTokens: { p50: 300, p95: 800, p99: 1500 },
//     cost: { p50: 0.003, p95: 0.012, p99: 0.025 },
//     toolCallCount: { p50: 0, p95: 2, p99: 4 }
//   }
// }
```

---

### getAgentId()

```typescript
getAgentId(): string
```

Returns the agent ID (auto-generated or configured).

---

### getSessionId()

```typescript
getSessionId(): string
```

Returns the session ID (auto-generated or configured).

---

### getBurnRate()

```typescript
getBurnRate(): number
```

Returns the current USD/minute spend rate based on recent requests.

---

### getCostByAgent()

```typescript
getCostByAgent(): Record<string, number>
```

Returns cost breakdown by agent ID (useful when multiple agents share a cost store).

---

## freeze()

```typescript
function freeze(agentId: string): void
```

Immediately registers the given agent ID in the FreezeRegistry. All subsequent requests for that agent will be blocked with a `FrozenAgentError`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | `string` | Yes | The agent ID to freeze. Use `"*"` to freeze all agents. |

### Behavior

- **Idempotent**: Calling `freeze(id)` multiple times is equivalent to calling it once
- **Immediate**: Takes effect for the very next request
- **In-memory**: No external service needed, persists for process lifetime
- **Wildcard**: `freeze("*")` freezes all agents, including agents created after the freeze call

### Example

```typescript
import { freeze } from "tealtiger";

// Freeze a specific agent
freeze("agent-research-01");

// Freeze ALL agents (emergency stop)
freeze("*");
```

---

## unfreeze()

```typescript
function unfreeze(agentId: string): void
```

Removes the given agent ID from the FreezeRegistry. Subsequent requests for that agent will proceed normally.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | `string` | Yes | The agent ID to unfreeze. Use `"*"` to unfreeze the wildcard freeze. |

### Behavior

- **Safe**: Calling `unfreeze(id)` for an agent that isn't frozen completes without error
- **Immediate**: Takes effect for the very next request
- **Targeted**: `unfreeze("agent-01")` only unfreezes that specific agent — does not affect the wildcard freeze

### Example

```typescript
import { freeze, unfreeze } from "tealtiger";

freeze("agent-research-01");
// ... agent is blocked ...
unfreeze("agent-research-01");
// ... agent resumes normal operation ...
```

---

## FrozenAgentError

```typescript
class FrozenAgentError extends Error {
  readonly agentId: string;
  readonly frozenBy: "specific" | "wildcard";
  readonly frozenAt: number; // Unix timestamp
}
```

Thrown when a request is attempted on a frozen agent:

```typescript
try {
  await frozenClient.chat.completions.create({ /* ... */ });
} catch (err) {
  if (err instanceof FrozenAgentError) {
    console.log(err.agentId);   // "agent-research-01"
    console.log(err.frozenBy);  // "specific" or "wildcard"
  }
}
```

---

## Supported Providers

| Provider | Client Type | Import |
|----------|------------|--------|
| OpenAI | `OpenAI` | `import OpenAI from "openai"` |
| Anthropic | `Anthropic` | `import Anthropic from "@anthropic-ai/sdk"` |
| Google Gemini | `GoogleGenerativeAI` | `import { GoogleGenerativeAI } from "@google/generative-ai"` |
| AWS Bedrock | `BedrockRuntimeClient` | `import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"` |
| Azure OpenAI | `AzureOpenAI` | `import { AzureOpenAI } from "openai"` |
| Google Vertex AI | `VertexAI` | `import { VertexAI } from "@google-cloud/vertexai"` |
| Cohere | `CohereClient` | `import { CohereClient } from "cohere-ai"` |
| Mistral | `MistralClient` | `import MistralClient from "@mistralai/mistralai"` |
| DeepSeek | `OpenAI` (custom baseURL) | `import OpenAI from "openai"` |
| Groq | `Groq` | `import Groq from "groq-sdk"` |
| xAI | `OpenAI` (custom baseURL) | `import OpenAI from "openai"` |
| Together | `Together` | `import Together from "together-ai"` |
| HF-TGI | `HfInference` | `import { HfInference } from "@huggingface/inference"` |

### DeepSeek / xAI Example

```typescript
// DeepSeek uses OpenAI-compatible API
const deepseek = observe(
  new OpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey: process.env.DEEPSEEK_KEY })
);

// xAI uses OpenAI-compatible API
const xai = observe(
  new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.XAI_KEY })
);
```

---

## Complete Example

```typescript
import { observe, freeze, unfreeze } from "tealtiger";
import OpenAI from "openai";

// 1. Wrap with observe
const client = observe(new OpenAI(), {
  agentId: "demo-agent",
  sessionId: "session-001",
  baselineWindow: 20
});

// 2. Use normally
for (let i = 0; i < 25; i++) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Request ${i}` }]
  });
}

// 3. Check accumulated data
console.log(client.getCost());
// { session: 0.015, agent: 0.015, lastRequest: 0.0006, requestCount: 25 }

console.log(client.getBaseline());
// { requestCount: 20, complete: true, stats: { ... } }

// 4. Emergency stop
freeze("demo-agent");

try {
  await client.chat.completions.create({ /* ... */ });
} catch (err) {
  // FrozenAgentError: Agent "demo-agent" is frozen
}

// 5. Resume
unfreeze("demo-agent");
await client.chat.completions.create({ /* ... */ }); // Works again
```
