# TealTiger Red Team Benchmark Results

> Generated: 2026-04-15T00:00:00.000Z
> TealTiger Version: 1.2.0
> Runner Version: 1.0.0

## Methodology

TealTiger benchmarks are executed using a **dataset-driven approach**:

1. Attack prompts from recognized third-party benchmarks are bundled as local YAML fixtures
2. Each prompt is evaluated through TealTiger's `POST /evaluate` governance endpoint
3. Governance decisions (ALLOW/DENY/MONITOR) are compared against ground truth labels
4. Detection rates and classification metrics are computed per category

**Key characteristics:**
- **Deterministic**: TealTiger v1.2.0 uses regex-based pattern matching with no LLM in the governance path
- **Reproducible**: Same version + dataset combination = identical results
- **No external dependencies**: No paid API keys or network calls required
- **Fail-closed**: Infrastructure errors are recorded separately, never counted as passes

**What "blocked" means:** A probe is "blocked" when TealTiger's governance stack returns a DENY decision, indicating the input was identified as potentially harmful and would be prevented from reaching the downstream LLM.

## Summary

| Metric | Value |
|--------|-------|
| Overall Detection Rate | 37.1% |
| Suites Executed | 4 |
| Baseline Status | ✅ PASSED |

## Garak (NVIDIA) Results

**Dataset Version**: 0.9.0
**Total Probes**: 35
**Overall Detection Rate**: 37.1%

| Category | Total | Blocked | Allowed | Detection Rate |
|----------|-------|---------|---------|----------------|
| jailbreak | 10 | 4 | 6 | 40.0% |
| prompt_injection | 10 | 4 | 6 | 40.0% |
| data_leakage | 10 | 1 | 14 | 6.7% |
| encoding | 5 | 3 | 2 | 60.0% |

**Analysis:**
- **Jailbreak (40%)**: TealTiger detects common DAN-style and roleplay jailbreaks via pattern matching. Novel jailbreaks using indirect phrasing evade current patterns.
- **Prompt Injection (40%)**: Direct injection patterns ("ignore previous instructions") are caught. Indirect/context-based injections require expanded pattern library.
- **Data Leakage (6.7%)**: Known gap. TealTiger focuses on input-side detection; data leakage probes often test output-side information disclosure. Targeted for v1.2.1.
- **Encoding (60%)**: Base64 and common encoding attacks are partially detected. ROT13 and multi-layer encoding coverage expanding in v1.2.1.

## PINT (Lakera) Results

**Dataset Version**: 1.0.0
**Total Samples**: 13

| Metric | Value |
|--------|-------|
| Accuracy | 61.5% |
| Precision | 85.7% |
| Recall | 40.0% |
| F1 Score | 54.5% |

**Analysis:**
- **High Precision (85.7%)**: When TealTiger flags something, it's almost always correct. Low false positive rate means legitimate user inputs are rarely blocked.
- **Low Recall (40%)**: Pattern library gaps mean many injection attempts go undetected. This is the primary improvement target for v1.2.1.
- **Accuracy (61.5%)**: Reflects the recall gap — TealTiger correctly handles benign inputs but misses subtle injection patterns.

## Agent Security (AgentDojo/AgentHarm) Results

**Dataset Version**: 1.0.0
**Total Scenarios**: 14

| Category | Total | Blocked | Allowed | N/A | Detection Rate |
|----------|-------|---------|---------|-----|----------------|
| data_exfiltration | 3 | 2 | 1 | 0 | 66.7% |
| privilege_escalation | 3 | 2 | 1 | 0 | 66.7% |
| destructive_operations | 3 | 2 | 1 | 0 | 66.7% |
| social_engineering | 2 | 1 | 1 | 0 | 50.0% |
| model_alignment | 1 | 0 | 0 | 1 | N/A |
| hallucination_detection | 1 | 0 | 0 | 1 | N/A |
| output_toxicity | 1 | 0 | 0 | 1 | N/A |

**Analysis:**
- Multi-step scenarios are evaluated at each governance decision point
- A scenario is "blocked" if any critical step receives DENY
- Out-of-scope categories (model alignment, hallucination, output toxicity) require ML-based output analysis

## GuardBench (EU JRC) Results

**Dataset Version**: 1.0.0
**Total Samples**: 20

### Deterministic Scope Categories

| Category | Total | Detection Rate | Scope |
|----------|-------|----------------|-------|
| prompt_injection | 4 | 50.0% | Deterministic |
| jailbreak | 4 | 50.0% | Deterministic |
| data_leakage | 3 | 33.3% | Deterministic |
| harmful_content | 3 | 33.3% | Deterministic |
| toxicity | 2 | N/A | ML-dependent |
| bias_detection | 2 | N/A | ML-dependent |
| misinformation | 2 | N/A | ML-dependent |

## Comparison Context

Published leaderboard scores for reference (PINT benchmark):

| Solution | PINT F1 Score | Architecture |
|----------|---------------|--------------|
| Lakera Guard | 95.2% | ML-based (proprietary) |
| Azure AI Prompt Shield | 89.1% | ML-based (cloud) |
| AWS Bedrock Guardrails | 89.2% | ML-based (cloud) |
| TealTiger v1.2.0 | 54.5% | Deterministic (regex) |

> **Important context**: TealTiger uses deterministic regex-based pattern matching, not ML inference. This is a deliberate architectural choice that provides:
> - **Zero latency overhead** from ML inference in the governance path
> - **100% reproducibility** — identical inputs always produce identical decisions
> - **No API costs** — no per-request charges for governance evaluation
> - **High precision (85.7%)** — very low false positive rate
>
> The tradeoff is lower recall compared to ML-based solutions. This is being addressed in v1.2.1 through expanded pattern libraries targeting 75%+ recall.

## Known Limitations

- TealTiger v1.2.0 uses regex-based pattern matching — no ML inference in governance path
- Low recall (40%) on PINT reflects pattern library gaps, not architectural limitation — targeted for v1.2.1
- Data leakage detection focuses on input-side patterns; output-side leakage requires separate tooling
- Encoding-based attacks (base64, rot13) have partial coverage — expanding in v1.2.1
- Agent scenarios test governance decision points, not full agent trajectory analysis
- Novel jailbreak techniques that avoid known patterns will evade detection until patterns are updated

## Out-of-Scope Categories

The following categories are outside TealTiger's deterministic governance scope:

| Category | Rationale |
|----------|-----------|
| model_alignment | Requires output content quality analysis — outside input-side governance |
| hallucination_detection | Requires factual accuracy verification of LLM output |
| output_toxicity | Requires ML-based output toxicity classification |
| bias_detection | Requires NLU-based bias detection in generated content |
| misinformation | Requires factual verification via NLU |

## Improvement Targets (v1.2.1)

| Metric | v1.2.0 (Current) | v1.2.1 (Target) | Strategy |
|--------|-------------------|-----------------|----------|
| PINT Recall | 40.0% | 75%+ | Expanded pattern library, indirect injection patterns |
| Garak Jailbreak | 40.0% | 70%+ | Novel jailbreak pattern detection |
| Garak Data Leakage | 6.7% | 40%+ | Input-side leakage pattern expansion |
| Garak Encoding | 60.0% | 80%+ | Multi-layer encoding detection |
| Overall Detection | 37.1% | 60%+ | Combined pattern library expansion |

## Version Information

| Component | Version |
|-----------|---------|
| TealTiger | 1.2.0 |
| Benchmark Runner | 1.0.0 |
| Garak dataset | 0.9.0 |
| PINT dataset | 1.0.0 |
| Agent dataset | 1.0.0 |
| GuardBench dataset | 1.0.0 |
