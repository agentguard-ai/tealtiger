---
layout: post
title: "Pre-Execution Governance for AI Sandboxes: TealTiger + Daytona"
description: "How combining TealTiger's deterministic logic governance with Daytona's infrastructure isolation creates true defense-in-depth for AI agent code execution."
date: 2026-06-16
permalink: /security/integrations/daytona-tealtiger-pre-execution-governance/
category: security
hub: integrations
author: Naga Satish Chilakamarti
author_github: https://github.com/nagasatish007
author_role: Maintainer

tags:
  - tealtiger
  - daytona
  - sandbox
  - pre-execution
  - defense-in-depth
  - secret-detection
  - governance
---

# Pre-Execution Governance for AI Sandboxes: TealTiger + Daytona

Daytona gives your AI agents a safe place to run code — isolated kernel,
ephemeral filesystem, controlled network. But isolation answers a different
question than governance. Isolation decides **where and how** code runs.
Governance decides **if it should run at all**.

This post covers the pattern we built to combine both: TealTiger scans
LLM-generated code for secrets, PII, and policy violations *before* Daytona
ever creates a sandbox. The result is defense-in-depth that no single layer
can provide alone.

## The gap: isolation without inspection

Consider what happens when an LLM generates code containing a hardcoded API
key. In a sandbox-only workflow:

1. The agent produces code with `sk-proj-ABC123...` embedded in a string
2. The sandbox executes it in an isolated environment
3. The key ends up in sandbox logs, process memory, or network traffic

The sandbox prevented the code from *escaping*. But it didn't prevent the
secret from *entering*. For compliance frameworks (SOC 2, HIPAA, EU AI Act),
organizations need evidence that governance evaluated code before execution —
not just that execution was contained.

## Architecture: logic governance + infrastructure isolation

![TealTiger + Daytona Architecture](/assets/images/blog/daytona-tealtiger-architecture.svg)

The integration creates a three-phase pipeline:

| Phase | Owner | Responsibility |
|-------|-------|----------------|
| **Pre-execution** | TealTiger | Scan for secrets (500+ patterns), PII, policy violations, budget check |
| **Execution** | Daytona | Isolated runtime: dedicated kernel, filesystem, network, resource limits |
| **Post-execution** | TealTiger | Audit receipt generation, cost attribution, output scan |

TealTiger operates deterministically with less than 5ms overhead. No LLM in
the governance path — the same policy and the same input always produce the
same decision.

## What each layer prevents

![Defense Layers](/assets/images/blog/daytona-tealtiger-defense-layers.svg)

Neither layer alone covers the full threat surface:

- **TealTiger without Daytona**: you know the code is clean, but a zero-day
  in the runtime could still cause damage. No resource isolation.
- **Daytona without TealTiger**: code runs safely in isolation, but secrets
  and PII still enter the environment. No pre-execution audit trail.

Together, nothing leaks in and nothing escapes out.

## Working example

The integration pattern is straightforward. TealTiger wraps the LLM client,
Daytona wraps the execution environment. The governance decision happens at
the boundary between them.

```python
import os
from tealtiger import TealOpenAI
from daytona_sdk import Daytona

# TealTiger governs the LLM gateway
ai_client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "prompt_injection": True,
        "secret_detection": True,
        "pii_detection": True,
    },
    budget={"max_cost_per_session": 2.00},
)

# Daytona provides isolated execution
daytona = Daytona()

# Agent generates code — TealTiger scans the output
response = ai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": "Write a script to parse and transform user data"
    }],
)

# If we reach here, TealTiger approved the output
# Execute safely in Daytona's isolated sandbox
sandbox = daytona.create()
result = sandbox.process.code_run(
    response.choices[0].message.content
)

# Clean up
daytona.remove(sandbox)
```

If TealTiger detects a secret or PII in the LLM output, the response is
blocked before `sandbox.process.code_run()` is ever called. The sandbox is
never created, the code never runs, and the governance decision is logged
with a structured audit receipt.

## Dual-layer cost control

One of the less obvious benefits: financial risk is eliminated from both
directions.

| Layer | What it controls | How |
|-------|-----------------|-----|
| **TealTiger** | LLM token spend | Per-request, per-session, and per-day budgets |
| **Daytona** | Compute resources | CPU, memory, and time caps per sandbox |

