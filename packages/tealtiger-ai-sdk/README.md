# tealtiger-ai-sdk

TealTiger governance middleware for the [Vercel AI SDK](https://ai-sdk.dev/) — deterministic policy evaluation, guardrails, cost tracking, circuit breaking, and audit logging for all LLM calls.

[![npm](https://img.shields.io/npm/v/tealtiger-ai-sdk)](https://www.npmjs.com/package/tealtiger-ai-sdk)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Coverage](https://codecov.io/gh/agentguard-ai/tealtiger/branch/main/graph/badge.svg?flag=tealtiger-ai-sdk)](https://app.codecov.io/gh/agentguard-ai/tealtiger?flags%5B0%5D=tealtiger-ai-sdk)

## Quick Start

```bash
npm install tealtiger-ai-sdk ai @ai-sdk/openai tealtiger-sdk@npm:tealtiger
```

```typescript
import { wrapLanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import tealtigerMiddleware from 'tealtiger-ai-sdk';

// Zero-config: PII detection, prompt injection, content moderation enabled
const model = wrapLanguageModel({
  model: openai('gpt-4'),
  middleware: tealtigerMiddleware(),
});
```

That's it. Every call through `model` is now governed.

## What It Does

The middleware intercepts LLM calls at three hook points:

| Hook | Phase | Governance |
|------|-------|-----------|
| `transformParams` | Pre-request | PII redaction, prompt injection detection, secret scanning, model allowlisting |
| `wrapGenerate` | Non-streaming | Policy evaluation, circuit breaker, budget enforcement, output guardrails, audit logging |
| `wrapStream` | Streaming | Same as wrapGenerate, with stream chunk accumulation |

## Configuration

```typescript
import tealtigerMiddleware from 'tealtiger-ai-sdk';

const middleware = tealtigerMiddleware({
  // Guardrails (all enabled by default in zero-config)
  guardrails: {
    pii: true,
    promptInjection: true,
    contentModeration: true,
    output: { contentModeration: true },
  },

  // Policy evaluation via TealEngine
  policy: { mode: 'ENFORCE' },

  // Circuit breaker per provider
  circuitBreaker: {
    failureThreshold: 5,
    timeout: 60000,
    halfOpenRequests: 3,
  },

  // Cost tracking and budget limits
  costTracking: {
    enabled: true,
    perRequestLimit: 0.50,
    dailyLimit: 50.00,
    anomalyThreshold: 200,
  },

  // Audit logging
  audit: {
    enabled: true,
    includeTraceIds: true,
  },

  // Secret detection
  secrets: { enabled: true, confidenceThreshold: 0.8 },

  // Model allowlisting
  registry: {
    enabled: true,
    allowedModels: ['openai/gpt-4', 'anthropic/claude-3-opus'],
  },

  // Fail behavior (default: fail-closed)
  failOpen: false,
  moduleTimeout: 5000,
});
```

## Error Handling

The middleware throws typed errors you can catch:

```typescript
import {
  PolicyViolationError,
  GuardrailViolationError,
  CircuitOpenError,
  BudgetExceededError,
} from 'tealtiger-ai-sdk';

try {
  const result = await generateText({ model, prompt: 'Hello' });
} catch (error) {
  if (error instanceof PolicyViolationError) {
    console.log('Blocked:', error.decision.reason_codes);
  } else if (error instanceof CircuitOpenError) {
    console.log(`${error.provider} is down, retry in ${error.retryAfterMs}ms`);
  } else if (error instanceof BudgetExceededError) {
    console.log(`${error.budgetType} limit reached, $${error.remainingBudget} remaining`);
  }
}
```

## How It Works

1. **Composition, not reimplementation** — delegates to existing TealTiger v1.2 components (TealEngineV12, TealGuard, TealCircuit, TealAudit, CostTracker, TealSecrets, TealRegistry)
2. **Synchronous factory, lazy init** — `tealtigerMiddleware()` returns instantly; async module setup happens on first call
3. **Deterministic** — identical inputs produce identical decisions, no LLM in the governance path
4. **Fail-closed by default** — if governance evaluation fails, requests are denied (configurable)
5. **Correlation IDs** — UUID v4 links all decisions, logs, and cost records for a single request

## Policy Files

Load external policy files:

```typescript
const middleware = tealtigerMiddleware({
  policyPath: './governance/policy.json',
});
```

```json
{
  "mode": "ENFORCE",
  "policyId": "production-v1",
  "rules": [
    {
      "id": "block-dangerous",
      "name": "Block dangerous prompts",
      "condition": "input.contains('hack')",
      "action": "DENY"
    }
  ]
}
```

## Peer Dependencies

| Package | Version |
|---------|---------|
| `ai` (Vercel AI SDK) | ≥3.0.0 |
| `tealtiger-sdk` | ≥1.2.0 |

## Build

Dual ESM + CJS output targeting ES2020:

```bash
npm run build     # produces dist/index.mjs + dist/index.js + .d.ts files
npm run test      # vitest (430+ tests including property-based)
npm run typecheck # tsc --noEmit
```

## Examples

- [Next.js App Router chat](./examples/nextjs-app-router/) — wraps a Vercel AI
  SDK model with `tealtigerMiddleware()` and displays governance metadata in a
  `useChat` client.

## License

Apache-2.0
