# TealGemini Quickstart

This example shows how to create a guarded Gemini client with TealTiger. It demonstrates:

- creating a `TealGemini` client;
- registering PII and content moderation guardrails;
- tracking Gemini request cost with model-specific pricing;
- attaching a daily budget and storing request cost records.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your Gemini API key:

```bash
export GEMINI_API_KEY=your-gemini-api-key
```

Copy `.env.example` in this directory if you prefer loading environment
variables from a file, and replace only the placeholder value.

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node examples/gemini-quickstart/index.ts
```

## What It Does

The example sends two `generateContent` requests through `TealGemini`:

1. A basic prompt that prints the model response, token count, and tracked cost.
2. A PII prompt that triggers the PII guardrail in `redact` mode and prints the redacted text from the guardrail metadata.

At the end it prints a cost summary for the `gemini-quickstart-agent` session.

## Notes

- `TealGemini` uses the Google AI SDK `generateContent` API shape.
- The example registers Gemini pricing from `GEMINI_PRICING` with `CostTracker` so cost metadata is non-zero for `gemini-pro`.
- `ContentModerationGuardrail` uses local pattern matching here (`useOpenAI: false`) so the quickstart only needs a Gemini API key.
