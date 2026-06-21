# tealtiger-redteam

Static red-team scanner for Haystack pipeline Python files. The scanner never
imports or executes the target pipeline. It parses source with Python's `ast`
module, looks for deterministic risk signals, and returns TealTiger fix
suggestions linked to existing Haystack recipes.

## Install

```bash
pip install tealtiger-redteam
```

## Usage

```bash
tealtiger-redteam scan pipeline.py
tealtiger-redteam scan pipeline.py --json
tealtiger-redteam scan pipeline.py --output report.json
```

Exit codes:

- `0`: scan completed and no vulnerable scenarios were found
- `1`: scan completed and at least one vulnerable scenario was found
- `2`: invalid input, parse failure, missing file, or unsupported argument

## Scenarios

The scanner checks five built-in scenarios:

| Scenario | Static risk signal | TealTiger fix |
| --- | --- | --- |
| Prompt injection | Prompt/generator path without `TealTigerGuardComponent` | Add `TealTigerGuardComponent` before the prompt or generator |
| Indirect injection | Retriever/document path reaches a prompt/generator without a guard | Guard retrieved documents before prompt construction |
| Infinite loop | Agent/tool loop without `TealTigerCircuitBreaker` | Add a circuit breaker with iteration and cost limits |
| PII exfiltration | Retrieved documents reach prompt/generator without `TealTigerPIIRedactor` | Redact or flag retrieved documents before generation |
| Token bomb | High token/cost expansion signals without a circuit breaker | Add session cost and iteration caps |

## Report Shape

```json
{
  "target": "pipeline.py",
  "summary": {
    "status": "vulnerable",
    "findings_total": 1,
    "scenarios": {
      "prompt_injection": "safe",
      "indirect_injection": "vulnerable",
      "infinite_loop": "safe",
      "pii_exfiltration": "safe",
      "token_bomb": "safe"
    }
  },
  "findings": [
    {
      "id": "TT-HAYSTACK-INDIRECT-INJECTION",
      "scenario": "indirect_injection",
      "severity": "high",
      "status": "vulnerable",
      "line": 12,
      "message": "Retriever output appears to reach a prompt or generator without TealTigerGuardComponent.",
      "fix": {
        "component": "TealTigerGuardComponent",
        "snippet": "pipeline.add_component(\"guard\", TealTigerGuardComponent(mode=\"refer\"))",
        "recipe": "packages/haystack-tealtiger/docs/recipes/injection-defense.md"
      }
    }
  ]
}
```

## Limitations

This is a static heuristic scanner. It is designed for quick local review and
CI guardrails, not as proof that a pipeline is safe. It can produce false
positives or miss dynamically-constructed pipelines. It intentionally avoids
reading secrets, environment variables, network resources, or executing pipeline
code.
