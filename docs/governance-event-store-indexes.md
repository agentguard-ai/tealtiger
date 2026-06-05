# Governance Event Store Index Strategy

This document explains the schema in `api/governance-events/schema.sql` and the
matching Drizzle definitions in `api/governance-events/schema.ts`.

## Query shape

Dashboard queries are expected to filter by time range first, then narrow by
agent, decision, tool, provider, event type, or compliance framework. The schema
therefore stores timestamps as integer epoch milliseconds so SQLite and
PostgreSQL can both sort and range-filter without database-specific date
functions.

## Core indexes

- `idx_events_timestamp` supports global event timelines.
- `idx_events_agent_timestamp` supports per-agent dashboards and drilldowns.
- `idx_events_decision_timestamp` supports allow, deny, warn, monitor, and error
  breakdowns by time.
- `idx_events_tool_timestamp` and `idx_events_tool_name_timestamp` support
  tool-level review and incident response. `tool` is retained for the existing
  API shape; `tool_name` is available for dashboard and migration consumers that
  prefer the explicit name.
- `idx_cost_records_agent_timestamp` and `idx_cost_records_timestamp` support
  cost charts over time.
- `idx_security_events_type_timestamp` and
  `idx_security_events_decision_timestamp` support PII, secret, injection, and
  moderation views.

The hourly and daily rollup tables use unique scope indexes so aggregation jobs
can upsert one row per agent/hour or agent/day/provider/model. PostgreSQL can
reuse the same logical keys with `ON CONFLICT`.

## Append-only events

`governance_events` is the receipt ledger and should be insert-only. The SQLite
DDL adds `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort writes. In a
PostgreSQL migration, use equivalent triggers or restrict application roles so
only inserts are permitted on the ledger table.

Derived tables such as `agent_stats_hourly`, `cost_summary_daily`, and
`compliance_status` are intentionally mutable because they are rollups or current
state views.

## SQLite to PostgreSQL mapping

| SQLite column type | PostgreSQL target | Notes |
| --- | --- | --- |
| `TEXT` | `text` or `uuid` | Keep text IDs unless UUID validation is required. |
| `INTEGER` timestamp | `bigint` or `timestamptz` | Epoch milliseconds migrate cleanly to `bigint`. |
| `REAL` cost | `numeric(18, 8)` | Prefer `numeric` in PostgreSQL for billing precision. |
| `TEXT` JSON payloads | `jsonb` | Validate JSON at the application boundary in SQLite. |
| `INTEGER` boolean | `boolean` | Convert `0/1` values during migration. |

## Storage estimate

The estimate below assumes:

- average `governance_events` row, including receipt JSON: 2.5 KB
- optional `cost_records` row: 0.7 KB
- optional `security_events` row: 1.0 KB
- index overhead: roughly 60% of raw table size
- 30-day month

| Events/day | Raw GB/month | Indexed GB/month | Notes |
| ---: | ---: | ---: | --- |
| 10,000 | 1.3 | 2.1 | Small team or staging workload. |
| 100,000 | 12.6 | 20.2 | Production app with moderate agent traffic. |
| 1,000,000 | 125.9 | 201.4 | Requires retention, archival, and partition planning. |
| 10,000,000 | 1,258.9 | 2,014.2 | PostgreSQL partitioning or warehouse export recommended. |

For SQLite Phase 1, keep retention short or archive old receipt payloads when
daily volume is above roughly 100,000 events/day. PostgreSQL Phase 2 should add
monthly or weekly partitions for `governance_events`, `cost_records`, and
`security_events` once sustained traffic reaches the million-events/day range.
