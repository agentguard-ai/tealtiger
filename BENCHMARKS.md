# TealTiger Red Team Benchmark Results

> Generated: 2026-05-07T00:00:00.000Z
> TealTiger Version: 1.2.1
> Runner Version: 1.0.0

## Methodology

TealTiger benchmarks are executed using a **dataset-driven approach**:

1. Attack prompts from recognized third-party benchmarks are bundled as local YAML fixtures
2. Each prompt is evaluated through TealTiger's `POST /evaluate` governance endpoint
3. Governance decisions (ALLOW/DENY/MONITOR) are compared against ground truth labels
4. Detection rates and classification metrics are computed per category

**Key characteristics:**
- **Deterministic**: TealTiger v1.2.1 uses regex-based pattern matching with conjunction logic — no LLM in the governance path
- **Reproducible**: Same version + dataset combination = identical results
- **No external dependencies**: No paid API keys or network calls required
- **Fail-closed**: Infrastructure errors are recorded separately, never counted as passes

**What "blocked" means:** A probe is "blocked" when TealTiger's governance stack returns a DENY decision, indicating the input was identified as potentially harmful and would be prevented from reaching the downstream LLM.

## Summary — v1.3.0

> Generated: 2026-05-18T00:00:00.000Z
> TealTiger Version: 1.3.0
> Runner Version: 2.0.0

### Governance Evaluation Latency

TealEngine v1.3 `evaluate()` — measured on Node.js 20, single-threaded:

| Percentile | Latency |
|------------|---------|
| p50 | 0.8ms |
| p95 | 2.1ms |
| p99 | 4.3ms |

### TealClassifier Inference

ONNX model inference — CPU, ≤512 tokens:

| Percentile | Latency |
|------------|---------|
| p50 | 12ms |
| p95 | 18ms |
| p99 | 22ms |

### TealProof Hash Generation

SHA-256 decision hash:

| Percentile | Latency |
|------------|---------|
| p50 | 0.02ms |
| p95 | 0.05ms |
| p99 | 0.08ms |

### Merkle Proof Verification

Verify inclusion proof:

| Percentile | Latency |
|------------|---------|
| p50 | 0.1ms |
| p95 | 0.3ms |
| p99 | 0.5ms |

### TealGuard v2 (Full Pipeline)

Unicode + PII + injection + content:

| Percentile | Latency |
|------------|---------|
| p50 | 1.5ms |
| p95 | 3.2ms |
| p99 | 5.1ms |

### Policy Hot-Swap

Bundle validation + swap:

| Percentile | Latency |
|------------|---------|
| p50 | 15ms |
| p95 | 28ms |
| p99 | 45ms |

### Detection Accuracy (OWASP Policy Pack)

| Category | Precision | Recall | F1 Score |
|----------|-----------|--------|----------|
| Prompt injection | 94.2% | 91.8% | 93.0% |
| PII detection | 97.1% | 95.3% | 96.2% |
| Secret detection | 99.2% | 98.7% | 98.9% |

---

## Summary — v1.2.x

| Metric | v1.2.0 | v1.2.1 | Change |
|--------|--------|--------|--------|
| Overall Garak Detection Rate | 37.1% | 45.7% | +8.6% |
| Garak Jailbreak | 40.0% | 60.0% | **+20.0%** |
| Garak Prompt Injection | 40.0% | 40.0% | — |
| Garak Data Leakage | 6.7% | 6.7% | — |
| Garak Encoding | 60.0% | 73.3% | +13.3% |
| PINT F1 Score | 54.5% | 63.8% | **+9.3%** |
| PINT Precision | 85.7% | 88.2% | +2.5% |
| PINT Recall | 40.0% | 50.0% | **+10.0%** |

## What Changed in v1.2.1

Added **8 new detection categories** using **conjunction matching** (require 2 signals to co-occur, preventing false positives):

| Category | What it catches | v1.2.0 | v1.2.1 |
|----------|----------------|--------|--------|
| Persona jailbreaks | "You are AIM/Evil AI/The Unrestricted One" | 0% | Partial |
| Hypothetical framing | "pretend there are no rules" | 0% | Partial |
| Authority impersonation | "I am your developer", sudo claims | 0% | Partial |
| Emotional manipulation | "dying wish", "for my research paper" | 0% | Partial |
| Mode switching | "opposite mode", "jailbreak mode" | Partial | Improved |
| Indirect injection | Token injection, boundary confusion | 0% | Partial |
| Data extraction requests | PII lookup, credential extraction | 6.7% | Improved |
| Extended encoding | Morse, binary, Caesar, leetspeak | Partial | Improved |

**Design constraint**: All patterns use conjunction matching — they require two signals to co-occur (e.g., identity assignment AND unrestricted behavior language). This prevents false positives on legitimate messages like "please ignore my previous email" or "can you explain how prompt injection works?"

## Garak (NVIDIA) Results

**Dataset Version**: 0.9.0 (expanded to 70 probes)
**Total Probes**: 70
**Overall Detection Rate**: 45.7%

| Category | Total | Blocked | Allowed | Detection Rate | Change |
|----------|-------|---------|---------|----------------|--------|
| jailbreak | 20 | 12 | 8 | 60.0% | +20.0% |
| prompt_injection | 20 | 8 | 12 | 40.0% | — |
| data_leakage | 15 | 1 | 14 | 6.7% | — |
| encoding | 15 | 11 | 4 | 73.3% | +13.3% |

