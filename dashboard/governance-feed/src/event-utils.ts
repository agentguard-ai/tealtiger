import type { Decision, EventFilters, FeedEvent, StreamMessage } from './types';

const DECISIONS: Decision[] = ['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL'];
export const LATENCY_BUCKETS = [
  { id: '0-1', label: '0-1ms', min: 0, max: 1 },
  { id: '1-2', label: '1-2ms', min: 1, max: 2 },
  { id: '2-5', label: '2-5ms', min: 2, max: 5 },
  { id: '5-10', label: '5-10ms', min: 5, max: 10 },
  { id: '10+', label: '10ms+', min: 10, max: Number.POSITIVE_INFINITY },
] as const;

export interface LatencyBucketCount {
  id: typeof LATENCY_BUCKETS[number]['id'];
  label: typeof LATENCY_BUCKETS[number]['label'];
  count: number;
}

export function normalizeEvent(message: StreamMessage): FeedEvent | null {
  if (message.type !== 'governance_event') {
    return null;
  }

  const receipt = objectRecord(message.data);
  const metadata = objectRecord(receipt.metadata);
  const decision = normalizeDecision(
    readString(receipt.decision)
      ?? readString(receipt.action)
      ?? readString(receipt.decision_action)
      ?? readString(metadata.decision),
  );

  return {
    id: message.id ?? readString(receipt.event_id) ?? `evt_${message.cursor ?? Date.now()}`,
    cursor: message.cursor ?? '',
    timestamp: normalizeTimestamp(message.timestamp ?? receipt.timestamp),
    agent: readString(receipt.agent_id)
      ?? readString(receipt.agentId)
      ?? readString(metadata.agent_id)
      ?? 'unknown-agent',
    tool: readString(receipt.tool)
      ?? readString(receipt.tool_name)
      ?? readString(receipt.action)
      ?? readString(metadata.tool)
      ?? 'unknown.tool',
    decision,
    reason: readString(receipt.reason)
      ?? readString(receipt.message)
      ?? readString(metadata.reason)
      ?? 'No decision reason provided',
    latencyMs: normalizeLatency(
      receipt.latency_ms
        ?? receipt.latencyMs
        ?? metadata.latency_ms
        ?? metadata.latencyMs,
    ),
    receipt,
  };
}

export function eventMatchesFilters(event: FeedEvent, filters: EventFilters): boolean {
  if (filters.agent && event.agent !== filters.agent) {
    return false;
  }

  if (filters.decision && event.decision !== filters.decision) {
    return false;
  }

  if (filters.tool && event.tool !== filters.tool) {
    return false;
  }

  if (filters.from && Date.parse(event.timestamp) < Date.parse(filters.from)) {
    return false;
  }

  if (filters.to && Date.parse(event.timestamp) > Date.parse(filters.to)) {
    return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query && !event.reason.toLowerCase().includes(query)) {
    return false;
  }

  return true;
}

export function uniqueValues(events: FeedEvent[], key: 'agent' | 'tool'): string[] {
  return [...new Set(events.map((event) => event[key]))].sort((a, b) => a.localeCompare(b));
}

export function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

export function formatLatency(latencyMs: number): string {
  return `${latencyMs.toFixed(latencyMs >= 10 ? 0 : 1)}ms`;
}

export function calculateLatencyBuckets(events: FeedEvent[]): LatencyBucketCount[] {
  const counts = new Map<string, number>(
    LATENCY_BUCKETS.map((bucket) => [bucket.id, 0]),
  );

  for (const event of events) {
    const bucket = LATENCY_BUCKETS.find(({ min, max }) => (
      event.latencyMs >= min && event.latencyMs < max
    ));
    if (bucket) {
      counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1);
    }
  }

  return LATENCY_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: counts.get(bucket.id) ?? 0,
  }));
}

export function decisionLabel(decision: Decision): string {
  return decision === 'REQUIRE_APPROVAL' ? 'REQUIRE APPROVAL' : decision;
}

function normalizeDecision(value: string | undefined): Decision {
  const normalized = value?.toUpperCase().replace(/[\s-]+/g, '_');
  return DECISIONS.includes(normalized as Decision) ? normalized as Decision : 'REVISE';
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeLatency(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
