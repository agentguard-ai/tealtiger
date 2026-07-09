@safal207 — sharp review. Both findings are real gaps. Addressing in order:

## 1. Validator under-binding → tightening to full executable boundary

You're right — the current validator is shape-level only. An `allow` that passes without `normalized_scope`, `normalization_id`, `intent_digest`, or `idempotency_key` can't be safely bound by a future executor. Going with your first option: enforce the full route-specific recomputation boundary.

Updated required fields:

```python
# allow — full executable binding
ALLOW_REQUIRED = [
    "agent_id", "tool", "normalized_scope", "normalization_id",
    "intent_digest", "intent_ref", "idempotency_key",
    "issued_at", "policy_refs",
]

# require_approval — same binding + resume fields
REQUIRE_APPROVAL_REQUIRED = ALLOW_REQUIRED + [
    "continuation_id", "expires_at",
]
```

For nullable target state: requiring key presence even when value is `None`. That makes "I checked, no target state" explicit vs. "I forgot to check":

```python
# Key must exist in the dict, value may be None
if "target_state_digest" not in d:
    errors.append(f"'{decision}' requires 'target_state_digest' key (may be None)")
```

## 2. Duplicate execution bypass → keying on `(intent_ref, idempotency_key)` only

Agreed. The current triple `(decision_id, intent_ref, idempotency_key)` lets a replay mint a fresh `decision_id` and slip through. The terminal-outcome check should key on `(intent_ref, idempotency_key)` regardless of `decision_id`.

Changes:
- Oracle rejects execution when a terminal outcome exists for the same `(intent_ref, idempotency_key)` pair — `decision_id` is irrelevant for duplicate detection
- Promoting `idempotency_key` to a first-class field on `GovernanceOutcome` (out of extensions)
- Docstring clarification: "a key stable across retries of one side effect, not a key unique to each attempt"

Negative fixture:

```python
FIXTURE_DUPLICATE_DIFFERENT_DECISION_ID: GovernanceDecision = {
    "decision_id": "d-010",  # fresh decision record
    "intent_ref": FIXTURE_ALLOW["intent_ref"],  # same authorized intent
    "idempotency_key": "idem-allow-001",  # same idempotency key
    "agent_id": "support-bot",
    "tool": "search_docs",
    "normalized_scope": "docs/public",
    "normalization_id": "jcs-sha256",
    "intent_digest": FIXTURE_ALLOW["intent_digest"],
    "policy_refs": ["allow-read-tools-v1"],
    "decision": "allow",
    "reason": "Retry of previously executed intent",
    "issued_at": "2026-06-25T14:30:00Z",
    "seq": 5,
    "running_count": 6,
}
# Expected: DENY — terminal outcome already exists for (intent_ref, idempotency_key)
```

## CI status

Noted the `action_required` state with no actual job execution. Will push these fixes and verify CI runs produce real results on the next commit.

Pushing shortly.
