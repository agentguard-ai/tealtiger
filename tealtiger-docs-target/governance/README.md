# Governance & Enforcement

This folder contains **governance enforcement artifacts** for TealTiger.

These files define **how documentation, policies, schemas, and audit contracts are kept deterministic, stable, and backward‑compatible** across releases.

> This folder exists so governance rules are **explicit, reviewable, and enforceable** — not tribal knowledge.

---

## Why this exists

TealTiger treats governance as a **first‑class system**, not just documentation.

As the platform evolves:
- policies change
- audit schemas grow
- new contributors join
- customers depend on backward compatibility

Without explicit governance enforcement:
- contracts drift
- audits become fragile
- determinism erodes
- breaking changes slip in unnoticed

This folder prevents that.

---

## What this folder contains

```
governance/
├── README.md                     # This file
│
├── ci/
│   └── governance-ci-workflow.yml
│       # Reference CI workflow for automated enforcement
│
├── manual/
│   └── manual-governance-enforcement.md
│       # Human review checklist (used before CI is enabled)
│
└── future/
    └── future-saas-enforcement.md
        # Forward-looking reference for SaaS-scale enforcement
```

---

## Governance enforcement levels

### Level 0 — Human enforcement

- Governance rules are defined in docs
- Reviewers manually check:
  - stable IDs
  - schema compatibility
  - golden corpus changes

Reference:
```
governance/manual/manual-governance-enforcement.md
```

---

### Level 1 — CI guardrails

- Lightweight CI workflow enforces:
  - stable ID immutability
  - machine index consistency
  - audit schema compatibility
  - golden corpus integrity

Reference:
```
governance/ci/governance-ci-workflow.yml
```

---

### Level 2 — SaaS enforcement (future)

- Upload-time validation
- Runtime enforcement
- Tenant isolation

Reference:
```
governance/future/future-saas-enforcement.md
```

---

## Relationship to documentation

Governance enforcement builds on:
- Stable IDs (`stable_id`)
- Machine-readable specs (`machine_spec`)
- Golden corpus
- Audit schemas
- Stability guarantees

Indexed via:
```
docs/machine/_machine-index.v1.1.0.yaml
```

---

## Design philosophy

- Deterministic over probabilistic
- Explicit over implicit
- Additive over breaking
- Machine-enforceable over convention
- Versioned over mutable

---

## Summary

This folder ensures TealTiger governance remains:
- predictable
- reviewable
- enforceable
- scalable
- future‑proof

If a rule matters, it must be documented, machine‑readable, and eventually enforceable.
