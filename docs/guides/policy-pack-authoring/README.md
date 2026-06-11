# Policy Pack Authoring Guide

This guide walks you through a complete policy pack authoring flow using a
fixture-based harness:

- define a tool catalog
- define explicit grants
- define policy rules (tool + argument conditions)
- define expected TEEC-style receipts for regression cases
- run fixtures offline to validate behavior

The files in this directory are intentionally small so contributors can reuse
them as a template for future policy-pack PRs.

## Files

- `tool-catalog.json` — MCP-style tool catalog with risk tags
- `grants.json` — explicit allow/deny grants
- `policy.yaml` — policy route table (action + argument conditions)
- `allow.json` — expected ALLOW case
- `deny-destructive.json` — expected destructive tool DENY case
- `require-approval.json` — expected REQUIRE_APPROVAL case
- `revise.json` — expected REVISE case with scrubbed content
- `deny-budget.json` — expected budget-deny case
- `run-fixtures.ts` — offline fixture runner

## Suggested folder shape for PRs

For future packs, mirror this layout so reviewers can quickly validate
policy behavior:

```text
policy-pack-authoring/
  README.md
  tool-catalog.json
  grants.json
  policy.yaml
  allow.json
  deny-destructive.json
  require-approval.json
  revise.json
  deny-budget.json
  run-fixtures.ts
```

## Workflow

1. Define tools in `tool-catalog.json`.
2. List explicit grants in `grants.json`.
3. Define policy rules and guard conditions in `policy.yaml`.
4. Create fixture files with request + expected TEEC-style receipts.
5. Run `node run-fixtures.ts` equivalent for the TypeScript runtime you use.

## Fixture contract

Each fixture file uses the shape:

```json
{
  "name": "descriptive-case-id",
  "request": {
    "tool": "tool_name",
    "args": {
      "...": "..."
    },
    "estimated_cost_usd": 0.12
  },
  "expected": {
    "action": "ALLOW | DENY | REQUIRE_APPROVAL | REVISE",
    "reasonCodes": ["policy_code_1"],
    "teec": {
      "action": "ALLOW",
      "tool": "tool_name",
      "risk": "READ"
    }
  }
}
```

## TEEC style output

The harness generates a compact receipt object that mirrors typical TealTiger
telemetry shape:

- `policyVersion`
- `pack`
- `tool`
- `action`
- `decision`
- `reasonCodes`
- `riskLevel`
- `budgetUsd`
- `sanitized` (for REVISE cases)

Contributors can extend this to include more environment metadata (policy pack
source, request IDs, actor IDs) as needed.

## Running the fixture harness

```bash
cd docs/guides/policy-pack-authoring
npx ts-node run-fixtures.ts
```

Expected output:

```text
Loaded policy pack: policy-pack-authoring-guide
✓ [1] allow-search
✓ [2] deny-destructive
✓ [3] require-approval
✓ [4] revise-redact
✓ [5] deny-budget
5 fixture(s) passed.
```
