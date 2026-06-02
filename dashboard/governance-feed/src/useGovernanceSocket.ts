import { useEffect, useRef, useState } from 'react';

import { normalizeEvent } from './event-utils';
import type { FeedEvent, StreamMessage, StreamState } from './types';

const INITIAL_STATE: StreamState = {
  status: 'connecting',
  lastMessageAt: null,
  reconnectAttempt: 0,
};

export function useGovernanceSocket(
  url: string,
  onEvent: (event: FeedEvent) => void,
): StreamState {
  const onEventRef = useRef(onEvent);
  const cursorRef = useRef('');
  const [state, setState] = useState<StreamState>(INITIAL_STATE);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = (): void => {
      if (closed) {
        return;
      }

      setState((current) => ({
        ...current,
        status: attempt === 0 ? 'connecting' : 'reconnecting',
        reconnectAttempt: attempt,
      }));

      const reconnectUrl = withCursor(url, cursorRef.current);
      socket = new WebSocket(reconnectUrl);

      socket.addEventListener('open', () => {
        attempt = 0;
        setState({
          status: 'connected',
          lastMessageAt: Date.now(),
          reconnectAttempt: 0,
        });
      });

      socket.addEventListener('message', (event) => {
        const message = parseMessage(event.data);
        if (!message) {
          return;
        }

        setState((current) => ({
          ...current,
          lastMessageAt: Date.now(),
        }));

        const feedEvent = normalizeEvent(message);
        if (!feedEvent) {
          return;
        }

        if (feedEvent.cursor) {
          cursorRef.current = feedEvent.cursor;
        }
        onEventRef.current(feedEvent);
      });

      socket.addEventListener('close', () => {
        if (closed) {
          return;
        }
        attempt += 1;
        setState((current) => ({
          ...current,
          status: 'reconnecting',
          reconnectAttempt: attempt,
        }));
        reconnectTimer = setTimeout(connect, Math.min(5000, 400 * attempt));
      });

      socket.addEventListener('error', () => {
        socket?.close();
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
      setState((current) => ({
        ...current,
        status: 'disconnected',
      }));
    };
  }, [url]);

  return state;
}

function withCursor(rawUrl: string, cursor: string): string {
  if (!cursor) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    url.searchParams.set('cursor', cursor);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function parseMessage(value: unknown): StreamMessage | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value) as StreamMessage;
  } catch {
    return null;
  }
}
