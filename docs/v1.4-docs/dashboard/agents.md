---
title: "Agent Matrix"
description: "Monitor all active and frozen agents with per-agent status, cost, denial rates, and role information."
---

# Agent Matrix

The Agents panel shows a real-time matrix of all observed agents with their governance status, role assignments, cost metrics, and behavioral indicators.

---

## Overview

The Agent Matrix displays a table of all agents that have been observed by TealTiger:

| Column | Description |
|--------|-------------|
| Agent ID | Unique identifier for the agent |
| Role | Assigned role (researcher, writer, reviewer, etc.) |
| Status | Active (green), Idle (gray), or Frozen (red) |
| Provider | LLM provider being used |
| Model | Current model |
| Total Cost (24h) | Cost attributed to this agent in the last 24 hours |
| Denial Rate (24h) | Percentage of requests denied in the last 24 hours |
| Requests (24h) | Total request count in the last 24 hours |
| Last Activity | Timestamp of the most recent request |

---

## Agent Status

| Status | Indicator | Meaning |
|--------|-----------|---------|
| **Active** | 🟢 Green dot | Agent has made a request in the last 5 minutes |
| **Idle** | ⚪ Gray dot | Agent exists but no recent activity (> 5 minutes) |
| **Frozen** | 🔴 Red badge "FROZEN" | Agent is frozen via `freeze()` — all requests blocked |

Frozen agents display the freeze reason:
- "Manually frozen" — operator called `freeze(agentId)`
- "Wildcard freeze" — `freeze("*")` was called
- "Canary triggered" — agent triggered a canary honeypot

---

## Provider and Model Info

Each agent row shows its current LLM configuration:

```
research-agent-01 | researcher | 🟢 Active
  Provider: OpenAI | Model: gpt-4o | Latency p50: 450ms
```

When an agent has used multiple models across requests, the "Model" column shows the most recently used model.

---

## Request and Denial Rates

| Metric | Description |
|--------|-------------|
| Requests/hour | Average request rate in the current hour |
| Denial rate | Percentage of requests that received a DENY decision |
| Latency p50 | Median governance overhead latency |

### Anomaly Highlighting

Agents with anomalous behavior are highlighted:

- **Denial rate > 20%** (configurable): Amber indicator — this agent is hitting governance limits frequently
- **Denial rate > 50%**: Red indicator — this agent may be misconfigured or adversarial
- **Cost velocity alert active**: Amber pulsing badge
- **Canary trigger history**: Red security badge

---

## Expandable Detail

Clicking an agent row expands to show:

### Allowed Tools

The list of tools this agent's role permits:

```
Allowed: web_search, arxiv_search, read_file, google_scholar
Denied (attempted): write_file (2x), execute_code (1x)
```

### Recent Decisions

The last 10 governance decisions for this agent:

| Time | Action | Reason | Latency |
|------|--------|--------|---------|
| 14:32:01 | ALLOW | — | 2ms |
| 14:31:45 | DENY | ROLE_TOOL_NOT_ALLOWED | 1ms |
| 14:31:12 | ALLOW | — | 3ms |

### Cost Trend

A sparkline showing the agent's cost over the last 24 hours, making spending patterns visible at a glance.

### Behavioral Baseline Status

```
Baseline: Complete (100/100 requests)
Latency p50: 420ms | p95: 1.2s | p99: 2.1s
Cost p50: $0.003 | p95: $0.012
```

---

## Sorting and Filtering

### Sort By

Click any column header to sort:
- Agent ID (alphabetical)
- Role (alphabetical)
- Status (frozen first)
- Total Cost (highest first)
- Denial Rate (highest first)
- Last Activity (most recent first)

### Filter By

| Filter | Options |
|--------|---------|
| Role | Dropdown of all roles |
| Status | Active / Idle / Frozen |
| Cost threshold | Show only agents above $X cost |

---

## Freeze Control

Each agent row includes a **Freeze** toggle button that directly calls the kill switch:

```
[research-agent-01] [🟢 Active] [...] [❄️ Freeze]
```

Clicking **Freeze** calls `freeze(agentId)` via the dashboard API. The status immediately changes to:

```
[research-agent-01] [🔴 FROZEN] [...] [🔓 Unfreeze]
```

Clicking **Unfreeze** calls `unfreeze(agentId)` and restores the agent to active status.

---

## Grouping By Role

The matrix supports a "Group by Role" toggle that collapses agents into role groups:

```
▼ researcher (3 agents)
  research-agent-01  🟢  $2.45  8% denial
  research-agent-02  🟢  $1.87  5% denial
  research-agent-03  ⚪  $0.00  0% denial

▼ writer (2 agents)
  writer-agent-01    🟢  $0.92  12% denial
  writer-agent-02    🔴  $0.00  FROZEN

▼ reviewer (1 agent)
  reviewer-agent-01  🟢  $0.31  2% denial
```

This view is especially useful for multi-agent systems with many agents per role.

---

## Real-Time Updates

The Agent Matrix updates in real-time via WebSocket:

- Status changes (active → idle → frozen) appear immediately
- Cost and request counts update every 5 seconds
- New agents appear as soon as they make their first request
- Freeze/unfreeze actions from other clients are reflected instantly
