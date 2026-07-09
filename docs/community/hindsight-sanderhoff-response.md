@Sanderhoff-alt — good question. The answer is: **leave room for a richer model, but ship v1 with a sensible default mapping that users can override.**

Concretely, the adapter should take an `importance_fn` parameter:

```python
memory = HindsightGovernanceMemory(
    client=hindsight,
    # Default: simple decision-type mapping
    importance_fn=default_importance,
)

def default_importance(decision) -> float:
    """Default v1 mapping: decision action drives base importance."""
    base = {"deny": 0.90, "require_approval": 0.85, "monitor": 0.70, "allow": 0.55}
    return base.get(decision.action, 0.60)
```

Users who want richer logic can override it:

```python
def custom_importance(decision) -> float:
    """Use risk_score as one signal among several."""
    base = 0.50
    # Risk score contributes, but doesn't dominate
    risk_contribution = (decision.risk_score / 100) * 0.3
    # Repeated denials for same agent+tool are more important
    recurrence_boost = 0.15 if decision.is_recurring else 0.0
    # False-positive-flagged events are deprioritized
    fp_penalty = -0.20 if decision.metadata.get("false_positive") else 0.0
    return min(base + risk_contribution + recurrence_boost + fp_penalty, 1.0)

memory = HindsightGovernanceMemory(client=hindsight, importance_fn=custom_importance)
```

**Why not map risk_score directly to importance:**

You're right on both points:
1. High-risk false positives shouldn't persist forever — a `risk_score: 95` that turned out to be a regex false positive shouldn't crowd out real denials in future recall
2. Low-risk ALLOWs in aggregate ARE useful for baseline construction — they should decay slowly from *recall context* but persist long enough to compute statistical baselines

**The v1 design principle**: `importance_fn` is a pluggable function. The default is simple (decision type only, risk_score ignored). The interface leaves room for richer models (recurrence, false-positive feedback, policy version drift) without baking assumptions into the adapter.

This also addresses the policy/scorer version evolution point: if risk_score semantics change between policy versions, the `importance_fn` can incorporate `policy_digest` to normalize scores across versions.

**For the benchmark dataset** you proposed earlier — I'd suggest testing both the simple default mapping and 2-3 richer variants to see which actually produces better precision@5 for contextual recall. That would tell us whether the complexity is worth it for v1, or whether the simple mapping is good enough until real usage data says otherwise.
