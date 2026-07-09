# tealtiger

[![PyPI version](https://img.shields.io/pypi/v/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![Python versions](https://img.shields.io/pypi/pyversions/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Deterministic governance for AI agents.** Cost tracking, audit logging, guardrails, and policy enforcement — in-process, <5ms overhead, no LLM in the governance path.

![Dashboard](https://raw.githubusercontent.com/agentguard-ai/TealTiger/main/assets/dashboard-overview.png)

---

## observe() — Zero-Config Entry Point

One line. No config files, no policies, no infrastructure. Wrap any LLM client and get instant visibility.

```python
from tealtiger import observe, freeze, unfreeze
client = observe(OpenAI())
response = client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": "Hello"}])
```

You now have: per-request cost tracking, structured audit log with correlation IDs, behavioral baseline construction (P50/P95/P99), PII detection in REPORT_ONLY mode, and an emergency kill switch.

---

## Sync and Async Usage

### Synchronous

```python
from tealtiger import observe, freeze, unfreeze
from openai import OpenAI

client = observe(OpenAI())
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Summarize this document."}]
)
print(client.get_cost())  # ObserveCostSummary(total_cost=0.0041, request_count=1, ...)
```

### Asynchronous

```python
from tealtiger import observe_async, freeze, unfreeze
from openai import AsyncOpenAI

client = observe_async(AsyncOpenAI())
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Summarize this document."}]
)
print(client.get_cost())
```

---

## Progressive Path to Governance

Start with zero config, add policies when you're ready.

### Level 0: Observe (zero config)

```python
from tealtiger import observe, freeze, unfreeze

client = observe(OpenAI())
# All calls instrumented — cost, audit, baseline, PII scan
# Emergency stop:
freeze()      # blocks all requests immediately
unfreeze()    # resume
```

### Level 1: Budget limits

```python
from tealtiger import observe

client = observe(OpenAI(), budget={"max_cost_per_request": 0.50, "max_cost_per_day": 25.00})
```

### Level 2: Guardrails

```python
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    guardrails={"pii_detection": True, "prompt_injection": True, "content_moderation": True},
    budget={"max_cost_per_request": 0.50},
)
```

### Level 3: Full governance (TealEngine policies)

```python
from tealtiger import TealEngine

engine = TealEngine(policy_path="./policies/")
# Deterministic policy evaluation, structured evidence, FREEZE rules
```

---

## Features

| Feature | Description |
|---------|-------------|
| **observe()** | Zero-config instrumentation — cost, audit, baseline, PII in one line |
| **freeze() / unfreeze()** | Instant kill switch — <5ms propagation, no config required |
| **Multi-Stage Defense** | Pre-execution guardrails + post-execution output scanning |
| **Post-Execution Governance** | Scan model outputs for PII leaks, secrets, policy violations |
| **Role-Based Policies** | Per-agent, per-role governance with scoped authority |
| **Dashboard** | Local-first governance dashboard — `tealtiger dashboard` |

---

## Supported Providers

| Provider | Status | Models |
|----------|--------|--------|
| OpenAI | ✅ | GPT-4o, GPT-4, GPT-3.5, o1, o3 |
| Anthropic | ✅ | Claude 3.5 Sonnet, Claude 3 Opus/Haiku |
| Google Gemini | ✅ | Gemini 1.5 Pro, Flash, Ultra |
| AWS Bedrock | ✅ | Claude, Titan, Command, Llama, Jurassic |
| Azure OpenAI | ✅ | Deployment-based routing |
| Cohere | ✅ | Command R+, Embed, Rerank |
| Mistral AI | ✅ | Mistral Large, Medium, Small |
| DeepSeek | ✅ | DeepSeek-V3, DeepSeek-R1 |
| Groq | ✅ | Llama 3, Mixtral (ultra-low latency) |
| xAI (Grok) | ✅ | Grok-2, Grok-1.5 |
| Together AI | ✅ | Open-source model hosting |
| HuggingFace TGI | ✅ | Self-hosted inference |
| Fireworks AI | ✅ | Optimized open-source inference |
| Perplexity | ✅ | Search-augmented generation |

---

## Install

```bash
pip install tealtiger
```

Requires Python 3.8+. Zero runtime dependencies beyond the provider SDK you're already using.

---

## Key Properties

- **Deterministic** — Same input + same policy = same decision, every time
- **No LLM in governance path** — Pure logic, no probabilistic filters
- **<5ms overhead** — Governance runs in-process, no network hops
- **Offline-capable** — No SaaS dependency, no telemetry phone-home
- **Apache 2.0** — Fully open source

---

## Documentation

Full docs at [docs.tealtiger.ai](https://docs.tealtiger.ai)

- [Quick Start](https://docs.tealtiger.ai/quickstart)
- [observe() API Reference](https://docs.tealtiger.ai/api/observe)
- [Policy Authoring Guide](https://docs.tealtiger.ai/policies)
- [Provider Configuration](https://docs.tealtiger.ai/providers)
- [Dashboard](https://docs.tealtiger.ai/dashboard)
- [Examples](https://github.com/agentguard-ai/tealtiger/tree/main/examples)

---

## License

Apache 2.0 — [LICENSE](https://github.com/agentguard-ai/tealtiger/blob/main/LICENSE)
