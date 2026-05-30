import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Configuration options for the WebSocket hook.
 */
export interface WebSocketOptions {
  /** WebSocket server URL. */
  url: string;
  /** Optional sub-protocols. */
  protocols?: string | string[];
  /** Whether to connect immediately. Defaults to true. */
  autoConnect?: boolean;
  /** Maximum number of reconnection attempts. Set to 0 to disable. Defaults to 10. */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts (ms). Defaults to 1000. */
  reconnectInterval?: number;
  /** Maximum delay between reconnection attempts (ms). Defaults to 30000. */
  maxReconnectInterval?: number;
  /** Factor for exponential backoff. Defaults to 2. */
  reconnectBackoffFactor?: number;
  /** Random jitter factor (0 to 1) to add to the delay. Defaults to 0.3. */
  jitterFactor?: number;
  /** Whether to automatically reconnect on close (excluding intentional close). Defaults to true. */
  shouldReconnect?: boolean;
  /** Callback when connection is established. */
  onOpen?: (event: Event) => void;
  /** Callback when connection is closed. */
  onClose?: (event: CloseEvent) => void;
  /** Callback when a message is received. */
  onMessage?: (event: MessageEvent) => void;
  /** Callback when an error occurs. */
  onError?: (event: Event) => void;
}

/**
 * Enum for WebSocket connection state.
 */
export enum WebSocketConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

/**
 * Return type of the useWebSocket hook.
 */
export interface WebSocketReturn {
  /** Current connection state. */
  connectionState: WebSocketConnectionState;
  /** Whether the socket is currently connected. */
  isConnected: boolean;
  /** Whether a connection attempt is in progress (including reconnection). */
  isConnecting: boolean;
  /** The last received message event (updates on each message). */
  lastMessage: MessageEvent | null;
  /** The number of reconnection attempts so far. */
  reconnectAttempts: number;
  /** Send a message through the WebSocket. Returns false if not connected. */
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => boolean;
  /** Manually close the WebSocket connection. If `permanent` is true, no reconnection will be attempted. */
  close: (permanent?: boolean) => void;
  /** Manually attempt to reconnect. */
  reconnect: () => void;
}

// Ensure the hook only works in browser environments
const isBrowser = typeof window !== 'undefined';

/**
 * Custom React hook for managing a WebSocket connection with automatic reconnection logic.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry limits
 * - Lifecycle callbacks
 * - Proper cleanup on unmount
 * - Type-safe message handling
 *
 * @example
 *