---
title: "Migration Guide: v1.3 → v1.4"
description: "Upgrade to TealTiger v1.4 with zero breaking changes. Adopt observe(), multi-stage defense, and post-execution governance at your own pace."
---

# Migration Guide: v1.3 → v1.4

v1.4 is **fully backward compatible** with v1.3. All existing configurations, policies, and integrations continue to work without modification. This guide covers what's new and how to adopt it gradually.

---

## Quick Upgrade

```bash
# TypeScript
npm install tealtiger@1.4.0

# Python
pip install tealtiger==1.4.0
```

That's it. Your existing code works unchanged.

---

## No Breaking Changes

| Area | v1.3 Behavior | v1.4 Behavior |
|------|--------------|--------------|
| TealGuard default depth | Pattern scanning only | Same — `depth: "fast"` is the default |
| Post-execution scanning | Not available | Not active unless explicitly configured |
| observe() | Not available | Opt-in — doesn't affect existing code |
| Role-based policies | Not available | Opt-in — falls back to global policy |
| API surface | All methods preserved | All methods preserved + new additions |
| GovernanceDecision | Existing fields | Existing fields + `stagesEvaluated`, `phase` (additive) |

---

## New Imports

### TypeScript

```typescript
// New in v1.4
import { observe, freeze, unfreeze } from "tealtiger";
import { perRole } from "tealtiger/policy";

// Existing (unchanged)
import { TealGuard, TealEngine, TealAudit, TealCircuit } from "tealtiger";
```

### Python

```python
# New in v1.4
from tealtiger import observe, freeze, unfreeze
from tealtiger.policy import per_role

# Existing (unchanged)
from tealtiger import TealGuard, TealEngine, TealAudit, TealCircuit
```

---

## Gradual Adoption Path

### Step 1: Install v1.4 (Zero Risk)

Update the package. Everything works as before.

```bash
npm install tealtiger@1.4.0
```

### Step 2: Add observe() to One Agent (Low Risk)

Wrap one client with `observe()` to start collecting cost and behavioral data. Nothing is blocked.

```typescript
import { observe } from "tealtiger";
const client = observe(existingClient);
```

### Step 3: Review the Baseline (Informational)

After 100 requests, check what "normal" looks like for your agent:

```typescript
const baseline = client.getBaseline();
console.log(baseline.stats);
```

### Step 4: Enable Multi-Stage Defense (Optional)

If you want deeper defense, upgrade your TealGuard depth:

```typescript
// Before (v1.3 — still works in v1.4)
const guard = new TealGuard({ pii: true, secrets: true });

// After (v1.4 — adds structural analysis)
const guard = new TealGuard({
  depth: "standard",
  guardrails: { pre: { pii: true, secrets: true } }
});
```

### Step 5: Add Post-Execution Scanning (Optional)

Enable output scanning when you're ready:

```typescript
const guard = new TealGuard({
  depth: "standard",
  guardrails: {
    pre: { pii: true, secrets: true },
    post: { pii: true, secrets: true }  // NEW: scan outputs
  }
});
```

### Step 6: Add Role-Based Policies (Optional)

When you have multiple agents:

```typescript
import { perRole } from "tealtiger/policy";

const policy = perRole({
  researcher: { allowed_tools: ["search", "read"], max_cost_per_session: 2.0 },
  writer: { allowed_tools: ["write", "edit"], max_cost_per_session: 0.5 }
});
```

---

## New Configuration Options

### depth

```typescript
// v1.3 (no depth option — always "fast" equivalent)
const guard = new TealGuard({ pii: true });

// v1.4 (explicit depth)
const guard = new TealGuard({ depth: "standard", guardrails: { pre: { pii: true } } });
```

### post guardrails

```typescript
// v1.3 (pre-only, implicit)
const guard = new TealGuard({ pii: true, secrets: true });

// v1.4 (explicit pre/post structure)
const guard = new TealGuard({
  guardrails: {
    pre: { pii: true, secrets: true },
    post: { pii: true, secrets: true }
  }
});
```

### per_role

```python
# v1.3 (single global policy)
guard = TealGuard(pii=True, secrets=True)

# v1.4 (role-based policies)
from tealtiger.policy import per_role
policy = per_role({
    "researcher": {"allowed_tools": ["search"], "max_cost_per_session": 2.0},
    "writer": {"allowed_tools": ["write"], "max_cost_per_session": 0.5}
}, default_deny=True)
```

---

## GovernanceDecision Changes

The `GovernanceDecision` object gains new fields (additive, non-breaking):

```typescript
// v1.3 fields (still present)
interface GovernanceDecision {
  action: "ALLOW" | "DENY" | "SANITIZE" | "REPORT";
  riskScore: number;
  reasonCodes: string[];
  correlationId: string;
  timestamp: number;
}

// v1.4 additions
interface GovernanceDecision {
  // ... all v1.3 fields ...
  stagesEvaluated: string[];    // Which stages ran
  stageResults: StageResult[];  // Per-stage details
  shortCircuited: boolean;      // Did it short-circuit?
  totalLatencyMs: number;       // Total governance overhead
  phase: "pre" | "post";       // Which direction was scanned
}
```

Code that reads v1.3 fields continues to work. The new fields are additive.

---

## Optional Dependencies

If you use `depth: "deep"`, install the ONNX runtime:

```bash
# TypeScript
npm install onnxruntime-node @tealtiger/onnx-model

# Python
pip install tealtiger[deep]
# or: pip install onnxruntime>=1.17
```

These are only loaded at runtime when `depth: "deep"` is configured. Fast and standard modes add zero new dependencies.

---

## Dashboard (New)

v1.4 ships with a governance dashboard. It's a separate application — installing it is entirely optional and has no impact on SDK behavior.

See [Dashboard Getting Started](/dashboard/getting-started) for setup instructions.

---

## FAQ

**Q: Will my existing tests pass after upgrading?**
Yes. v1.4 adds no breaking changes. The `GovernanceDecision` object has additional fields but no removed or renamed fields.

**Q: Does observe() affect my existing TealGuard setup?**
No. `observe()` and `TealGuard` are independent. You can use one, the other, or both.

**Q: What if I don't configure depth?**
It defaults to `"fast"` which is equivalent to v1.3 behavior. You'll see `stagesEvaluated: ["stage1"]` in decisions.

**Q: Is the ONNX model downloaded on install?**
Only if you install the `@tealtiger/onnx-model` package (TypeScript) or `tealtiger[deep]` (Python). The base package doesn't include it.

**Q: Can I use observe() in production?**
Yes. It adds < 5ms overhead (P99), makes no network calls, and never blocks requests. It's designed for production use from day one.
