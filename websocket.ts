// /src/services/websocket.ts

/**
 * WebSocket service for real-time communication
 * Handles connection lifecycle, message routing, and automatic reconnection
 */

import { EventEmitter } from 'events';

/**
 * Standard WebSocket event names
 */
export enum WsEvent {
  Open = 'open',
  Close = 'close',
  Error = 'error',
  Message = 'message',
  Reconnecting = 'reconnecting',
  Reconnected = 'reconnected',
}

/**
 * Connection states
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

/**
 * Options for WebSocket service
 */
export interface WebSocketOptions {
  /** WebSocket server URL */
  url: string;
  /** Reconnection delay base in ms (default: 1000) */
  reconnectBaseDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  reconnectMaxDelay?: number;
  /** Maximum reconnection attempts (default: 10, -1 for infinite) */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms (default: 30000, 0 to disable) */
  heartbeatInterval?: number;
  /** Heartbeat message (default: { type: 'ping' }) */
  heartbeatMessage?: object;
  /** Enable built-in logging (default: false) */
  debug?: boolean;
  /** Protocols to pass to WebSocket constructor */
  protocols?: string | string[];
}

/**
 * Typed message handler
 */
export type MessageHandler<T = unknown> = (data: T, event: MessageEvent) => void;

/**
 * Simple typed event emitter for WebSocket service
 */
class WsEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`WebSocketService: Error in event handler for "${event}"`, err);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/**
 * WebSocket service class
 * Manages a single WebSocket connection with auto-reconnect and message routing.
 *
 * @example
 * const ws = new WebSocketService({ url: 'wss://api.example.com/ws' });
 * ws.on('message', (data) => console.log(data));
 * ws.connect();
 */
export class WebSocketService<IncomingMessage = any, OutgoingMessage = any> {
  private emitter = new WsEventEmitter();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private state: ConnectionState = ConnectionState.Disconnected;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();

  public readonly options: Required<WebSocketOptions>;

  constructor(options: WebSocketOptions) {
    this.options = {
      url: options.url,
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      reconnectMaxDelay: options.reconnectMaxDelay ?? 30000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      heartbeatMessage: options.heartbeatMessage ?? { type: 'ping' },
      debug: options.debug ?? false,
      protocols: options.protocols,
    };
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Returns true if WebSocket is currently open
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ────────────── Connection Management ──────────────

  /**
   * Open WebSocket connection
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.log('Connect called but already connected/connecting');
      return;
    }
    this.intentionalClose = false;
    this.setState(ConnectionState.Connecting);
    this.createSocket();
  }

  /**
   * Close WebSocket connection (no reconnection)
   */
  disconnect(code?: number, reason?: string): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();
    if (this.ws) {
      this.ws.close(code ?? 1000, reason ?? 'Client disconnect');
      this.ws = null;
    }
    this.setState(ConnectionState.Disconnected);
  }

  /**
   * Send a message over the WebSocket
   */
  send(data: OutgoingMessage): void {
    if (!this.isConnected) {
      this.log('Cannot send – connection not open');
      return;
    }
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws!.send(message);
  }

  // ────────────── Event Registration ──────────────

  /**
   * Listen for any incoming message
   */
  onMessage(handler: MessageHandler<IncomingMessage>): () => void {
    return this.addMessageHandler('*', handler);
  }

  /**
   * Listen for messages of a specific type (object with `type` property)
   */
  onMessageType<T extends { type: string }>(type: T['type'], handler: MessageHandler<T>): () => void {
    return this.addMessageHandler(type, handler);
  }

