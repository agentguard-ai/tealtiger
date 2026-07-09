@safal207 — all three points are correct. Fixing in this push:

## 1. Oracle updated — `decision_id` removed from duplicate predicate

`evaluate_contract_binding()` now reads `idempotency_key` as a first-class field on the outcome and checks `(intent_ref, idempotency_key)` only:

```python
same_intent = outcome.get("intent_ref") == decision.get("intent_ref")
same_idempotency = (
    outcome.get("idempotency_key") == decision.get("idempotency_key")
)
if terminal and same_intent and same_idempotency:
    return "deny", "duplicate_outcome"
```

`same_decision` is gone. A fresh `decision_id` with the same semantic side effect is now denied.

## 2. Negative fixture now calls the oracle and asserts deny

Moved the behavioral assertion into `test_governance_decision_fail_closed_contract.py` where the oracle lives. The test calls `evaluate_contract_binding()` and asserts `verdict == "deny"` with `reason == "duplicate_outcome"`:

```python
def test_duplicate_different_decision_id_denies() -> None:
    """Fresh decision_id with same (intent_ref, idempotency_key) is denied."""
    decision = base_allow_decision()
    decision["decision_id"] = "d-replay-fresh-id"  # different decision_id
    candidate = matching_candidate()

    existing_outcome: GovernanceOutcome = {
        "decision_id": "d-fail-closed-001",  # original
        "intent_ref": "sha256:intent-ref-approved",
        "idempotency_key": "idem:send-summary:user@example.com:001",
        "outcome": "executed",
        ...
    }

    verdict, reason = evaluate_contract_binding(decision, candidate, [existing_outcome])
    assert verdict == "deny"
    assert reason == "duplicate_outcome"
```

## 3. Semantic model pinned: **Model A (pair model)**

Resolved the inconsistency. The contract now uses:

- `intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))` — **excludes** `idempotency_key`
- Duplicate identity = `(intent_ref, idempotency_key)` — the pair
- A different `idempotency_key` with the same `intent_ref` is a genuinely new invocation of the same semantic intent

Updated docstrings:
- `GovernanceDecision.intent_ref`: removed `idempotency_key` from the hash input list
- `GovernanceDecision.idempotency_key`: reworded to "a key stable across retries of one side effect, not a key unique to each attempt. Duplicate enforcement keys on `(intent_ref, idempotency_key)` — not on `decision_id`."

Pushing now.
