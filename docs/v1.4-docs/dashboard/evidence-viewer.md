---
title: "Evidence Viewer"
description: "Inspect the full TEEC v2.1 evidence envelope for any governance decision — reason chains, confidence scores, seals, and cost evidence."
---

# Evidence Viewer

The Evidence Viewer lets you deep-dive into any governance decision. It renders the full TEEC (Typed Evidence & Evidence Contract) v2.1 envelope, showing exactly why a decision was made, which modules evaluated, how confident the detections were, and the cryptographic proof of decision integrity.

---

## What It Shows

For any governance decision, the Evidence Viewer displays:

| Section | Contents |
|---------|----------|
| **Top Fields** | correlationId, agentId, timestamp, teec_version, action, intent_ref, receipt_ref, seq, running_count |
| **Reason Chain** | Ordered module evaluations grouped by stage (pre/post), with per-module action, latency, and reason codes |
| **Confidence Scores** | Per-finding confidence values (0–100%) with color-coded severity indicators |
| **Governance Seal** | HMAC seal, agent_id, timestamps, receipt chain, genesis detection |
| **Cost Evidence** | Provider, model, token breakdown, estimated vs actual cost, variance warnings |

---

## Navigating to the Evidence Viewer

You can reach the Evidence Viewer from three entry points:

### 1. Direct Navigation

Navigate to `/evidence` to see the filterable decision list. Click any decision to open its evidence detail.

### 2. From Audit Trail

Click any governance event in the Audit Trail → opens directly to the Evidence detail for that `correlationId`.

### 3. From Decision Explorer

Click "View Full Evidence" in any Decision Explorer drill-down → opens the Evidence detail.

---

## Reason Chain Visualization

The reason chain shows the ordered sequence of module evaluations:

```
┌─────────────────────────────────────────────────────┐
│ PRE_EXECUTION                                       │
├─────────────────────────────────────────────────────┤
│ 🟢 TealSecrets v1.2.0    PASS   2.1ms  (no findings)│
│ 🔴 TealGuard v1.4.0      DENY   3.4ms              │
│    └── PII_DETECTED (high) — SSN pattern found      │
│    └── INJECTION_SUSPECTED (medium)                  │
├─────────────────────────────────────────────────────┤
│ POST_EXECUTION                                       │
├─────────────────────────────────────────────────────┤
│ (not evaluated — pre-scan denied)                    │
└─────────────────────────────────────────────────────┘

Final Action: DENY (most restrictive: TealGuard)
```

Each module evaluation shows:

- Module name and version
- Stage (PRE_EXECUTION or POST_EXECUTION)
- Action taken by this module
- Latency contribution
- Reason codes with title and severity from the TEEC registry
- Error indicator (if the module errored)

Evaluations are grouped into **PRE_EXECUTION** and **POST_EXECUTION** sections with visual separation.

---

## Confidence Scores

When modules produce findings with confidence scores, they're displayed as percentage bars:

| Finding | Confidence | Level |
|---------|-----------|-------|
| SSN Pattern | 94% | 🔴 High (> 70%) |
| Email Address | 99% | 🔴 High (> 70%) |
| Possible Phone | 52% | 🟡 Medium (40–70%) |
| Ambiguous Token | 28% | ⚪ Low (< 40%) |

Classification:
- **High** (> 70%): Strong signal — likely a true positive
- **Medium** (40–70%): Moderate signal — review recommended
- **Low** (< 40%): Weak signal — possible false positive

Findings are sorted by confidence in descending order (highest confidence first).

---

## Governance Seal

The seal section proves tamper-evidence:

| Field | Example | Description |
|-------|---------|-------------|
| HMAC | `a7f3...b2c1` (truncated) | HMAC-SHA256 over decision payload |
| Seal Timestamp | 2026-06-15 14:32:01.234 | When the seal was computed |
| Agent ID | `research-agent-01` | Agent that produced the decision |
| Time Diff | +12ms | Difference between seal and decision timestamp |
| intent_ref | `sha256:abc...` | Hash linking to the original intent |
| receipt_ref | `sha256:def...` | Hash linking to the previous decision |
| seq | 47 | Position in the decision chain |
| normalization_id | `norm-001` | Normalization identifier |

