# TealGroq Quickstart

This example shows how to create a guarded Groq client with TealTiger. It demonstrates:

- creating a `TealGroq` client;
- using a fast Groq-hosted Llama model;
- registering PII and content moderation guardrails;
- measuring request latency;
- tracking Groq request cost with model-specific pricing;
- attaching a daily budget and storing request cost records.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your Groq API key:

```bash
export GROQ_API_KEY=your-groq-api-key
```

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node examples/groq-quickstart/index.ts
```

## What It Does

The example sends two `chat.completions.create` requests through `TealGroq`:

1. A basic prompt that prints the model response, measured latency, Groq-reported timing, token count, and tracked cost.
2. A PII prompt that triggers the PII guardrail in `redact` mode and prints the redacted text from the guardrail metadata.

At the end it prints a cost summary for the `groq-quickstart-agent` session.

## Notes

- `TealGroq` uses Groq's OpenAI-compatible `chat.completions.create` shape.
- The example uses `llama-3.1-8b-instant` to highlight Groq's low-latency inference path.
- The example registers Groq pricing from `GROQ_PRICING` with `CostTracker` so cost metadata is non-zero for the selected model.
- `ContentModerationGuardrail` uses local pattern matching here (`useOpenAI: false`) so the quickstart only needs a Groq API key.
