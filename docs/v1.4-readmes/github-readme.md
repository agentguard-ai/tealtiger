# TealTiger

<div align="center">

<img src=".github/logo/tealtiger-logo-256.png" alt="TealTiger Logo" width="200">

**Deterministic Governance for AI Agents**

Cost tracking, guardrails, audit logging, and policy enforcement for LLM applications.
In-process. <5ms overhead. No LLM in the governance path. Works with any provider.

[![npm version](https://img.shields.io/npm/v/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
[![PyPI version](https://img.shields.io/pypi/v/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://github.com/agentguard-ai/tealtiger/actions/workflows/test.yml/badge.svg)](https://github.com/agentguard-ai/tealtiger/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/codecov/c/github/agentguard-ai/tealtiger)](https://codecov.io/gh/agentguard-ai/tealtiger)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/agentguard-ai/tealtiger/badge)](https://securityscorecards.dev/viewer/?uri=github.com/agentguard-ai/tealtiger)
[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289da?logo=discord&logoColor=white)](https://discord.gg/X2ePf8QAj)
[![Governed by TealTiger](./assets/badges/governed-by-tealtiger.svg)](https://github.com/agentguard-ai/tealtiger)

<br>

<a href="https://www.nvidia.com/en-us/startups/">
  <img src=".github/logo/nvidia-inception-badge.svg" alt="NVIDIA Inception Program" width="250">
</a>

<br>

[Website](https://tealtiger.co.in) · [Docs](https://docs.tealtiger.ai) · [Examples](./examples) · [Discord](https://discord.gg/X2ePf8QAj) · [Blog](https://blogs.tealtiger.ai)

</div>

---

## Why TealTiger?

AI agents are powerful. They're also unpredictable, expensive, and difficult to audit.

TealTiger gives you **deterministic governance** — the same input with the same policy produces the same decision, every time. No probabilistic filters. No LLM judging another LLM. Pure logic.

Every governance decision produces a structured, reconstructable record. Every verdict traces to the human who authored the policy. Every cost is tracked to the penny.

**Start with one line. Grow into full governance.**

![Progressive Disclosure](./assets/progressive-disclosure.svg)

---

## Quick Start

### observe() — Zero-Config (Recommended)

The fastest path from zero to visibility. No config files, no policies. One line.

**TypeScript:**

```typescript
import { observe, freeze } from 'tealtiger';

const client = observe(new OpenAI());
const res = await client.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] });

console.log(client.getCost());       // per-request and cumulative cost
console.log(client.getBaseline());   // behavioral baseline after 100 requests
freeze();                            // emergency kill switch — <5ms
```

**Python:**

```python
from tealtiger import observe, freeze

client = observe(OpenAI())
response = client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": "Hello"}])

print(client.get_cost())       # per-request and cumulative cost
print(client.get_baseline())   # behavioral baseline after 100 requests
freeze()                       # emergency kill switch — <5ms
```

**What `observe()` gives you automatically:**
- Per-request cost tracking across 14 providers
- Structured audit log with correlation IDs
- Behavioral baseline (P50/P95/P99 latency, cost, tokens)
- PII detection in REPORT_ONLY mode
- Emergency kill switch via `freeze()` / `unfreeze()`

No config. Under 5ms overhead per call.

---

## Features

### 🔭 observe() — Zero-Config Instrumentation
One-line wrapper for any supported LLM client. Instant cost tracking, audit logging, behavioral baselines, and PII detection with no configuration.

### 🛡️ Security Guardrails
- **PII Detection** — Detect and redact sensitive information
- **Prompt Injection Prevention** — Block malicious injection attempts
- **Content Moderation** — Filter toxic or harmful content
- **Secret Detection** — 500+ patterns across 9 categories

### 💰 Cost Governance
- **Budget Enforcement** — Hard limits per request, session, and day
- **Real-Time Tracking** — Per-agent, per-session cost attribution
- **Anomaly Detection** — Governance-owned ceilings with statistical deviation alerts
- **Circuit Breakers** — Automatic halt on runaway cost loops

### 🏗️ TealEngine — Deterministic Policy Evaluation
- **ENFORCE / MONITOR / REPORT_ONLY** modes
- **FREEZE Rules** — Immutable emergency kill switches with tamper detection
- **Policy Traceability** — Every verdict traces to the human policy author
- **Structured Evidence** — SARIF, JUnit XML, JSON export

### 🔐 Non-Human Identity (NHI)
- Agent lifecycle governance with Zero Standing Privilege
- Scope enforcement and attestation
- Per-identity grants and delegation chains

### 🧠 Memory Governance
- Write provenance tracking
- Instruction injection detection
- Exfiltration prevention
- 5 scopes × 4 classifications

### ⚡ Reliability
- Circuit breakers, retry budgets, fallback chains
- Deterministic degradation paths
- Runaway loop detection

### 📊 Dashboard
Local-first governance dashboard. No cloud, no signup.

```bash
npx tealtiger dashboard
```

![Dashboard Overview](./assets/dashboard-overview.png)
![Dashboard Agents](./assets/dashboard-agents.png)
![Dashboard Evidence](./assets/dashboard-evidence.png)

---

## Architecture

TealTiger runs **in-process** as a transparent proxy. No sidecar. No network hop. No SaaS dependency.

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌──────────────┐
│  Your Agent │────▶│  TealTiger (in-process)               │────▶│  LLM Provider│
│             │◀────│  observe → guard → engine → audit     │◀────│              │
└─────────────┘     └──────────────────────────────────────┘     └──────────────┘
                           │          │           │
                           ▼          ▼           ▼
                       Cost Log   Decision    Audit Trail
                                  Receipt     (structured)
```

![Architecture](./assets/progressive-disclosure.svg)

---

## Providers

14 LLM providers supported with automatic cost tracking.

| Provider | Status | Highlights |
|----------|--------|------------|
| OpenAI | ✅ | GPT-4o, GPT-4, o1, o3 |
| Anthropic | ✅ | Claude 3.5 Sonnet, Claude 3 Opus/Haiku |
| Google Gemini | ✅ | Gemini 1.5 Pro, Flash, Ultra |
| AWS Bedrock | ✅ | Claude, Titan, Command, Llama, Jurassic |
| Azure OpenAI | ✅ | Deployment-based routing |
| Cohere | ✅ | Command R+, Embed, Rerank |
| Mistral AI | ✅ | European data residency |
| DeepSeek | ✅ | DeepSeek-V3, DeepSeek-R1 |
| Groq | ✅ | Ultra-low latency inference |
| xAI (Grok) | ✅ | Grok-2, real-time knowledge |
| Together AI | ✅ | Open-source model hosting |
| HuggingFace TGI | ✅ | Self-hosted inference |
| Fireworks AI | ✅ | Optimized open-source inference |
| Perplexity | ✅ | Search-augmented generation |

---

## Integrations

### Framework Adapters

| Framework | Package | Version |
|-----------|---------|---------|
| LangChain | `langchain-tealtiger` | 0.2.0 |
| LangGraph | `langgraph-tealtiger` | 0.2.0 |
| Vercel AI SDK | `tealtiger-ai-sdk` | 0.2.0 |
| CrewAI | `crewai-tealtiger` | 0.2.0 |
| AG2 | `ag2-tealtiger` | 0.2.0 |
| LlamaIndex | `llamaindex-tealtiger` | 0.2.0 |
| CAMEL-AI | `camelai-tealtiger` | 0.2.0 |
| Haystack | `haystack-tealtiger` | 0.2.0 |
| PydanticAI | `pydanticai-tealtiger` | 0.2.0 |

### Platform Adapters

| Platform | Description |
|----------|-------------|
| AWS Bedrock Agents | Native guardrail adapter |
| AWS AgentCore | Pre/post action governance plugin |
| Azure AI Agent Service | Tool-call pipeline middleware |

### Infrastructure

| Integration | Description |
|-------------|-------------|
| Dakera | Persistent governance state backend |
| Portkey Gateway | Webhook guardrail |
| Daytona | Pre-execution governance for sandboxed code |

---

## Governance Coverage

| Dimension | Module | What It Does |
|-----------|--------|-------------|
| 🛡️ Security | TealSecrets, TealGuard | Secret detection (500+ patterns), PII, prompt injection, content moderation |
| 🔑 Identity | TealEngine (NHI) | Agent lifecycle, scope enforcement, Zero Standing Privilege |
| ⚡ Reliability | TealCircuit, TealReliability | Circuit breakers, retry budgets, fallback chains |
| 🧠 Memory | TealMemory | Write provenance, injection detection, exfiltration prevention |
| 💰 Cost | TealMonitor | Governance-owned ceilings, anomaly detection, per-agent attribution |
| 📋 Evidence | TealProof, TealAudit | Cryptographic receipts (Merkle + RFC 3161), SARIF export, OTel spans |
| ⚙️ Policy | TealEngine | FREEZE rules, PLAN_ONLY mode, hot-swap bundles, anti-tamper |
| 🔄 Workflow | TealFlow | Declarative YAML governance workflows, org-level inheritance |
| 📊 Drift | TealDrift | Behavioral drift detection, statistical baselines |
| ⏱️ Temporal | TealTemporal | Session TTL, cooldown periods, time-of-day restrictions |
| 🔍 Registry | TealRegistry | MCP tool integrity monitoring, definition-drift detection |
| 🧠 Classification | TealClassifier | Local ONNX ML inference (≤20ms), regex+ML ensemble |

---

## Install

**TypeScript:**
```bash
npm install tealtiger
```

**Python:**
```bash
pip install tealtiger
```

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone
git clone --recurse-submodules https://github.com/agentguard-ai/tealtiger.git

# Pick a good first issue
# https://github.com/agentguard-ai/tealtiger/issues?q=label%3A%22good+first+issue%22
```

---

## Community

- [Discord](https://discord.gg/X2ePf8QAj)
- [GitHub Discussions](https://github.com/agentguard-ai/tealtiger/discussions)
- [LinkedIn](https://www.linkedin.com/company/tealtiger)
- [X (Twitter)](https://x.com/TealtigerAI)
- [Blog](https://blogs.tealtiger.ai)
- [Playground](https://playground.tealtiger.ai)

---

## License

[Apache 2.0](./LICENSE)

---

<div align="center">

**⭐ Star this repo if you believe AI agents need governance, not just guardrails.**

[Report Bug](https://github.com/agentguard-ai/tealtiger/issues/new?template=bug_report.yml) · [Request Feature](https://github.com/agentguard-ai/tealtiger/issues/new?template=feature_request.yml) · [Docs](https://docs.tealtiger.ai)

</div>
