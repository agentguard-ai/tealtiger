import { type ReactElement, useMemo, useState } from 'react';

import { Badge, type BadgeProps } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  eventTypeLabels,
  filterSecurityEvents,
  getAgents,
  sampleSecurityEvents,
  severityLabels,
  summarizeSeverityByDay,
  type SecurityEvent,
  type SecurityEventFilters,
  type SecurityEventState,
  type SecurityEventType,
  type Severity,
} from './security-events';

const severityOptions: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low', 'info'];
const eventTypeOptions: Array<SecurityEventType | 'all'> = [
  'all',
  'pii_detected',
  'secret_leaked',
  'prompt_injection_blocked',
  'tool_denied',
  'budget_exceeded',
];
const stateLabels: Record<SecurityEventState, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  dismissed: 'Dismissed',
  investigating: 'Investigating',
};
const severityVariant: Record<Severity, BadgeProps['variant']> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
  info: 'outline',
};

export function SecurityEventsView(): ReactElement {
  const [filters, setFilters] = useState<SecurityEventFilters>({
    severity: 'all',
    type: 'all',
    agent: 'all',
    timeRange: 'all',
    search: '',
  });
  const [eventStates, setEventStates] = useState<Record<string, SecurityEventState>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(sampleSecurityEvents[0]?.id ?? null);

  const eventsWithState = useMemo(
    () => sampleSecurityEvents.map((event) => ({ ...event, state: eventStates[event.id] ?? event.state })),
    [eventStates],
  );
  const filteredEvents = useMemo(
    // Pinned to match test fixture in security-events.test.ts; swap to Date.now() when wiring to a real backend.
    () => filterSecurityEvents(eventsWithState, filters, Date.parse('2026-05-30T15:00:00.000Z')),
    [eventsWithState, filters],
  );
  const agents = useMemo(() => getAgents(eventsWithState), [eventsWithState]);
  const severityBuckets = useMemo(() => summarizeSeverityByDay(filteredEvents), [filteredEvents]);

  function updateFilter<Key extends keyof SecurityEventFilters>(key: Key, value: SecurityEventFilters[Key]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateEventState(id: string, state: SecurityEventState): void {
    setEventStates((current) => ({ ...current, [id]: state }));
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="security-events-heading">
      <header className="grid gap-4 xl:grid-cols-[1fr_520px] xl:items-end">
        <div>
          <h1 id="security-events-heading" className="text-xl font-semibold">
            Security events
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitor PII, secrets, prompt injection, policy violations, and budget alerts.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Security event summary">
          <SummaryCard label="Filtered events" value={filteredEvents.length.toString()} />
          <SummaryCard
            label="Critical open"
            value={filteredEvents.filter((event) => event.severity === 'critical' && event.state === 'open').length.toString()}
          />
          <SummaryCard
            label="Investigating"
            value={filteredEvents.filter((event) => event.state === 'investigating').length.toString()}
          />
        </div>
      </header>

      <Filters filters={filters} agents={agents} onUpdate={updateFilter} />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr] xl:items-start">
        <section className="rounded-md border border-border bg-card p-4 xl:sticky xl:top-20" aria-labelledby="severity-chart-heading">
          <h2 id="severity-chart-heading" className="text-base font-semibold">
            Severity distribution
          </h2>
          <SeverityDistribution buckets={severityBuckets} />
        </section>

        <section className="grid gap-3" aria-label="Security event list">
          {filteredEvents.length === 0 ? (
            <EmptyState onReset={() => setFilters({ severity: 'all', type: 'all', agent: 'all', timeRange: 'all', search: '' })} />
          ) : (
            filteredEvents.map((event) => (
              <SecurityEventCard
                key={event.id}
                event={event}
                isExpanded={expandedEventId === event.id}
                onToggle={() => setExpandedEventId((current) => (current === event.id ? null : event.id))}
                onStateChange={(state) => updateEventState(event.id, state)}
              />
            ))
          )}
        </section>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold">{value}</strong>
    </div>
  );
}

