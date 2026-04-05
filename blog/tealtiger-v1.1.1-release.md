---
title: "TealTiger v1.1.1: Enterprise-Grade AI Agent Security — Zero Infrastructure Required"
published: true
description: "A deep dive into TealTiger v1.1.1 — the open-source AI agent security SDK with policy enforcement, guardrails, circuit breakers, audit logging, and 7-provider coverage. No servers required."
tags: ai, security, opensource, typescript
cover_image: https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/01-platform-architecture.svg
canonical_url: https://docs.tealtiger.ai/blog/v1-1-1-release
series: "TealTiger Release Notes"
---

As AI agents move from prototypes to production, the security gap widens. Agents now execute tools, manage budgets, access sensitive data, and make autonomous decisions at scale. Yet most teams still ship without guardrails, audit trails, or policy enforcement — not because they don't care, but because existing solutions demand infrastructure they can't justify.

TealTiger v1.1.1 changes that equation. It's a complete AI agent security platform that runs entirely inside your SDK — no sidecars, no proxies, no servers. Just `npm install tealtiger` or `pip install tealtiger`, and your agents are secured.

This post walks through the architecture, capabilities, and enterprise features that make v1.1.1 production-ready for organizations of any size.

---

## Platform Architecture

TealTiger is built around five core components, each handling a distinct security concern. They compose together through a unified request pipeline, or work independently when you only need one capability.

![TealTiger Platform Architecture](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/01-platform-architecture.svg)

Every request flows through the same deterministic pipeline: policy evaluation → content validation → circuit breaker check → provider call → audit logging. Each step is optional, composable, and adds sub-millisecond overhead.

---

## Request Lifecycle

Understanding how a single request traverses the TealTiger stack is key to appreciating the depth of protection. Here's the complete lifecycle:

![Request Lifecycle](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/02-request-lifecycle.svg)

Every step produces a typed `Decision` object with a consistent contract — action, reason codes, risk score, and correlation ID. This means your application logic can handle any outcome uniformly, regardless of which component triggered it.

---

## The Five Pillars

### 1. TealEngine — Deterministic Policy Enforcement

TealEngine is the brain of the platform. It evaluates security policies against every request and returns a deterministic `Decision` object. No probabilistic guessing — the same input always produces the same output.

**Policy Rollout Modes** allow gradual deployment without risk:

![Policy Rollout Modes](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/03-policy-rollout-modes.svg)

Start in `REPORT_ONLY` to measure impact, promote to `MONITOR` to catch violations without blocking, then move to `ENFORCE` when confident. Mode resolution follows a strict hierarchy: policy-specific override → environment override → global default. Resolution completes in under 1ms.

**Decision Contract** — every evaluation returns:

| Field | Type | Description |
|-------|------|-------------|
| `action` | Enum | ALLOW, DENY, REDACT, TRANSFORM, REQUIRE_APPROVAL, DEGRADE |
| `reason_codes` | Enum[] | Standardized codes explaining the decision |
| `risk_score` | 0–100 | Computed risk level |
| `correlation_id` | UUID v4 | End-to-end request tracing |
| `policy_id` | String | Which policy triggered |
| `mode` | Enum | Active enforcement mode |
| `metadata` | Object | Evaluation time, cache hit, cost data |

```typescript
const decision = engine.evaluate({
  agentId: 'support-agent-001',
  action: 'tool.execute',
  tool: 'database_query',
  correlation_id: 'req-abc-123'
});

// Deterministic branching
switch (decision.action) {
  case DecisionAction.ALLOW:
    await executeTool();
    break;
  case DecisionAction.DENY:
    logger.warn(`Blocked: ${decision.reason_codes}`);
    break;
  case DecisionAction.REQUIRE_APPROVAL:
    await escalateToHuman(decision);
    break;
}
```

---

### 2. TealGuard — Client-Side Security Guardrails

