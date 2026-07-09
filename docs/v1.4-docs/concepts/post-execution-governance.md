---
title: "Post-Execution Governance"
description: "Bi-directional scanning — block dangerous inputs before the LLM and sensitive outputs before the caller."
---

# Post-Execution Governance

TealTiger v1.4 extends governance to LLM outputs. Pre-execution scanning blocks dangerous inputs. Post-execution scanning blocks sensitive outputs. Together, they provide bi-directional defense.

---

## The Problem

Pre-execution governance catches threats going *into* the model. But models can *generate* sensitive content:

- **Secrets in training data**: Models sometimes output API keys, passwords, or connection strings they were trained on
- **PII in completions**: Names, email addresses, phone numbers, SSNs generated in responses
- **Harmful content**: The model produces content that violates your organization's policies
- **Data exfiltration via output**: A compromised prompt causes the model to leak context window contents

Pre-execution scanning alone can't catch these — the dangerous content doesn't exist until after the model generates it.

---

## How It Works

<img src="/diagrams/post-execution-governance.svg" alt="Bi-directional pre/post scanning" />

The post-scan executes **after** the provider response is received but **before** it's returned to the caller. In ENFORCE mode, blocked content never reaches your application code.

---

## Configuration

```typescript
import { TealGuard } from "tealtiger";

const guard = new TealGuard({
  guardrails: {
    // Scan inputs before sending to the LLM
    pre: {
      pii: true,           // Block PII in inputs
      secrets: true,       // Block secrets in inputs
      injection: true      // Block prompt injection attempts
    },
    // Scan outputs before returning to the caller
    post: {
      pii: true,           // Block PII in outputs
      secrets: true,       // Block secrets in outputs
      content: true        // Block harmful content in outputs
    }
  }
});
```

```python
from tealtiger import TealGuard

guard = TealGuard(
    guardrails={
        "pre": {"pii": True, "secrets": True, "injection": True},
        "post": {"pii": True, "secrets": True, "content": True}
    }
)
```

### Independent Configuration

`pre` and `post` are fully independent. You can configure:

- **Both**: Full bi-directional scanning
- **Only pre**: Traditional input-only scanning (v1.3 behavior)
- **Only post**: Output-only scanning (useful when you trust inputs but not model outputs)
- **Neither**: No guardrails (governance via policy only)

```typescript
// Only scan outputs — useful for internal trusted inputs
const guard = new TealGuard({
  guardrails: {
    post: { pii: true, secrets: true }
  }
});
```

---

## Enforcement Modes

Post-execution guardrails support the same enforcement modes as pre-execution:

| Mode | Pre-Scan Behavior | Post-Scan Behavior |
|------|-------------------|-------------------|
| `ENFORCE` | Block request, return DENY | Block response, return DENY |
| `MONITOR` | Log warning, allow request | Log warning, return response |
| `REPORT_ONLY` | Log detection, no action | Log detection, no action |

```typescript
const guard = new TealGuard({
  mode: "ENFORCE", // Applies to both pre and post
  guardrails: {
    pre: { pii: true },
    post: { pii: true, secrets: true }
  }
});
```

You can also set different modes for pre and post:

```typescript
const guard = new TealGuard({
  guardrails: {
    pre: { pii: true, mode: "ENFORCE" },      // Block PII inputs
    post: { pii: true, mode: "MONITOR" }       // Warn on PII outputs, but allow
  }
});
```

---

## Audit Trail

Every scan produces an audit event with a `phase` field distinguishing pre from post:

```json
{
  "eventType": "governance_decision",
  "phase": "post",
  "action": "DENY",
  "reason_codes": ["PII_DETECTED"],
  "findings": [
    { "type": "EMAIL", "count": 2 },
    { "type": "PHONE", "count": 1 }
  ],
  "correlationId": "abc-123",
  "agentId": "agent-writer-01",
  "timestamp": 1718400000000
}
```

The audit trail makes it clear whether a governance event was triggered by input content or output content.

---

## Use Cases

### Secret Leakage in Responses

Models trained on code sometimes output API keys or credentials from their training data:

```typescript
const guard = new TealGuard({
  guardrails: {
    post: { secrets: true }
  }
});

// Model outputs: "Use this key: sk-proj-abc123..."
// Post-scan catches it → DENY (in ENFORCE) or WARN (in MONITOR)
```

### PII in Model Outputs

Customer service agents that generate responses containing user PII:

```typescript
const guard = new TealGuard({
  guardrails: {
    post: { pii: { categories: ["ssn", "credit_card"] } }
  }
});

// Model outputs: "Your SSN is 123-45-6789"
// Post-scan catches it → response blocked before reaching the user
```

### Harmful Content Generation

Models that produce content violating organizational policies:

```typescript
const guard = new TealGuard({
  guardrails: {
    post: { content: { policy: "organizational-safe" } }
  }
});
```

### Context Window Exfiltration

A compromised prompt causes the model to dump its context (including other users' data):

```typescript
const guard = new TealGuard({
  guardrails: {
    pre: { injection: true },       // Catch the injection attempt
    post: { pii: true, secrets: true } // Catch the leaked content
  }
});
```

---

## Multi-Stage Integration

Post-execution governance integrates with the multi-stage defense pipeline. The `depth` setting applies to post-scan as well:

```typescript
const guard = new TealGuard({
  depth: "standard",
  guardrails: {
    pre: { pii: true, secrets: true },
    post: { pii: true, secrets: true }
  }
});
```

Both pre and post scans run through Stage 1 (pattern) and Stage 2 (structural) when `depth: "standard"` is configured.

---

## Backward Compatibility

If no `post` guardrails are configured, TealGuard behaves identically to v1.3:

```typescript
// v1.3 behavior — no post-execution scan
const guard = new TealGuard({
  guardrails: {
    pre: { pii: true, secrets: true }
  }
});
```

The `guardrails` configuration is fully backward compatible. Existing v1.3 configurations continue to work without modification.

---

## Performance Impact

Post-execution scanning adds latency **after** the LLM responds but **before** the response reaches your code:

| Depth | Pre-Scan Overhead | Post-Scan Overhead | Total Added |
|-------|-------------------|-------------------|-------------|
| `fast` | < 5ms | < 5ms | < 10ms |
| `standard` | < 20ms | < 20ms | < 40ms |
| `deep` | < 50ms | < 50ms | < 100ms |

Since the LLM response typically takes 500ms–5s, the post-scan overhead is negligible relative to total request time.
