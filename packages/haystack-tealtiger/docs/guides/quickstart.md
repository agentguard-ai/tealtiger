# 1-Minute Haystack Secure Starter

Use the Haystack Secure Starter template repository to launch a local,
cost-tracked, PII-guarded RAG pipeline in under a minute:

```bash
git clone https://github.com/CleanDev-Fix/haystack-secure-starter.git
cd haystack-secure-starter
pip install -r requirements.txt && python quickstart.py
```

Template repository:
[`CleanDev-Fix/haystack-secure-starter`](https://github.com/CleanDev-Fix/haystack-secure-starter)

## What The Starter Shows

- A Haystack RAG pipeline over local sample support records.
- `TealTigerPIIRedactor` redacting mock PII before prompt construction.
- `TealTigerGovernanceComponent` producing deterministic governance and cost telemetry.
- `TealTigerCircuitBreaker` stopping runaway loops before the generator step.
- Terminal output with governance decisions and sanitized context.

## Expected Output

```text
== TealTiger Haystack Secure Starter ==
Query: How should support handle Jane's renewal ticket?

Retrieved documents: 2
PII findings redacted: 2
Governance action: ALLOW
Governance cost tracked: $0.0002
Circuit breaker: continue

Sanitized answer context:
- Customer Jane Doe can be reached at [REDACTED]. Her renewal ticket references SSN [REDACTED].
- Finance escalation records should keep account notes inside the approved support workflow.

Ready for generator: yes
```

The starter runs locally and does not require an LLM API key. Replace the final
local preview step with your preferred Haystack generator when you are ready to
connect a model provider.
