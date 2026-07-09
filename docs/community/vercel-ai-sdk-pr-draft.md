# Vercel AI SDK Integration PR — Fixed Draft

## Instructions

1. Fork `vercel/ai` on GitHub (already forked at `agentguard-ai/ai`)
2. Create fresh branch from upstream main: `git checkout -b docs/tealtiger-governance-v2`
3. Create the example directory: `examples/node-tealtiger-governance/`
4. Add the files below
5. Push and open PR against `vercel/ai` main branch

## PR Title
```
docs(examples): add governance middleware example (tealtiger-ai-sdk)
```

## PR Description
```markdown
## Summary

Adds an example showing how to use `tealtiger-ai-sdk` as a governance middleware for the Vercel AI SDK. Demonstrates deterministic policy evaluation, PII redaction, cost tracking, and circuit breaking via the standard `LanguageModelV3Middleware` interface.

Closes #15841

## What this adds

- `examples/node-tealtiger-governance/` — A Node.js example demonstrating:
  - Zero-config governance middleware (PII detection, prompt injection blocking)
  - Cost tracking with per-session budget limits
  - Circuit breaker for cascading failures
  - Structured audit logging with correlation IDs
  - No LLM in the governance path (<5ms overhead)

## Fix from previous PR (#16004)

The Vercel bot flagged that the previous example used non-existent config keys. This version uses only real `TealTigerMiddlewareConfig` properties (`guardrails`, `policy`, `costTracking`, `circuitBreaker`, `secrets`) and compiles cleanly under `tsc --strict`.

## Testing

```bash
cd examples/node-tealtiger-governance
npm install
npx tsx src/index.ts
```

## Package

- npm: [tealtiger-ai-sdk](https://www.npmjs.com/package/tealtiger-ai-sdk) (v0.1.0)
- Source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-ai-sdk
- License: Apache-2.0
```

---

## Files to create

### `examples/node-tealtiger-governance/package.json`

```json
{
  "name": "node-tealtiger-governance",
  "version": "0.0.0",
  "private": true,
  "description": "Governance middleware example using tealtiger-ai-sdk",
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "ai": "latest",
    "@ai-sdk/openai": "latest",
    "tealtiger-ai-sdk": "^0.1.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

### `examples/node-tealtiger-governance/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

### `examples/node-tealtiger-governance/src/index.ts`

```typescript
/**
 * Governance Middleware Example — tealtiger-ai-sdk
 *
 * Demonstrates how to add deterministic governance to any AI SDK model
 * using the standard LanguageModelV3Middleware interface.
 *
 * Features shown:
 * - Zero-config PII detection and prompt injection blocking
 * - Cost tracking with per-session budget limits
 * - Circuit breaker for cascading failure prevention
 * - Structured audit logging with correlation IDs
 *
 * No LLM in the governance path — all evaluation is deterministic (<5ms).
 *
 * Run: npx tsx src/index.ts
 */

import { generateText, wrapLanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import tealtigerMiddleware from 'tealtiger-ai-sdk';

async function main() {
  // ─── Example 1: Zero-Config Governance ──────────────────────────────
  // No config = zero-config mode:
  // - PII detection enabled (email, SSN, credit card, phone)
  // - Prompt injection detection enabled
  // - Content moderation enabled
  // - All in observe mode (tracks but doesn't block)

  console.log('─── Example 1: Zero-Config Observe Mode ───\n');

  const observeModel = wrapLanguageModel({
    model: openai('gpt-4o-mini'),
    middleware: tealtigerMiddleware(),
  });

  const result1 = await generateText({
    model: observeModel,
    prompt: 'What is the capital of France?',
  });

  console.log('Response:', result1.text);
  console.log('(Governance: observed, not blocked)\n');

  // ─── Example 2: Policy Enforcement ──────────────────────────────────
  // Configure guardrails with explicit policy enforcement mode.
  // PII is redacted, prompt injection is blocked, cost is tracked.

  console.log('─── Example 2: Policy Enforcement ───\n');

  const enforcedModel = wrapLanguageModel({
    model: openai('gpt-4o-mini'),
    middleware: tealtigerMiddleware({
      policy: {
        mode: 'ENFORCE',
      },
      guardrails: {
        pii: {
          enabled: true,
          action: 'redact',
          detectTypes: ['email', 'ssn', 'credit_card'],
        },
        promptInjection: {
          enabled: true,
          action: 'block',
          sensitivity: 'medium',
        },
        contentModeration: {
          enabled: true,
          action: 'block',
        },
      },
      costTracking: {
        enabled: true,
        perSessionLimit: 1.0,
        dailyLimit: 10.0,
      },
    }),
  });

  const result2 = await generateText({
    model: enforcedModel,
    prompt: 'Summarize this: Contact john@example.com for details.',
  });

  console.log('Response:', result2.text);
  console.log('(PII "john@example.com" was redacted before reaching the model)\n');

  // ─── Example 3: Circuit Breaker + Secrets Detection ─────────────────
  // Prevent cascading failures and detect leaked credentials.

  console.log('─── Example 3: Circuit Breaker + Secrets ───\n');

  const resilientModel = wrapLanguageModel({
    model: openai('gpt-4o-mini'),
    middleware: tealtigerMiddleware({
      policy: {
        mode: 'ENFORCE',
      },
      circuitBreaker: {
        failureThreshold: 3,
        timeout: 30000,
        halfOpenRequests: 1,
      },
      secrets: {
        enabled: true,
        confidenceThreshold: 0.8,
      },
    }),
  });

  const result3 = await generateText({
    model: resilientModel,
    prompt: 'Hello world',
  });

  console.log('Response:', result3.text);
  console.log('(Circuit breaker: opens after 3 consecutive failures)');
  console.log('(Secrets: blocks API keys/tokens in prompts)\n');

  // ─── Example 4: Model Allowlisting ─────────────────────────────────
  // Restrict which models can be used.

  console.log('─── Example 4: Model Allowlisting ───\n');

  const restrictedModel = wrapLanguageModel({
    model: openai('gpt-4o-mini'),
    middleware: tealtigerMiddleware({
      registry: {
        enabled: true,
        allowedModels: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
      },
    }),
  });

  const result4 = await generateText({
    model: restrictedModel,
    prompt: 'What is 2 + 2?',
  });

  console.log('Response:', result4.text);
  console.log('(Only allowed models can be called — others are blocked)\n');

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('─── Governance Summary ───\n');
  console.log('All governance decisions are logged with:');
  console.log('- Correlation ID (UUID v4) per request');
  console.log('- Decision: ALLOW / DENY / REDACT');
  console.log('- Risk score (0-100)');
  console.log('- Evaluation time (<5ms)');
  console.log('- Cost tracked per request');
  console.log('- No LLM in the governance path');
}

main().catch(console.error);
```