  /**
   * Listen for WebSocket lifecycle events
   */
  on(event: WsEvent.Open, handler: (event: Event) => void): void;
  on(event: WsEvent.Close, handler: (event: CloseEvent) => void): void;
  on(event: WsEvent.Error, handler: (event: Event) => void): void;
  on(event: WsEvent.Message, handler: (data: IncomingMessage, event: MessageEvent) => void): void;
  on(event: WsEvent.Reconnecting, handler: (attempt: number) => void): void;
  on(event: WsEvent.Reconnected, handler: () => void): void;
  on(event: string, handler: (...args: any[]) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Remove a lifecycle event listener
   */
  off(event: WsEvent, handler: (...args: any[]) => void): void {
    this.emitter.off(event, handler);
  }

  /**
   * Remove all listeners (optionally for a specific event)
   */
  removeAllListeners(event?: string): void {
    this.emitter.removeAllListeners(event);
    if (!event) {
      this.messageHandlers.clear();
    } else if (event === '*') {
      this.messageHandlers.delete('*');
    } else {
      this.messageHandlers.delete(event);
    }
  }

  // ────────────── Internal Methods ──────────────

  private createSocket(): void {
    try {
      const { url, protocols } = this.options;
      this.ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch (err) {
      this.log('Failed to create WebSocket:', err);
      this.handleError(err as Event);
      return;
    }

    this.ws!.onopen = (event: Event) => {
      this.onOpen(event);
    };

    this.ws!.onclose = (event: CloseEvent) => {
      this.onClose(event);
    };

    this.ws!.onerror = (event: Event) => {
      this.handleError(event);
    };

    this.ws!.onmessage = (event: MessageEvent) => {
      this.onMessageReceived(event);
    };
  }

  private onOpen(event: Event): void {
    this.log('WebSocket connection opened');
    this.reconnectAttempts = 0;
    this.setState(ConnectionState.Connected);
    this.startHeartbeat();
    this.emitter.emit(WsEvent.Open, event);
  }

  private onClose(event: CloseEvent): void {
    this.log('WebSocket connection closed:', event.code, event.reason);
    this.ws = null;
    this.clearHeartbeat();

    if (!this.intentionalClose && this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.setState(ConnectionState.Disconnected);
      this.emitter.emit(WsEvent.Close, event);
    }
  }

  private handleError(event: Event): void {
    this.log('WebSocket error:', event);
    this.emitter.emit(WsEvent.Error, event);
  }

  private onMessageReceived(event: MessageEvent): void {
    let data: IncomingMessage;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      data = event.data as IncomingMessage;
    }

    // Emit generic message event
    this.emitter.emit(WsEvent.Message, data, event);

    // Emit type-specific handlers if data is an object with a type property
    if (typeof data === 'object' && data !== null && 'type' in data) {
      const type = (data as any).type as string;
      this.messageHandlers.get(type)?.forEach(handler => handler(data, event));
    }

    // Always call wildcard handlers
    this.messageHandlers.get('*')?.forEach(handler => handler(data, event));
  }

  // ────────────── Message Routing ──────────────

  private addMessageHandler(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  // ────────────── Reconnection ──────────────

  private shouldReconnect(): boolean {
    return this.options.maxReconnectAttempts === -1 ||
      this.reconnectAttempts < this.options.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    const delay = this.calculateReconnectDelay();
    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setState(ConnectionState.Reconnecting);
    this.emitter.emit(WsEvent.Reconnecting, this.reconnectAttempts + 1);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.createSocket();
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const { reconnectBaseDelay, reconnectMaxDelay } = this.options;
    const exponential = reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
    const capped = Math.min(exponential, reconnectMaxDelay);
    // Add jitter (±20%)
    const jitter = capped * 0.2 * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ────────────── Heartbeat ──────────────

  private startHeartbeat(): void {
    if (this.options.heartbeatInterval <= 0) return;
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send(this.options.heartbeatMessage as OutgoingMessage);
      }
    }, this.options.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ────────────── State Management ──────────────

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  // ────────────── Logging ──────────────

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[WebSocketService]`, ...args);
    }
  }

  // ────────────── Cleanup ──────────────

  /**
   * Destroy the service – disconnects, clears timers, removes all listeners
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.messageHandlers.clear();
  }
}