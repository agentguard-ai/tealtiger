# E2B Governance Example

This example shows TealTiger acting as a policy gate before AI-generated code is
sent to an E2B sandbox.

## Architecture

```text
User Prompt
  -> LLM-generated code
  -> TealEngine policy gate
       - tool allowlist
       - code execution policy
       - session budget check
       - secret scan
       - sandbox call rate limit
  -> ALLOW: execute in E2B
  -> DENY: block before sandbox creation
  -> MODIFY: sanitize candidate code before any execution path
```

E2B answers where the code executes: an isolated cloud sandbox. TealTiger answers
whether the code should execute: the example evaluates policy, scans for leaked
credentials, checks budget and rate limits, then records sandbox execution cost.

## Setup

Install dependencies from this example directory:

```bash
git submodule update --init packages/tealtiger-sdk
cd examples/e2b-governance
npm install
```

Set credentials for the live provider path:

```bash
export E2B_API_KEY="your-e2b-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

Optional configuration:

```bash
export OPENAI_MODEL="gpt-4.1-mini"
export CODE_PROMPT="Write Python code that prints the 10th Fibonacci number."
export TEALTIGER_E2B_SESSION_BUDGET_USD="0.05"
export TEALTIGER_E2B_MAX_CALLS="2"
export TEALTIGER_E2B_RATE_WINDOW_MS="60000"
export E2B_COST_PER_SECOND_USD="0.0006"
export E2B_ESTIMATED_SECONDS="3"
```

Do not commit real API keys. Keep real values in your shell, secret manager, or a
local `.env` file ignored by git.

## Run

Typecheck the example:

```bash
npx tsc --noEmit
```

Run it:

```bash
npm start
```

If `E2B_API_KEY` is not set, the example runs in dry-run mode and prints the code
that would be sent to E2B after approval. If `OPENAI_API_KEY` is not set, it uses
a deterministic local code generator so the governance flow is still visible.

## What It Demonstrates

- An LLM or deterministic fallback creates Python code from a user prompt.
- `TealEngine` evaluates the sandbox call against tool, identity, code execution,
  and behavioral policies.
- A secret scan blocks generated code containing placeholder API keys before E2B
  can execute it.
- `BudgetManager` blocks sandbox execution when the projected session budget is
  exceeded.
- A sliding-window limiter caps sandbox calls per time window.
- `CostTracker` records E2B sandbox execution cost using a custom
  per-sandbox-second pricing unit.
- The console output includes the governance decision, execution output, latency,
  recorded cost, and a cost summary.

## Validation

```bash
npx tsc --noEmit
```

The example is designed to compile without live API keys and to run end-to-end
when valid `E2B_API_KEY` and `OPENAI_API_KEY` values are provided.
