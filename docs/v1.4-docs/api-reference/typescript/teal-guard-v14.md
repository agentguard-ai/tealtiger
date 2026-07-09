---
title: "TealGuard v1.4 — TypeScript API"
description: "API reference for TealGuard v1.4 with multi-stage defense pipeline and post-execution response governance."
---

# TealGuard v1.4 — TypeScript API

TealGuard v1.4 adds two major capabilities: configurable multi-stage defense depth and post-execution response scanning.

---

## Constructor

```typescript
import { TealGuard } from "tealtiger";

const guard = new TealGuard(config: TealGuardConfig);
```

### TealGuardConfig

```typescript
interface TealGuardConfig {
  // Defense depth (NEW in v1.4)
  depth?: "fast" | "standard" | "deep";  // Default: "fast"

  // Enforcement mode
  mode?: "ENFORCE" | "MONITOR" | "REPORT_ONLY";  // Default: "ENFORCE"

  // Bi-directional guardrails (NEW in v1.4)
  guardrails?: {
    pre?: GuardrailConfig;
    post?: GuardrailConfig;
  };

  // Role-based policy (NEW in v1.4)
  policy?: RolePolicy;

  // Existing v1.3 options (still supported)
  pii?: boolean | PIIConfig;
  secrets?: boolean;
  injection?: boolean;
  content?: boolean | ContentConfig;
}
```

---

## depth

Controls how many defense stages execute per request.

```typescript
type Depth = "fast" | "standard" | "deep";
```

| Value | Stages Executed | Target Latency |
|-------|----------------|----------------|
| `"fast"` | Stage 1 (pattern scanning) | < 5ms |
| `"standard"` | Stage 1 + Stage 2 (structural analysis) | < 20ms |
| `"deep"` | Stage 1 + Stage 2 + Stage 3 (local classifier) | < 50ms |

```typescript
// Minimal latency — catches patterns only
const guard = new TealGuard({ depth: "fast" });

// Balanced — catches patterns + structural threats
const guard = new TealGuard({ depth: "standard" });

// Maximum coverage — adds ONNX classifier
const guard = new TealGuard({ depth: "deep" });
```

### Default

`"fast"` — equivalent to v1.3 behavior. No breaking changes.

---

## guardrails

Configures bi-directional scanning — pre-execution (input) and post-execution (output).

```typescript
interface GuardrailConfig {
  pii?: boolean | PIIGuardrailConfig;
  secrets?: boolean;
  injection?: boolean;
  content?: boolean | ContentPolicyConfig;
  mode?: "ENFORCE" | "MONITOR" | "REPORT_ONLY";
}

interface PIIGuardrailConfig {
  categories?: ("email" | "phone" | "ssn" | "credit_card" | "passport" | "drivers_license")[];
}

interface ContentPolicyConfig {
  policy?: string;
}
```

### Pre-Execution Only (v1.3 Compatible)

```typescript
const guard = new TealGuard({
  guardrails: {
    pre: { pii: true, secrets: true, injection: true }
  }
});
```

### Post-Execution Only

```typescript
const guard = new TealGuard({
  guardrails: {
    post: { pii: true, secrets: true, content: true }
  }
});
```

### Bi-Directional

```typescript
const guard = new TealGuard({
  guardrails: {
    pre: {
      pii: { categories: ["ssn", "credit_card"] },
      secrets: true,
      injection: true
    },
    post: {
      pii: true,
      secrets: true,
      content: true
    }
  }
});
```

### Per-Direction Mode Override

```typescript
const guard = new TealGuard({
  guardrails: {
    pre: { pii: true, secrets: true, mode: "ENFORCE" },
    post: { pii: true, secrets: true, mode: "MONITOR" }
  }
});
```

---

## evaluate()

```typescript
async evaluate(request: GovernanceRequest): Promise<GovernanceDecision>
```

Evaluates a request through the multi-stage pipeline.