An infinite agent loop hits TealTiger's budget limit before the LLM provider
charges accumulate. Even if the loop somehow bypasses the token budget,
Daytona's resource limits cap the compute cost.

## Unified audit trail

![Audit Flow](/assets/images/blog/daytona-tealtiger-audit-flow.svg)

Every execution produces a TEEC (Typed Evidence & Evidence Contract) receipt
that links:

- **The governance decision** — decision ID, policy digest, risk score, latency
- **The sandbox execution** — sandbox ID, exit code, duration, resource usage
- **The correlation** — OpenTelemetry-compatible trace ID linking both events

Receipts export as SARIF v2.1.0 (for security tooling), JUnit XML (for CI/CD),
or JSON (for custom pipelines). Compliance teams get a single artifact proving
that governance approved the execution before it happened.

## Use case: secret interception

Here's a concrete scenario. An agent is asked to "write a database connection
script" and the LLM halluccinates a realistic-looking connection string:

```python
# LLM generates this code:
import psycopg2

conn = psycopg2.connect(
    host="prod-db.internal.company.com",
    password="sk-prod-8f2a9b4c1d3e5f6a7b8c9d0e1f2a3b4c",  # ← TealTiger catches this
    database="users"
)
```

TealTiger's TealSecrets module identifies the credential pattern, blocks the
response, and logs a governance decision with reason code
`SECRET_DETECTED:generic_api_key`. The sandbox is never created.

Without pre-execution scanning, that string would exist in:
- Daytona sandbox process memory
- Sandbox execution logs
- Potentially in network traffic if the connection attempt was made

Even in isolation, that's a compliance violation — the secret *entered* a
system it shouldn't have.

## Integration approaches

We see three paths for deeper integration:

### 1. Documentation and examples (available now)

A joint guide showing the TealTiger + Daytona pattern. Working code lives at
[`examples/daytona-governed-sandbox`](https://github.com/agentguard-ai/tealtiger/tree/main/examples/daytona-governed-sandbox).

### 2. SDK wrapper (proposed)

A `tealtiger-daytona` package that wraps `sandbox.process.code_run()` with
automatic governance:

```python
from tealtiger.integrations.daytona import GovernedSandbox

sandbox = GovernedSandbox(
    policy="default-deny",
    guardrails=["secret_detection", "pii_detection"],
)

# Governance happens transparently
result = sandbox.run(agent_generated_code)
```

### 3. Pre-execution hook (if Daytona supports it)

A native hook where TealTiger evaluates code before the sandbox executes it:

```python
daytona.register_pre_execution_hook(tealtiger.evaluate)
```

This would make governance invisible to the agent framework — just a property
of the execution environment.

## Both already in the AG2 ecosystem

TealTiger and Daytona are both AG2 Beta Extensions. They coexist in the same
multi-agent framework at `autogen/beta/extensions/`. This means teams already
using AG2 for multi-agent workflows can layer both without introducing new
dependencies.

## Getting started

Install both SDKs:

```bash
pip install tealtiger daytona-sdk
```

Set your environment:

```bash
export OPENAI_API_KEY="your-key"
export DAYTONA_API_KEY="your-key"
```

Run the governed sandbox example:

```bash
git clone https://github.com/agentguard-ai/tealtiger.git
cd tealtiger/examples/daytona-governed-sandbox
python governed_execution.py
```

## Summary

| Concern | Without integration | With TealTiger + Daytona |
|---------|--------------------|-----------------------|
| Secrets in code | Enter sandbox, end up in logs | Blocked before sandbox creation |
| PII exposure | Contained but still present | Never enters the environment |
| Cost control | Either LLM or compute, not both | Both layers enforced |
| Audit evidence | Execution logs only | Governance decision + execution linked |
| Compliance proof | "It was isolated" | "It was evaluated AND isolated" |

Defense-in-depth means no single point of failure in your security story.
TealTiger handles the logic. Daytona handles the infrastructure. Together,
you get a governance posture that satisfies both the security team and the
compliance auditors.

---

**Resources:**

- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [TealTiger PyPI](https://pypi.org/project/tealtiger/)
- [Daytona SDK](https://github.com/daytonaio/sdk)
- [Working Example: Governed Sandbox](https://github.com/agentguard-ai/tealtiger/tree/main/examples/daytona-governed-sandbox)
- [TealTiger Documentation](https://docs.tealtiger.ai/)
