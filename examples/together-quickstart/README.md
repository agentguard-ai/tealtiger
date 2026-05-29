# TealTogether Quickstart

This example shows how to create a guarded Together AI client with TealTiger. It demonstrates:

- creating a `TealTogether` client;
- using a Together-hosted open-source Llama model;
- registering PII and content moderation guardrails;
- tracking Together AI request cost with model-specific pricing;
- attaching a daily budget and storing request cost records.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your Together AI API key:

```bash
export TOGETHER_API_KEY=your-together-api-key
```

Copy `.env.example` in this directory if you prefer loading environment
variables from a file, and replace only the placeholder value.

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node --project examples/together-quickstart/tsconfig.json examples/together-quickstart/index.ts
```

## What It Does

The example sends two `chat.completions.create` requests through `TealTogether`:

1. A basic prompt that prints the model response, token count, and tracked cost.
2. A PII prompt that triggers the PII guardrail in `redact` mode and prints the redacted text from the guardrail metadata.

At the end it prints a cost summary for the `together-quickstart-agent` session.

## Notes

- `TealTogether` uses Together AI's OpenAI-compatible `chat.completions.create` shape.
- The example uses `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` to show an open-source model hosted by Together AI.
- The example registers Together AI pricing from `TOGETHER_PRICING` with `CostTracker` so cost metadata is non-zero for the selected model.
- `ContentModerationGuardrail` uses local pattern matching here (`useOpenAI: false`) so the quickstart only needs a Together AI API key.
