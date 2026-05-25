# TealTiger Error Code Reference

This page lists the TypeScript SDK error classes, the error codes they carry,
when they are raised, and the usual fix path. The SDK has two related error
systems:

- SDK client errors in `packages/tealtiger-sdk/src/utils/errors.ts`, backed by
  `TealTigerErrorCode`.
- Governance engine errors in `packages/tealtiger-sdk/src/core/engine/` and
  `packages/tealtiger-sdk/src/core/engine/v1.2/`.

## SDK client error codes

These codes are defined in `packages/tealtiger-sdk/src/types/index.ts`.

| Code | Category | Meaning | Common trigger | Suggested fix |
| --- | --- | --- | --- | --- |
| `INVALID_CONFIG` | Configuration | The SDK configuration is structurally valid TypeScript but not acceptable to TealTiger. | Missing or invalid budget, provider, SSA, guardrail, or policy settings. | Check the option name, type, and required fields. Compare the config with the README examples. |
| `MISSING_API_KEY` | Configuration | A provider or SSA request needs an API key and none was supplied. | Creating a client without `apiKey` or the expected environment variable. | Set the required key through an environment variable or pass it through the client config. |
| `INVALID_SSA_URL` | Configuration | The SSA base URL is missing, malformed, or uses an unsupported format. | Passing an empty string, invalid URL, or unsupported protocol. | Use a full `http://` or `https://` URL and remove trailing malformed path/query text. |
| `NETWORK_ERROR` | Network | A request failed before a valid response was received. | DNS failure, dropped connection, unreachable service, or low-level transport failure. | Verify network access, service availability, proxy settings, and retry when the dependency is healthy. |
| `TIMEOUT_ERROR` | Network | A request exceeded the configured timeout. | SSA or provider request takes longer than the client timeout. | Increase timeout only when expected; otherwise inspect the upstream service latency. |
| `CONNECTION_ERROR` | Network | The client could not establish a connection. | Refused port, offline service, TLS/connectivity failure. | Confirm the service is running at the configured host and port. |
| `AUTHENTICATION_ERROR` | Authentication | The remote service rejected authentication. | Invalid, expired, or unauthorized key/token. | Rotate or replace credentials and verify account/project permissions. |
| `INVALID_API_KEY_FORMAT` | Authentication | The supplied key does not match the expected format. | Empty, truncated, or wrong-provider API key. | Use the correct provider key and keep it in environment variables or a gitignored `.env`. |
| `INVALID_REQUEST` | Request validation | The request payload does not meet SDK validation rules. | Missing required request fields, invalid message shape, invalid tool schema, or invalid limits. | Correct the request shape before calling the SDK. |
| `VALIDATION_ERROR` | Request validation | SDK validation failed for a specific input. | Policy builder validation, request validation, or config helper validation. | Read the error details, correct the named field, and rerun validation. |
| `SERVER_ERROR` | Server | SSA or provider returned a server-side failure. | HTTP 5xx or provider-side error. | Retry after checking provider status; report persistent failures with correlation details. |
| `SERVICE_UNAVAILABLE` | Server | A required service is temporarily unavailable. | SSA/provider maintenance, overloaded endpoint, unavailable dependency. | Retry with backoff and verify the configured endpoint. |
| `SECURITY_DENIED` | Security | TealTiger blocked the request for a security reason. | Guardrail, policy, or governance decision denies the operation. | Inspect the decision details and either change the input or update policy intentionally. |
| `POLICY_ERROR` | Security | Policy evaluation or policy constraints produced an error. | Invalid policy rule, denied policy path, or policy builder misuse. | Validate the policy and confirm the requested operation is allowed by the active policy. |

## SDK client error classes

These classes live in `packages/tealtiger-sdk/src/utils/errors.ts`.