### `examples/node-tealtiger-governance/README.md`

```markdown
# Governance Middleware Example — tealtiger-ai-sdk

This example demonstrates how to add deterministic governance to any Vercel AI SDK model using [tealtiger-ai-sdk](https://www.npmjs.com/package/tealtiger-ai-sdk).

## Features

- **PII Detection & Redaction** — Detects email, SSN, credit card, phone numbers in prompts
- **Prompt Injection Blocking** — Blocks known injection patterns before they reach the model
- **Cost Tracking** — Per-request, per-session, and daily budget limits
- **Circuit Breaker** — Prevents cascading failures with automatic cooldown
- **Secret Detection** — Blocks API keys, tokens, credentials in prompts
- **Model Allowlisting** — Restrict which models agents can use
- **Structured Audit** — Correlation IDs, risk scores, evaluation time logging

All governance is deterministic and in-process — no LLM in the governance path, <5ms overhead.

## Running

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your-key

# Install dependencies
npm install

# Run the example
npx tsx src/index.ts
```

## Configuration

The middleware accepts a `TealTigerMiddlewareConfig` object:

```typescript
import tealtigerMiddleware from 'tealtiger-ai-sdk';

const middleware = tealtigerMiddleware({
  // Policy enforcement mode
  policy: { mode: 'ENFORCE' },

  // Guardrails configuration
  guardrails: {
    pii: { enabled: true, action: 'redact', detectTypes: ['email', 'ssn'] },
    promptInjection: { enabled: true, action: 'block' },
    contentModeration: { enabled: true, action: 'block' },
  },

  // Cost tracking
  costTracking: { enabled: true, perSessionLimit: 5.0, dailyLimit: 50.0 },

  // Circuit breaker
  circuitBreaker: { failureThreshold: 5, timeout: 60000, halfOpenRequests: 3 },

  // Secret detection
  secrets: { enabled: true, confidenceThreshold: 0.8 },

  // Model allowlisting
  registry: { enabled: true, allowedModels: ['openai/gpt-4o-mini'] },

  // Fail-open mode (default: false = fail-closed)
  failOpen: false,
});
```

## How It Works

`tealtiger-ai-sdk` implements `LanguageModelV3Middleware`, hooking into:

- `transformParams` — PII redaction, injection detection, secrets scanning (pre-request)
- `wrapGenerate` — Cost tracking, circuit breaker, audit logging, policy evaluation
- `wrapStream` — Same governance for streaming responses

## Zero-Config Mode

Calling `tealtigerMiddleware()` with no arguments enables:
- PII detection (observe only)
- Prompt injection detection (observe only)
- Content moderation (observe only)
- Cost tracking
- Audit logging

No blocking in zero-config mode — governance observes and logs without denying requests.

## Links

- [tealtiger-ai-sdk on npm](https://www.npmjs.com/package/tealtiger-ai-sdk)
- [TealTiger Documentation](https://docs.tealtiger.ai)
- [Source Code](https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-ai-sdk)
- [TealTigerMiddlewareConfig API](https://github.com/agentguard-ai/tealtiger/blob/main/packages/tealtiger-ai-sdk/src/types/config.ts)
```
