# TealTiger × Daytona — Governed Code Execution

Defense-in-depth for AI agents: **TealTiger** governs the logic layer (policy, PII, secrets, cost) while **Daytona** provides isolated sandbox execution (kernel, filesystem, network isolation).

## Architecture

```
[Agent / LLM Output]
        │
        ▼
┌───────────────────┐
│    TealTiger       │  ← Logic governance: scans for secrets, PII,
│    (Pre-execution) │     validates against policy, checks budget
└────────┬──────────┘
         │ (Approved)
         ▼
┌───────────────────┐
│    Daytona         │  ← Infrastructure isolation: dedicated kernel,
│    (Sandbox)       │     filesystem, network stack, resource limits
└────────┬──────────┘
         │ (Result)
         ▼
┌───────────────────┐
│    TealTiger       │  ← Post-execution: audit receipt, cost tracking,
│    (Post-execution)│     output scanning, evidence export
└───────────────────┘
```

## What This Demonstrates

1. **Pre-execution secret scanning** — TealTiger intercepts LLM-generated code before Daytona executes it. If secrets (API keys, tokens, credentials) are detected, execution is blocked.

2. **Dual-layer cost control** — TealTiger enforces LLM token budgets; Daytona enforces compute resource limits (CPU, memory, time).

3. **Unified audit trail** — Every sandbox execution produces a TEEC receipt linking the governance decision to the execution outcome.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=your-key
export DAYTONA_API_KEY=your-daytona-key

# Run the example
python governed_sandbox.py
```

## Requirements

- Python 3.10+
- `tealtiger>=1.3.0`
- `daytona-sdk>=0.171.0`
- `openai>=1.0.0`

## Use Cases

| Scenario | TealTiger Role | Daytona Role |
|---|---|---|
| Agent generates code with hardcoded API key | Detects secret, blocks execution | Never sees the code |
| Agent code tries to access `/etc/passwd` | Allows (not its domain) | Blocks (filesystem isolation) |
| Agent exceeds $5 LLM budget | Blocks further LLM calls | Sandbox continues running |
| Agent code runs infinite loop | Allows (not its domain) | Kills sandbox at resource limit |
| Agent code is clean and safe | Approves with audit receipt | Executes in isolated sandbox |

## Links

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Deterministic governance SDK
- [Daytona](https://github.com/daytonaio/daytona) — Secure AI sandbox infrastructure
- [Daytona SDK Docs](https://www.daytona.io/docs/sandboxes)

## License

Apache-2.0
