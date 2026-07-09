---
title: "Dashboard — Getting Started"
description: "Set up the TealTiger Governance Dashboard locally in under 5 minutes."
---

# Dashboard — Getting Started

Get the governance dashboard running locally. Prerequisites to deployment: about 5 minutes.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Required for both API and frontend |
| npm | 9+ | Included with Node.js 18+ |

No Docker, no cloud accounts, no external services required.

---

## Install

### Option 1: From the TealTiger Monorepo

If you already have the TealTiger repository cloned:

```bash
cd your-tealtiger-repo

# Install API dependencies
cd dashboard/api
npm install

# Install frontend dependencies
cd ../web
npm install
```

### Option 2: Standalone Clone

```bash
git clone https://github.com/agentguard-ai/TealTiger.git
cd TealTiger

# Install API
cd dashboard/api
npm install

# Install frontend
cd ../web
npm install
```

---

## Database Setup

The dashboard uses SQLite — no database server needed. The database file is created automatically on first API startup.

**Location:** `dashboard/api/dashboard.db`

### Seed Demo Data (Optional)

To populate the dashboard with sample data for evaluation:

```bash
cd dashboard/api
npx tsx src/seed-demo.ts
```

This creates:

- 5 sample agents (researcher, writer, reviewer, coder, operator)
- 200+ governance decisions across the agents
- Cost records with realistic token counts
- Module evaluations with various findings
- Sample TEEC evidence envelopes

---

## Run

Start both the API and frontend in separate terminal windows:

### Terminal 1: API Server

```bash
cd dashboard/api
npm run dev
```

The API starts at **http://localhost:3001** with:

- REST endpoints at `/api/v1/`
- WebSocket for real-time updates
- SQLite database at `./dashboard.db`

### Terminal 2: Frontend

```bash
cd dashboard/web
npm run dev
```

The frontend starts at **http://localhost:3000**.

---

## Access

Open your browser to:

```
http://localhost:3000
```

You'll see the Overview panel with:

- Active agents count
- Total cost (24h)
- Decision breakdown
- Recent event stream

If you seeded demo data, these panels will be populated. Otherwise, they'll show zero state until your application starts writing governance events.

---

## Connecting Your Application

The dashboard reads from the same SQLite database that TealTiger writes to. To connect your application:

### 1. Configure TealTiger to write to the dashboard DB

```typescript
import { observe } from "tealtiger";
import OpenAI from "openai";

const client = observe(new OpenAI(), {
  agentId: "my-app-agent",
  audit: {
    output: "sqlite",
    path: "./dashboard/api/dashboard.db"  // Same DB the dashboard reads
  }
});
```

```python
from tealtiger import observe
from openai import OpenAI

client = observe(
    OpenAI(),
    agent_id="my-app-agent",
    audit={"output": "sqlite", "path": "./dashboard/api/dashboard.db"}
)
```

### 2. Events appear in real-time

Once your application makes requests through the governed client, events appear in the dashboard via WebSocket — no refresh needed.

---

## Configuration

### API Configuration

Create `dashboard/api/.env` (optional):

```env
# Server port (default: 3001)
PORT=3001

# Database path (default: ./dashboard.db)
DATABASE_PATH=./dashboard.db

# CORS origin (default: http://localhost:3000)
CORS_ORIGIN=http://localhost:3000
```

### Frontend Configuration

Create `dashboard/web/.env.local` (optional):

```env
# API URL (default: http://localhost:3001)
NEXT_PUBLIC_API_URL=http://localhost:3001

# WebSocket URL (default: ws://localhost:3001)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Production Deployment

For production use, build and serve statically:

```bash
# Build API
cd dashboard/api
npm run build
node dist/server.js

# Build frontend
cd dashboard/web
npm run build
npm run start
```

Or use a process manager like PM2:

```bash
pm2 start dashboard/api/dist/server.js --name "tealtiger-api"
pm2 start "npm run start" --cwd dashboard/web --name "tealtiger-web"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | Change port in `dashboard/web/.env.local` or stop the conflicting process |
| Port 3001 already in use | Change `PORT` in `dashboard/api/.env` |
| Database locked | Ensure only one API instance is running |
| No data showing | Check that your app writes to the same database path the API reads |
| WebSocket disconnects | Check that CORS is configured correctly for your frontend origin |
| Seed script fails | Ensure you're running from the `dashboard/api` directory |

---

## Next Steps

- [Dashboard Overview](/dashboard) — What each panel does
- [Evidence Viewer](/dashboard/evidence-viewer) — Deep-dive into governance decisions
- [Audit Trail](/dashboard/audit-trail) — Chronological event log
- [Agent Matrix](/dashboard/agents) — Monitor your agent fleet
