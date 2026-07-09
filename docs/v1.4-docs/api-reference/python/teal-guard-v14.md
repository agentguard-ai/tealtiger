---
title: "TealGuard v1.4 — Python API"
description: "API reference for TealGuard v1.4 with multi-stage defense pipeline and post-execution response governance in the Python SDK."
---

# TealGuard v1.4 — Python API

TealGuard v1.4 in Python adds configurable multi-stage defense depth and post-execution response scanning, with the same semantics as the TypeScript SDK.

---

## Constructor

```python
from tealtiger import TealGuard

guard = TealGuard(
    depth="fast",           # "fast" | "standard" | "deep"
    mode="ENFORCE",         # "ENFORCE" | "MONITOR" | "REPORT_ONLY"
    guardrails={
        "pre": {"pii": True, "secrets": True},
        "post": {"pii": True, "secrets": True}
    }
)
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `depth` | `str` | No | `"fast"` | Defense pipeline depth: `"fast"`, `"standard"`, or `"deep"` |
| `mode` | `str` | No | `"ENFORCE"` | Global enforcement mode |
| `guardrails` | `dict` | No | `None` | Pre and post guardrail configuration |
| `policy` | `RolePolicy` | No | `None` | Role-based policy (from `per_role()`) |
| `pii` | `bool` | No | `False` | Legacy v1.3 PII detection toggle |
| `secrets` | `bool` | No | `False` | Legacy v1.3 secrets detection toggle |
| `injection` | `bool` | No | `False` | Legacy v1.3 injection detection toggle |

---

## depth

Controls how many defense stages execute per request.

| Value | Stages Executed | Target Latency |
|-------|----------------|----------------|
| `"fast"` | Stage 1 (pattern scanning) | < 5ms |
| `"standard"` | Stage 1 + Stage 2 (structural analysis) | < 20ms |
| `"deep"` | Stage 1 + Stage 2 + Stage 3 (local classifier) | < 50ms |

```python
# Minimal latency — catches patterns only
guard_fast = TealGuard(depth="fast")

# Balanced — catches patterns + structural threats
guard_standard = TealGuard(depth="standard")

# Maximum coverage — adds ONNX classifier
guard_deep = TealGuard(depth="deep")
```

---

## guardrails

Configures bi-directional scanning.

```python
guard = TealGuard(
    guardrails={
        "pre": {
            "pii": True,                     # or {"categories": ["ssn", "credit_card"]}
            "secrets": True,
            "injection": True,
            "mode": "ENFORCE"                # Optional per-direction override
        },
        "post": {
            "pii": True,
            "secrets": True,
            "content": True,
            "mode": "MONITOR"
        }
    }
)
```

### Pre-Only (v1.3 Compatible)

```python
guard = TealGuard(
    guardrails={"pre": {"pii": True, "secrets": True}}
)
```

### Post-Only

```python
guard = TealGuard(
    guardrails={"post": {"pii": True, "secrets": True}}
)
```

### Bi-Directional

```python
guard = TealGuard(
    guardrails={
        "pre": {"pii": {"categories": ["ssn", "credit_card"]}, "secrets": True, "injection": True},
        "post": {"pii": True, "secrets": True, "content": True}
    }
)
```

---

## evaluate()

```python
async def evaluate(self, request: GovernanceRequest) -> GovernanceDecision
def evaluate_sync(self, request: GovernanceRequest) -> GovernanceDecision
```

Evaluates a request through the multi-stage pipeline.

### GovernanceDecision

```python
@dataclass
class GovernanceDecision:
    # Core decision
    action: Literal["ALLOW", "DENY", "SANITIZE", "REPORT"]
    risk_score: float
    reason_codes: list[str]

    # Multi-stage fields (NEW in v1.4)
    stages_evaluated: list[str]
    stage_results: list[StageResult]
    short_circuited: bool
    total_latency_ms: float

    # Phase identifier (NEW in v1.4)
    phase: Literal["pre", "post"]

    # Existing fields
    correlation_id: str
    timestamp: float
    agent_id: str | None = None

@dataclass
class StageResult:
    stage: Literal["stage1", "stage2", "stage3"]
    action: Literal["PASS", "DENY"]
    latency_ms: float
    findings: list[Finding]

@dataclass
class Finding:
    type: str            # "PII", "SECRET", "INJECTION", "HARMFUL_CONTENT"
    pattern: str | None  # Pattern that matched
    category: str | None # Finding category
    confidence: float    # 0-1
    severity: str        # "low", "medium", "high", "critical"
```

### Example

```python
decision = await guard.evaluate({
    "content": "My API key is sk-proj-abc123...",
    "agent_id": "test-agent",
    "tool_name": "send_email"
})

print(decision.action)             # "DENY"
print(decision.stages_evaluated)   # ["stage1"]
print(decision.short_circuited)    # True
print(decision.stage_results[0])
# StageResult(stage="stage1", action="DENY", latency_ms=2.1,
#   findings=[Finding(type="SECRET", pattern="openai_api_key", confidence=0.99, severity="critical")])
```

---

## evaluate_response()

```python
async def evaluate_response(self, response: GovernanceResponse) -> GovernanceDecision
def evaluate_response_sync(self, response: GovernanceResponse) -> GovernanceDecision
```

Evaluates an LLM response through the post-execution pipeline. **New in v1.4.**

```python
@dataclass
class GovernanceResponse:
    content: str
    agent_id: str | None = None
    correlation_id: str | None = None
    model: str | None = None
    provider: str | None = None
```

### Example

```python
# Check model output before returning to the caller
post_decision = await guard.evaluate_response(GovernanceResponse(
    content=model_output,
    agent_id="my-agent",
    correlation_id=request_correlation_id
))

if post_decision.action == "DENY":
    raise ResponseBlockedError(post_decision.reason_codes)
```

---

## Short-Circuit Behavior

When a stage produces DENY, subsequent stages are skipped:

```python
# Input contains a secret pattern
decision = await guard.evaluate({"content": "sk-proj-abc123xyz..."})

print(decision.stages_evaluated)  # ["stage1"]
print(decision.short_circuited)   # True
print(decision.total_latency_ms)  # 2.1
```

---

## Sync and Async Usage

The Python SDK supports both patterns:

```python
# Async (recommended for web applications)
decision = await guard.evaluate(request)
post_decision = await guard.evaluate_response(response)

# Sync (for scripts and notebooks)
decision = guard.evaluate_sync(request)
post_decision = guard.evaluate_response_sync(response)
```

---

## Integration with observe()

```python
from tealtiger import observe, TealGuard
from openai import OpenAI

guard = TealGuard(
    depth="standard",
    guardrails={
        "pre": {"pii": True, "secrets": True},
        "post": {"pii": True, "secrets": True}
    }
)

client = observe(OpenAI(), guard=guard)

# Pre-scan and post-scan happen automatically
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

## Backward Compatibility

v1.3 configurations work without changes:

```python
# v1.3 style — still works
guard = TealGuard(pii=True, secrets=True, injection=True, mode="ENFORCE")
```

Defaults to `depth="fast"` with no post-execution scan.

---

## Deep Mode Dependencies

Stage 3 requires ONNX runtime:

```bash
# Install with deep mode support
pip install tealtiger[deep]

# Or install onnxruntime separately
pip install onnxruntime>=1.17
```

The ONNX dependency is only loaded at runtime when `depth="deep"` is configured. Fast and standard modes have zero additional dependencies.
