import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';

import { BoundedEventQueue } from './client-buffer';
import { matchesFilter, filterFromSubscribeMessage, parseFilterParams } from './filters';
import { GovernanceEventStream } from './event-stream';
import type {
  GovernanceEventMessage,
  StoredGovernanceEvent,
  StreamControlMessage,
  StreamMessage,
  SubscribeMessage,
  SubscriptionFilter,
  TEECReceipt,
} from './types';

export interface GovernanceStreamServerOptions {
  stream?: GovernanceEventStream;
  historyLimit?: number;
  heartbeatIntervalMs?: number;
  clientBufferLimit?: number;
  clientHighWaterMarkBytes?: number;
}

export interface StartedServer {
  host: string;
  port: number;
  httpUrl: string;
  wsUrl: string;
}

interface StreamClient {
  id: string;
  socket: WebSocket;
  filter: SubscriptionFilter;
  queue: BoundedEventQueue<StreamMessage>;
  unsubscribe: () => void;
  isAlive: boolean;
  isFlushing: boolean;
  flushRetry: NodeJS.Timeout | null;
}

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_CLIENT_BUFFER_LIMIT = 1_000;
const DEFAULT_HIGH_WATER_MARK_BYTES = 512 * 1024;

export class GovernanceStreamServer {
  readonly stream: GovernanceEventStream;

