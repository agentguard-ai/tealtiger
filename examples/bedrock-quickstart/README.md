# TealBedrock Quickstart — Multi-Model Routing

This example shows how to create a guarded Bedrock client with TealTiger and
route requests to different models based on task type. It demonstrates:

- creating a `TealBedrock` client with AWS credentials;
- registering PII and content moderation guardrails;
- tracking Bedrock request cost with per-model pricing;
- attaching a daily budget and storing request cost records;
- a **multi-model router** that selects Claude (reasoning), Llama (code),
  Titan (summarisation), Cohere (creative), or Haiku (fast Q&A) depending on
  the task.

## Setup

Install the runtime dependencies from a TypeScript project:

```bash
npm install tealtiger ts-node typescript @types/node
```

Set your AWS credentials (the IAM principal needs `bedrock:InvokeModel`):

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

Run the quickstart from the TealTiger repository root:

```bash
npx ts-node examples/bedrock-quickstart/index.ts
```

## What It Does

The example sends five `invokeModel` requests through `TealBedrock`, each
routed to a different model via the `routeForTask` function:

1. **Reasoning** → `anthropic.claude-v2` — complex analysis.
2. **Code** → `meta.llama2-70b-chat-v1` — code generation.
3. **Summary** → `amazon.titan-text-express-v1` — summarisation.
4. **Creative** → `cohere.command-text-v14` — creative writing.
5. **Quick Q&A** → `anthropic.claude-3-haiku-20240307-v1:0` — fast & cheap.

Every request runs through the PII and content moderation guardrails. Cost
is tracked per request and accumulated in the daily budget. At the end a
session-level cost summary is printed.

## Notes

- The IAM principal must have `bedrock:InvokeModel` permission for *all* of
  the model IDs used in this example. In production, scope the policy to only
  the models your application needs.
- Per-model pricing is registered explicitly via `addCustomPricing` so that
  `CostTracker` reports non-zero cost metadata. Update the values from the
  [AWS Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/) if
  they change.
- `ContentModerationGuardrail` uses local pattern matching here
  (`useOpenAI: false`) so the quickstart only needs AWS credentials.
