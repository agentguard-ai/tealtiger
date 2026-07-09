@vaaraio — this is a sharp distinction and the right time to add it. Tamper-evidence without completeness-evidence is half the audit story.

The `seq` + `running_count` proposal is clean and I agree it belongs in the core shape, not under extensions. The argument is decisive: if a vendor can maintain its own private sequence, it can drop records without the framework detecting it. The completeness guarantee must be framework-enforced.

For PR #6030, I'll add:

```python
class GovernanceDecision(TypedDict, total=False):
    # ... existing fields ...
    seq: int              # monotonic position within crew_run_id, no gaps
    running_count: int    # total decisions emitted in this run so far
```

Contract test fixtures for the gap case:

```python
# Fixture: contiguity violation (seq gap = provable dropped record)
records = [
    {"decision_id": "d-001", "seq": 1, "running_count": 1, ...},
    {"decision_id": "d-002", "seq": 2, "running_count": 2, ...},
    # seq 3 missing
    {"decision_id": "d-004", "seq": 4, "running_count": 4, ...},
]
assert verify_contiguity(records) == False  # gap at seq 3

# Fixture: running_count exceeds held records (provable omission)
records = [
    {"decision_id": "d-001", "seq": 1, "running_count": 1, ...},
    {"decision_id": "d-002", "seq": 2, "running_count": 3, ...},  # claims 3 exist, only 2 held
]
assert verify_completeness(records) == False
```

The key invariant: `max(running_count) == len(records)` AND `seq` forms a contiguous 1..N sequence with no gaps. If either fails, the verifier knows records were dropped without needing access to the issuer.

This also composes cleanly with the Merkle proof chain in TEEC — `seq` gives you ordering, the hash chain gives you tamper-evidence, and together they prove both authenticity and completeness.

Welcome the contract-test fixture contribution to #6030 — tag me when you push it and I'll integrate alongside the existing test suite.
