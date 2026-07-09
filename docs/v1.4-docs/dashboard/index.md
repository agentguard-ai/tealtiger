---
title: "Governance Dashboard"
description: "Real-time visibility into governance decisions, agent status, costs, and security events — all running locally on your infrastructure."
---

# Governance Dashboard

The TealTiger Governance Dashboard provides real-time visibility into everything your governance layer does. See which agents are running, what they're spending, what's being blocked, and why.

---

## What It Is

A local-first web application that visualizes governance data collected by TealTiger. No cloud dependency — your governance data stays on your infrastructure.

- **Real-time**: Live updates via WebSocket for cost velocity, decisions, and alerts
- **Searchable**: Full-text search across the audit trail
- **Filterable**: Slice data by agent, role, action type, time range, and more
- **Inspectable**: Drill into any governance decision to see the full TEEC evidence envelope
- **Configurable**: Adjust budgets, thresholds, and policies from the UI

---

## Architecture

<img src="/diagrams/dashboard-architecture.svg" alt="Dashboard component architecture" />

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | Next.js 14, React, Tailwind CSS, react-window | `dashboard/web/` |
| API | Fastify, Drizzle ORM, Zod | `dashboard/api/` |
| Database | SQLite (file-based) | `dashboard/api/dashboard.db` |
| Real-time | WebSocket (native Fastify) | Built into API |

---

## Panels

### Overview

Top-level metrics at a glance:

- Active agents count
- Total cost (24h)
- Decision breakdown (allow/deny/sanitize/report)
- Recent governance events stream
- Burn rate sparkline

### Agents

Role-based agent matrix showing all active and frozen agents with per-agent stats. See [Agent Matrix](/dashboard/agents) for details.

### Costs

Cost velocity, budget forecasting, and optimization suggestions. See [Costs Panel](/dashboard/costs) for details.

### Policies

Visual policy editor with:

- Form-based policy creation (no JSON editing)
- Real-time validation
- Policy simulation ("what would happen?")
- Import/export for version control
- Deploy with hot-swap (no restart)

### Audit Trail

Chronological event log with filtering and search. See [Audit Trail](/dashboard/audit-trail) for details.

### Evidence Viewer

Deep-dive into any governance decision — full TEEC envelope, reason chains, confidence scores, cryptographic seals. See [Evidence Viewer](/dashboard/evidence-viewer) for details.

### Decision Explorer

Table and timeline views of governance decisions with drill-down. See [Decision Explorer](/dashboard/decision-explorer) for details.

### Settings

Configuration panels for:

- Budget management (session, daily, monthly)
- Velocity alert thresholds
- Model routing configuration
- Canary management
- Role definitions

---

## Navigation

The sidebar organizes panels into sections:

```
📊 Overview
👥 Agents
    └── Agent Matrix
💰 Costs
    ├── Burn Rate
    ├── Budget Forecast
    └── Optimization
🔒 Govern
    ├── Policies
    ├── Audit Trail
    ├── Evidence
    └── Decision Explorer
⚙️ Settings
    ├── Budgets
    ├── Roles
    └── Canaries
```

---

## Data Flow

1. **SDK writes**: TealTiger SDK (via observe/TealGuard) writes governance events to the SQLite database
2. **API reads**: Dashboard API reads from the same database and serves via REST + WebSocket
3. **Frontend displays**: Next.js frontend fetches data, renders panels, and subscribes to real-time updates

The dashboard is **read-only** by default — it doesn't affect your running agents unless you explicitly use the Settings panel to adjust budgets or policies (which propagates via hot-swap).

---

## Requirements

- Node.js 18+
- npm or yarn
- SQLite (bundled with the API via better-sqlite3)

No Docker, no cloud services, no external databases.

---

## Quick Start

```bash
# Clone the dashboard (if standalone)
git clone https://github.com/agentguard-ai/TealTiger.git
cd TealTiger

# Install API dependencies
cd dashboard/api && npm install

# Install frontend dependencies
cd ../web && npm install

# Seed demo data (optional)
cd ../api && npx tsx src/seed-demo.ts

# Start both (in separate terminals)
cd dashboard/api && npm run dev    # → http://localhost:3001
cd dashboard/web && npm run dev    # → http://localhost:3000
```

See [Getting Started](/dashboard/getting-started) for the full setup guide.