  private readonly heartbeatIntervalMs: number;
  private readonly clientBufferLimit: number;
  private readonly clientHighWaterMarkBytes: number;
  private readonly clients = new Set<StreamClient>();
  private readonly httpServer: Server;
  private readonly wsServer: WebSocketServer;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: GovernanceStreamServerOptions = {}) {
    this.stream = options.stream ?? new GovernanceEventStream({ historyLimit: options.historyLimit });
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
    this.clientBufferLimit = options.clientBufferLimit ?? DEFAULT_CLIENT_BUFFER_LIMIT;
    this.clientHighWaterMarkBytes = options.clientHighWaterMarkBytes ?? DEFAULT_HIGH_WATER_MARK_BYTES;
    this.httpServer = createServer((request, response) => this.handleHttpRequest(request, response));
    this.wsServer = new WebSocketServer({ noServer: true });
    this.configureUpgradeHandling();
  }

  start(port = 0, host = '127.0.0.1'): Promise<StartedServer> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        this.httpServer.off('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.httpServer.off('error', onError);
        const address = this.httpServer.address();
        const resolvedPort = typeof address === 'object' && address ? address.port : port;
        this.startHeartbeat();
        resolve({
          host,
          port: resolvedPort,
          httpUrl: `http://${host}:${resolvedPort}`,
          wsUrl: `ws://${host}:${resolvedPort}`,
        });
      };

      this.httpServer.once('error', onError);
      this.httpServer.once('listening', onListening);
      this.httpServer.listen(port, host);
    });
  }

  stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients) {
      client.unsubscribe();
      client.socket.close();
    }
    this.clients.clear();
    this.wsServer.close();

    return new Promise((resolve, reject) => {
      this.httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  publish(receipt: TEECReceipt): GovernanceEventMessage {
    return this.stream.publish(receipt);
  }

  private configureUpgradeHandling(): void {
    this.wsServer.on('connection', (socket, request) => this.handleWebSocketConnection(socket, request));
    this.httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/ws/events') {
        socket.destroy();
        return;
      }
      this.wsServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.wsServer.emit('connection', webSocket, request);
      });
    });
  }

  private handleHttpRequest(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'tealtiger-governance-stream',
        metrics: this.stream.metrics(),
      });
      return;
    }

    if (
      request.method === 'GET'
      && (url.pathname === '/sse/events' || url.pathname === '/api/v1/events/stream')
    ) {
      this.handleSseConnection(request, response, url);
      return;
    }

    sendJson(response, 404, { error: 'not_found', message: 'Route not found' });
  }

  private handleWebSocketConnection(socket: WebSocket, request: IncomingMessage): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const { filter, cursor } = parseFilterParams(url.searchParams);
    const client = this.createClient(socket, filter);

    client.unsubscribe = this.stream.subscribe((event) => {
      if (matchesFilter(event, client.filter)) {
        this.enqueue(client, event.message);
      }
    });

    socket.on('pong', () => {
      client.isAlive = true;
    });
    socket.on('message', (payload) => this.handleClientMessage(client, payload));
    socket.on('close', () => this.removeClient(client));
    socket.on('error', () => this.removeClient(client));

    this.send(client, controlMessage('connection_ack', {
      client_id: client.id,
      cursor: this.stream.latestCursor(),
    }));
    this.replay(client, cursor);
  }

  private handleClientMessage(client: StreamClient, payload: WebSocket.RawData): void {
    let parsed: SubscribeMessage;
    try {
      parsed = JSON.parse(payload.toString()) as SubscribeMessage;
    } catch {
      this.send(client, controlMessage('subscription_updated', {
        ok: false,
        error: 'invalid_json',
      }));
      return;
    }

    if (parsed.type !== 'subscribe') {
      this.send(client, controlMessage('subscription_updated', {
        ok: false,
        error: 'unsupported_message_type',
      }));
      return;
    }

    client.filter = filterFromSubscribeMessage(parsed);
    this.send(client, controlMessage('subscription_updated', {
      ok: true,
      filter: client.filter,
    }));
    this.replay(client, parsed.cursor);
  }

  private createClient(socket: WebSocket, filter: SubscriptionFilter): StreamClient {
    const client: StreamClient = {
      id: `client_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      socket,
      filter,
      queue: new BoundedEventQueue<StreamMessage>(this.clientBufferLimit),
      unsubscribe: () => undefined,
      isAlive: true,
      isFlushing: false,
      flushRetry: null,
    };
    this.clients.add(client);
    return client;
  }

  private removeClient(client: StreamClient): void {
    if (!this.clients.has(client)) {
      return;
    }
    client.unsubscribe();
    if (client.flushRetry) {
      clearTimeout(client.flushRetry);
      client.flushRetry = null;
    }
    this.clients.delete(client);
  }

  private replay(client: StreamClient, cursor: string | undefined): void {
    const events = this.stream.replayAfter(cursor, client.filter);
    for (const event of events) {
      this.enqueue(client, event.message);
    }
    this.send(client, controlMessage('replay_complete', {
      cursor: this.stream.latestCursor(),
      replayed: events.length,
    }));
  }

  private enqueue(client: StreamClient, message: StreamMessage): void {
    const before = client.queue.droppedCount;
    client.queue.push(message);
    const dropped = client.queue.droppedCount - before;
    if (dropped > 0) {
      this.stream.recordBackpressureDrop(dropped);
    }
    this.flush(client);
  }

  private send(client: StreamClient, message: StreamMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (client.queue.length > 0 || client.socket.bufferedAmount > this.clientHighWaterMarkBytes) {
      this.enqueue(client, message);
      return;
    }

    client.socket.send(JSON.stringify(message));
  }

  private flush(client: StreamClient): void {
    if (client.isFlushing || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    client.isFlushing = true;
    const flushNext = (): void => {
      if (client.socket.readyState !== WebSocket.OPEN) {
        client.isFlushing = false;
        return;
      }

      if (client.socket.bufferedAmount > this.clientHighWaterMarkBytes) {
        client.isFlushing = false;
        this.scheduleFlush(client);
        return;
      }

      const next = client.queue.shift();
      if (!next) {
        client.isFlushing = false;
        return;
      }

      client.socket.send(JSON.stringify(next), () => setImmediate(flushNext));
    };

    flushNext();
  }

  private scheduleFlush(client: StreamClient): void {
    if (client.flushRetry || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    client.flushRetry = setTimeout(() => {
      client.flushRetry = null;
      this.flush(client);
    }, 10);
    client.flushRetry.unref();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.unsubscribe();
          client.socket.terminate();
          this.clients.delete(client);
          continue;
        }

        client.isAlive = false;
        client.socket.ping();
        this.send(client, controlMessage('heartbeat', {
          cursor: this.stream.latestCursor(),
        }));
      }
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  private handleSseConnection(request: IncomingMessage, response: ServerResponse, url: URL): void {
    const { filter, cursor } = parseFilterParams(url.searchParams);
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    writeSse(response, controlMessage('connection_ack', { cursor: this.stream.latestCursor() }), 'connection_ack');

    const replayed = this.stream.replayAfter(cursor, filter);
    for (const event of replayed) {
      writeSse(response, event.message, 'governance_event', event.message.cursor);
    }
    writeSse(response, controlMessage('replay_complete', {
      cursor: this.stream.latestCursor(),
      replayed: replayed.length,
    }), 'replay_complete');

    const unsubscribe = this.stream.subscribe((event: StoredGovernanceEvent) => {
      if (matchesFilter(event, filter)) {
        writeSse(response, event.message, 'governance_event', event.message.cursor);
      }
    });
    const heartbeat = setInterval(() => {
      response.write(`: heartbeat ${Date.now()}\n\n`);
    }, this.heartbeatIntervalMs);
    heartbeat.unref();

    request.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }
}

export function createGovernanceStreamServer(
  options: GovernanceStreamServerOptions = {},
): GovernanceStreamServer {
  return new GovernanceStreamServer(options);
}

function controlMessage(type: StreamControlMessage['type'], data: Record<string, unknown>): StreamControlMessage {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function writeSse(
  response: ServerResponse,
  message: StreamMessage,
  eventName: string,
  id?: string,
): void {
  if (id) {
    response.write(`id: ${id}\n`);
  }
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(message)}\n\n`);
}