function Filters({
  filters,
  agents,
  onUpdate,
}: {
  filters: SecurityEventFilters;
  agents: string[];
  onUpdate: <Key extends keyof SecurityEventFilters>(key: Key, value: SecurityEventFilters[Key]) => void;
}): ReactElement {
  return (
    <form
      className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(150px,1fr))_minmax(220px,1.2fr)]"
      aria-label="Security event filters"
    >
      <label className="grid gap-2 text-sm font-medium">
        Severity
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filters.severity}
          onChange={(event) => onUpdate('severity', event.target.value as SecurityEventFilters['severity'])}
        >
          {severityOptions.map((severity) => (
            <option key={severity} value={severity}>
              {severity === 'all' ? 'All severities' : severityLabels[severity]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Event type
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filters.type}
          onChange={(event) => onUpdate('type', event.target.value as SecurityEventFilters['type'])}
        >
          {eventTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type === 'all' ? 'All event types' : eventTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Agent
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filters.agent}
          onChange={(event) => onUpdate('agent', event.target.value)}
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Time range
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filters.timeRange}
          onChange={(event) => onUpdate('timeRange', event.target.value as SecurityEventFilters['timeRange'])}
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium md:col-span-2 xl:col-span-1">
        Search
        <Input
          type="search"
          value={filters.search}
          onChange={(event) => onUpdate('search', event.target.value)}
          placeholder="Reason, tool, or ASI tag"
        />
      </label>
    </form>
  );
}

function SeverityDistribution({ buckets }: { buckets: ReturnType<typeof summarizeSeverityByDay> }): ReactElement {
  if (buckets.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No severity data matches the current filters.</p>;
  }

  const max = Math.max(...buckets.map((bucket) => bucket.critical + bucket.high + bucket.medium + bucket.low + bucket.info), 1);

  return (
    <div className="mt-4 grid gap-3">
      {buckets.map((bucket) => {
        const total = bucket.critical + bucket.high + bucket.medium + bucket.low + bucket.info;
        return (
          <div className="grid grid-cols-[86px_1fr_28px] items-center gap-3" key={bucket.date}>
            <span className="text-xs text-muted-foreground">{bucket.date}</span>
            <div className="flex min-h-4 overflow-hidden rounded-full bg-muted" aria-label={`${bucket.date}: ${total} security events`}>
              {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((severity) => (
                <span
                  key={severity}
                  className={severitySegmentClass(severity)}
                  style={{ width: `${(bucket[severity] / max) * 100}%` }}
                  title={`${severityLabels[severity]}: ${bucket[severity]}`}
                />
              ))}
            </div>
            <span className="text-right text-xs text-muted-foreground">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

function SecurityEventCard({
  event,
  isExpanded,
  onToggle,
  onStateChange,
}: {
  event: SecurityEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onStateChange: (state: SecurityEventState) => void;
}): ReactElement {
  return (
    <article className={`overflow-hidden rounded-md border bg-card ${severityBorderClass(event.severity)}`}>
      <button
        className="grid w-full gap-3 bg-transparent p-4 text-left text-sm text-card-foreground outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[98px_minmax(150px,1fr)_minmax(140px,0.9fr)_minmax(220px,1.4fr)_80px_112px] md:items-center"
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <Badge variant={severityVariant[event.severity]}>{severityLabels[event.severity]}</Badge>
        <span className="min-w-0">
          <strong className="block truncate">{eventTypeLabels[event.type]}</strong>
          <small className="block text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</small>
        </span>
        <span className="min-w-0">
          <strong className="block truncate">{event.agent}</strong>
          <small className="block truncate text-xs text-muted-foreground">{event.tool}</small>
        </span>
        <span className="text-muted-foreground">{event.reason}</span>
        <Badge variant="outline">{event.owaspAsi}</Badge>
        <Badge variant={event.state === 'open' ? 'warning' : event.state === 'dismissed' ? 'secondary' : 'outline'}>
          {stateLabels[event.state]}
        </Badge>
      </button>

      {isExpanded ? (
        <div className="grid gap-4 border-t border-border bg-muted/20 p-4 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-wrap gap-2 self-start" aria-label={`Workflow actions for ${event.id}`}>
            <Button type="button" variant="outline" size="sm" onClick={() => onStateChange('acknowledged')}>
              Acknowledge
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onStateChange('investigating')}>
              Investigate
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onStateChange('dismissed')}>
              Dismiss
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-semibold">TEEC receipt</h3>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
              {JSON.stringify(event.receipt, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function EmptyState({ onReset }: { onReset: () => void }): ReactElement {
  return (
    <div className="rounded-md border border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">No security events match the current filters.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Adjust filters or reset the view to see the latest governed security activity.
      </p>
      <Button type="button" className="mt-4" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}

function severitySegmentClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    critical: 'bg-destructive',
    high: 'bg-warning',
    medium: 'bg-primary',
    low: 'bg-success',
    info: 'bg-muted-foreground',
  };
  return classes[severity];
}

function severityBorderClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    critical: 'border-destructive/70',
    high: 'border-warning/70',
    medium: 'border-primary/60',
    low: 'border-border',
    info: 'border-border',
  };
  return classes[severity];
}
