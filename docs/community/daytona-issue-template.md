**Title:** Pre-execution governance hook for sandbox code (TealTiger integration)

---

**Is your feature request related to a problem? Please describe.**

Daytona provides excellent infrastructure isolation for AI-generated code, but there's no logic governance layer that evaluates code *before* it reaches the sandbox. Today, if an LLM generates code containing hardcoded API keys, PII (SSNs, credit cards), or malicious dependencies, that code enters the sandbox unscanned — the secret ends up in sandbox logs, network traffic, or filesystem even though the execution itself is isolated.

The infrastructure isolation prevents the code from *escaping*, but doesn't prevent sensitive data from *entering*. For compliance (SOC 2, HIPAA, EU AI Act), organizations need evidence that governance evaluated the code before execution, not just that execution was contained.

**Describe the solution you'd like**

A pre-execution governance integration using [TealTiger](https://github.com/agentguard-ai/tealtiger) that scans LLM-generated code before `sandbox.process.code_run()` executes it. This creates defense-in-depth: TealTiger decides IF code should run, Daytona decides WHERE and HOW.

What it would look like:

```python
from tealtiger import TealOpenAI
from daytona_sdk import Daytona

ai_client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"secret_detection": True, "prompt_injection": True},
    budget={"max_cost_per_session": 2.00},
)

daytona = Daytona()

response = ai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a script to process user data"}],
)

# TealTiger already scanned the LLM output — secrets/PII blocked upstream
sandbox = daytona.create()
result = sandbox.process.code_run(response.choices[0].message.content)
daytona.remove(sandbox)
```

Capabilities:
- Secret detection (500+ patterns) before sandbox creation
- PII scanning to prevent sensitive data entering sandbox environment
- Dual-layer cost control (TealTiger: LLM tokens, Daytona: compute resources)
- Structured audit receipt linking governance decision to sandbox execution outcome
- All deterministic, <5ms overhead, no LLM in the governance path

**Describe alternatives you've considered**

1. **Post-execution log scanning** — scan sandbox output after execution. Problem: secret already leaked into sandbox environment/logs by then.
2. **Custom pre-exec wrapper** — write bespoke regex scanning before each `code_run()`. Problem: doesn't scale, no structured audit trail, no policy management.
3. **LLM-based safety classifier** — use another LLM to judge code safety. Problem: non-deterministic, expensive, slow (100ms+ vs <5ms), no compliance evidence.

**Additional context**

Working proof-of-concept already built: https://github.com/agentguard-ai/tealtiger/tree/main/examples/daytona-governed-sandbox

Both TealTiger and Daytona are AG2 Beta Extensions — they already coexist in the same ecosystem (`autogen/beta/extensions/daytona/` and our proposed `autogen/beta/extensions/tealtiger/`).

About TealTiger:
- Apache 2.0, Python + TypeScript SDKs
- Secret detection (500+ patterns), PII, prompt injection, cost tracking, circuit breaker
- Already integrated with AG2 ([merged](https://github.com/ag2ai/ag2/pull/2962)), Vercel AI SDK, LangChain, CrewAI
- PyPI: https://pypi.org/project/tealtiger/

Happy to contribute a `daytona-tealtiger` integration example or a pre-execution hook implementation — whatever approach works best for the Daytona team.
