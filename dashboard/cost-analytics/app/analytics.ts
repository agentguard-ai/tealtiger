import { AGENTS, AGENT_BUDGETS } from './data';
import type {
  AgentId,
  AnomalyPoint,
  BudgetUtilization,
  CostEvent,
  DateRange,
  ExpensiveCall,
  Granularity,
  ProviderCost,
  TimelineRow,
  ToolCost,
} from './types';

export function filterByDateRange(events: CostEvent[], range: DateRange): CostEvent[] {
  const from = range.from ? Date.parse(`${range.from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
  const to = range.to ? Date.parse(`${range.to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  return events.filter((event) => {
    const timestamp = Date.parse(event.timestamp);
    return timestamp >= from && timestamp <= to;
  });
}

export function buildTimeline(events: CostEvent[], granularity: Granularity): TimelineRow[] {
  const buckets = new Map<string, TimelineRow>();

  for (const event of events) {
    const bucketKey = bucketFor(event.timestamp, granularity);
    const row = buckets.get(bucketKey) ?? createTimelineRow(bucketKey, granularity);
    row[event.agent] = roundCurrency(Number(row[event.agent] ?? 0) + event.costUsd);
    row.total = roundCurrency(row.total + event.costUsd);
    buckets.set(bucketKey, row);
  }

  return [...buckets.values()].sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));
}

export function calculateBudgetUtilization(events: CostEvent[]): BudgetUtilization[] {
  const totals = sumBy(events, (event) => event.agent);
  return AGENTS.map((agent) => {
    const costUsd = totals.get(agent) ?? 0;
    const budgetUsd = AGENT_BUDGETS[agent];
    return {
      agent,
      budgetUsd,
      costUsd,
      utilization: budgetUsd === 0 ? 0 : costUsd / budgetUsd,
    };
  });
}

export function calculateProviderSplit(events: CostEvent[]): ProviderCost[] {
  return [...sumBy(events, (event) => event.provider)]
    .map(([provider, costUsd]) => ({ provider, costUsd }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

export function calculateToolRanking(events: CostEvent[], limit = 10): ToolCost[] {
  const totals = new Map<string, { costUsd: number; calls: number }>();
  for (const event of events) {
    const current = totals.get(event.tool) ?? { costUsd: 0, calls: 0 };
    current.costUsd += event.costUsd;
    current.calls += 1;
    totals.set(event.tool, current);
  }

  return [...totals.entries()]
    .map(([tool, value]) => ({
      tool,
      calls: value.calls,
      costUsd: roundCurrency(value.costUsd),
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, limit);
}

export function calculateExpensiveCalls(events: CostEvent[], limit = 5): ExpensiveCall[] {
  return [...events]
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      agent: event.agent,
      tool: event.tool,
      provider: event.provider,
      costUsd: event.costUsd,
    }));
}

export function calculateAnomalies(timeline: TimelineRow[]): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];

  for (const agent of AGENTS) {
    const values = timeline.map((row) => Number(row[agent] ?? 0)).filter((value) => value > 0);
    const threshold = percentile(values, 0.95);
    for (const row of timeline) {
      const costUsd = Number(row[agent] ?? 0);
      if (threshold > 0 && costUsd > threshold) {
        anomalies.push({
          bucketKey: row.bucketKey,
          label: row.label,
          agent,
          costUsd,
          threshold,
        });
      }
    }
  }

  return anomalies;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function createTimelineRow(bucketKey: string, granularity: Granularity): TimelineRow {
  const row: TimelineRow = {
    bucketKey,
    label: labelForBucket(bucketKey, granularity),
    total: 0,
  };
  for (const agent of AGENTS) {
    row[agent] = 0;
  }
  return row;
}

function bucketFor(timestamp: string, granularity: Granularity): string {
  const date = new Date(timestamp);
  if (granularity === 'hourly') {
    return date.toISOString().slice(0, 13);
  }

  if (granularity === 'weekly') {
    const week = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = week.getUTCDay() || 7;
    week.setUTCDate(week.getUTCDate() - day + 1);
    return week.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function labelForBucket(bucketKey: string, granularity: Granularity): string {
  if (granularity === 'hourly') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
    }).format(new Date(`${bucketKey}:00:00.000Z`));
  }

  if (granularity === 'weekly') {
    return `Week of ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
    }).format(new Date(`${bucketKey}T00:00:00.000Z`))}`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
  }).format(new Date(`${bucketKey}T00:00:00.000Z`));
}

function sumBy<Key extends string>(events: CostEvent[], getKey: (event: CostEvent) => Key): Map<Key, number> {
  const totals = new Map<Key, number>();
  for (const event of events) {
    const key = getKey(event);
    totals.set(key, roundCurrency((totals.get(key) ?? 0) + event.costUsd));
  }
  return totals;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}
