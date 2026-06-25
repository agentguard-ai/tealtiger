# TealTiger

<div align="center">

<img src=".github/logo/tealtiger-logo-256.png" alt="TealTiger Logo" width="200">

**AI Agent Security & Governance SDK**

Deterministic governance, guardrails, cost tracking, and policy management for LLM applications.
Open source. TypeScript + Python. Provider coverage is tracked per SDK.

[![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
[![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289da?logo=discord&logoColor=white)](https://discord.gg/X2ePf8QAj)
[![GitHub stars](https://img.shields.io/github/stars/agentguard-ai/tealtiger?style=social)](https://github.com/agentguard-ai/tealtiger)
[![Governed by TealTiger](./assets/badges/governed-by-tealtiger.svg)](https://github.com/agentguard-ai/tealtiger)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/agentguard-ai/tealtiger/badge)](https://securityscorecards.dev/viewer/?uri=github.com/agentguard-ai/tealtiger)

<br>

<a href="https://www.nvidia.com/en-us/startups/">
  <img src=".github/logo/nvidia-inception-badge.svg" alt="NVIDIA Inception Program" width="250">
</a>

<br>

[Website](https://tealtiger.co.in) · [Documentation](#documentation) · [Examples](#examples) · [Discord](https://discord.gg/X2ePf8QAj) · [Contributing](#-build-with-us)

</div>

---

## ⚡ 60-second quickstart

Install: `npm install tealtiger` or `pip install tealtiger`, then wrap one existing OpenAI call:

```typescript
import { TealOpenAI } from 'tealtiger';
const client = new TealOpenAI({ apiKey: process.env.OPENAI_API_KEY, guardrails: { promptInjection: true } });
const res = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello!' }] });
console.log(res.security?.decision ?? 'ALLOW');
```

```python
import os
from tealtiger import TealOpenAI
client = TealOpenAI(api_key=os.environ["OPENAI_API_KEY"], guardrails={"prompt_injection": True})
print(client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": "Hello!"}]).security.decision)
```

```text
ALLOW
Governance receipt emitted; cost and guardrails tracked.
```

Next: [full Quick Start](#-quick-start) and [examples](./examples).

---

## What is TealTiger?

TealTiger is an open-source SDK that provides **deterministic governance** for AI agents. It enforces security policies, tracks costs, and produces structured evidence — all at runtime, with no infrastructure required.

> **Looking for the source code?** This is the hub repo. The SDK source lives in the language-specific repos:
> - **TypeScript SDK**: [tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod)
> - **Python SDK**: [tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod)
>
> Or clone this repo with submodules: `git clone --recurse-submodules https://github.com/agentguard-ai/tealtiger.git`

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

### 🔌 Provider Coverage

Core provider clients are available across the TypeScript and Python SDKs:

- **OpenAI** — GPT-4, GPT-4o, GPT-3.5
- **Anthropic** — Claude 3.5, Claude 3
- **Google Gemini** — Multimodal support
- **AWS Bedrock** — Claude, Titan, Jurassic, Command, Llama
- **Azure OpenAI** — Deployment-based routing
- **Cohere** — Chat, RAG, embeddings
- **Mistral AI** — European data residency

Additional v1.3 provider coverage is currently supported in the Python SDK and
tracked as planned TypeScript SDK parity:

- **DeepSeek** — Cost-efficient reasoning models
- **Groq** — Ultra-low latency inference
- **Together AI** — Open-source model hosting
- **HuggingFace TGI** — Self-hosted inference
- **xAI (Grok)** — Real-time knowledge

### 🔌 Platform Adapters
- **AWS Bedrock Agents** — Native guardrail adapter
- **AWS AgentCore** — Pre/post action governance plugin
- **Azure AI Agent Service** — Tool-call pipeline middleware

### 🏗️ Governance Architecture
- **Deterministic Policy Evaluation** — No LLM in the governance path
- **Structured Evidence** — Every decision produces a reconstructable record
- **Cryptographic Proof** — Merkle trees + RFC 3161 timestamping (TealProof)
- **Non-Human Identity (NHI)** — Agent lifecycle, scope enforcement, Zero Standing Privilege
- **FREEZE Rules** — Immutable emergency kill switches with tamper detection
- **Correlation IDs** — End-to-end traceability across the decision chain
- **Policy Traceability** — Every verdict traces to the human policy author
- **OWASP Agentic Top 10** — Zero-config policy pack covering all 10 ASI risks

---

## 🗺️ Governance Coverage

| Dimension | What it does | Module |
|-----------|-------------|--------|
| 🛡️ **Security** | Secret detection (500+ patterns), prompt injection, PII, content moderation, Unicode normalization, encoded output detection | `TealSecrets` `TealGuard` |
| 🔑 **Identity** | Non-Human Identity lifecycle, scope enforcement, Zero Standing Privilege, agent attestation | `TealEngine (NHI)` |
| ⚡ **Reliability** | Circuit breakers, retry budgets, fallback chains, deterministic degradation | `TealCircuit` `TealReliability` |
| 🧠 **Memory** | Write provenance, instruction injection detection, exfiltration prevention, scope enforcement | `TealMemory` |
| 💰 **Cost** | Governance-owned ceilings, anomaly detection, reasoning-token budgets, per-agent attribution | `TealMonitor` |
| 📋 **Evidence** | Cryptographic receipts (Merkle + RFC 3161), SARIF export, OTel spans, SIEM integration | `TealProof` `TealAudit` |
| ⚙️ **Policy** | FREEZE rules, PLAN_ONLY mode, hot-swap bundles, anti-tamper, automation levels | `TealEngine` |
| 🔄 **Workflow** | Declarative YAML governance workflows, org-level inheritance, floor enforcement | `TealFlow` |
| 📊 **Drift** | Behavioral drift detection, statistical baselines, model output regression | `TealDrift` |
| ⏱️ **Temporal** | Session TTL, cooldown periods, time-of-day restrictions | `TealTemporal` |
| 🔍 **Registry** | MCP definition-drift monitoring, tool description scanning, adapter composition allowlist | `TealRegistry` |
| 🧠 **Classification** | Local ONNX ML inference (≤20ms), ensemble modes, regex+ML combination | `TealClassifier` |

> **Design principle:** No LLM in the governance path. Same input + same policy = same decision, every time.

---

## 📦 SDKs

| Language | Source Code | Package | Install |
|----------|------------|---------|---------|
| TypeScript | [tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod) | [npm](https://www.npmjs.com/package/tealtiger) | `npm install tealtiger` |
| Python | [tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod) | [PyPI](https://pypi.org/project/tealtiger/) | `pip install tealtiger` |

### 🔌 Framework Adapters

| Framework | Package | Install |
|-----------|---------|---------|
| LangChain | [langchain-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/langchain-tealtiger) | `pip install langchain-tealtiger` |
| Vercel AI SDK | [tealtiger-ai-sdk](https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-ai-sdk) | `npm install tealtiger-ai-sdk` |
| PydanticAI | [pydanticai-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/pydanticai-tealtiger) | `pip install pydanticai-tealtiger` |
| Haystack | [haystack-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/haystack-tealtiger) | `pip install haystack-tealtiger` |
| CAMEL-AI | [camelai-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/camelai-tealtiger) | `pip install camelai-tealtiger` |
| LlamaIndex | [python example](https://github.com/agentguard-ai/tealtiger/blob/main/examples/python/llamaindex_integration.py) | `pip install tealtiger llama-index openai` |

### 🔗 Infrastructure Integrations

| Platform | What it provides | Install |
|----------|-----------------|---------|
| [Dakera](https://github.com/Dakera-AI/dakera-py) | Persistent governance state backend (cost storage, decision receipts, delegation chains via KG) | `pip install dakera[tealtiger]` | [Docs](https://dakera.ai/integrations/tealtiger) |
| [AG2 Beta](https://github.com/ag2ai/ag2) | Governance middleware Extension for AG2 Beta agents | `pip install ag2-tealtiger` |
| [Portkey Gateway](https://github.com/Portkey-AI/gateway) | Webhook guardrail for Portkey AI Gateway | [Example](https://github.com/agentguard-ai/tealtiger/tree/main/examples/portkey-webhook-guardrail) |
| [Daytona](https://github.com/daytonaio/daytona) | Pre-execution governance for sandboxed code execution | [Example](https://github.com/agentguard-ai/tealtiger/tree/main/examples/daytona-governed-sandbox) |

---

## 📚 Documentation

- [Why your AI agent needs a budget — cost governance for LLM apps](./docs/blog/cost-governance-for-llm-apps.md)
- [OWASP Agentic Top 10 — practical defenses with TealTiger](./docs/blog/owasp-agentic-top-10-defenses.md)
- [Quick Start Guide](#-quick-start)
- [Security Guardrails](#️-security-guardrails)
- [Cost Governance](#-cost-governance)
- [Provider Setup](#-provider-coverage)
- [FAQ](./docs/faq.md)
- [Why TealTiger?](./docs/why-tealtiger.md)
- [Cross-SDK Feature Parity Matrix](./docs/cross-sdk-feature-parity-matrix.md)
- [Governance Event Store Indexes](./docs/governance-event-store-indexes.md)
- [Error Code Reference](./docs/error-code-reference.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Roadmap](./ROADMAP.md)

### Badge

Use the TealTiger badge to show that a project is governed by deterministic
agent security and cost policies.

Light badge:

```md
[![Governed by TealTiger](https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/assets/badges/governed-by-tealtiger.svg)](https://github.com/agentguard-ai/tealtiger)
```

Dark badge:

```md
[![Governed by TealTiger](https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/assets/badges/governed-by-tealtiger-dark.svg)](https://github.com/agentguard-ai/tealtiger)
```
### Python Hugging Face TGI Quickstart

Use `examples/python/huggingface_tgi_quickstart.py` to try the guarded
Hugging Face Text Generation Inference provider from the Python SDK.

```bash
export HF_API_TOKEN="your-hugging-face-token"
export HF_TGI_ENDPOINT="https://your-endpoint.endpoints.huggingface.cloud"
export HF_TGI_MODEL="meta-llama/Meta-Llama-3.1-8B-Instruct"

python examples/python/huggingface_tgi_quickstart.py
```

The example enables guardrail and cost-tracking configuration, sends one sample
chat request, then prints the response, token usage, estimated cost, provider,
and correlation ID. Use placeholder values in docs and `.env.example` files;
never commit a real `HF_API_TOKEN`.

### TealEngine Policy Schema

Use [`schemas/tealtiger-policy.schema.json`](./schemas/tealtiger-policy.schema.json) for editor autocomplete and validation when authoring TealEngine policy JSON or YAML files. JSON policy files can include:

```json
{
  "$schema": "./schemas/tealtiger-policy.schema.json"
}
```

For YAML policies, configure your editor's YAML schema mapping to point policy files such as `tealtiger-policy.yml` at `./schemas/tealtiger-policy.schema.json`.

### Validate Policy Files

Use the policy validator script to check a TealTiger policy JSON file before
using it in CI/CD or runtime governance:

```bash
npm install
npx ts-node scripts/validate-policy.ts ./my-policy.json
```

You can also run the npm script:

```bash
npm run validate:policy -- ./my-policy.json
```

The validator loads
[`schemas/tealtiger-policy.schema.json`](./schemas/tealtiger-policy.schema.json),
prints schema validation errors, exits `0` when the policy is valid, and exits
`1` when the policy is invalid.

---

## 🐯 Build With Us — Early Contributor Program

TealTiger is open source and we're looking for early contributors to shape the future of AI agent governance.

### What You Can Work On

| Area | Examples | Difficulty |
|------|----------|------------|
| 🔍 Secret Detection | New detection patterns, custom categories | 🟢 Beginner |
| 📝 Documentation | Guides, examples, API docs, typo fixes | 🟢 Beginner |
| 🧪 Tests | Unit tests, property-based tests, integration tests | 🟡 Intermediate |
| 🔌 Integrations | LangChain, CrewAI, AG2, LlamaIndex middleware | 🟡 Intermediate |
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

**Current:** v1.3.0 — Autonomous Agent Governance (Released May 18, 2026)
- TealEngine v1.3 with pre/post evaluation pipeline, FREEZE rules, automation levels
- Non-Human Identity (NHI) governance with Zero Standing Privilege
- TealProof — cryptographic governance receipts (Merkle + RFC 3161)
- TealFlow — declarative YAML governance workflows
- TealClassifier — local ONNX ML inference (≤20ms)
- TealDrift, TealState, TealTemporal — behavioral, context, and session governance
- TealMonitor v2 — governance-owned cost ceilings, anomaly detection
- OWASP Agentic Top 10 policy pack (zero-config)
- Core provider clients plus Python support for the expanded v1.3 provider set
- TypeScript/Python parity tracked in the cross-SDK feature parity matrix

**Next:** v1.4.0 — Zero-Config Adoption & MCP Governance (July 2026)
- `observe(client)` — 1-line auto-instrumentation, zero config, instant visibility
- Local CLI dashboard (`npx tealtiger dashboard`)
- Progressive disclosure: observe → suggest → enforce → govern
- 8 framework adapters: LangChain, LangGraph, CrewAI, AG2, LlamaIndex, CAMEL-AI, Haystack, Vercel AI SDK
- MCP governance: tool validation, per-identity grants, argument-level policies
- Tool poisoning & rug pull defense
- Runaway loop detection & per-trace token budgets
- TEEC v2.1 Execution Receipts (cryptographic evidence)
- EU AI Act, NIST AI RMF, ISO 42001 compliance mappings
- **Universal Adapter Governance Contract** — enforced across all framework adapters:
  - Every proposed tool call, budget change, freeze/unfreeze, and delegated handoff creates a decision record before execution
  - Decision binds: agent_id, turn_id, parent_turn_id, action kind, tool name, canonical args digest, policy digest, decision source, expiry, delegation scope
  - Execution outcome backlinks to decision_id and effective args digest that actually ran
  - Denial, timeout, and require-approval become visible terminal or pending states (no silent transcript gaps)
  - Per-actor enforcement: channel/hub approval does not become ambient authority for every agent
  - Delegation creates scope-bound authorization: delegatee emits its own decision and outcome record
  - Invariant tests: same payload in two turns produces two decision IDs; approval for one agent does not authorize another; revised args create a new pending decision; timeout produces durable terminal result; retry returns prior terminal state instead of re-running side effect
- **Supply Chain Integrity Verification** — validate AI dependency hashes before agent execution (response to LiteLLM supply chain attack, March 2026)
- **A2A Protocol Governance** — per-task access scoping, token lifetime enforcement, consent flow governance for Agent2Agent interactions (A2A GA under Linux Foundation, 150+ orgs)
- **MCP Tool Integrity Monitoring** — definition-drift detection, tool description scanning, adapter composition allowlist, rug-pull defense with cryptographic pinning
- **Kill Switch Latency SLA** — guaranteed <5ms FREEZE propagation with published benchmarks, quantified time-to-halt for compliance
- **Shadow Agent Detection** — discover ungoverned agents in the environment, surface unmonitored tool calls and untracked cost
- **AI Dependency SBOM** — generate Software Bill of Materials for agent dependencies, model provenance, and MCP server inventory
- **Dakera Integration (shipped)** — persistent governance state backend for distributed deployments (`pip install dakera[tealtiger]`). Cost records, decision receipts, and delegation chains survive restarts via agent-scoped memory with importance-weighted retention.
- **Pack Hunt Defense** — multi-agent coordinated attack detection:
  - Cross-session intent correlation: link related sessions via `session_group_id`, query receipts across sessions by agent + time window
  - Reassembly detection: flag when N individually-benign requests from different agents/sessions converge on the same output scope within a time window (deterministic, no LLM)
  - Multi-model coordination detection: track which model produced which output, flag when output from model A becomes input to model B without governance evaluation in between

**Planned:** v1.5.0 — Enterprise Platform (Q3 2026)
- Multi-tenancy with complete data isolation
- RBAC (Owner, Admin, Policy Author, Viewer, Auditor)
- SSO via SAML 2.0 / OIDC (Okta, Azure AD, Google)
- SIEM export (Splunk, Elastic, Sentinel, Datadog)
- Policy staging, dry-run mode, canary deployments
- Scheduled compliance reports & executive dashboard

**Future:** v2.0.0 — SaaS Security Platform (Q1 2027)
- Full SaaS control plane (CSPM/CWPP model for AI agents)
- CISO executive console with governance health scoring
- TealTiger Operator & Agent for Kubernetes
- Shadow AI detection (discover ungoverned agents)
- Remote kill switch from SaaS console
- CloudEvents, OpenTelemetry, Backstage plugin

> All features maintain: in-process <5ms, zero-config entry, no LLM in governance path, offline-capable.

---

## 🌟 Community

- **Discord**: [Join TealTiger Community](https://discord.gg/X2ePf8QAj)
- **GitHub Discussions**: [Ask questions, share ideas](https://github.com/agentguard-ai/tealtiger/discussions)
- **LinkedIn**: [TealTiger](https://www.linkedin.com/company/tealtiger)
- **X (Twitter)**: [@TealtigerAI](https://x.com/TealtigerAI)
- **Documentation**: [docs.tealtiger.ai](https://docs.tealtiger.ai)
- **Blog**: [blogs.tealtiger.ai](https://blogs.tealtiger.ai)
- **Playground**: [playground.tealtiger.ai](https://playground.tealtiger.ai)
- **Email**: reachout@tealtiger.ai

---

## 🔒 Security

TealTiger is committed to responsible open-source security practices.

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/agentguard-ai/tealtiger/badge)](https://securityscorecards.dev/viewer/?uri=github.com/agentguard-ai/tealtiger)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/10824/badge)](https://www.bestpractices.dev/projects/10824)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-brightgreen?logo=dependabot)](https://github.com/agentguard-ai/tealtiger/security/dependabot)
[![CodeQL](https://github.com/agentguard-ai/tealtiger/actions/workflows/codeql.yml/badge.svg)](https://github.com/agentguard-ai/tealtiger/actions/workflows/codeql.yml)

For vulnerability reports, see our [Security Policy](./SECURITY.md).

---

## 📄 License

TealTiger is [Apache 2.0 licensed](./LICENSE).

---

## 🙏 Acknowledgments

Built with ❤️ by the TealTiger team and [contributors](./CONTRIBUTORS.md).

---

## 👥 Contributors

[![Contributors](https://contrib.rocks/image?repo=agentguard-ai/tealtiger)](https://github.com/agentguard-ai/tealtiger/graphs/contributors)

Want to contribute? Check out our [CONTRIBUTING.md](./CONTRIBUTING.md) guide!

---

<div align="center">

**⭐ Star this repo if you believe AI agents need governance, not just guardrails.**

[Report Bug](https://github.com/agentguard-ai/tealtiger/issues/new?template=bug_report.md) · [Request Feature](https://github.com/agentguard-ai/tealtiger/issues/new?template=feature_request.md) · [Ask Question](https://github.com/agentguard-ai/tealtiger/issues/new?template=question.md)

</div>
