# Vercel AI SDK Governance Example

This example shows TealTiger governance as middleware around Vercel AI SDK
`generateText()` and `streamText()` calls in a minimal Next.js API route.

## Architecture

```text
POST /api/chat
  -> extract user ID from body or x-user-id header
  -> estimate request cost for the selected model
  -> run TealEngine policy evaluation
  -> run a PII guardrail on the latest user message
  -> check the user's daily budget
  -> ALLOW: call generateText() or streamText()
  -> DENY: return 403 with governance metadata
  -> record model usage with CostTracker after completion
```

The route returns governance metadata in response headers:

- `x-tealtiger-action`
- `x-tealtiger-request-id`
- `x-tealtiger-user-id`
- `x-tealtiger-policy-allowed`
- `x-tealtiger-pii-action`
- `x-tealtiger-pii-risk`
- `x-tealtiger-estimated-cost-usd`
- `x-tealtiger-budget-remaining-usd`

## Setup

From the repository root, initialize the TypeScript SDK submodule and install the
example dependencies:

```bash
git submodule update --init packages/tealtiger-sdk
cd examples/vercel-ai-governance
npm install
```

AI SDK v6 can route plain `provider/model` strings through Vercel AI Gateway. For
local development, link a Vercel project and pull environment variables:

```bash
vercel link
vercel env pull .env.local
```

Optional configuration:

```bash
export AI_MODEL="openai/gpt-5.4"
export TEALTIGER_USER_DAILY_BUDGET_USD="1.00"
export TEALTIGER_INPUT_COST_PER_1K="0.00125"
export TEALTIGER_OUTPUT_COST_PER_1K="0.01"
export TEALTIGER_ESTIMATED_OUTPUT_TOKENS="500"
export TEALTIGER_PII_ACTION="block"
```

Use placeholder values in docs and local examples. Do not commit real provider
tokens, Vercel OIDC values, or AI Gateway credentials.

## Run

Typecheck the example:

```bash
npm run typecheck
```

Start Next.js:

```bash
npm run dev
```

Send a non-streaming request:

```bash
curl -i http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -H "x-user-id: user_123" \
  -d '{"prompt":"Explain TealTiger governance in one sentence."}'
```

Send a streaming request:

```bash
curl -i http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -H "x-user-id: user_123" \
  -d '{"stream":true,"prompt":"Write a short checklist for AI policy review."}'
```

Try a PII request:

```bash
curl -i http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -H "x-user-id: user_123" \
  -d '{"prompt":"Email Taylor at taylor@example.com with the full report."}'
```

With the default `TEALTIGER_PII_ACTION=block`, TealTiger returns `403` before the
LLM call. Set `TEALTIGER_PII_ACTION=redact` to redact supported PII before the
prompt is sent to the model.

## Files

- `app/api/chat/route.ts` wraps AI SDK `generateText()` and `streamText()` calls.
- `lib/tealtiger-governance.ts` owns TealEngine policy evaluation, PII guardrail
  execution, per-user budgets, response headers, and CostTracker records.

## Notes

- The in-memory budget store is intentionally simple for the example. Production
  apps should back `CostStorage` with durable storage.
- The route uses a local SDK source import so it typechecks inside this monorepo.
  In a standalone Next.js app, install `tealtiger` and replace those local imports
  with package imports.
- No real API keys are included.
