---
title: "Costs Panel"
description: "Monitor cost velocity, budget exhaustion forecasts, and per-agent cost attribution in real-time."
---

# Costs Panel

The Costs panel provides real-time visibility into LLM spend across all governed agents. Detect runaway spending, forecast budget exhaustion, and identify optimization opportunities.

---

## Cost Velocity Chart

The primary widget shows current burn rate (USD/minute) with a real-time sparkline:

```
┌─────────────────────────────────────────────────┐
│ 🔥 Burn Rate: $0.42/min                        │
│                                                  │
│  $0.50 ─ ─ ─ ─ ─ ─ ─ ─ threshold ─ ─ ─ ─ ─   │
│         ╭─╮                                      │
│  $0.25 ─╯  ╰──╮    ╭──╮                        │
│              ╰──╯  ╰──╭──╮                      │
│  $0.00 ─────────────────╰────────────────       │
│         -60m    -45m    -30m    -15m    now      │
└─────────────────────────────────────────────────┘
```

### Features

- **Updated every 5 seconds** via WebSocket
- **Velocity threshold line** shown as a horizontal reference
- **Configurable time windows**: 1 hour, 6 hours, 24 hours
- **Alert state**: When burn rate exceeds the configured threshold, the widget turns red with a pulsing border

### Velocity Alert State

When a `COST_VELOCITY_ALERT` fires:

```
⚠️ VELOCITY ALERT — Current: $0.52/min | Threshold: $0.50/min
   Action: throttle (backoff: 4s)
```

Shows:
- Current rate vs configured threshold
- Active throttle status (if action is "throttle")
- Which agents are contributing most to the velocity

---

## Budget Exhaustion Forecast

A countdown widget showing when budgets will be exhausted at current spend rate:

```
┌─────────────────────────────────────────────────┐
│ 📊 Monthly Budget                               │
│                                                  │
│  ████████████████░░░░░░░  72% consumed          │
│                                                  │
│  Remaining: $280.00 of $1000.00                 │
│  Exhaustion: June 23, 2026 (8 days)             │
│  Burn rate: $35.00/day                          │
└─────────────────────────────────────────────────┘
```

### Gauge Color Coding

| Consumption | Color | Meaning |
|-------------|-------|---------|
| 0–79% | Green | Normal spend |
| 80–94% | Amber | Approaching limit |
| 95–100% | Red | Critical — budget nearly exhausted |

### Forecast Projection

A line chart showing:
- **Solid line**: Actual cumulative spend over time
- **Dashed line**: Linear budget allocation (expected spend)
- **Projected line**: Extrapolation showing when the lines cross (exhaustion point)

### Budget Scopes

Toggle between views:
- **Session**: Current session budget
- **Daily**: Today's budget
- **Monthly**: Monthly budget

---

## Per-Agent Cost Attribution

A breakdown table showing which agents are responsible for spend:

| Agent ID | Role | Cost (24h) | % of Total | Requests | Avg Cost/Req |
|----------|------|-----------|-----------|----------|--------------|
| research-agent-01 | researcher | $12.40 | 42% | 1,234 | $0.010 |
| coder-agent-01 | coder | $8.70 | 29% | 456 | $0.019 |
| writer-agent-01 | writer | $5.20 | 17% | 2,100 | $0.002 |
| reviewer-agent-01 | reviewer | $3.50 | 12% | 890 | $0.004 |

### Breakdown Views

- **By Agent**: Individual agent costs
- **By Role**: Aggregated by role
- **By Model**: Which models cost the most
- **By Provider**: Cost per provider (OpenAI, Anthropic, etc.)
- **By Time**: Hourly/daily cost breakdown

---

## Cost Optimization Suggestions

An actionable panel showing where money can be saved:

```
┌─────────────────────────────────────────────────┐
│ 💡 Potential Savings: $145/month                │
├─────────────────────────────────────────────────┤
│                                                  │
│ 📦 Batch API Eligible          $65/mo savings   │
│    892 requests could use batch API (50% off)   │
│                                                  │
│ 🗄️ Prompt Cache Potential      $48/mo savings   │
│    67% of requests share prefix patterns        │
│                                                  │
│ ⬇️ Model Downgrade             $32/mo savings   │
│    234 requests used gpt-4o where gpt-4o-mini   │
│    would suffice (< 200 input tokens)           │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Categories

| Category | What It Detects | Potential Savings |
|----------|----------------|-------------------|
| Batch API | Requests with latency tolerance > 24h | Up to 50% per request |
| Prompt Caching | Repeated prefix patterns across requests | Up to 50% on cached tokens |
| Model Downgrade | Simple requests using expensive models | Up to 95% (gpt-4o → gpt-4o-mini) |

### Context Bloat Alert

Flags requests where input tokens exceed 50% of the model's context window:

```
⚠️ Context Bloat: 12 requests used > 64k tokens (gpt-4o)
   Average context cost: $0.32 | Average completion cost: $0.08
   Context is 4× more expensive than the actual completion
```

### Refresh Cadence

Optimization suggestions update **daily** based on the rolling 7-day usage window. This avoids performance impact from constant recomputation.

---

## Retry Chain Costs

A table of the most expensive retry chains:

| Correlation ID | Retries | Total Cost | Final Outcome | Cap Hit? |
|----------------|---------|-----------|---------------|----------|
| `abc-123` | 5 | $0.42 | DENY | Yes (at $0.50) |
| `def-456` | 3 | $0.28 | ALLOW | No |
| `ghi-789` | 4 | $0.35 | DEFER_TO_TRUSTED | No |

Shows:
- Top 20 most expensive retry chains
- Whether the retry cost cap terminated the chain
- Final outcome (did the retry succeed?)

---

## Model Routing Log

When cost-aware model routing is configured, a log shows routing decisions:

| Time | Original Model | Routed To | Estimated Savings | Reason |
|------|---------------|-----------|-------------------|--------|
| 14:32 | gpt-4o | gpt-4o-mini | $0.008 | Cost ceiling ($0.01) |
| 14:28 | claude-3-opus | claude-3-haiku | $0.012 | Cost ceiling ($0.01) |

Includes:
- Total savings from routing this month
- Routing frequency (% of requests that hit the ceiling)
- Warning if routing frequency > 50% ("Consider adjusting your ceiling")

---

## Real-Time Updates

All cost widgets update in real-time via WebSocket:

- Burn rate: Every 5 seconds
- Budget gauge: After each request
- Agent attribution: Every 30 seconds
- Optimization suggestions: Daily
- Velocity alerts: Instant (push)
