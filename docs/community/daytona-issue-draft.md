# Issue Title

[Feature Request] TealTiger pre-execution governance for Daytona sandboxes

# Body

## Summary

Proposing an integration between [TealTiger](https://github.com/agentguard-ai/tealtiger) and Daytona that adds deterministic logic governance before code reaches a sandbox. TealTiger scans LLM-generated code for secrets, PII, and policy violations *before* Daytona spins up the isolated environment — creating defense-in-depth: logic governance + infrastructure isolation.

## Why TealTiger + Daytona?

Daytona provides the **infrastructure isolation** — dedicated kernel, filesystem, network stack per sandbox. But isolation alone doesn't prevent:

- Hardcoded secrets (API keys, tokens) being embedded in agent-generated code
- PII (SSN, credit cards) leaking into sandbox environments and logs
- Runaway LLM cost loops before code even reaches the sandbox
- Lack of audit trail linking *why* a sandbox was approved to execute

TealTiger adds the **logic governance layer** that decides IF code should execute, BEFORE Daytona decides WHERE and HOW.

## Architecture

```
[LLM generates code]
        │
        ▼
┌───────────────────┐
│    TealTiger       │  ← Scans for secrets (500+ patterns), PII,
│    (Pre-execution) │     validates policy, checks budget
└────────┬──────────┘
         │ (Approved)
         ▼
┌───────────────────┐
│    Daytona         │  ← Isolated execution: kernel, filesystem,
│    (Sandbox)       │     network, resource limits
└────────┬──────────┘
         │ (Result)
         ▼
┌───────────────────┐
│    TealTiger       │  ← Audit receipt, cost tracking, output scan
│    (Post-execution)│
└───────────────────┘
```

## Integration Use Cases

### 1. Secret interception before sandbox creation

TealTiger's TealSecrets module detects 500+ credential patterns. If an agent generates code containing a hardcoded API key, TealTiger blocks execution before Daytona ever creates a sandbox — preventing secret leakage into sandbox logs, network traffic, or filesystem.

### 2. Dual-layer cost control

- **TealTiger**: Enforces LLM token budgets (per-request, per-session, per-day)
- **Daytona**: Enforces compute resource limits (CPU, memory, time)
- Together: Complete financial risk elimination for infinite agent loops

### 3. Unified audit trail

Every sandbox execution produces a TEEC receipt linking:
- The governance decision (decision_id, policy_digest, risk_score)
- The sandbox execution outcome (sandbox_id, exit_code, duration)
- Exportable as SARIF, JUnit XML, or JSON for compliance

## Working Example

Already built and live: https://github.com/agentguard-ai/tealtiger/tree/main/examples/daytona-governed-sandbox

```python
from tealtiger import TealOpenAI
from daytona_sdk import Daytona

# TealTiger governs the LLM gateway
ai_client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"prompt_injection": True, "secret_detection": True},
    budget={"max_cost_per_session": 2.00},
)

# Daytona provides isolated execution
daytona = Daytona()

# Agent workflow
response = ai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a script to parse user data"}],
)

# TealTiger approved → execute safely in Daytona
sandbox = daytona.create()
result = sandbox.process.code_run(response.choices[0].message.content)
daytona.remove(sandbox)
```

## What we're proposing

1. **Documentation**: A joint example/guide showing the TealTiger + Daytona pattern
2. **SDK integration** (optional): A `tealtiger-daytona` wrapper that auto-governs before `sandbox.process.code_run()`
3. **Event hook** (if Daytona supports it): Pre-execution hook where TealTiger evaluates before sandbox runs code

## About TealTiger

- Deterministic governance SDK — no LLM in the governance path, <5ms overhead
- Secret detection (500+ patterns), PII detection, prompt injection blocking, cost tracking
- Apache 2.0, Python + TypeScript SDKs
- Already integrated with AG2 (merged), Vercel AI SDK, LangChain, CrewAI
- PyPI: https://pypi.org/project/tealtiger/
- npm: https://www.npmjs.com/package/tealtiger

Happy to collaborate on whatever integration approach works best for the Daytona team.