TealGuard runs content validation entirely in-process — no network calls, no latency spikes. It detects PII, prompt injection, jailbreak attempts, and harmful content in milliseconds.

Guardrails execute in parallel for maximum throughput:

![TealGuard Parallel Execution](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/04-guardrail-parallel.svg)

**Detection capabilities:**
- PII: emails, phone numbers, SSNs, credit card numbers, addresses
- Prompt injection and jailbreak patterns
- Content moderation (hate speech, violence, sexual content)
- Custom pattern matching via regex or policy rules

```python
engine = GuardrailEngine(mode="parallel", timeout=5000)
engine.register_guardrail(PIIDetectionGuardrail(action="redact"))
engine.register_guardrail(PromptInjectionGuardrail(sensitivity="high"))
engine.register_guardrail(ContentModerationGuardrail(threshold=0.7))

result = await engine.execute(user_input)
# result.passed, result.risk_score, result.violations
```

---

### 3. TealMonitor — Behavioral Anomaly Detection

TealMonitor establishes behavioral baselines for each agent and detects deviations in real time. It tracks cost velocity, request patterns, and tool usage — flagging anomalies before they become incidents.

![TealMonitor Anomaly Detection](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/10-monitoring-anomaly.svg)

Cost governance is built in. Set budgets at any scope (request, session, agent, tenant) with configurable windows (per minute, hour, day). When budgets are exceeded, TealEngine produces cost-specific decisions with reason codes like `COST_BUDGET_EXCEEDED` or `MODEL_DOWNGRADED` — enabling graceful degradation instead of hard failures.

---

### 4. TealCircuit — Cascading Failure Prevention

TealCircuit implements the circuit breaker pattern to prevent one failing provider from taking down your entire system. It manages state transitions automatically and integrates with TealMonitor for intelligent recovery.

![TealCircuit State Machine](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/05-circuit-breaker.svg)

Combined with multi-provider failover, TealCircuit enables architectures where a primary provider failure automatically routes to a backup — with full policy enforcement maintained across the switch.

```typescript
const multiProvider = new TealMultiProvider({
  strategy: 'priority',
  enableFailover: true,
  maxFailoverAttempts: 3
});

// If OpenAI fails, automatically routes to Anthropic
// All guardrails, policies, and audit logging remain active
```

---

### 5. TealAudit — Compliance-Ready Audit Logging

TealAudit produces versioned, immutable audit events with security-by-default PII redaction. It's designed for compliance teams who need comprehensive trails without risking data leakage.

**Redaction levels** provide granular control:

![TealAudit Redaction Levels](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/06-redaction-levels.svg)

The default (`HASH`) ensures raw prompts and responses never appear in logs. PII detection runs automatically before any redaction, catching sensitive data even when developers forget to configure it. Debug mode (`NONE`) requires explicit opt-in and emits a warning.

Every audit event carries:
- Schema version for forward compatibility
- Correlation ID for end-to-end tracing
- Component versions for dependency tracking
- Cost metadata (estimated and actual)
- Policy decisions and triggered rules

---

## Multi-Provider Coverage

TealTiger wraps 7 LLM providers with consistent security, giving you 95%+ market coverage through a unified interface. Every provider gets the same guardrails, policies, audit logging, and cost tracking — no per-provider security gaps.

![Multi-Provider Coverage](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/07-multi-provider.svg)

| Provider | Client | Unique Capabilities |
|----------|--------|-------------------|
| OpenAI | `TealOpenAI` | Chat, completions, embeddings, function calling |
| Anthropic | `TealAnthropic` | Claude 3 family, streaming, long context |
| Google | `TealGemini` | Multimodal input, safety settings, grounding |
| AWS Bedrock | `TealBedrock` | 5 model families, regional endpoints |
| Azure OpenAI | `TealAzureOpenAI` | Deployment-based routing, Azure AD integration |
| Mistral AI | `TealMistral` | European data residency, GDPR compliance |
| Cohere | `TealCohere` | RAG with citations, connectors, embeddings |

