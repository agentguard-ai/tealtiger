# Governance Enforcement – Manual Guide (v1.1.0)

## Purpose
This guide explains how to enforce TealTiger governance rules **without automation**.
It is intended for early-stage teams or design reviews before CI is enabled.

## What to Check Before Merging

### 1. Stable IDs
- Verify that `stable_id` values did not change
- If meaning changed, require a new stable_id

### 2. Audit Event Schema
- Required fields must not be renamed or removed
- New fields must go under `extensions.*`

### 3. Golden Corpus
- Test case IDs must never be reused
- Changed behavior requires a new test case ID

### 4. Decision Determinism
- Same inputs + same policy version must yield same decision

## When to Block a Change
- Any change that violates stability-guarantees.mdx
- Any reuse of stable IDs with new semantics

## Outcome
If all checks pass, the change is safe for v1.1.x.