| Class | Codes | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `BaseTealTigerError` | Any `TealTigerErrorCode` | Used directly for unknown or uncategorized SDK errors and as the base class for SDK-specific errors. | The SDK has a structured error with `message`, `code`, optional `details`, and optional `cause`. | Inspect `code` first, then `details` and `cause`. Handle it with the same retry/config/security flow as the specific code. |
| `TealTigerConfigError` | `INVALID_CONFIG`, `MISSING_API_KEY`, `INVALID_SSA_URL` | Configuration validation helpers reject client, key, URL, or options input. | The SDK cannot safely start or send a request with the supplied configuration. | Fix the named config field, supply required environment variables, and validate URLs before startup. |
| `TealTigerNetworkError` | `NETWORK_ERROR`, `TIMEOUT_ERROR`, `CONNECTION_ERROR` | Created for transport failures and timeout/connection failures. | The request did not complete because the remote endpoint could not be reached or did not respond in time. | Check endpoint health, network/DNS/proxy settings, timeout values, and retry policy. |
| `TealTigerServerError` | `SERVER_ERROR`, `SERVICE_UNAVAILABLE` | Created when the SSA or provider reports a server-side failure. | The request reached a service, but the service could not complete it. | Retry with backoff, check provider status, and include correlation details when reporting the failure. |
| `TealTigerSecurityError` | `SECURITY_DENIED`, `POLICY_ERROR` | Created when a security or policy decision blocks a request. | TealTiger is enforcing a governance/security constraint. | Review the decision output and update the input or policy only if the denial is expected to be allowed. |
| `TealTigerValidationError` | `INVALID_REQUEST`, `VALIDATION_ERROR` | Request validation, policy builder validation, or request shape checks fail. | The caller supplied invalid input. | Fix the request object, required fields, and allowed values before retrying. |
| `TealTigerAuthError` | `AUTHENTICATION_ERROR`, `INVALID_API_KEY_FORMAT` | Authentication checks fail or a key has the wrong shape. | Credentials are absent, malformed, expired, or unauthorized. | Supply the correct key through a safe secret source and verify service permissions. |

### Error factory

`createTealTigerError(message, code, details, cause)` maps `TealTigerErrorCode`
values to the matching class above. If a future code is not mapped, it returns
`BaseTealTigerError`.

## TealBaseClient errors

These classes live in `packages/tealtiger-sdk/src/client/base.ts`.

| Class | Component | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `TealTigerError` | Caller-provided component | Base class for client component errors. | A TealTiger component reported a structured client error. | Inspect the subclass or component value to choose the correct fix. |
| `PolicyViolationError` | `TealEngine` | The engine returns a denied decision while the client is enforcing policies. | The active policy blocked the operation. | Review the active policy, the denied action, and the decision reason before changing policy or request input. |
| `GuardrailViolationError` | `TealGuard` | Guardrail evaluation finds violations during client request processing. | One or more guardrails rejected the input or output. | Review the `violations` array, remove unsafe content, or intentionally adjust guardrails. |
| `CircuitOpenError` | `TealCircuit` | Client-side circuit protection blocks execution. | A downstream dependency is failing often enough that TealTiger stopped calls temporarily. | Let the dependency recover, inspect failure history, and tune circuit thresholds only when the defaults are too strict. |
| `AnomalyDetectedError` | `TealMonitor` | Cost or behavior monitoring detects an anomaly. | Monitoring found usage that does not match expected baselines. | Inspect the anomaly payload, confirm whether it is legitimate, and adjust limits/baselines only after review. |

## Engine and policy errors

These classes live in `packages/tealtiger-sdk/src/core/engine/types.ts`.

| Class | Category | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `InvalidConfigurationError` | Config | Policy mode, decision, or engine config validation fails. | The governance engine received invalid configuration or an invalid decision object. | Fix the invalid field listed in the message, then rerun policy validation. |
| `PolicyViolationError` | Policy | ENFORCE mode blocks a decision and the caller requests exception-based handling. | The operation violated active policy and carries the `Decision` that caused the block. | Inspect `decision.reason_codes`, `decision.policy_id`, and `decision.reason`; then change the request or policy intentionally. |

## TealEngine v1.2 errors

These classes live in `packages/tealtiger-sdk/src/core/engine/v1.2/errors.ts`.

| Class | Category | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `TealError` | Base | Base class for v1.2 structured errors. | A v1.2 module produced a structured error with `code`, optional `module`, and optional `correlation_id`. | Use the specific subclass when available; otherwise inspect `code`, `module`, and `correlation_id`. |
| `TealConfigError` | Config | A v1.2 module or policy configuration is invalid. | A module cannot initialize or evaluate because required configuration is missing or invalid. | Fix `config_key`, expected/received values, and any module registration mismatch. |
| `TealSchemaError` | Config/schema | A policy or registry document fails structural validation. | The document shape does not match the expected schema. | Inspect `schema_path` and `validation_errors`; correct the policy or registry document. |
| `TealRuntimeError` | Runtime | A recoverable or non-recoverable v1.2 runtime failure occurs. | Runtime execution failed after configuration was accepted. | Check `recoverable`; retry only recoverable failures and investigate module/runtime state for non-recoverable ones. |
| `TealAdapterError` | Runtime/adapter | A storage-agnostic adapter fails an operation. | An adapter such as an in-memory or future storage adapter could not complete `operation`. | Inspect `adapter` and `operation`, then fix adapter configuration, storage availability, or retry policy. |

## Circuit breaker errors

