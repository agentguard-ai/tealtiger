## Summary

Proposing an integration between [TealTiger](https://github.com/agentguard-ai/tealtiger) and Adrian that creates a two-tier defense architecture: TealTiger handles fast deterministic checks (<5ms) as a first pass, and Adrian's reasoning engine handles the deeper behavioral/intent analysis for requests that pass the deterministic layer.

## Why this makes sense

Adrian and TealTiger solve different parts of the same problem:

| Layer | TealTiger | Adrian |
|---|---|---|
| Detection method | Deterministic pattern matching (no LLM) | LLM-based reasoning analysis |
| Latency | <5ms | ~200ms (LLM inference) |
| Strength | PII, secrets (500+ patterns), tool allowlists, cost budgets | Intent detection, CoT analysis, behavioral anomalies |
| Weakness | Can't reason about why an agent did something | Slower, requires GPU, non-deterministic |

Combined, you get defense-in-depth:

- **Stage 1 (TealTiger)**: Catches the easy wins instantly — secrets in tool args, PII in queries, budget violations, tool allowlist violations. No compute cost, no false positives.
- **Stage 2 (Adrian)**: For requests that pass Stage 1, do the deeper reasoning analysis — is the agent's intent malicious? Is it drifting from its remit? Is the CoT suspicious?

This saves Adrian's LLM compute for the genuinely ambiguous cases (where reasoning analysis provides the most value) while covering deterministic patterns at zero cost.

## Proposed integration

```python
import adrian
from tealtiger import TealOpenAI

# TealTiger handles fast deterministic governance (<5ms)
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"pii_detection": True, "secret_detection": True},
    budget={"max_cost_per_session": 5.00},
)

# Adrian handles deep reasoning-level monitoring
adrian.init(api_key="adr_live_...")

# Both work together — TealTiger blocks the obvious violations,
# Adrian catches the subtle intent-based threats
```

## Collaboration options

1. **Joint example**: A LangChain agent with both TealTiger (deterministic layer) and Adrian (reasoning layer) showing combined detection
2. **Shared event format**: Adrian events and TealTiger TEEC receipts could share correlation IDs for unified audit trails
3. **SDK interop**: TealTiger's `on_decision` callback could optionally forward "borderline" decisions (risk_score 40-70) to Adrian for deeper analysis
4. **Benchmark**: Compare detection rates of TealTiger alone, Adrian alone, and both combined — quantify the defense-in-depth benefit

## About TealTiger

- Apache 2.0, Python + TypeScript SDKs
- Deterministic governance — no LLM in governance path, <5ms
- Secret detection (500+ patterns), PII, prompt injection, cost tracking, circuit breaker
- Already integrated with LangChain, AG2 (merged), CrewAI, Haystack, Vercel AI SDK
- PyPI: https://pypi.org/project/tealtiger/

Both projects are Apache 2.0, both target the same user base (teams deploying AI agents in production), and both are FOSS. Happy to collaborate on whatever integration approach works best for the Adrian team.
