# Why TealTiger?

TealTiger is useful when AI governance needs to move from scattered application checks into a consistent runtime policy layer. A small prototype can start with inline `if` statements and a few log calls. The harder part is scaling: keeping cost limits, PII checks, model policy, audit evidence, and provider coverage consistent as you add more agents, teams, and providers.

## TealTiger vs. DIY governance

DIY governance usually starts simple. The application owns every check, every log field, every provider-specific cost estimate, and every place where a policy decision can drift.

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

With TealTiger, the policy decision is configured at the governed client layer, so application code can stay focused on the model call.

```typescript
const client = new TealOpenAI({ apiKey, guardrails, budget });
const response = await client.chat.completions.create(request);
return response;
```

The shorter code is not the only benefit. The value is that cost, safety, and evidence handling is applied consistently across calls instead of copied manually into each path.

## What TealTiger gives you out of the box

- Deterministic governance decisions in the request path, without an LLM deciding safety policy.
- Cost tracking and budget enforcement across model calls.
- Guardrails for PII detection, prompt injection prevention, content moderation, secret detection, and custom rules.
- Audit and redaction support for structured evidence.
- Provider coverage for OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, Cohere, Mistral AI, DeepSeek, Groq, Together AI, Hugging Face TGI, and xAI.
- A shared place to evolve policy as agent and provider usage grows.

## Trade-offs

TealTiger does not replace good policy design, provider operations, or broader security review. Teams still define budgets, allowed models, PII handling, retention, and operational boundaries.

For small internal experiments or narrow workflows, DIY checks may be sufficient. TealTiger becomes the better fit when governance behavior needs to be reused, reviewed, and extended across more than one provider or agent workflow.