### Chain Genesis Detection

When `receipt_ref` is exactly 64 zeros (`0000...0000`), the viewer displays a **"Chain Genesis"** badge indicating this is the first decision in the agent's chain.

### Copy Seal

The "Copy Seal" button copies the full hex-encoded HMAC value to the clipboard for verification.

---

## Cost Evidence

When cost data exists for the decision:

| Field | Value |
|-------|-------|
| Provider | OpenAI |
| Model | gpt-4o |
| Input Cost | $0.0025 |
| Output Cost | $0.0040 |
| Total Cost | $0.0065 |
| Request Tokens | 500 |
| Response Tokens | 800 |
| Total Tokens | 1300 |

### Estimated vs Actual

When both values are available:

```
Estimated: $0.0050
Actual:    $0.0065
Variance:  +$0.0015 ⚠️ (+30% over estimate)
```

A warning indicator appears when:
- Actual cost exceeds estimated by more than 20%
- Estimated cost is zero or negative

### No Cost Data

If no cost record exists for the correlationId, the section displays: "No cost data available."

---

## Filtering

The Evidence list view includes a filter panel with:

| Filter | Type | Options |
|--------|------|---------|
| Reason Codes | Multi-select | Populated from distinct reason codes in the data |
| Module Name | Dropdown | Populated from distinct module names in the data |
| Action Type | Dropdown | ALLOW, DENY, SANITIZE, REPORT |
| Agent ID | Text input | Partial match (contains) |

### Filter Behavior

- All active filters use **AND logic** — results must match all active filters simultaneously
- Active filter count and result count are displayed
- **Clear Filters** button resets all filters at once

---

## Export

### Export Evidence Pack

Every evidence detail view includes an "Export Evidence Pack" button that downloads the complete TEEC envelope as JSON:

**Filename:** `teec-evidence-{correlationId}.json`

**Contents:**

```json
{
  "metadata": {
    "exportTimestamp": 1718461921000,
    "dashboardVersion": "1.4.0",
    "teec_version": "2.1"
  },
  "decision": {
    "correlationId": "abc-123-def",
    "agentId": "research-agent-01",
    "timestamp": 1718461920000,
    "action": "DENY",
    "intent_ref": "sha256:...",
    "receipt_ref": "sha256:...",
    "seq": 47,
    "running_count": 48
  },
  "moduleEvaluations": [...],
  "governanceSeal": {
    "hmac": "a7f3...full hex...",
    "timestamp": 1718461920012,
    "agent_id": "research-agent-01"
  },
  "costEvidence": {
    "provider": "openai",
    "model": "gpt-4o",
    "totalCostUsd": 0.0065,
    ...
  }
}
```

This file serves as a tamper-proof audit artifact for compliance teams.

### Error Handling

If the export fails (network issue, browser restriction), a toast notification appears with:
- Error message explaining what went wrong
- Retry button to attempt the download again

---

## API Endpoints

The Evidence Viewer is powered by:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/decisions/{correlationId}/evidence` | Assemble and return the full TEEC envelope |
| `GET /api/v1/decisions/{correlationId}/evidence/export` | Download the envelope as a JSON file |
| `GET /api/v1/decisions?reasonCode=&moduleName=&actionType=&agentId=` | Filtered decision list |

### Partial Data

The API returns HTTP 200 with partial data when some components are missing:
- Decision exists but no module evaluations → `moduleEvaluations: []`
- Decision exists but no cost record → `costEvidence: null`
- Governance seal unparseable → `governanceSeal: null`

The Evidence Viewer gracefully handles missing sections, showing "No data available" messages where appropriate.
