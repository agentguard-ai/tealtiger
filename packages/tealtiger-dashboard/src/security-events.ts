export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityEventType =
  | 'pii_detected'
  | 'secret_leaked'
  | 'prompt_injection_blocked'
  | 'tool_denied'
  | 'budget_exceeded';
export type SecurityEventState = 'open' | 'acknowledged' | 'dismissed' | 'investigating';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  agent: string;
  tool: string;
  type: SecurityEventType;
  severity: Severity;
  reason: string;
  state: SecurityEventState;
  owaspAsi: string;
  receipt: Record<string, unknown>;
}

export interface SecurityEventFilters {
  severity: Severity | 'all';
  type: SecurityEventType | 'all';
  agent: string;
  timeRange: 'all' | '24h' | '7d';
  search: string;
}

export interface SeverityBucket {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export const severityLabels: Record<Severity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO',
};

export const eventTypeLabels: Record<SecurityEventType, string> = {
  pii_detected: 'PII detected',
  secret_leaked: 'Secret leaked',
  prompt_injection_blocked: 'Prompt injection blocked',
  tool_denied: 'Tool denied',
  budget_exceeded: 'Budget exceeded',
};

export const sampleSecurityEvents: SecurityEvent[] = [
  {
    id: 'sec-001',
    timestamp: '2026-05-30T14:21:11.000Z',
    agent: 'support-agent',
    tool: 'crm.lookup_customer',
    type: 'pii_detected',
    severity: 'medium',
    reason: 'PII detected in support-agent prompt before CRM lookup.',
    state: 'open',
    owaspAsi: 'ASI-04',
    receipt: {
      decision: 'REQUIRE_APPROVAL',
      policy: 'pii-human-review',
      redactions: ['email', 'phone'],
      latency_ms: 2.4,
    },
  },
  {
    id: 'sec-002',
    timestamp: '2026-05-30T13:47:02.000Z',
    agent: 'finance-agent',
    tool: 'stripe.refund',
    type: 'budget_exceeded',
    severity: 'high',
    reason: 'Refund request exceeded agent daily budget.',
    state: 'investigating',
    owaspAsi: 'ASI-08',
    receipt: {
      decision: 'DENY',
      policy: 'agent-budget-limit',
      budget_usd: 200,
      attempted_usd: 350,
      latency_ms: 1.8,
    },
  },
  {
    id: 'sec-003',
    timestamp: '2026-05-30T12:10:40.000Z',
    agent: 'code-agent',
    tool: 'github.create_issue',
    type: 'prompt_injection_blocked',
    severity: 'critical',
    reason: 'Prompt injection attempted to override repository policy checks.',
    state: 'open',
    owaspAsi: 'ASI-01',
    receipt: {
      decision: 'DENY',
      policy: 'prompt-injection-denylist',
      matched_patterns: ['ignore previous policy', 'exfiltrate token'],
      latency_ms: 3.1,
    },
  },
  {
    id: 'sec-004',
    timestamp: '2026-05-29T21:35:10.000Z',
    agent: 'ops-agent',
    tool: 'secrets.read',
    type: 'secret_leaked',
    severity: 'critical',
    reason: 'Secret-like value detected in tool arguments.',
    state: 'acknowledged',
    owaspAsi: 'ASI-02',
    receipt: {
      decision: 'DENY',
      policy: 'secrets-never-log',
      finding: 'api_key_pattern',
      latency_ms: 2.9,
    },
  },
  {
    id: 'sec-005',
    timestamp: '2026-05-28T16:08:22.000Z',
    agent: 'research-agent',
    tool: 'web.fetch',
    type: 'tool_denied',
    severity: 'low',
    reason: 'Tool denied because requested domain is not in the approved list.',
    state: 'dismissed',
    owaspAsi: 'ASI-05',
    receipt: {
      decision: 'DENY',
      policy: 'domain-allowlist',
      domain: 'example-untrusted.test',
      latency_ms: 1.2,
    },
  },
  {
    id: 'sec-006',
    timestamp: '2026-05-27T10:18:00.000Z',
    agent: 'triage-agent',
    tool: 'ticket.update',
    type: 'tool_denied',
    severity: 'info',
    reason: 'Tool denied outside assigned support queue.',
    state: 'open',
    owaspAsi: 'ASI-09',
    receipt: {
      decision: 'DENY',
      policy: 'scoped-ticket-access',
      queue: 'enterprise',
      latency_ms: 1.5,
    },
  },
];

export function filterSecurityEvents(
  events: SecurityEvent[],
  filters: SecurityEventFilters,
  now = Date.now(),
): SecurityEvent[] {
  const search = filters.search.trim().toLowerCase();
  const cutoff = getCutoff(filters.timeRange, now);

  return events.filter((event) => {
    if (filters.severity !== 'all' && event.severity !== filters.severity) return false;
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.agent !== 'all' && event.agent !== filters.agent) return false;
    if (cutoff && Date.parse(event.timestamp) < cutoff) return false;
    if (search) {
      const haystack = [
        event.agent,
        event.tool,
        event.reason,
        event.owaspAsi,
        eventTypeLabels[event.type],
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function summarizeSeverityByDay(events: SecurityEvent[]): SeverityBucket[] {
  const buckets = new Map<string, SeverityBucket>();

  for (const event of events) {
    const date = event.timestamp.slice(0, 10);
    const bucket = buckets.get(date) ?? {
      date,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    bucket[event.severity] += 1;
    buckets.set(date, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getAgents(events: SecurityEvent[]): string[] {
  return [...new Set(events.map((event) => event.agent))].sort();
}

function getCutoff(timeRange: SecurityEventFilters['timeRange'], now: number): number | null {
  if (timeRange === '24h') return now - 24 * 60 * 60 * 1000;
  if (timeRange === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  return null;
}
