import { type ReactElement, useMemo, useState } from 'react';

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
    <main className="dashboard-shell">
      <section className="security-panel" aria-labelledby="security-events-heading">
        <header className="security-header">
          <div>
            <p className="eyebrow">TealTiger dashboard</p>
            <h1 id="security-events-heading">Security events</h1>
            <p className="subhead">Monitor PII, secrets, prompt injection, policy violations, and budget alerts.</p>
          </div>
          <div className="summary-grid" aria-label="Security event summary">
            <SummaryCard label="Filtered events" value={filteredEvents.length.toString()} />
            <SummaryCard label="Critical open" value={filteredEvents.filter((event) => event.severity === 'critical' && event.state === 'open').length.toString()} />
            <SummaryCard label="Investigating" value={filteredEvents.filter((event) => event.state === 'investigating').length.toString()} />
          </div>
        </header>

        <Filters filters={filters} agents={agents} onUpdate={updateFilter} />

        <div className="content-grid">
          <section className="chart-panel" aria-labelledby="severity-chart-heading">
            <h2 id="severity-chart-heading">Severity distribution</h2>
            <SeverityDistribution buckets={severityBuckets} />
          </section>

          <section className="event-list-panel" aria-label="Security event list">
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
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
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
    <form className="filters" aria-label="Security event filters">
      <label>
        Severity
        <select value={filters.severity} onChange={(event) => onUpdate('severity', event.target.value as SecurityEventFilters['severity'])}>
          {severityOptions.map((severity) => (
            <option key={severity} value={severity}>
              {severity === 'all' ? 'All severities' : severityLabels[severity]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Event type
        <select value={filters.type} onChange={(event) => onUpdate('type', event.target.value as SecurityEventFilters['type'])}>
          {eventTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type === 'all' ? 'All event types' : eventTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Agent
        <select value={filters.agent} onChange={(event) => onUpdate('agent', event.target.value)}>
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </label>

      <label>
        Time range
        <select value={filters.timeRange} onChange={(event) => onUpdate('timeRange', event.target.value as SecurityEventFilters['timeRange'])}>
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </label>

      <label className="search-label">
        Search
        <input
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
    return <p className="muted">No severity data matches the current filters.</p>;
  }

  const max = Math.max(...buckets.map((bucket) => bucket.critical + bucket.high + bucket.medium + bucket.low + bucket.info), 1);

  return (
    <div className="severity-chart">
      {buckets.map((bucket) => {
        const total = bucket.critical + bucket.high + bucket.medium + bucket.low + bucket.info;
        return (
          <div className="chart-row" key={bucket.date}>
            <span className="chart-date">{bucket.date}</span>
            <div className="chart-bar" aria-label={`${bucket.date}: ${total} security events`}>
              {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((severity) => (
                <span
                  key={severity}
                  className={`bar-segment severity-${severity}`}
                  style={{ width: `${(bucket[severity] / max) * 100}%` }}
                  title={`${severityLabels[severity]}: ${bucket[severity]}`}
                />
              ))}
            </div>
            <span className="chart-total">{total}</span>
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
    <article className={`event-card severity-border-${event.severity}`}>
      <button className="event-main" type="button" onClick={onToggle} aria-expanded={isExpanded}>
        <span className={`severity-badge severity-${event.severity}`}>{severityLabels[event.severity]}</span>
        <span>
          <strong>{eventTypeLabels[event.type]}</strong>
          <small>{new Date(event.timestamp).toLocaleString()}</small>
        </span>
        <span>
          <strong>{event.agent}</strong>
          <small>{event.tool}</small>
        </span>
        <span className="reason">{event.reason}</span>
        <span className="asi-tag">{event.owaspAsi}</span>
        <span className={`state-pill state-${event.state}`}>{stateLabels[event.state]}</span>
      </button>

      {isExpanded ? (
        <div className="event-details">
          <div className="action-row" aria-label={`Workflow actions for ${event.id}`}>
            <button type="button" onClick={() => onStateChange('acknowledged')}>Acknowledge</button>
            <button type="button" onClick={() => onStateChange('investigating')}>Investigate</button>
            <button type="button" onClick={() => onStateChange('dismissed')}>Dismiss</button>
          </div>
          <div>
            <h3>TEEC receipt</h3>
            <pre>{JSON.stringify(event.receipt, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function EmptyState({ onReset }: { onReset: () => void }): ReactElement {
  return (
    <div className="empty-state">
      <h2>No security events match these filters</h2>
      <p>Adjust severity, type, agent, time range, or search to broaden the current view.</p>
      <button type="button" onClick={onReset}>Reset filters</button>
    </div>
  );
}
