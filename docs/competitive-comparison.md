# TealTiger vs. Alternatives — Competitive Comparison

> **Last Updated:** June 2026 (v1.4 feature set)
> **Purpose:** README section, documentation landing page, and sales collateral

---

## Why TealTiger?

TealTiger is the only **SDK-first, deterministic, multi-provider governance layer** for AI agents. It operates entirely in-process with no infrastructure dependencies, no LLM in the governance path, and under 5ms overhead.

Every other solution in this space requires either a SaaS platform, adds an LLM to the governance path (making decisions non-deterministic), or covers only a subset of the governance surface.

---

## Feature Comparison

| Capability | TealTiger | Lakera Guard | NeMo Guardrails | Invariant Labs | Lasso Security | LLM Guard |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Architecture** | SDK (in-process) | SaaS API | SDK (Python) | SDK | Platform | SDK (Python) |
| **Deterministic** (no LLM in governance) | ✅ | ❌ | ❌ | Partial | ❌ | ✅ |
| **Latency** | <5ms | ~50ms | ~200ms+ | ~20ms | ~100ms | <10ms |
| **PII detection** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Secret detection** (500+ patterns) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Prompt injection blocking** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tool-call governance** (allowlist/deny) | ✅ | ❌ | Partial | ✅ | ✅ | ❌ |
| **Cost tracking & budget enforcement** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Per-agent role-based policies** | ✅ | ❌ | ❌ | ❌ | Partial | ❌ |
| **Kill switch** (freeze/unfreeze) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Behavioral baseline / anomaly detection** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **RESAMPLE / DEFER_TO_TRUSTED** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Canary/honeypot detection** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-stage defense pipeline** | ✅ | ❌ | Partial | ❌ | ❌ | ❌ |
| **Post-execution output scanning** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Structured audit export** (SARIF/JUnit/JSON) | ✅ | ❌ | ❌ | ❌ | Partial | ❌ |
| **MCP protocol governance** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **AG-UI / A2UI protocol governance** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-provider support** (12+) | ✅ | ❌ | ❌ | ❌ | ✅ | Partial |
| **Python + TypeScript SDKs** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Open source** (Apache 2.0) | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Offline / air-gapped capable** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |

---

## Head-to-Head Summaries

### TealTiger vs. Lakera Guard

Lakera specializes in prompt injection detection with high accuracy. However, it's a SaaS-only product requiring network calls for every request (~50ms latency). It has no tool-call governance, no cost tracking, no agent-level controls, and no SDK. TealTiger provides the same input/output scanning plus full agent governance, deterministically, in-process, at <5ms.

**Choose Lakera if:** You only need prompt injection detection and are comfortable with SaaS dependency.
**Choose TealTiger if:** You need full agent governance (tools, cost, roles, kill switch) without infrastructure.

### TealTiger vs. NVIDIA NeMo Guardrails

NeMo Guardrails uses LLM-based "rails" written in Colang DSL. It's powerful for conversational safety but adds 200ms+ latency per check, is Python-only, and doesn't cover tool-call governance, cost tracking, or agent-level controls. It also requires an LLM in the governance path, making decisions non-deterministic.

**Choose NeMo if:** You need complex conversational flow control and are comfortable with LLM-based governance.
**Choose TealTiger if:** You need deterministic, fast governance for multi-agent systems with cost and tool controls.

### TealTiger vs. Invariant Labs

Invariant Labs is the closest philosophical competitor — they focus on formal security guarantees for agents and support MCP. However, they lack cost tracking, budget enforcement, secret detection (500+ patterns), behavioral baselines, kill switches, RESAMPLE/DEFER patterns, and structured audit export. They're strong on correctness proofs but weaker on operational governance.

**Choose Invariant if:** You need formal verification of agent security properties.
**Choose TealTiger if:** You need operational runtime governance with full observability and cost controls.

### TealTiger vs. Lasso Security

Lasso is an enterprise platform for agent security with behavioral intent analysis. It requires platform deployment, enterprise contracts ($100k+), and uses LLM-based detection (non-deterministic). It doesn't offer an SDK, can't run offline, and has no open-source option.

**Choose Lasso if:** You're an enterprise with budget for a managed security platform and need agent discovery.
**Choose TealTiger if:** You need SDK-first governance you can deploy in 5 minutes at any scale.

### TealTiger vs. LLM Guard

LLM Guard provides pattern-based scanning (PII, toxicity) similar to TealTiger's guardrails layer. It's deterministic and fast. However, it's limited to input/output text scanning — no tool governance, no cost tracking, no agent-level policies, no audit export, no protocol governance, and Python-only.

**Choose LLM Guard if:** You only need basic text scanning and want the simplest possible setup.
**Choose TealTiger if:** You need full governance beyond text scanning — tools, cost, agents, protocols, audit.

---

## What Only TealTiger Does

These capabilities don't exist in any competing product:

1. **Cost tracking with budget enforcement** — Per-request, per-session, per-agent cost limits that block requests when budgets are exhausted
2. **RESAMPLE / DEFER_TO_TRUSTED decisions** — Go beyond ALLOW/DENY with intelligent recovery actions
3. **Canary-based honeypot detection** — Embed decoy artifacts that detect adversarial agent intent with zero false positives
4. **Kill switch (freeze/unfreeze)** — Instant emergency stop for any agent with one function call
5. **AG-UI / A2UI protocol governance** — Govern the agent-to-frontend event stream and UI declarations
6. **Behavioral baseline with anomaly alerting** — Automatic UEBA from the first 100 requests
7. **Secret detection at 500+ patterns** — Credential scanning depth that no other governance SDK provides
8. **Deterministic + <5ms + SDK-first + 12 providers** — This combination doesn't exist elsewhere

---

## GDM AI Control Roadmap Alignment

Google DeepMind's [AI Control Roadmap (2026)](https://arxiv.org/abs/TODO) identifies 15 concrete mitigations across four Detection tiers (D1-D4) and three Prevention and Response tiers (R1-R3). TealTiger implements D1/D2 detection mitigations and R1/R2 prevention and response mitigations as an SDK:

| GDM Mitigation | TealTiger Implementation |
|---|---|
| Action monitoring | TealGuard pre/post-execution scanning |
| Automated real-time response (resampling, blocking, deferring) | ENFORCE mode + RESAMPLE + DEFER_TO_TRUSTED + DENY |
| AI access control (least privilege) | Role-based per-agent policies + tool allowlists |
| Blocking / escalating | DENY + REQUIRE_APPROVAL decisions |
| UEBA anomaly detection | BehavioralBaseline (observe mode) |
| Shutdown | freeze() / unfreeze() kill switch |
| Honeypots | Canary-based detection |
| Environment isolation | Works with Daytona sandboxes (defense-in-depth) |

---

## Quick Start

```bash
pip install tealtiger    # Python
npm install tealtiger    # TypeScript
```

```python
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI())  # One line. Full governance. Zero config.
```

---

*This comparison reflects publicly available information as of June 2026. We welcome corrections — open an issue or discussion.*
