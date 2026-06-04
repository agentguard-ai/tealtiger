# Cost Analytics Dashboard

React dashboard view for TealTiger agent cost analytics and budget visualization.

## Run locally

```sh
npm run dashboard:cost:dev
```

## Build

```sh
npm run dashboard:cost:build
```

## Included views

- Cost timeline with hourly, daily, and weekly grouping
- p95 anomaly markers on the timeline
- Per-agent budget gauges with red state above 90% utilization
- Provider cost split donut chart
- Top 10 tool cost ranking
- Top 5 most expensive tool calls
- CSV export for raw events, timeline, budgets, providers, tools, and top calls