### GovernanceDecision (v1.4)

```typescript
interface GovernanceDecision {
  // Core decision
  action: "ALLOW" | "DENY" | "SANITIZE" | "REPORT";
  riskScore: number;
  reasonCodes: string[];

  // Multi-stage fields (NEW in v1.4)
  stagesEvaluated: string[];
  stageResults: StageResult[];
  shortCircuited: boolean;
  totalLatencyMs: number;

  // Phase identifier (NEW in v1.4)
  phase: "pre" | "post";

  // Existing fields
  correlationId: string;
  timestamp: number;
  agentId?: string;
}

interface StageResult {
  stage: "stage1" | "stage2" | "stage3";
  action: "PASS" | "DENY";
  latencyMs: number;
  findings: Finding[];
}

interface Finding {
  type: string;       // "PII", "SECRET", "INJECTION", "HARMFUL_CONTENT"
  pattern?: string;   // Pattern that matched (e.g., "openai_api_key")
  category?: string;  // Finding category
  confidence: number; // 0-1
  severity: string;   // "low", "medium", "high", "critical"
}
```

### Example

```typescript
const decision = await guard.evaluate({
  content: "My API key is sk-proj-abc123...",
  agentId: "test-agent",
  toolName: "send_email"
});

console.log(decision.action);            // "DENY"
console.log(decision.stagesEvaluated);   // ["stage1"]
console.log(decision.shortCircuited);    // true
console.log(decision.stageResults[0]);
// { stage: "stage1", action: "DENY", latencyMs: 2,
//   findings: [{ type: "SECRET", pattern: "openai_api_key", confidence: 0.99, severity: "critical" }] }
```

---

## evaluateResponse()

```typescript
async evaluateResponse(response: GovernanceResponse): Promise<GovernanceDecision>
```

Evaluates an LLM response through the post-execution pipeline. **New in v1.4.**

```typescript
interface GovernanceResponse {
  content: string;
  agentId?: string;
  correlationId?: string;
  model?: string;
  provider?: string;
}
```

### Example

```typescript
// Check a model output before returning to the caller
const postDecision = await guard.evaluateResponse({
  content: modelOutput,
  agentId: "my-agent",
  correlationId: requestCorrelationId
});

if (postDecision.action === "DENY") {
  // Response blocked — don't return to caller
  throw new Error(`Response blocked: ${postDecision.reasonCodes.join(", ")}`);
}
```

---

## Short-Circuit Behavior

When a stage produces a DENY decision, subsequent stages are skipped:

```typescript
// Input contains an obvious secret pattern
const decision = await guard.evaluate({ content: "sk-proj-abc123xyz..." });

console.log(decision.stagesEvaluated);  // ["stage1"]  — Stages 2 and 3 skipped
console.log(decision.shortCircuited);   // true
console.log(decision.totalLatencyMs);   // 2ms — only Stage 1 latency
```

This is automatic — you don't need to configure it. The pipeline always short-circuits on DENY regardless of configured depth.

---

## Integration with observe()

When using `observe()` with a `TealGuard` instance:

```typescript
import { observe } from "tealtiger";
import { TealGuard } from "tealtiger";
import OpenAI from "openai";

const guard = new TealGuard({
  depth: "standard",
  guardrails: {
    pre: { pii: true, secrets: true },
    post: { pii: true, secrets: true }
  }
});

const client = observe(new OpenAI(), { guard });

// Pre-scan and post-scan happen automatically for every request
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }]
});
```

---

## Backward Compatibility

v1.4 is fully backward compatible with v1.3 configurations:

```typescript
// v1.3 style — still works, equivalent to depth: "fast", pre-only guardrails
const guard = new TealGuard({
  pii: true,
  secrets: true,
  injection: true,
  mode: "ENFORCE"
});
```

The `depth` field defaults to `"fast"` and no post-execution scan runs unless explicitly configured.
