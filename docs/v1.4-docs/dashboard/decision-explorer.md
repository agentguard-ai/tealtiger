---
title: "Decision Explorer"
description: "Explore governance decisions with table and timeline views, sortable columns, and drill-down to stage-level detail."
---

# Decision Explorer

The Decision Explorer provides a structured view of governance decisions with powerful sorting, drill-down, and analysis capabilities. Use it to investigate patterns, identify problematic agents, and understand how the multi-stage pipeline is performing.

---

## Views

### Table View

The default view — a sortable, filterable table of all governance decisions:

| Correlation ID | Agent | Role | Action | Reason Codes | Stages | Latency | Cost | Timestamp |
|---------------|-------|------|--------|-------------|--------|---------|------|-----------|
| `abc-123` | research-01 | researcher | DENY | PII_DETECTED | 1 | 2ms | $0.00 | 14:32:01 |
| `def-456` | writer-01 | writer | ALLOW | — | 1,2 | 14ms | $0.003 | 14:31:58 |
| `ghi-789` | coder-01 | coder | DENY | SECRET_DETECTED | 1 | 3ms | $0.00 | 14:31:55 |

### Timeline View

An alternative visualization showing decisions plotted on a time axis:

```
14:30 ──●──●──●──●──○──●──●──●──○──●── 14:35
        │  │  │  │     │  │  │     │
        ✓  ✓  ✓  ✗     ✓  ✓  ✗     ✓

● ALLOW  ○ DENY  ◐ SANITIZE  ◑ REPORT
```

Features:
- Color-coded by action
- Density indicates request volume
- Hover to see decision summary
- Click to open drill-down

---

## Sorting

Click any column header to sort:

| Column | Sort Behavior |
|--------|--------------|
| Correlation ID | Alphabetical |
| Agent | Alphabetical |
| Role | Alphabetical |
| Action | DENY → SANITIZE → REPORT → ALLOW |
| Reason Codes | By first reason code (alphabetical) |
| Stages | By count of stages evaluated |
| Latency | Numeric (ascending/descending) |
| Cost | Numeric (ascending/descending) |
| Timestamp | Chronological (newest/oldest first) |

Multi-column sort: Hold Shift and click a second column to apply secondary sorting.

---

## Drill-Down View

Clicking a decision row opens the drill-down panel showing:

### Stage Decisions

A per-stage breakdown of how the decision was made:

```
┌─────────────────────────────────────────────────┐
│ Stage 1: Pattern Scanning         2.1ms  PASS   │
│   Findings: none                                 │
├─────────────────────────────────────────────────┤
│ Stage 2: Structural Analysis     11.8ms  DENY   │
│   Findings:                                      │
│   - AST_DANGEROUS_OPERATION (confidence: 0.87)   │
│     rm -rf detected in code output              │
├─────────────────────────────────────────────────┤
│ Stage 3: (not evaluated — short-circuited)       │
└─────────────────────────────────────────────────┘

Final: DENY | Total: 13.9ms | Short-circuit: Yes (at Stage 2)
```

### Module Evaluations

Each module that contributed to the decision:

| Module | Version | Action | Latency | Findings |
|--------|---------|--------|---------|----------|
| TealGuard | 1.4.0 | DENY | 11.8ms | AST_DANGEROUS_OPERATION |
| TealSecrets | 1.2.0 | PASS | 2.1ms | — |

### Timing Breakdown

A waterfall chart showing the timing of each stage:

```
Stage 1 ████ 2.1ms
Stage 2 ████████████████████████ 11.8ms
         0ms        5ms       10ms      15ms
```

### Decision Metadata

| Field | Value |
|-------|-------|
| Correlation ID | `def-456-ghi-789` |
| Agent ID | `coder-agent-01` |
| Session ID | `session-abc` |
| Phase | pre |
| Mode | ENFORCE |
| Depth | standard |
| Short-circuited | Yes (at Stage 2) |
| Risk Score | 87 |

---

## "View Full Evidence" Link

Every drill-down includes a prominent link:

```
[📋 View Full Evidence →]
```

This navigates to the Evidence Viewer at `/evidence/{correlationId}` where the complete TEEC envelope is rendered — including reason chains, confidence scores, governance seal, and cost evidence.

---

## Filters

The Decision Explorer supports the same filter set as the Evidence Viewer:

| Filter | Type | Description |
|--------|------|-------------|
| Action Type | Dropdown | ALLOW, DENY, SANITIZE, REPORT |
| Agent ID | Text | Partial match |
| Role | Dropdown | All defined roles |
| Reason Code | Multi-select | From distinct codes in data |
| Module | Dropdown | From distinct module names |
| Stage | Dropdown | stage1, stage2, stage3 |
| Depth | Dropdown | fast, standard, deep |
| Phase | Dropdown | pre, post |
| Time Range | Date picker | Custom or preset ranges |

Filters apply with AND logic — all active filters must match.

---

## Aggregate Statistics

Above the table, summary stats for the current filter:

```
Total: 12,345 decisions | Allow: 11,200 (90.7%) | Deny: 890 (7.2%) | Sanitize: 200 (1.6%) | Report: 55 (0.4%)
Avg Latency: 4.2ms | Short-circuit rate: 68% | Most common deny: PII_DETECTED (342)
```

---

## Patterns Panel

An AI-free pattern detection sidebar (deterministic, rule-based):

- **Repeated denials**: Same agent + same reason code recurring
- **Burst patterns**: Sudden spike in requests from one agent
- **Stage escalation**: Requests that consistently reach Stage 3
- **Cost anomalies**: Requests significantly above the baseline cost

Example:

```
⚠️ Pattern: research-agent-01 denied 15 times in last 5 minutes
   Reason: ROLE_TOOL_NOT_ALLOWED (write_file)
   Suggestion: Review role configuration or agent behavior
```

---

## Export

Export the current view (with active filters) as:

- **CSV**: For spreadsheet analysis
- **JSON**: For programmatic processing
- **PDF**: For compliance reports (summary only)

Maximum export: 10,000 rows per export.

---

## Performance

- Virtual scrolling for large datasets
- Server-side pagination and filtering
- Indexed database queries on all sortable columns
- WebSocket for real-time new decision notifications
