# PR Title

feat(beta/extensions): add TealTiger deterministic governance middleware

# PR Body (follows AG2 template)

## Why are these changes needed?

AG2 Beta's middleware system currently has logging, retries, history trimming, and token limiting — but no governance middleware for policy enforcement, tool access control, or structured audit evidence.

This Extension adds TealTiger as a governance middleware that enforces tool allowlists, detects PII in tool arguments, tracks per-agent cost, provides per-agent kill switches, and produces structured TEEC receipts — all deterministically in <5ms with no LLM in the governance path.

Follows the Extension contribution policy: named maintainer, Google-style docstrings, tests, `missing_additional_dependency` guard for the `tealtiger` third-party package.

## Related issue number

Closes #[BETA_ISSUE_NUMBER]

Related:
- Classic integration merged: #2962
- Original design discussion: #2942

## Checks

- [x] I've included any doc changes needed for https://docs.ag2.ai/. See https://docs.ag2.ai/latest/docs/contributor-guide/documentation/ to build and test documentation locally.
- [x] I've added tests (if relevant) corresponding to the changes introduced in this PR.
- [ ] I've made sure all auto checks have passed.

## AI assistance

- [x] I understand the changes in this PR and can explain them in my own words.
- [x] I have verified that the PR description accurately reflects the actual diff.
- [x] If AI assistance was used, I reviewed, tested, and validated the generated code/text before submitting.

---

## Extension details

**Named maintainer:** @nagasatish007
**Additional dependency:** `tealtiger>=1.3.0`
**Location:** `autogen/beta/extensions/tealtiger/`
**Tests:** `test/beta/extensions/tealtiger/test_governance_invariants.py` (13 tests)

### Capabilities

| Capability | Hook | Behavior |
|---|---|---|
| Tool allowlisting | `on_tool_execution()` | DENY if tool not in allowed patterns |
| PII detection | `on_tool_execution()` | DENY if SSN/CC/email/phone in tool args |
| Secret detection | `on_tool_execution()` | DENY if API keys/tokens in tool args |
| Cost governance | `on_tool_execution()` | DENY if session budget exceeded |
| Per-agent kill switch | `on_turn()` + `on_tool_execution()` | DENY all actions for frozen agents |
| Structured audit | All hooks | TEEC receipt for every decision |

### Usage

```python
from autogen.beta import Agent
from autogen.beta.config import OpenAIConfig
from autogen.beta.middleware import Middleware
from autogen.beta.extensions.tealtiger import TealTigerMiddleware, GovernanceMode, GovernancePolicy

agent = Agent(
    "assistant",
    config=OpenAIConfig("gpt-4o-mini"),
    tools=[search, read_file],
    middleware=[
        Middleware(
            TealTigerMiddleware,
            mode=GovernanceMode.ENFORCE,
            policies=[
                GovernancePolicy.tool_allowlist(["search", "read_file"]),
                GovernancePolicy.pii_block(["ssn", "credit_card"]),
                GovernancePolicy.cost_limit(max_per_session=5.0),
            ],
        )
    ],
)
```

### Governance invariants tested

1. Same payload in two turns → two distinct decision_ids
2. Approval for one agent does not authorize another
3. Channel/hub approval does not authorize a different tool/scope
4. Revised args → new pending decision
5. Timeout → no execution, durable terminal result
6. Retry with same decision_id → prior terminal state
7. Receipt reconstruction answers: who, which policy, which delegation, what executed