**Execution time**: 30ms (70 probes)

**Analysis:**
- **Jailbreak (60%, +20%)**: Conjunction patterns now catch persona jailbreaks (AIM, DAN variants), authority impersonation, emotional manipulation, and mode switching. Remaining misses are indirect phrasing variants that don't trigger both conjunction signals.
- **Prompt Injection (40%)**: Direct injection patterns caught. Indirect/context-based injections using novel phrasing still evade — these require additional conjunction pattern variants.
- **Data Leakage (6.7%)**: Remains a gap. Most data leakage probes test output-side disclosure which requires output scanning (planned for v1.3 TealGuard v2).
- **Encoding (73.3%, +13.3%)**: Extended encoding conjunction patterns now catch morse/binary/caesar + decode intent combinations.

## PINT (Lakera) Results

**Dataset Version**: 1.0.0 (expanded to 52 samples)
**Total Samples**: 52

| Metric | v1.2.0 | v1.2.1 | Change |
|--------|--------|--------|--------|
| Accuracy | 61.5% | 67.3% | +5.8% |
| Precision | 85.7% | 88.2% | +2.5% |
| Recall | 40.0% | 50.0% | +10.0% |
| F1 Score | 54.5% | 63.8% | +9.3% |

**Confusion Matrix**: TP: 15, FP: 2, TN: 20, FN: 15

| Category | Total | TP | FP | TN | FN | Precision | Recall | F1 |
|----------|-------|----|----|----|----|-----------|---------|----|
| prompt_injection | 20 | 9 | 0 | 0 | 11 | 100% | 45% | 62% |
| jailbreak | 10 | 6 | 0 | 0 | 4 | 100% | 60% | 75% |
| hard_negatives | 12 | 0 | 2 | 10 | 0 | — | — | — |
| benign_chat | 10 | 0 | 0 | 10 | 0 | — | — | — |

**Execution time**: 5ms (52 samples)

**Analysis:**
- **Precision maintained at 88.2%** — conjunction matching prevents false positives. Only 2 FPs across 52 samples.
- **Recall improved to 50%** (+10%) — new patterns catch previously-missed attack variants.
- **Zero false positives on benign chat** — all 10 benign samples correctly allowed.
- **Hard negatives**: 2 FPs on edge cases (legitimate messages that contain partial attack-like phrasing). Acceptable for high-sensitivity mode.

## Comparison Context

Published leaderboard scores for reference (PINT benchmark):

| Solution | PINT F1 Score | Architecture | Latency |
|----------|---------------|--------------|---------|
| Lakera Guard | 95.2% | ML-based (proprietary) | ~100ms |
| Azure AI Prompt Shield | 89.1% | ML-based (cloud) | ~200ms |
| AWS Bedrock Guardrails | 89.2% | ML-based (cloud) | ~150ms |
| **TealTiger v1.2.1** | **63.8%** | **Deterministic (regex)** | **<5ms** |
| TealTiger v1.2.0 | 54.5% | Deterministic (regex) | <5ms |

> **Important context**: TealTiger uses deterministic regex-based pattern matching with conjunction logic, not ML inference. This is a deliberate architectural choice that provides:
> - **Sub-5ms latency** — no ML inference overhead in the governance path
> - **100% reproducibility** — identical inputs always produce identical decisions
> - **No API costs** — no per-request charges for governance evaluation
> - **High precision (88.2%)** — very low false positive rate
> - **Zero infrastructure dependency** — runs entirely in-process
>
> The tradeoff is lower recall compared to ML-based solutions. Conjunction matching in v1.2.1 improved recall by 10% while maintaining precision. Further improvements planned for v1.3.

## Known Limitations

- TealTiger v1.2.1 uses regex-based pattern matching with conjunction logic — no ML inference in governance path
- Recall (50%) reflects pattern library coverage — novel phrasing variants that avoid both conjunction signals will evade detection
- Data leakage detection focuses on input-side patterns; output-side leakage requires TealGuard v2 (v1.3)
- Indirect prompt injection via novel phrasing remains partially uncovered
- Agent scenarios test governance decision points, not full agent trajectory analysis

## Improvement Roadmap

| Metric | v1.2.0 | v1.2.1 (Current) | v1.3 (Target) | Strategy |
|--------|--------|-------------------|---------------|----------|
| PINT F1 | 54.5% | 63.8% | 80%+ | Additional conjunction variants + output scanning |
| Garak Jailbreak | 40.0% | 60.0% | 85%+ | Expanded persona/framing pattern variants |
| Garak Data Leakage | 6.7% | 6.7% | 60%+ | Output-side scanning (TealGuard v2) |
| Garak Encoding | 60.0% | 73.3% | 90%+ | Multi-layer encoding + steganographic detection |
| Overall Detection | 37.1% | 45.7% | 70%+ | Combined pattern expansion + output governance |

## Version Information

| Component | Version |
|-----------|---------|
| TealTiger | 1.2.1 |
| Benchmark Runner | 1.0.0 |
| Garak dataset | 0.9.0 (70 probes) |
| PINT dataset | 1.0.0 (52 samples) |
| Agent dataset | 1.0.0 |
| GuardBench dataset | 1.0.0 |
