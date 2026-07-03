# TealTiger Dashboards

TealTiger currently includes three dashboard views for local governance
readiness checks.

| Dashboard | Purpose | Dev command | Build command |
| --- | --- | --- | --- |
| Governance event feed | Watches governance decisions from the local event stream. | `npm run dashboard:dev` | `npm run dashboard:build` |
| Cost analytics | Reviews agent spend, budgets, provider split, and expensive tool calls. | `npm run dashboard:cost:dev` | `npm run dashboard:cost:build` |
| Compliance status | Reviews framework coverage, evidence status, and compliance gaps. | `npm run dashboard:compliance:dev` | `npm run dashboard:compliance:build` |

The governance event feed is also available through the local CLI launcher:

```sh
npx tealtiger dashboard
```

That command serves the event-feed dashboard with a local governance event
store. The cost analytics and compliance status dashboards are standalone Vite
views intended for local release-readiness and documentation capture.