This class lives in `packages/tealtiger-sdk/src/core/circuit/TealCircuit.ts`.

| Class | Category | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `CircuitOpenError` | Circuit breaker | `TealCircuit.execute()` is called while the circuit is open and it is not ready for a half-open retry. | The circuit breaker is preventing repeated calls to a failing dependency. | Wait for the timeout window, check the downstream service, and tune `failureThreshold`, `timeout`, or `halfOpenRequests` only with evidence. |

## Reliability errors

This class lives in `packages/tealtiger-sdk/src/reliability/types.ts`.

| Class | Category | When it is thrown | What it means | How to fix |
| --- | --- | --- | --- | --- |
| `TransientError` | Reliability | Used to model retryable failures with an HTTP-like status code. | A dependency failed in a way that may succeed on retry. | Retry according to the configured retry budget; do not retry non-transient status codes indefinitely. |

## Budget and cost-related outcomes

The current SDK source does not define a `TealBudgetExceededError` class. Budget
and cost enforcement is represented through decisions, reason codes, and generic
errors, including:

| Code or reason | Where it appears | What it means | How to fix |
| --- | --- | --- | --- |
| `COST_BUDGET_EXCEEDED` | `packages/tealtiger-sdk/src/cost/governance-cost.ts` and v1.2 reason-code registry | The requested or accumulated cost exceeds the configured budget. | Reduce the request, switch to a lower-cost model, raise the budget intentionally, or require manual approval. |
| `REASONING_TOKEN_BUDGET_EXCEEDED` | `packages/tealtiger-sdk/src/cost/governance-cost.ts` | Reasoning-token usage exceeds the configured budget. | Lower reasoning effort/token limits or route the request through a cheaper policy. |
| `COST_ANOMALY_DETECTED` | `packages/tealtiger-sdk/src/cost/anomaly-detection.ts` | Cost behavior differs from expected usage. | Review whether usage is legitimate; update baseline only after confirming the change is expected. |
| `COST_SPIKE_DETECTED` | `packages/tealtiger-sdk/src/cost/anomaly-detection.ts` | A short-term cost spike was detected. | Pause or rate-limit the source, inspect recent requests, and adjust thresholds only with evidence. |
| `COST_VELOCITY_ANOMALY` | v1.2 reason-code registry | Cost is increasing faster than expected. | Inspect the workload, require approval, or reduce model/request volume. |
| `COST_MODEL_TIER_VIOLATION` | v1.2 reason-code registry | A request attempted to use a disallowed cost tier. | Use an allowed model tier or update policy intentionally. |
| `COST_ESTIMATED_TOO_HIGH` | v1.2 reason-code registry | Estimated request cost is above policy limits. | Reduce input/output size, choose a cheaper model, or request approval. |
| `MODEL_DOWNGRADED` | v1.2 reason-code registry | Policy degraded the request to a lower-cost model. | No action needed unless the downgrade is unexpected; then inspect cost policy. |

## Example error outputs

### Missing API key

```json
{
  "name": "TealTigerConfigError",
  "message": "API key is required",
  "code": "MISSING_API_KEY",
  "details": {
    "field": "apiKey"
  }
}
```

Fix: set the provider key in an environment variable or pass it through the
client config. Do not commit real keys.

### Policy violation

```json
{
  "name": "PolicyViolationError",
  "component": "TealEngine",
  "message": "Policy violation: tool is not allowed",
  "decision": {
    "action": "DENY",
    "reason_codes": ["TOOL_NOT_ALLOWED"],
    "policy_id": "default-agent-policy"
  }
}
```

Fix: use an allowed tool, change the request, or update the policy only after
confirming the blocked operation should be permitted.

### Circuit breaker open

```json
{
  "name": "CircuitOpenError",
  "message": "Circuit breaker is open"
}
```

Fix: check the downstream provider or service that caused repeated failures,
wait for the circuit timeout, and avoid forcing retries until the dependency is
healthy.

### Budget exceeded

```json
{
  "action": "DENY",
  "reason_code": "COST_BUDGET_EXCEEDED",
  "message": "Estimated request cost exceeds the configured budget"
}
```

Fix: reduce token usage, select a lower-cost model, or intentionally raise the
budget after review.

## Troubleshooting checklist

1. Read `name` and `code` first.
2. Check `details`, `decision`, `reason_code`, or `reason_codes` for the exact
   failing field or policy.
3. Use `correlation_id` when present to connect the error to logs, audit events,
   or evidence records.
4. Fix configuration and validation errors before retrying.
5. Retry network/server/reliability errors only with backoff.
6. Treat security, policy, budget, and circuit-breaker denials as intentional
   governance decisions unless evidence shows they are misconfigured.
