// /src/hooks/useGovernanceEvents.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GovernanceEvent {
  id: string;
  type: 'decision' | 'cost' | 'tool_usage' | 'security' | 'compliance';
  timestamp: string; // ISO 8601
  agentId: string;
  agentName?: string;
  cost?: number;
  toolUsed?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  source: string;
}

export interface PaginationMeta {
  total: number;
  offset: number;
  limit: number;
}

export interface EventsResponse {
  events: GovernanceEvent[];
  pagination: PaginationMeta;
}

export interface GovernanceEventsFilters {
  type?: string | string[];
  from?: string; // ISO 8601
  to?: string;
  agentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UseGovernanceEventsOptions {
  /** Enable real-time updates via SSE; falls back to polling */
  realtime?: boolean;
  /** Polling interval in ms (default: 5000) */
  pollingInterval?: number;
  /** Manually enable/disable the query */
  enabled?: boolean;
  /** Override base API URL (default: process.env.REACT_APP_API_URL || 'http://localhost:4000/api') */
  apiBaseUrl?: string;
}

export interface UseGovernanceEventsResult {
  events: GovernanceEvent[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isRealtimeConnected: boolean;
  isUsingPolling: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_API_BASE =
  process.env.REACT_APP_API_URL ?? 'http://localhost:4000/api';
const DEFAULT_POLL_INTERVAL = 5_000;

function buildQueryParams(filters: GovernanceEventsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      filters.type.forEach((t) => params.append('type', t));
    } else {
      params.set('type', filters.type);
    }
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.agentId) params.set('agentId', filters.agentId);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return params;
}

/* ------------------------------------------------------------------ */
/*  API fetch function                                                 */
/* ------------------------------------------------------------------ */

async function fetchEvents(
  filters: GovernanceEventsFilters,
  signal: AbortSignal,
  apiBase: string,
): Promise<EventsResponse> {
  const query = buildQueryParams(filters);
  const url = `${apiBase}/governance/events?${query.toString()}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch governance events: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`,
    );
  }

  return response.json() as Promise<EventsResponse>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useGovernanceEvents(
  filters: GovernanceEventsFilters = {},
  options: UseGovernanceEventsOptions = {},
): UseGovernanceEventsResult {
  const {
    realtime = false,
    pollingInterval = DEFAULT_POLL_INTERVAL,
    enabled = true,
    apiBaseUrl = DEFAULT_API_BASE,
  } = options;

  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isUsingPolling, setIsUsingPolling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingFailoverRef = useRef(false);

  // ---- React Query ----
  const queryKey = ['governance-events', filters, apiBaseUrl];

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EventsResponse, Error>({
    queryKey,
    queryFn: ({ signal }) => fetchEvents(filters, signal, apiBaseUrl),
    enabled,
    refetchInterval: (
      | (() => {
          // If realtime is enabled and SSE is connected → no polling
          if (realtime && isRealtimeConnected) return false;
          // If realtime is enabled but SSE failed or not available → poll
          if (realtime && pollingFailoverRef.current) return pollingInterval;
          // If realtime not requested → optional polling (can be overridden by passing pollingInterval)
          if (!realtime) return pollingInterval;
          return false;
        })()
      : undefined
    ) as number | false | undefined,
    staleTime: 30_000,
    retry: 2,
  });

  // ---- SSE for real-time updates ----
  useEffect(() => {
    if (!realtime || !enabled) {
      setIsRealtimeConnected(false);
      setIsUsingPolling(false);
      pollingFailoverRef.current = false;
      return;
    }

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const query = buildQueryParams(filters);
      const url = `${apiBaseUrl}/governance/events/stream?${query.toString()}`;

      try {
        source = new EventSource(url);
      } catch {
        // SSE not supported → fall back to polling immediately
        pollingFailoverRef.current = true;
        setIsRealtimeConnected(false);
        setIsUsingPolling(true);
        return;
      }

      source.onopen = () => {
        setIsRealtimeConnected(true);
        setIsUsingPolling(false);
        pollingFailoverRef.current = false;
      };

      source.onmessage = (event) => {
        try {
          const newEvent: GovernanceEvent = JSON.parse(event.data);
          // Invalidate the query so the next poll (or manual refetch) gets the update.
          // For immediate update you could also use queryClient.setQueryData, but invalidate
          // is safer to keep cache consistent with server.
          queryClient.invalidateQueries({ queryKey });
        } catch {
          // ignore malformed messages
        }
      };

      source.onerror = () => {
        source?.close();
        setIsRealtimeConnected(false);
        // Fall back to polling
        pollingFailoverRef.current = true;
        setIsUsingPolling(true);
        // Attempt reconnection after a delay
        reconnectTimer = setTimeout(connect, pollingInterval);
      };
    }

    connect();

    return () => {
      if (source) source.close();
      clearTimeout(reconnectTimer);
      setIsRealtimeConnected(false);
      setIsUsingPolling(false);
      pollingFailoverRef.current = false;
    };
    // Only reconnect when filters or apiBaseUrl change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime, enabled, apiBaseUrl, JSON.stringify(filters)]);

  // ---- Result ----
  return {
    events: data?.events ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    isRealtimeConnected,
    isUsingPolling,
  };
}