---
title: "Multi-Stage Defense Pipeline"
description: "How TealGuard decomposes defense into three specialized stages — pattern scanning, structural analysis, and local classification — with configurable depth."
---

# Multi-Stage Defense Pipeline

TealGuard v1.4 introduces a multi-stage defense architecture that lets you trade latency for depth. Choose the defense level appropriate for your environment.

---

## Overview

The pipeline decomposes security evaluation into three specialized stages, each progressively deeper:

| Stage | Name | What It Does | Target Latency |
|-------|------|-------------|----------------|
| 1 | Pattern Scanning | Regex-based detection of PII, secrets, injection signatures | < 5ms |
| 2 | Structural Analysis | AST intent classification, sentence anomaly detection | < 20ms |
| 3 | Local Classifier | Pre-trained ONNX binary model for harmful content | < 50ms |

---

## Depth Configuration

```typescript
import { TealGuard } from "tealtiger";

// Fast — Stage 1 only (default, matches v1.3 behavior)
const guardFast = new TealGuard({ depth: "fast" });

// Standard — Stage 1 + Stage 2
const guardStandard = new TealGuard({ depth: "standard" });

// Deep — All three stages
const guardDeep = new TealGuard({ depth: "deep" });
```

```python
from tealtiger import TealGuard

# Fast — Stage 1 only (default)
guard_fast = TealGuard(depth="fast")

# Standard — Stage 1 + Stage 2
guard_standard = TealGuard(depth="standard")

# Deep — All three stages
guard_deep = TealGuard(depth="deep")
```

---

## Pipeline Flow

<img src="/diagrams/multi-stage-pipeline.svg" alt="Multi-stage defense pipeline" />

### Short-Circuit Behavior

If any stage produces a **DENY** decision, the pipeline short-circuits immediately:

- Stage 1 DENY → Stages 2 and 3 never execute
- Stage 2 DENY → Stage 3 never executes
- Stage 3 DENY → Request is blocked

This means the `fast` depth is genuinely fast — you only pay the latency of the deeper stages when the earlier stages pass.

---

## Stage 1: Pattern Scanning

**Target latency:** < 5ms

Stage 1 uses regex-based pattern matching to detect well-known sensitive patterns:

### PII Detection
- Email addresses
- Phone numbers (US, UK, international formats)
- Social Security Numbers (SSN)
- Credit card numbers (Luhn-validated)
- Passport numbers
- Driver's license numbers

### Secret Detection
- API keys (OpenAI, Anthropic, AWS, GCP, Azure, Stripe, etc.)
- Private keys (RSA, ECDSA, Ed25519)
- Database connection strings
- JWT tokens
- OAuth tokens
- 500+ patterns from TealSecrets

### Injection Signatures
- Prompt injection markers ("ignore previous instructions", "system override")
- Jailbreak patterns (DAN, role-play exploits)
- Encoded payloads (base64-wrapped instructions)

### When Stage 1 Is Enough

Stage 1 covers the vast majority of real-world threats. If your primary concern is data leakage (PII, secrets) and known injection patterns, `depth: "fast"` is the right choice.

---

## Stage 2: Structural Analysis

**Target latency:** < 20ms (cumulative with Stage 1)

Stage 2 applies deeper analysis to content that passed Stage 1:

### AST-Based Intent Classification

For code outputs, Stage 2 parses the code into an AST and classifies intent:

- **File system operations**: Detects `fs.rm`, `os.remove`, `shutil.rmtree`
- **Network operations**: Detects outbound HTTP calls, socket connections
- **Process execution**: Detects `exec`, `spawn`, `subprocess.run`
- **Privilege escalation**: Detects `sudo`, `chmod`, `setuid`

This catches cases where the code is syntactically valid (passes Stage 1) but semantically dangerous.

### Sentence-Structure Anomaly Detection

For natural language content, Stage 2 analyzes sentence structure:

- **Embedded instructions**: Detects instructions hidden within seemingly normal text
- **Role confusion**: Detects attempts to redefine the model's role mid-conversation
- **Context manipulation**: Detects attempts to inject new context or override existing context
- **Statistical outliers**: Flags text with unusual token distribution compared to baseline

