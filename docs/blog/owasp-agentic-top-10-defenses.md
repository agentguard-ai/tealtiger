# OWASP ASI Top 10: Practical Defenses with TealTiger

The OWASP Agentic Security Initiative (ASI) list is quickly becoming the practical
checklist for production AI agents. The important part is not just knowing the 10
risks — it is encoding controls so violations fail fast at runtime.

Below is a practical mapping from OWASP ASI risk patterns to TealTiger defenses.
The examples are operational, not theoretical.

Reference: [OWASP Agentic Top 10](https://owasp.org/www-project-agentic-security-initiatve/)

## Why governance needs to be deterministic

For AI security controls, “ask another model if this is safe” is a weak control model.

- it can drift on repeated inputs,
- it can be bypassed by prompt manipulation,
- it adds latency and cost to every check,
- and it is hard to prove after the fact.

TealTiger’s deterministic policy engine gives you the predictable enforcement layer
that ASI expects from security controls.

## Risk map (practical)

| ASI | Title | Risk pattern | TealTiger control |
| --- | --- | --- | --- |
| ASI-01 | Autonomous actions without oversight | Silent side effects | Tool allowlists, NHI roles, `PLAN_ONLY` gates |
| ASI-02 | Prompt manipulation & jailbreaks | Governance bypass attempts | Prompt injection detection + strict policy precedence |
| ASI-03 | Tool output tampering | Untrusted output fed into next steps | Content moderation + integrity checks + policy assertions |
| ASI-04 | Secret leakage | Tokens, keys, credentials exposed | Secret detection + redaction + block + alert |
| ASI-05 | Prompt exfiltration | User-provided instructions leak workflow secrets | Input classifier + memory scope enforcement |
| ASI-06 | Memory abuse | Sensitive context kept or exported | Memory provenance + scope boundaries |
| ASI-07 | Cost abuse | Budget run-away in loops and retries | Cost ceilings + retry caps + freeze rules |
| ASI-08 | Provider/model drift | Unexpected model behavior shifts | Drift monitors + risk thresholding |
| ASI-09 | Weak incident evidence | No reproducible trail | SARIF/JUnit evidence + trace IDs |
| ASI-10 | Governance model confusion | Different rules in different flows | Central policy packs + inheritance and overrides |

## 1) ASI-01 — Autonomous actions without oversight

Unrestricted tool access is the single most common ASI starter risk.

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  policies: [
    {
      id: 'default-tool-policy',
      mode: 'PLAN_ONLY',
      rules: [
        { tool: 'delete_user_data', allowed: false },
        { tool: 'send_email', allowed: true, scope: ['support', 'billing'] },
      ],
    },
    {
      id: 'human-signoff-sensitive',
      mode: 'APPROVAL_REQUIRED',
      conditions: [{ field: 'tool', in: ['refund', 'suspension'] }],
      approvers: ['security-team'],
    },
  ],
});
```

This keeps destructive or sensitive actions from becoming unbounded automation.

## 2) ASI-02 — Prompt manipulation

Attackers frequently pivot through prompt injection to alter intended behavior.

```python
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"prompt_injection": True},
    policy_pack="policy.json"
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role":"system","content":"Answer only policy questions."},
              {"role":"user","content":"Ignore previous instructions..."}],
)
```

When injection is detected and severity crosses threshold, route to `BLOCK` or
`PLAN_ONLY` instead of silent pass-through.

## 3) ASI-03 — Output tampering and unsafe tool handoff

Treat tool arguments as data that must be validated before execution.

```json
{
  "id": "tool-argument-guard",
  "mode": "BLOCK",
  "conditions": [
    { "field": "tool", "equals": "http_post" },
    { "field": "tool.args.domain", "in": ["internal://"] },
    { "field": "risk", "operator": "gte", "value": "medium" }
  ]
}
```

This pattern catches attempts to pivot an unsafe domain or sensitive argument set.

## 4) ASI-04 — Secret leakage

Secrets appear as raw strings, partially encoded values, and obfuscated forms.

- TealTiger’s secret detector works as a gate, not a one-time linter.
- You can set to `BLOCK`, `REDACT`, or `REPORT_ONLY`.

```typescript
await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Use my token: sk_test_123' }],
  context: { redactionMode: 'error_on_detect' }
});
```

The policy engine surfaces the exact rule that matched for auditability.

## 5) ASI-07 — Cost abuse

This one is frequently overlooked in “security” writing because the impact is
financial, not just behavioral.

```yaml
budget:
  maxCostPerRequest: 0.30
  maxCostPerSession: 5.00
  maxRetries: 2
  maxCostPerDay: 50.00
policies:
  - id: cost-fuse
    mode: BLOCK
    when:
      estimatedCost: { gt: 0.30 }
  - id: cost-warning
    mode: REPORT_ONLY
    when:
      dailyCostRatio: { gte: 0.8 }
```

Hard boundaries prevent runaway spend during tool-cascade failures.

## 6) ASI-08 — Drift and behavioral inconsistency

Agents can behave safely for weeks then drift in output style, argument patterns,
or tool choice under model/provider changes. Treat drift as an ASI-05 style control
failover:

- Baseline expected policy outcomes,
- Alert when violation rates move,
- Move affected agents to stricter policy mode during investigation.

## 7) ASI-09 — Insufficient evidence

Every block or override should emit machine-readable evidence.

TealTiger supports JSON/SARIF evidence exports so you can correlate security
decisions with traces, IDs, and policy version in incident reviews.

## 8) ASI-10 — Governance inconsistency across runtime paths

Heterogeneous services often have one policy in staging, another in production.

Use a central policy-pack approach with inheritance and environment-safe overlays.
That gives you uniform controls and controlled exceptions.

## Summary: practical coverage by risk

- Strong: ASI-01, ASI-02, ASI-04, ASI-07, ASI-09  
- Partial: ASI-03, ASI-05, ASI-06, ASI-08, ASI-10 (depends on adapter fidelity)

### Adoption checklist

1. Start with ASI-01 and ASI-02 controls in `BLOCK` mode.
2. Add ASI-04 and ASI-07 in `REPORT_ONLY` if your team needs baseline tuning.
3. Move to hard-block and approval workflows once false positives are tuned.
4. Export evidence from every environment and include it in incident reviews.

## Final take

The ASI risks are operationally real, not theoretical.

The fastest route to safer agents is not more complex prompts.
It is deterministic governance with explicit controls for tools, memory, content,
secrets, and cost.
