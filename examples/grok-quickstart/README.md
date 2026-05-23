# TealXai (Grok) Quickstart

This example shows how to create a guarded xAI/Grok client with TealTiger. It demonstrates:

- creating a `TealXai` client;
- registering PII and content moderation guardrails;
- tracking xAI request cost with model-specific pricing;
- attaching a daily budget and storing request cost records.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your xAI API key:

```bash
export XAI_API_KEY=your-xai-api-key
```

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node examples/grok-quickstart/index.ts
```

## What It Does

The example sends two `chat.completions.create` requests through `TealXai`:

1. A basic prompt that prints the model response, token count, and tracked cost.
2. A PII prompt that triggers the PII guardrail in `redact` mode and prints the redacted text from the guardrail metadata.

At the end it prints a cost summary for the `xai-quickstart-agent` session.

## Notes

- `TealXai` uses the OpenAI-compatible `chat.completions.create` shape.
- The example registers xAI pricing from `XAI_PRICING` with `CostTracker` so cost metadata is non-zero for `grok-3`.
- `ContentModerationGuardrail` uses local pattern matching here (`useOpenAI: false`) so the quickstart only needs an xAI API key.
