# Troubleshooting

Use this guide when setup or runtime errors block a TealTiger integration.
For canonical error codes, see the [error code reference](./error-code-reference.md).

## `Cannot find module 'tealtiger'`

### Symptom

Node.js fails during startup or tests:

```text
Error: Cannot find module 'tealtiger'
```

### Cause

The package is not installed in the current workspace, or the app is importing
from the wrong package name/path.

### Fix

Install the package in the app that runs TealTiger and import from the public
package entrypoint:

```bash
npm install tealtiger
```

```ts
import { TealEngine } from "tealtiger";
```

In a monorepo, run the install command from the package that owns the
application entrypoint, then restart the test runner or dev server.

## `MISSING_API_KEY`

### Symptom

Client creation or the first model request fails with:

```text
MISSING_API_KEY
```

### Cause

The selected provider needs an API key, but the key was not passed in config
and the expected environment variable is not set.

### Fix

Set the provider key outside source control and pass it through configuration:

```bash
export OPENAI_API_KEY="sk-..."
```

```ts
const engine = new TealEngine({
  apiKey: process.env.OPENAI_API_KEY,
});
```

Do not commit real keys. Use `.env.example` files with placeholder values when
documenting required environment variables.

## `Policy violation: tool is not allowed`

### Symptom

A tool call is denied:

```text
Policy violation: tool is not allowed
```

### Cause

The active policy does not include the requested tool in its allowlist, or the
request is using a different tool name than the policy expects.

### Fix

Compare the tool name in the failing request with the policy allowlist:

```json
{
  "tools": {
    "allow": ["file-read", "search-docs"]
  }
}
```

Use an allowed tool, correct the request name, or update the policy only after
reviewing the access risk. Avoid broad allowlists such as `"*"` for production
agents.

## `Circuit breaker is open`

### Symptom

Requests fail before reaching the downstream service:

```text
Circuit breaker is open
```

### Cause

TealTiger has observed repeated downstream failures and opened the circuit to
avoid cascading failures, retry storms, or uncontrolled cost.

### Fix

Check the downstream service first, then let the circuit timeout elapse:

```ts
const circuit = new TealCircuit({
  failureThreshold: 5,
  timeout: 30_000,
  halfOpenRequests: 1,
});
```

Tune circuit thresholds only when logs show the dependency is healthy and the
defaults are too strict for normal traffic.

## `Budget exceeded`

### Symptom

A request is blocked with a budget error:

```text
Budget exceeded
```

or:

```text
COST_BUDGET_EXCEEDED
```

### Cause

The estimated or accumulated cost is above the configured per-request, session,
daily, or agent budget.

### Fix

Lower request cost or raise the budget intentionally:

```ts
const engine = new TealEngine({
  budget: {
    perRequestUsd: 0.05,
    perSessionUsd: 1,
    perDayUsd: 10,
  },
});
```

Prefer cheaper models, smaller prompts, lower token limits, or manual approval
for expensive workflows before increasing production budgets.
