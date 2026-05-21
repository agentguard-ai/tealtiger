# TealDeepSeek Quickstart

This example shows how to create a guarded DeepSeek client with TealTiger. It demonstrates:

- creating a `TealDeepSeek` client;
- registering PII and content moderation guardrails;
- tracking DeepSeek request cost with model-specific pricing;
- attaching a daily budget and storing request cost records.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your DeepSeek API key:

```bash
export DEEPSEEK_API_KEY=sk-your-deepseek-key
```

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node examples/quickstart-deepseek/index.ts
```

## What It Does

The example sends two `chat.completions.create` requests through `TealDeepSeek`:

1. A basic prompt that prints the model response, token count, and tracked cost.
2. A PII prompt that triggers the PII guardrail in `redact` mode and prints the redacted text from the guardrail metadata.

At the end it prints a cost summary for the `deepseek-quickstart-agent` session.

## Notes

- `TealDeepSeek` uses the OpenAI-compatible `chat.completions.create` shape.
- The example registers DeepSeek pricing from `DEEPSEEK_PRICING` with `CostTracker` so cost metadata is non-zero for `deepseek-chat`.
- `ContentModerationGuardrail` uses local pattern matching here (`useOpenAI: false`) so the quickstart only needs a DeepSeek API key.
