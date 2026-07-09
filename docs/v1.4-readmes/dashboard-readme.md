# @tealtiger/dashboard

[![npm version](https://img.shields.io/npm/v/@tealtiger/dashboard.svg)](https://www.npmjs.com/package/@tealtiger/dashboard)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Local-first governance dashboard for TealTiger.** Visualize agent behavior, cost attribution, audit trails, and governance decisions — entirely on your machine. No cloud. No signup.

---

## What It Is

The TealTiger Dashboard is a local governance console that provides real-time visibility into your AI agents. It reads from TealTiger's structured audit log and cost data, presenting a unified view of everything happening in your governed agents.

- **Cost attribution** — Per-agent, per-session, per-request cost breakdown
- **Audit trail** — Searchable, filterable governance event log with correlation IDs
- **Behavioral baselines** — P50/P95/P99 charts for latency, cost, and token usage
- **Governance decisions** — Every ALLOW/DENY/MONITOR verdict with full evidence
- **Kill switch status** — Real-time freeze/unfreeze state per agent
- **Evidence viewer** — Drill into individual decisions with full reconstructable proof

---

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 14 (App Router) | Dashboard UI |
| API | Fastify | REST API for dashboard data |
| Storage | SQLite | Local governance event store |

Everything runs on `localhost`. No external network calls. Data never leaves your machine.

---

## Setup

### Install

```bash
npm install @tealtiger/dashboard
```

Or run directly:

```bash
npx tealtiger dashboard
```

### From Source

```bash
git clone https://github.com/agentguard-ai/tealtiger.git
cd packages/dashboard

# Install dependencies
npm install

# Seed with sample data (optional — useful for exploration)
npm run seed

# Start the dashboard
npm run dev
```

Dashboard starts at `http://localhost:3741`.

---

## Usage

### With observe()

The dashboard automatically picks up data from `observe()` instrumented clients in the same process or via the local SQLite store.

```typescript
import { observe } from 'tealtiger';

const client = observe(new OpenAI(), { dashboard: true });
// Dashboard at http://localhost:3741 now shows live data
```

### Standalone

```bash
npx tealtiger dashboard --port 3741 --db ./tealtiger.db
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3741 | Dashboard port |
| `--db` | `./tealtiger.db` | Path to SQLite governance store |
| `--seed` | false | Populate with sample data on first run |
| `--open` | true | Auto-open browser |

---

## Panels

### Overview

High-level summary: total cost, request count, active agents, governance decisions, and kill switch status.

![Overview](assets/dashboard-overview.png)

### Agents

Per-agent drill-down: cost attribution, request volume, behavioral baseline charts, active sessions, and freeze state.

![Agents](assets/dashboard-agents.png)

### Evidence Viewer

Full governance decision detail: the input that triggered the decision, the policy that was evaluated, the verdict, the evidence chain, and correlation to the original request.

![Evidence](assets/dashboard-evidence.png)

### Audit Log

Searchable, filterable log of all governance events. Filter by agent, session, decision type, time range. Export as JSON or SARIF.

### Cost Explorer

Time-series cost visualization. Per-provider, per-model, per-agent breakdowns. Anomaly highlighting when spend deviates from baseline.

### Baseline Monitor

Behavioral baseline visualization: P50/P95/P99 for latency, cost, and token usage. Drift alerts when new requests deviate from established baselines.

---

## Data Model

The dashboard reads from TealTiger's local SQLite store. Schema:

| Table | Purpose |
|-------|---------|
| `audit_events` | All governance events (request, response, error, tool_call) |
| `cost_records` | Per-request cost breakdown with provider pricing |
| `decisions` | Governance verdicts with evidence chain |
| `agents` | Registered agent metadata and freeze state |
| `sessions` | Session lifecycle and cost accumulation |
| `baselines` | Computed P50/P95/P99 metrics per agent |

---

## Key Properties

- **Local-first** — All data stays on your machine
- **No signup** — No accounts, no cloud, no telemetry
- **Real-time** — Live updates as requests flow through observe()
- **Deterministic** — Dashboard reflects exact governance state, no approximations
- **Lightweight** — SQLite storage, minimal resource usage
- **Apache 2.0** — Fully open source

---

## Documentation

- [Dashboard Guide](https://docs.tealtiger.ai/dashboard)
- [Configuration](https://docs.tealtiger.ai/dashboard/configuration)
- [Custom Panels](https://docs.tealtiger.ai/dashboard/custom-panels)
- [Data Export](https://docs.tealtiger.ai/dashboard/export)

---

## License

Apache 2.0 — [LICENSE](https://github.com/agentguard-ai/tealtiger/blob/main/LICENSE)
