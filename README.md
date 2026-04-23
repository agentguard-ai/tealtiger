# TealTiger

<div align="center">

<img src=".github/logo/tealtiger-logo.png" alt="TealTiger Logo" width="200">

**AI Agent Security & Governance SDK**

Deterministic governance, guardrails, cost tracking, and policy management for LLM applications.
Open source. TypeScript + Python. Works with any provider.

[![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
[![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/agentguard-ai/tealtiger?style=social)](https://github.com/agentguard-ai/tealtiger)

[Website](https://tealtiger.co.in) · [Documentation](#documentation) · [Examples](#examples) · [Contributing](#-build-with-us)

</div>

---

## What is TealTiger?

TealTiger is an open-source SDK that provides **deterministic governance** for AI agents. It enforces security policies, tracks costs, and produces structured evidence — all at runtime, with no infrastructure required.

Unlike probabilistic safety filters, TealTiger uses **deterministic policy evaluation**: same input + same policy = same decision, every time. Every governance verdict is reconstructable, traceable to the human who authored the policy, and exportable as structured evidence (SARIF, JUnit XML, JSON).

**Key principle:** Governance should be an engineering property embedded in the runtime — not a document reviewed after the fact.

---

## 🚀 Quick Start

### TypeScript

```bash
npm install tealtiger
```

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: true,
    promptInjection: true,
    contentModeration: true,
  },
  budget: {
    maxCostPerRequest: 0.50,
    maxCostPerDay: 10.00,
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
// Guardrails enforced. Cost tracked. Evidence produced.
```

### Python

```bash
pip install tealtiger
```

```python
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
    },
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 10.00,
    },
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
)
# Guardrails enforced. Cost tracked. Evidence produced.
```

---

## ✨ Features

### 🛡️ Security Guardrails
- **PII Detection** — Detect and redact sensitive information automatically
- **Prompt Injection Prevention** — Block malicious prompt injection attempts
- **Content Moderation** — Filter toxic, harmful, or inappropriate content
- **Secret Detection** — 500+ patterns across 9 categories with confidence scoring
- **Custom Rules** — Define your own security policies

### 💰 Cost Governance
- **Budget Enforcement** — Hard limits per request, session, and day
- **Cost Tracking** — Real-time monitoring across all providers
- **Cost Alerts** — Notifications at configurable thresholds
- **Circuit Breakers** — Prevent runaway cost loops automatically

### 🔌 7 LLM Providers
- **OpenAI** — GPT-4, GPT-4o, GPT-3.5
- **Anthropic** — Claude 3.5, Claude 3
- **Google Gemini** — Multimodal support
- **AWS Bedrock** — Claude, Titan, Jurassic, Command, Llama
- **Azure OpenAI** — Deployment-based routing
- **Cohere** — Chat, RAG, embeddings
- **Mistral AI** — European data residency

### 🏗️ Governance Architecture
- **Deterministic Policy Evaluation** — No LLM in the governance path
- **Structured Evidence** — Every decision produces a reconstructable record
- **Correlation IDs** — End-to-end traceability across the decision chain
- **Policy Traceability** — Every verdict traces to the human policy author
- **OWASP ASI Coverage** — Addresses 8/10 OWASP Top 10 for Agentic Applications

---

## 📦 SDKs

| Language | Source Code | Package | Install |
|----------|------------|---------|---------|
| TypeScript | [tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod) | [npm](https://www.npmjs.com/package/tealtiger) | `npm install tealtiger` |
| Python | [tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod) | [PyPI](https://pypi.org/project/tealtiger/) | `pip install tealtiger` |

---

## 📚 Documentation

- [Quick Start Guide](#-quick-start)
- [Security Guardrails](#️-security-guardrails)
- [Cost Governance](#-cost-governance)
- [Provider Setup](#-7-llm-providers)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Roadmap](./ROADMAP.md)

---

## 🐯 Build With Us — Early Contributor Program

TealTiger is open source and we're looking for early contributors to shape the future of AI agent governance.

### What You Can Work On

| Area | Examples | Difficulty |
|------|----------|------------|
| 🔍 Secret Detection | New detection patterns, custom categories | 🟢 Beginner |
| 📝 Documentation | Guides, examples, API docs, typo fixes | 🟢 Beginner |
| 🧪 Tests | Unit tests, property-based tests, integration tests | 🟡 Intermediate |
| 🔌 Integrations | LangChain, CrewAI, AutoGen, LlamaIndex middleware | 🟡 Intermediate |
| 💾 Memory Adapters | Redis, Pinecone, Weaviate, ChromaDB adapters | 🟡 Intermediate |
| 🔄 CI/CD Templates | Jenkins, Azure Pipelines, Bitbucket Pipelines | 🟡 Intermediate |
| 🏗️ Core Modules | Governance engine, evidence export, policy evaluation | 🔴 Advanced |

### What Early Contributors Get

- 🏆 **Named in CONTRIBUTORS.md** and release notes
- 🎖️ **"Founding Contributor" badge** — first 25 merged PRs get permanent recognition
- 📣 **Shoutout on TealTiger social channels** (LinkedIn, X, Dev.to)
- 🔑 **Early access** to upcoming governance features before public release
- 💬 **Direct access** to the core team via GitHub Discussions
- 📝 **Co-authorship opportunity** on technical blog posts

### Get Started

```bash
# 1. Star this repo (it helps!)

# 2. Fork and clone the SDK you want to contribute to:
# TypeScript SDK:
git clone https://github.com/agentguard-ai/tealtiger-typescript-prod.git
# Python SDK:
git clone https://github.com/agentguard-ai/tealtiger-python-prod.git

# 3. Pick a "good first issue"
# https://github.com/agentguard-ai/tealtiger/issues?q=label%3A%22good+first+issue%22

# 4. Submit a PR
# 5. Join the team 🐯
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 🗺️ Roadmap

**Current:** v1.1.0 — 7 providers, TealEngine, guardrails, cost tracking

**Next:** v1.2.0 — Governance Bundle
- 7 governance modules across 6 dimensions
- Formal evidence contract with named reason codes
- Secret detection (500+ patterns, confidence scoring)
- Memory governance (5 scopes, 4 classifications)
- Reliability controls (retry budgets, circuit breakers, fallback chains)
- Model/tool registry with allowlisting and provenance verification
- Evidence export (SARIF v2.1.0, JUnit XML, JSON)

See [ROADMAP.md](./ROADMAP.md) for the full plan.

---

## 🌟 Community

- **GitHub Discussions**: [Ask questions, share ideas](https://github.com/agentguard-ai/tealtiger/discussions)
- **LinkedIn**: [TealTiger](https://www.linkedin.com/company/agentguard-ai)
- **Dev.to**: [Blog](https://dev.to/nagasatish_chilakamarti_2)
- **Email**: tealtiger@proton.me

---

## 📄 License

TealTiger is [Apache 2.0 licensed](./LICENSE).

---

## 🙏 Acknowledgments

Built with ❤️ by the TealTiger team and [contributors](./CONTRIBUTORS.md).

---

<div align="center">

**⭐ Star this repo if you believe AI agents need governance, not just guardrails.**

[Report Bug](https://github.com/agentguard-ai/tealtiger/issues/new?template=bug_report.md) · [Request Feature](https://github.com/agentguard-ai/tealtiger/issues/new?template=feature_request.md) · [Ask Question](https://github.com/agentguard-ai/tealtiger/issues/new?template=question.md)

</div>
