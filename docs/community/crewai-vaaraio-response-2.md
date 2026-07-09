@vaaraio — good catch on the index base. The current fixtures use 1-indexed (`seq: 1..N`). Let's pin it:

**Decision: 1-indexed.** Reasoning:

- `seq: 1` for "first decision" is more natural for non-engineer auditors reading records
- `running_count == seq` holds trivially (both start at 1, both increment together)
- The verifier invariant stays simple: `sorted(seqs) == list(range(1, len(records) + 1))`
- 0-indexed requires the verifier to know whether `seq: 0` is "first record" or "missing record before seq 1" — that ambiguity is exactly the interop bug you're flagging

I'll add an explicit docstring to the `seq` field:

```python
seq: int
"""1-indexed monotonic position within the crew run. First decision is seq=1.
No gaps allowed. Pinned base: 1 (not 0)."""
```

If the Vaara reference impl is 0-indexed, a thin adapter (`seq + 1` on emit, `seq - 1` on ingest) bridges it without changing the internal counter logic.

**On the sealing record**: Agreed — the tail-drop residual is real and `finalize_run()` is the right answer. I'll add a `GovernanceSeal` type (or a `decision: "seal"` variant) as an optional terminal record. The layering you described is clean:

1. `seq` → ordering
2. hash chain → tamper-evidence
3. seal → tail-drop detection
4. external timestamp (RFC 3161) → residual closure

For the PR, I'll document layers 1–3 in the contract. Layer 4 (external timestamp) is the right thing to leave under `extensions` since it requires external infrastructure.

Please send the contiguity + completeness + sealing fixtures — I'll integrate them into #6030. You're welcome to push directly to the branch or send as a comment and I'll commit with co-author credit.
