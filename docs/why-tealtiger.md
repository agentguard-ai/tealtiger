# Why TealTiger?

TealTiger is useful when AI governance needs to move from scattered application
checks into a consistent runtime policy layer. A small prototype can often get by
with inline `if` statements and a few log calls. The harder part comes later:
keeping cost limits, PII checks, model policy, audit evidence, and provider
coverage consistent as more agents, teams, and LLM providers are added.

## TealTiger vs. DIY governance

DIY governance usually starts simple. The application owns every check, every
log field, every provider-specific cost estimate, and every place where a policy
decision can drift.

```typescript
const cost = estimateCost(request);
if (cost > dailyBudgetRemaining) throw new Error("Budget exceeded");
if (containsPII(request.messages)) throw new Error("PII detected");
if (!allowedModels.has(request.model)) throw new Error("Model denied");
const startedAt = Date.now();
const response = await openai.chat.completions.create(request);
auditLog.push({ model: request.model, cost, startedAt, userId });
await writeCostRecord(userId, cost);
await writeSecurityEvent(userId, "checked");
return response;
```

With TealTiger, the policy decision is configured at the governed client layer,
so application code can stay focused on the model call.

```typescript
const client = new TealOpenAI({ apiKey, guardrails, budget });
const response = await client.chat.completions.create(request);
return response;
```

The shorter code is not the main benefit by itself. The value is that the same
kind of cost, safety, and evidence handling can be reused instead of copied into
each request path by hand.

## What TealTiger gives you out of the box

- Deterministic governance decisions in the request path, without using an LLM
  to decide whether governance rules apply.
- Cost tracking and budget enforcement across model calls.
- Guardrails for PII detection, prompt injection prevention, content
  moderation, secret detection, and custom rules.
- Audit and redaction support for structured evidence.
- Provider coverage for OpenAI, Anthropic, Google Gemini, AWS Bedrock,
  Azure OpenAI, Cohere, Mistral AI, DeepSeek, Groq, Together AI,
  Hugging Face TGI, and xAI.
- A shared place to evolve policy as agent and provider usage grows.

## Trade-offs

TealTiger does not remove the need to define good policies. Teams still need to
decide budget limits, allowed models, PII handling, audit retention, and
deployment modes. It also does not replace provider monitoring, application
security review, or a compliance program.

DIY checks can still be reasonable for a small experiment, a single provider, or
one-off internal tooling where the policy surface is tiny. TealTiger becomes a
better fit when the same governance behavior needs to be applied repeatedly,
reviewed, or extended across more than one provider or agent workflow.

## Summary

Use DIY checks when the scope is narrow and temporary. Use TealTiger when
governance needs to be explicit, reusable, and easier to review across cost,
safety, evidence, and provider boundaries.