Both TypeScript and Python SDKs have full feature parity across all 7 providers.

---

## End-to-End Traceability

Every request in TealTiger carries an `ExecutionContext` that propagates through all components. This enables incident investigation, compliance auditing, and distributed tracing without manual plumbing.

![End-to-End Traceability](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/09-traceability.svg)

Correlation IDs use cryptographically random UUID v4 to prevent prediction attacks. Context converts to and from HTTP headers for cross-service propagation. OpenTelemetry-compatible trace IDs integrate with existing observability stacks.

---

## OWASP Top 10 for Agentic Applications

TealTiger v1.1.1 maps directly to the OWASP Top 10 for Agentic Applications, covering 7 out of 10 vulnerability categories through its SDK-only architecture:

![OWASP Coverage Map](https://raw.githack.com/agentguard-ai/tealtiger/main/blog/diagrams/08-owasp-coverage.svg)

This coverage is achieved without deploying any infrastructure — a significant differentiator for teams that need security without operational overhead.

---

## Policy Testing: Shift Left

TealTiger includes a built-in policy test harness that validates policy behavior before production deployment. Write tests as code, run them in CI/CD, and catch regressions before they reach users.

```typescript
const tester = new PolicyTester(engine);

const report = tester.runSuite({
  name: 'Production Policy Validation',
  tests: [
    {
      name: 'Deny file deletion for support agents',
      context: {
        agentId: 'support-001',
        action: 'tool.execute',
        tool: 'file_delete'
      },
      expected: {
        action: DecisionAction.DENY,
        reason_codes: [ReasonCode.TOOL_NOT_ALLOWED]
      }
    },
    {
      name: 'Allow read-only database access',
      context: {
        agentId: 'analyst-001',
        action: 'tool.execute',
        tool: 'database_query'
      },
      expected: {
        action: DecisionAction.ALLOW
      }
    },
    // Built-in test corpora
    ...TestCorpora.promptInjection(),
    ...TestCorpora.piiDetection(),
    ...TestCorpora.unsafeCode()
  ]
});

// Export for CI/CD
const junitXml = tester.exportReport(report, 'junit');
```

```bash
# CLI integration
npx tealtiger test ./policies/*.test.json \
  --coverage \
  --format=junit \
  --output=./test-results/policies.xml
```

Each test executes in under 100ms. Results are deterministic and reproducible. JUnit XML export integrates with every major CI/CD platform.

---

## Performance Profile

Enterprise features add minimal overhead. Here are the p99 latency targets that TealTiger meets:

| Operation | p99 Latency | Notes |
|-----------|-------------|-------|
| Policy mode resolution | < 1ms | Hierarchical lookup with caching |
| Decision evaluation | < 10ms | Excluding policy logic execution |
| Context propagation | < 0.5ms | UUID generation + field copy |
| Content redaction | < 5ms | For content under 10KB |
| Audit logging | < 2ms | Asynchronous, non-blocking |
| Guardrail execution | < 5ms | Parallel execution of all checks |
| Policy test case | < 100ms | Per individual test |

The SDK uses LRU caching for policy evaluations, lazy initialization for components, and parallel execution for independent guardrails. Zero network calls for security checks means latency is bounded by CPU, not I/O.

---

## Getting Started

### TypeScript

```bash
npm install tealtiger
```

```typescript
import {
  TealOpenAI,
  TealEngine,
  GuardrailEngine,
  PIIDetectionGuardrail,
  PromptInjectionGuardrail,
  PolicyMode,
  TealAudit,
  FileOutput,
  RedactionLevel
} from 'tealtiger';

// Configure policy engine
const engine = new TealEngine({
  policies: {
    tools: {
      database_query: { allowed: true, maxRows: 1000 },
      file_delete: { allowed: false }
    }
  },
  mode: { defaultMode: PolicyMode.ENFORCE }
});

// Configure guardrails
const guardrails = new GuardrailEngine({ mode: 'parallel' });
guardrails.registerGuardrail(new PIIDetectionGuardrail({ action: 'redact' }));
guardrails.registerGuardrail(new PromptInjectionGuardrail({ sensitivity: 'high' }));

// Configure audit
const audit = new TealAudit({
  outputs: [new FileOutput('./audit.log')],
  config: {
    input_redaction: RedactionLevel.HASH,
    output_redaction: RedactionLevel.HASH,
    detect_pii: true
  }
});

// Create secured client
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
  engine,
  guardrailEngine: guardrails,
  audit
});
```

### Python

```bash
pip install tealtiger
```

```python
from tealtiger import (
    TealOpenAI, TealEngine, GuardrailEngine,
    PIIDetectionGuardrail, PromptInjectionGuardrail,
    PolicyMode, TealAudit, FileOutput, RedactionLevel
)

engine = TealEngine(
    policies={
        "tools": {
            "database_query": {"allowed": True, "max_rows": 1000},
            "file_delete": {"allowed": False}
        }
    },
    mode={"default_mode": PolicyMode.ENFORCE}
)

guardrails = GuardrailEngine(mode="parallel")
guardrails.register_guardrail(PIIDetectionGuardrail(action="redact"))
guardrails.register_guardrail(PromptInjectionGuardrail(sensitivity="high"))

audit = TealAudit(
    outputs=[FileOutput("./audit.log")],
    config={
        "input_redaction": RedactionLevel.HASH,
        "output_redaction": RedactionLevel.HASH,
        "detect_pii": True
    }
)

client = TealOpenAI(
    api_key="your-key",
    agent_id="my-agent",
    engine=engine,
    guardrail_engine=guardrails,
    audit=audit
)
```

---

## Framework Alignment

TealTiger v1.1.1 aligns with three major AI security frameworks:

| Framework | Coverage | Key Mappings |
|-----------|----------|-------------|
| OWASP Top 10 for Agentic Apps | 7/10 ASIs | Tool misuse, access control, cascading failures, rogue agents |
| Google SAIF | Core principles | Policy enforcement, audit trails, anomaly detection |
| NIST AI RMF 1.0 | Govern, Map, Measure, Manage | Policy modes, risk scoring, monitoring, audit |

---

## What's Next

TealTiger v1.1.1 is available now on [npm](https://www.npmjs.com/package/tealtiger) and [PyPI](https://pypi.org/project/tealtiger/). Both SDKs have full feature parity across all 7 providers.

Upcoming in the roadmap:
- Inter-agent communication security (ASI07 coverage)
- ML training and inference governance plugins
- Enhanced cost governance with spend velocity anomaly detection
- CI/CD integration packages (GitHub Actions, GitLab CI, CircleCI)

---

**Links:**
- 📚 Documentation: [docs.tealtiger.ai](https://docs.tealtiger.ai)
- 📦 TypeScript SDK: [npm](https://www.npmjs.com/package/tealtiger) | [GitHub](https://github.com/agentguard-ai/tealtiger-typescript)
- 🐍 Python SDK: [PyPI](https://pypi.org/project/tealtiger/) | [GitHub](https://github.com/agentguard-ai/tealtiger-python-prod)
- 🛡️ OWASP ASI Mapping: [Full Document](https://github.com/agentguard-ai/tealtiger-typescript/blob/main/OWASP-AGENTIC-TOP10-TEALTIGER-MAPPING.md)
- 📧 Contact: reachout@tealtiger.ai
- ⚖️ License: Apache 2.0

---

*TealTiger is open source under the Apache 2.0 license. We welcome contributions — see our [Contributing Guide](https://github.com/agentguard-ai/tealtiger-typescript/blob/main/CONTRIBUTING.md).*
