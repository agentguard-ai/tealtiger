@safal207 @arian-gogani @rpelevin — good convergence on the PR thread. Addressing both open points before pushing the next commit:

**1. Route-specific required fields (@safal207's review)**

Agreed — `total=False` with no validation means an `allow` can be structurally valid but useless as an authorization boundary. The fix:

Adding a `validate_governance_decision(d: GovernanceDecision) -> bool` that enforces route-specific minimums:

- `allow` / `require_approval`: MUST have `decision_id`, `agent_id`, `tool`, `intent_ref` (or `params_hash` if intent_ref not yet computed), `issued_at`, at least one `policy_refs` entry
- `deny`: MUST have `decision_id`, `tool`, `reason`
- `revise`: MUST have `decision_id`, `tool`, `reason`, `revalidate_if`

The TypedDict stays `total=False` (wire format flexibility), but the validator is the normative enforcement. Test fixtures will include a `test_allow_missing_binding_fields_fails_validation` case.

**2. Completeness docstring wording**

Fixed. Softened to "detect internal gaps within a retained sequence" and explicitly documented that tail-truncation requires the seal, and seal-suppression requires an external anchor.

**3. `intent_ref` / `receipt_ref` split (@arian-gogani + @safal207)**

Adopting this. The overloaded `action_ref` concept is cleaner as two distinct fields:

```python
class GovernanceDecision(TypedDict, total=False):
    # Identity
    decision_id: str           # runtime-local UUID
    intent_ref: str            # SHA-256(JCS({agent_id, tool, normalized_scope,
                               #   intent_digest, idempotency_key})) — no timestamp
    receipt_ref: str           # SHA-256(JCS({...intent_ref_fields, issued_at}))
    
    # Intent binding (TOCTOU closure)
    intent_digest: str         # SHA-256 over normalized executable envelope
    target_state_digest: str | None
    continuation_id: str | None
    normalization_id: str      # identifies which normalization was applied
    
    # Completeness
    seq: int                   # 0-indexed, no gaps
    running_count: int         # == seq + 1
    ...
```

Join rules:
- `GovernanceDecision` → `GovernanceOutcome` joins on `intent_ref`
- Idempotency checks bind to `intent_ref` equality
- Audit enumeration + record counting uses `receipt_ref`
- Timestamp never enters semantic identity
- Retries of the same authorized intent produce the same `intent_ref`
- Distinct records always have distinct `receipt_ref`

**4. `normalization_id` (from issue thread @XuebinMa)**

Adding `normalization_id` so engines can declare how they normalized params before hashing. agent-guard declares `"agent-guard-unwrap-v1"`, TealTiger declares `"jcs-sha256"`, and a verifier knows how to recompute.

**5. `revise` semantics**

Documented as advisory-only: no side effect, new decision required for any revised action. Engines that don't implement it simply never emit it.

**6. RFC 8785 (JCS) mandated**

The contract now explicitly mandates RFC 8785 for `params_hash`, `intent_digest`, and `intent_ref` computation. `json.dumps(sort_keys=True)` is NOT JCS — diverges on Unicode and non-integer fields.

**7. @safal207's conformance fixtures**

Adapting the four fail-closed cases from your LS repo into CrewAI's pytest format in this commit:
- exact-intent mismatch → deny
- target-state drift → revalidate
- continuation mismatch → deny
- duplicate outcome (idempotency) → deny

Next commit incoming with all of the above. Will tag everyone when pushed.
