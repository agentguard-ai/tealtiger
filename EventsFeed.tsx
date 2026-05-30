// File: /src/pages/EventsFeed.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GovernanceEvent {
  id: string;
  type: 'decision' | 'cost' | 'tool_usage' | 'security';
  severity: 'info' | 'warning' | 'error';
  summary: string;
  details?: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_WS_URL = 'ws://localhost:26072/ws/events';
const MAX_EVENTS = 500;
const RECONNECT_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityColorMap: Record<GovernanceEvent['severity'], string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const typeIconMap: Record<GovernanceEvent['type'], string> = {
  decision: '⚖️',
  cost: '💰',
  tool_usage: '🔧',
  security: '🔒',
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getAge(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// EventsFeed Component
// ---------------------------------------------------------------------------

export function EventsFeed() {
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<GovernanceEvent['type'] | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<GovernanceEvent['severity'] | 'all'>('all');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---------- WebSocket connection ----------
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(DEFAULT_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (msg: MessageEvent) => {
        try {
          const event: GovernanceEvent = JSON.parse(msg.data);
          if (!event.id || !event.type || !event.severity || !event.summary || !event.timestamp) {
            console.warn('Malformed event received from WS:', msg.data);
            return;
          }
          setEvents(prev => {
            const next = [event, ...prev];
            return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
          });
        } catch {
          console.warn('Failed to parse WebSocket message:', msg.data);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        setIsConnected(false);
        if (!event.wasClean) {
          setError('Connection lost. Reconnecting…');
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        setError('WebSocket error occurred.');
        ws.close();
      };
    } catch {
      setError('Failed to create WebSocket connection.');
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY_MS);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  // Auto‑scroll to top when new events arrive
  useEffect(() => {
    if (containerRef.current && events.length > 0) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  // ---------- Filters ----------
  const filteredEvents = events.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
    return true;
  });

  // ---------- Clear events ----------
  const clearEvents = () => setEvents([]);

  // ---------- Render ----------
  return (
    <div className="flex flex-col h-full" data-testid="events-feed">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Governance Events</h2>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {events.length} events
          </span>
          <button
            onClick={clearEvents}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850">
        {/* Type filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as GovernanceEvent['type'] | 'all')}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All</option>
            <option value="decision">Decision</option>
            <option value="cost">Cost</option>
            <option value="tool_usage">Tool</option>
            <option value="security">Security</option>
          </select>
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Severity</label>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as GovernanceEvent['severity'] | 'all')}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {error && (
          <span className="ml-auto text-xs text-red-500 dark:text-red-400">{error}</span>
        )}
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-white dark:bg-gray-900"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">No events {filterType !== 'all' || filterSeverity !== 'all' ? 'matching filters' : ''}</p>
            {!isConnected && (
              <p className="text-xs mt-1 text-yellow-500 dark:text-yellow-400">Awaiting connection…</p>
            )}
          </div>
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Icon */}
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-base rounded-full bg-white dark:bg-gray-700 shadow-sm">
                {typeIconMap[event.type]}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${severityColorMap[event.severity]}`}
                  >
                    {event.severity}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({getAge(event.timestamp)})
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {event.summary}
                </p>
                {event.details && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {event.details}
                  </p>
                )}
              </div>

              {/* Metadata toggle for debugging */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <details className="flex-shrink-0 group-hover:block hidden">
                  <summary className="text-xs text-gray-400 cursor-pointer">meta</summary>
                  <pre className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs overflow-auto">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-4">
        <span>Showing {filteredEvents.length} of {events.length}</span>
        <span className="capitalize">{filterType !== 'all' ? filterType : 'all types'}</span>
        <span className="capitalize">{filterSeverity !== 'all' ? filterSeverity : 'all severities'}</span>
      </div>
    </div>
  );
}

export default EventsFeed;