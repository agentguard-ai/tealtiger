# TealTiger + OpenAI Agents SDK Governance

This example shows how to place TealTiger governance around an OpenAI Agents
SDK workflow.

The demo uses a triage agent that can hand off to billing and support
specialists. TealTiger checks three governance points:

1. Before tool call: policy decides whether the active agent may use the tool.
2. Before handoff: a shared session budget decides whether another agent turn is
   allowed.
3. On output: guardrails scan final agent output for PII and unsafe content.

The default script runs as a deterministic local demo. It does not call a live
LLM and does not require a live TealTiger Security Sidecar Agent.

## Setup

From the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e packages/tealtiger-python
pip install "openai-agents>=0.17"
python examples/openai-agents-governance/main.py
```

On macOS or Linux, activate the virtual environment with:

```bash
source .venv/bin/activate
```

## What the demo shows

`main.py` defines:

- `Triage agent` with a safe `lookup_order` tool and handoffs to specialists.
- `Billing specialist` with a sensitive `refund_payment` tool.
- `Support specialist` with an allowed `schedule_followup` tool.
- A TealTiger policy that allows low-risk support tools and denies refunds.
- A shared TealTiger cost tracker and budget manager for the full agent session.
- An OpenAI Agents SDK `@output_guardrail` backed by TealTiger guardrails.

Expected output includes:

- `lookup_order` allowed by policy.
- `refund_payment` blocked by policy.
- The first specialist handoff allowed while the budget is available.
- A later handoff blocked after deterministic costs exceed the session budget.
- Clean output allowed.
- Output containing an email and phone number blocked by PII guardrails.

## Live TealTiger sidecar mode

The local demo uses an in-process policy evaluator so it is repeatable. To send
the same tool evaluations to a deployed TealTiger Security Sidecar Agent, set:

```bash
set TEALTIGER_SSA_URL=http://localhost:3000
set TEALTIGER_API_KEY=your-api-key
python examples/openai-agents-governance/main.py
```

On macOS or Linux:

```bash
export TEALTIGER_SSA_URL=http://localhost:3000
export TEALTIGER_API_KEY=your-api-key
python examples/openai-agents-governance/main.py
```

Deploy the same policy rules to the sidecar before using live mode.

## Integration points

### Before tool call

Each SDK tool function calls `GovernanceSession.execute_tool()` before running
the tool body. That method calls `TealTiger.execute_tool_sync()` with the tool
name, parameters, session ID, agent ID, and framework metadata.

If TealTiger denies the call, the tool body is not executed and the model gets a
blocked result.

### Before handoff

The demo calls `GovernanceSession.check_handoff()` before moving work from one
agent to another. It uses `BudgetManager.check_budget()` with the projected next
turn cost.

In a production OpenAI Agents SDK run, the same check can be called from a run
hook or handoff orchestration layer before allowing the next specialist turn.

### On output

`tealtiger_output_guardrails` is an OpenAI Agents SDK `@output_guardrail`. It
executes a TealTiger `GuardrailEngine` with:

- `PIIDetectionGuardrail`
- `ContentModerationGuardrail`

If a guardrail fails, the SDK guardrail returns `tripwire_triggered=True`.

## Notes

- This example intentionally avoids live OpenAI model calls so `python main.py`
  is safe for local verification.
- Do not put real API keys in this file. Use environment variables for sidecar
  credentials.
- The budget values are intentionally tiny so the demo can show an enforced
  budget without spending money.