### When Stage 2 Adds Value

Use `depth: "standard"` when your agents generate code or when you're concerned about sophisticated injection attacks that use obfuscation to bypass pattern matching.

---

## Stage 3: Local Classifier

**Target latency:** < 50ms (cumulative with Stages 1 and 2)

Stage 3 runs a pre-trained ONNX binary classifier locally:

### Model Details

| Property | Value |
|----------|-------|
| Format | ONNX |
| Architecture | Lightweight transformer (6 layers, 768 dim) |
| Input | Tokenized text (max 512 tokens) |
| Output | Binary classification (harmful / not harmful) |
| Size | ~25 MB |
| Inference | CPU-only, no GPU required |

### What It Catches

Stage 3 catches subtle harmful content that pattern matching and structural analysis miss:

- **Novel injection techniques** not yet in pattern databases
- **Semantically harmful content** that uses innocuous language
- **Context-dependent threats** where the danger is in meaning, not syntax
- **Adversarially crafted inputs** designed to bypass rule-based systems

### Important: No LLM in the Governance Path

Stage 3 is a pre-trained **classifier**, not a generative model. It:

- Produces deterministic outputs (same input → same classification)
- Runs entirely offline
- Has a fixed decision boundary (no prompt, no temperature, no sampling)
- Cannot be prompt-injected (it doesn't accept prompts)

### Dependencies

Stage 3 requires the `onnxruntime` package:

```bash
# TypeScript
npm install onnxruntime-node @tealtiger/onnx-model

# Python
pip install onnxruntime tealtiger[deep]
```

These dependencies are **only loaded when `depth: "deep"` is configured**. Fast and standard modes have zero additional dependencies.

---

## Decision Output

The pipeline produces a unified `GovernanceDecision` with stage details:

```typescript
const decision = await guard.evaluate(request);

console.log(decision);
// {
//   action: "ALLOW",
//   stages_evaluated: ["stage1", "stage2"],
//   stage_results: [
//     { stage: "stage1", action: "PASS", latencyMs: 2, findings: [] },
//     { stage: "stage2", action: "PASS", latencyMs: 12, findings: [] }
//   ],
//   totalLatencyMs: 14
// }
```

When a stage denies:

```typescript
// {
//   action: "DENY",
//   stages_evaluated: ["stage1"],
//   stage_results: [
//     { stage: "stage1", action: "DENY", latencyMs: 3, 
//       findings: [{ type: "SECRET", pattern: "openai_api_key", confidence: 0.99 }] }
//   ],
//   short_circuited: true,
//   totalLatencyMs: 3
// }
```

---

## Performance Characteristics

Benchmarks on standard hardware (Apple M2, 16 GB RAM):

| Depth | P50 Latency | P95 Latency | P99 Latency |
|-------|-------------|-------------|-------------|
| `fast` | 1.2ms | 3.1ms | 4.8ms |
| `standard` | 8.5ms | 14.2ms | 18.7ms |
| `deep` | 22.1ms | 38.4ms | 47.2ms |

These are the governance overhead only — they don't include the provider network call.

---

## Choosing the Right Depth

| Environment | Recommended Depth | Rationale |
|-------------|-------------------|-----------|
| Development / CI | `fast` | Minimize friction, catch obvious leaks |
| Staging | `standard` | Catch structural issues before production |
| Production (low-risk) | `fast` | Performance-first, pattern matching covers most threats |
| Production (high-risk) | `standard` or `deep` | Defense in depth for sensitive workloads |
| Compliance-critical | `deep` | Maximum coverage for audit requirements |

---

## Determinism Guarantee

All three stages produce deterministic results. The same input with the same configuration will always produce the same output. This is critical for:

- **Reproducibility**: Governance decisions can be replayed and verified
- **Testing**: Property-based tests can assert on behavior with confidence
- **Compliance**: Auditors can independently verify that decisions are correct
- **Debugging**: No randomness means no intermittent governance failures
