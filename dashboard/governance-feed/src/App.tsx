import {
  Activity,
  ArrowDownToLine,
  Braces,
  Clock3,
  Filter,
  Pause,
  Play,
  Search,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';

import {
  decisionLabel,
  eventMatchesFilters,
  formatLatency,
  formatTime,
  uniqueValues,
} from './event-utils';
import { useGovernanceSocket } from './useGovernanceSocket';
import type { EventFilters, FeedEvent, StreamState } from './types';

const DEFAULT_WS_URL = import.meta.env.VITE_GOVERNANCE_WS_URL ?? 'ws://127.0.0.1:8787/ws/events';
const MAX_EVENTS = 7_500;
const MAX_PENDING_EVENTS = 5_000;

const EMPTY_FILTERS: EventFilters = {
  agent: '',
  decision: '',
  tool: '',
  from: '',
  to: '',
  search: '',
};

export default function App(): ReactElement {
  const listRef = useRef<FixedSizeList<RowData> | null>(null);
  const pausedRef = useRef(false);
  const incomingBufferRef = useRef<FeedEvent[]>([]);
  const flushFrameRef = useRef<number | null>(null);
  const arrivalTimesRef = useRef<number[]>([]);

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<FeedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [eventsPerSecond, setEventsPerSecond] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [draftUrl, setDraftUrl] = useState(DEFAULT_WS_URL);
  const [activeUrl, setActiveUrl] = useState(DEFAULT_WS_URL);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const flushIncoming = useCallback(() => {
    flushFrameRef.current = null;
    const batch = incomingBufferRef.current.splice(0);
    if (batch.length === 0) {
      return;
    }

    const now = performance.now();
    arrivalTimesRef.current.push(...batch.map(() => now));
    arrivalTimesRef.current = arrivalTimesRef.current.filter((time) => now - time <= 1000);
    setEventsPerSecond(arrivalTimesRef.current.length);

    const newestFirst = [...batch].reverse();
    if (pausedRef.current) {
      setPendingEvents((current) => trimEvents([...newestFirst, ...current], MAX_PENDING_EVENTS));
      return;
    }

    setEvents((current) => trimEvents([...newestFirst, ...current], MAX_EVENTS));
    if (autoFollow) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(0, 'start');
      });
    }
  }, [autoFollow]);

  const receiveEvent = useCallback((event: FeedEvent) => {
    incomingBufferRef.current.push(event);
    if (flushFrameRef.current === null) {
      flushFrameRef.current = requestAnimationFrame(flushIncoming);
    }
  }, [flushIncoming]);

  const streamState = useGovernanceSocket(activeUrl, receiveEvent);

  useEffect(() => {
    if (!selectedId && events[0]) {
      setSelectedId(events[0].id);
    }
  }, [events, selectedId]);

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatchesFilters(event, filters)),
    [events, filters],
  );

  const agentOptions = useMemo(() => uniqueValues(events, 'agent'), [events]);
  const toolOptions = useMemo(() => uniqueValues(events, 'tool'), [events]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? null,
    [events, filteredEvents, selectedId],
  );
  const activeSelectedId = selectedEvent?.id ?? null;

  const updateFilter = useCallback(<Key extends keyof EventFilters>(key: Key, value: EventFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const pauseFeed = useCallback(() => {
    setPaused(true);
  }, []);

  const resumeFeed = useCallback(() => {
    setPendingEvents((pending) => {
      if (pending.length > 0) {
        setEvents((current) => trimEvents([...pending, ...current], MAX_EVENTS));
      }
      return [];
    });
    setPaused(false);
    setAutoFollow(true);
    requestAnimationFrame(() => {
      listRef.current?.scrollToItem(0, 'start');
    });
  }, []);

  const jumpToLatest = useCallback(() => {
    setAutoFollow(true);
    listRef.current?.scrollToItem(0, 'start');
  }, []);

  const reconnect = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = draftUrl.trim();
    if (nextUrl) {
      setActiveUrl(nextUrl);
    }
  }, [draftUrl]);

  const rowProps = useMemo(() => ({
    events: filteredEvents,
    selectedId: activeSelectedId,
    onSelect: setSelectedId,
  }), [activeSelectedId, filteredEvents]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">TT</div>
          <div>
            <h1>Governance Events</h1>
            <StatusLine state={streamState} url={activeUrl} />
          </div>
        </div>

        <div className="top-actions">
          <Metric icon={<Activity size={16} />} label="Events/sec" value={String(eventsPerSecond)} />
          <Metric icon={<Clock3 size={16} />} label="Buffered" value={String(events.length)} />
          {paused ? (
            <button className="primary-button" type="button" onClick={resumeFeed}>
              <Play size={16} />
              Resume
              {pendingEvents.length > 0 && <span className="unread-badge">{pendingEvents.length}</span>}
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={pauseFeed}>
              <Pause size={16} />
              Pause
            </button>
          )}
          <button className="secondary-button" type="button" onClick={jumpToLatest}>
            <ArrowDownToLine size={16} />
            Jump to latest
          </button>
        </div>
      </header>

      <section className="connection-strip">
        <form className="connection-form" onSubmit={reconnect}>
          <label htmlFor="ws-url">WebSocket URL</label>
          <input
            id="ws-url"
            type="text"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
          />
          <button className="secondary-button" type="submit">Connect</button>
        </form>
      </section>

      <main className="workspace">
        <section className="feed-panel" aria-label="Governance event feed">
          <div className="filter-bar">
            <div className="filter-title">
              <Filter size={16} />
              Filters
            </div>
            <label>
              Agent
              <select value={filters.agent} onChange={(event) => updateFilter('agent', event.target.value)}>
                <option value="">All agents</option>
                {agentOptions.map((agent) => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </label>
            <label>
              Decision
              <select value={filters.decision} onChange={(event) => updateFilter('decision', event.target.value)}>
                <option value="">All decisions</option>
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
                <option value="REVISE">REVISE</option>
                <option value="REQUIRE_APPROVAL">REQUIRE APPROVAL</option>
              </select>
            </label>
            <label>
              Tool
              <select value={filters.tool} onChange={(event) => updateFilter('tool', event.target.value)}>
                <option value="">All tools</option>
                {toolOptions.map((tool) => (
                  <option key={tool} value={tool}>{tool}</option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(event) => updateFilter('from', event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={filters.to}
                onChange={(event) => updateFilter('to', event.target.value)}
              />
            </label>
            <label className="search-field">
              Reason search
              <span>
                <Search size={15} />
                <input
                  type="search"
                  placeholder="budget, allowlist, sign-off"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                />
              </span>
            </label>
            <button className="icon-button" type="button" aria-label="Clear filters" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X size={16} />
            </button>
          </div>

          <div className="feed-summary">
            <span>{filteredEvents.length.toLocaleString()} visible events</span>
            <span>{events.length.toLocaleString()} retained</span>
            {paused && <span className="paused-chip">Paused: {pendingEvents.length.toLocaleString()} unread</span>}
          </div>

          <div className="list-frame">
            {filteredEvents.length > 0 ? (
              <FixedSizeList
                ref={listRef}
                itemCount={filteredEvents.length}
                itemSize={78}
                itemData={rowProps}
                overscanCount={24}
                onItemsRendered={({ visibleStartIndex }) => setAutoFollow(visibleStartIndex <= 2)}
                height="100%"
                width="100%"
              >
                {EventRow}
              </FixedSizeList>
            ) : (
              <div className="empty-state">No events match the current filters.</div>
            )}
          </div>
        </section>

        <ReceiptPanel event={selectedEvent} />
      </main>
    </div>
  );
}

interface RowData {
  events: FeedEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function EventRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowData>): ReactElement | null {
  const { events, selectedId, onSelect } = data;
  const event = events[index];
  if (!event) {
    return null;
  }

  const isSelected = event.id === selectedId;

  return (
    <div className="event-row-shell" style={style as CSSProperties}>
      <button
        className={`event-row decision-${event.decision.toLowerCase().replace('_', '-')}${isSelected ? ' selected' : ''}`}
        type="button"
        aria-expanded={isSelected}
        onClick={() => onSelect(event.id)}
      >
        <span className="event-time">{formatTime(event.timestamp)}</span>
        <span className="event-main">
          <span className="event-route">
            <strong>{event.agent}</strong>
            <span>{event.tool}</span>
          </span>
          <span className="event-reason">{event.reason}</span>
        </span>
        <span className="decision-pill">{decisionLabel(event.decision)}</span>
        <span className="latency-pill">{formatLatency(event.latencyMs)}</span>
      </button>
    </div>
  );
}

function ReceiptPanel({ event }: { event: FeedEvent | null }): ReactElement {
  return (
    <aside className="receipt-panel" aria-label="TEEC receipt JSON">
      <div className="receipt-header">
        <div>
          <span><Braces size={16} /> TEEC receipt JSON</span>
          <h2>{event ? event.id : 'No event selected'}</h2>
        </div>
        {event && <span className={`decision-pill decision-${event.decision.toLowerCase().replace('_', '-')}`}>{decisionLabel(event.decision)}</span>}
      </div>

      {event ? (
        <>
          <dl className="receipt-facts">
            <div>
              <dt>Timestamp</dt>
              <dd>{new Date(event.timestamp).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Agent</dt>
              <dd>{event.agent}</dd>
            </div>
            <div>
              <dt>Tool</dt>
              <dd>{event.tool}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{formatLatency(event.latencyMs)}</dd>
            </div>
          </dl>
          <pre className="receipt-json">{JSON.stringify(event.receipt, null, 2)}</pre>
        </>
      ) : (
        <div className="empty-state">Select an event to inspect the full receipt.</div>
      )}
    </aside>
  );
}

function StatusLine({ state, url }: { state: StreamState; url: string }): ReactElement {
  const connected = state.status === 'connected';
  const Icon = connected ? Wifi : WifiOff;
  const label = state.status === 'connected'
    ? 'Live'
    : state.status === 'reconnecting'
      ? `Reconnecting ${state.reconnectAttempt}`
      : state.status;

  return (
    <p className="status-line">
      <span className={`status-dot ${state.status}`} />
      <Icon size={14} />
      <span>{label}</span>
      <code>{url}</code>
    </p>
  );
}

function Metric({ icon, label, value }: { icon: ReactElement; label: string; value: string }): ReactElement {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function trimEvents(events: FeedEvent[], limit: number): FeedEvent[] {
  return events.length > limit ? events.slice(0, limit) : events;
}
