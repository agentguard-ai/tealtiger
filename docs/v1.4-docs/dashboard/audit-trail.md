---
title: "Audit Trail"
description: "Chronological log of all governance events with filtering, search, and drill-down to Evidence detail."
---

# Audit Trail

The Audit Trail panel shows a chronological log of every governance event produced by TealTiger. Every request evaluated, every decision made, every cost recorded — all in one searchable timeline.

---

## Overview

The Audit Trail renders governance events in reverse chronological order (newest first):

```
14:32:01.234  🔴 DENY    research-agent-01  PII_DETECTED        gpt-4o    $0.008
14:31:58.102  🟢 ALLOW   writer-agent-01    —                   gpt-4o-mini $0.001
14:31:55.890  🟡 REPORT  coder-agent-01     INJECTION_SUSPECTED gpt-4o    $0.012
14:31:52.445  🟢 ALLOW   research-agent-01  —                   gpt-4o    $0.006
14:31:48.112  🔴 DENY    writer-agent-01    ROLE_TOOL_NOT_ALLOWED gpt-4o-mini $0.000
```

Each row shows:
- **Timestamp**: Precise to milliseconds
- **Action**: ALLOW (green), DENY (red), SANITIZE (orange), REPORT (amber)
- **Agent ID**: Which agent produced the event
- **Reason Codes**: Why the decision was made (empty for ALLOW)
- **Model**: Which model was used
- **Cost**: Request cost

---

## Filters

### Event Type

Filter by governance action:

| Filter Value | Shows |
|-------------|-------|
| All | All events |
| ALLOW | Only allowed requests |
| DENY | Only denied requests |
| SANITIZE | Only sanitized requests |
| REPORT | Only reported (monitored) requests |

### Agent ID

Text input supporting partial match:
- Type `research` to see all agents with "research" in their ID
- Type a full agent ID for exact match

### Text Search

Full-text search across event fields:
- Searches: agent ID, reason codes, model name, correlation ID
- Case-insensitive
- Supports partial matches

### Time Range

Pre-set time windows:
- Last 1 hour
- Last 6 hours
- Last 24 hours
- Last 7 days
- Custom range (date picker)

### Phase

Filter by governance direction:
- Pre-execution events only
- Post-execution events only
- Both (default)

---

## Expandable Event Details

Clicking any event row expands to show the full event payload:

```json
{
  "correlationId": "abc-123-def-456",
  "agentId": "research-agent-01",
  "sessionId": "session-xyz",
  "timestamp": 1718461921234,
  "phase": "pre",
  "action": "DENY",
  "riskScore": 85,
  "reasonCodes": ["PII_DETECTED", "SSN_PATTERN"],
  "stagesEvaluated": ["stage1"],
  "shortCircuited": true,
  "totalLatencyMs": 2.3,
  "model": "gpt-4o",
  "provider": "openai",
  "cost": 0.008,
  "findings": [
    { "type": "PII", "category": "ssn", "confidence": 0.94 }
  ]
}
```

### Expanded View Actions

| Button | Action |
|--------|--------|
| **View Evidence** | Navigate to the Evidence Viewer for this correlationId |
| **Copy Correlation ID** | Copy the correlationId to clipboard |
| **Filter by Agent** | Set the agent filter to this agent's ID |
| **View Agent** | Navigate to this agent's detail in the Agent Matrix |

---

## Navigate to Evidence

Clicking the **View Evidence** button (or the "Inspect" icon) on any event navigates directly to:

```
/evidence/{correlationId}
```

This opens the full Evidence Viewer with reason chains, confidence scores, governance seal, and cost evidence for that specific decision.

---

## Event Types

The audit trail captures multiple event types:

| Event Type | Description | Icon |
|------------|-------------|------|
| `governance_decision` | Pre/post-execution governance evaluation | 🛡️ |
| `pii_detection` | PII found in observe mode (report-only) | 👁️ |
| `freeze_block` | Request blocked by kill switch | ❄️ |
| `cost_velocity_alert` | Burn rate exceeded threshold | 🔥 |
| `budget_warning` | Budget consumption warning (80%, 95%) | 💰 |
| `baseline_complete` | Behavioral baseline finished building | 📊 |
| `canary_triggered` | Agent triggered a canary honeypot | 🐦 |
| `tool_call` | Tool call detected in model response | 🔧 |
| `error` | Provider or governance error | ⚠️ |

---

## Pagination

The audit trail uses virtual scrolling for performance:

- Loads 50 events at a time
- Infinite scroll loads more as you scroll down
- Total event count shown at top: "Showing 50 of 12,345 events"
- Filters update the count in real-time

---

## Real-Time Updates

New events stream in via WebSocket:

- A "New events" banner appears at the top when new events arrive while scrolling
- Click the banner to jump to the top and see the latest events
- Auto-scroll mode (optional): automatically scrolls to show new events as they arrive

---

## Export

### Export Filtered Results

When filters are active, an "Export" button downloads the filtered results as JSON:

- Maximum 10,000 events per export
- Filename: `audit-trail-{timestamp}.json`
- Includes all event fields (not just the summary columns)

---

## Performance

The audit trail is designed for high-volume environments:

- Virtual scrolling (react-window) — only renders visible rows
- Server-side filtering — filters are applied at the API level, not in the browser
- Indexed queries — reason codes, agent ID, timestamp are indexed for fast lookups
- WebSocket for new events — no polling
