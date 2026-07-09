---
title: "Zero-Config Observe Mode"
description: "How observe() provides full-stack visibility with zero configuration — the Level 0 entry point to TealTiger's progressive governance."
---

# Zero-Config Observe Mode

`observe()` is the easiest way to start with TealTiger. One function call, no configuration, immediate visibility into your agent's behavior.

---

## Progressive Disclosure

TealTiger follows a four-level progressive disclosure path. You start at Level 0 and graduate when you're ready:

<img src="/diagrams/progressive-disclosure.svg" alt="Progressive disclosure levels" />

| Level | Name | What You Get | What You Configure |
|-------|------|-------------|-------------------|
| **0** | Observe | Cost tracking, audit logging, PII detection (report-only), behavioral baseline, kill switch | Nothing — zero config |
| **1** | Explicit Policies | Enforcement, tool allowlists, budget limits, guardrails | Policy configuration (JSON/code) |
| **2** | FREEZE Rules | Immutable safety boundaries that cannot be overridden at runtime | FREEZE rule definitions |
| **3** | Signed Bundles | Cryptographic evidence, tamper-proof audit, compliance artifacts | Bundle and signing configuration |

Each level is additive. Level 1 includes everything from Level 0. Level 2 includes everything from Level 1. You never lose capabilities by graduating.

---

## How observe() Works Internally

When you call `observe(client)`, TealTiger creates a transparent proxy around your provider client:

<img src="/diagrams/observe-proxy-flow.svg" alt="observe() proxy request flow" />

### Key Properties

1. **Transparent**: The proxy exposes the same API surface as the original client. Every method, every parameter, every response — identical.
2. **Non-blocking**: Nothing is ever blocked in observe mode. PII detection logs findings but never interferes with the request.
3. **In-process**: No network calls, no proxies, no sidecars, no external services. Everything runs in your process.
4. **Deterministic**: No LLM in the governance path. Same input always produces the same instrumentation behavior.
5. **Low overhead**: Less than 5ms added per request (P99). The provider network call dominates total latency.

---

## Proxy Wrapping

The proxy uses language-native mechanisms to intercept method calls:

- **TypeScript**: ES6 Proxy with handler traps for `get` and `apply`
- **Python**: `__getattr__` delegation with async/sync method detection

The proxy detects which methods trigger LLM calls (e.g., `chat.completions.create`, `messages.create`) and instruments only those. Utility methods, configuration setters, and non-API methods pass through with zero overhead.

---

## Cost Accumulator

The cost accumulator extracts token usage from provider responses and computes cost using TealTiger's built-in pricing database:

```
Per-request cost = (input_tokens × input_price) + (output_tokens × output_price)
```

Costs are aggregated at three levels:
- **Per-request**: Individual call cost
- **Per-session**: Sum of all requests in this `observe()` session
- **Per-agent**: Sum of all requests across all sessions for this `agentId`

When the provider doesn't return token usage (rare, but possible), the cost is recorded as zero with a `pricing_unavailable` flag.

---

## PII Scanner

The PII scanner uses TealTiger's existing `PIIDetectionGuardrail` running in `REPORT_ONLY` mode:

- **Scans both inputs and outputs** for every request
- **Detects**: Email addresses, phone numbers, SSNs, credit card numbers
- **Never blocks**: Even if PII is found, the request proceeds normally
- **Logs findings**: PII type, count, and request ID written to audit log (never the PII values themselves)
- **Fails silently**: If the scanner errors internally, the request continues as if no scan occurred

---

## Baseline Construction

The behavioral baseline automatically builds a statistical profile of your agent's "normal" behavior:

1. Collects metrics for the first N requests (default: 100)
2. Records: latency, input tokens, output tokens, cost, tool call count
3. Once N requests are processed, computes p50, p95, p99 for each metric
4. Marks the baseline as complete and writes a `baseline_complete` audit event

After completion, the baseline is frozen — subsequent requests don't modify it. Access it via:

```typescript
const baseline = client.getBaseline();
// { requestCount: 100, stats: { latency: { p50: 450, p95: 1200, p99: 2100 }, ... } }
```

---

## When to Use observe() vs Explicit Governance

| Scenario | Recommendation |
|----------|---------------|
| **New project, exploring** | Start with `observe()` — understand behavior before writing policies |
| **Production system, no governance yet** | Start with `observe()` — get visibility without risk |
| **Known security requirements** | Use explicit policies (`TealGuard`) from day one |
| **Compliance-mandated blocking** | Use explicit policies with ENFORCE mode |
| **Multi-agent system with role separation** | Use `observe()` + `perRole()` — combines visibility with role enforcement |
| **Incident response** | Use `freeze()` — works whether you have policies or not |

The general rule: if you know what to block, use policies. If you don't yet, use observe.

---

## Supported Providers

`observe()` supports all 14 LLM provider clients:

| Provider | TypeScript | Python |
|----------|-----------|--------|
| OpenAI | `new OpenAI()` | `openai.OpenAI()` |
| Anthropic | `new Anthropic()` | `anthropic.Anthropic()` |
| Google Gemini | `new GoogleGenerativeAI()` | `genai.GenerativeModel()` |
| AWS Bedrock | `new BedrockRuntimeClient()` | `boto3.client("bedrock-runtime")` |
| Azure OpenAI | `new AzureOpenAI()` | `openai.AzureOpenAI()` |
| Google Vertex AI | `new VertexAI()` | `vertexai.generative_models` |
| Cohere | `new CohereClient()` | `cohere.Client()` |
| Mistral | `new MistralClient()` | `mistralai.Mistral()` |
| DeepSeek | `new OpenAI({ baseURL })` | `openai.OpenAI(base_url=...)` |
| Groq | `new Groq()` | `groq.Groq()` |
| xAI | `new OpenAI({ baseURL })` | `openai.OpenAI(base_url=...)` |
| Together | `new Together()` | `together.Together()` |
| HF-TGI | `new HfInference()` | `huggingface_hub.InferenceClient()` |

If an unsupported client is passed, `observe()` throws an `UnsupportedProviderError` identifying the type.

---

## Air-Gapped and Offline Deployment

`observe()` works in air-gapped environments with no internet connectivity. It:

- Makes zero outbound network calls for instrumentation
- Does not require a proxy, sidecar, or external service
- Does not phone home, check licenses, or download updates
- Stores all data in-process (memory + local audit output)

The only network call is the one your application already makes to the LLM provider.
