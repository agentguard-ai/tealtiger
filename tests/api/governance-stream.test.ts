import { get } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';

import WebSocket from 'ws';

import { BoundedEventQueue } from '../../api/governance-stream/client-buffer';
import { GovernanceEventStream } from '../../api/governance-stream/event-stream';
import { attachTealEngineStreaming } from '../../api/governance-stream/teal-engine-adapter';
import {
  createGovernanceStreamServer,
  type GovernanceStreamServer,
} from '../../api/governance-stream/server';
import type { StreamMessage } from '../../api/governance-stream/types';

test('WebSocket connects and streams filtered governance events', async (t) => {
  const { server, started } = await buildServer(t);
  const client = await WebSocketReader.connect(`${started.wsUrl}/ws/events?agent=checkout-agent&decision=DENY`);

  await client.next('connection_ack');
  server.publish({
    agent_id: 'checkout-agent',
    decision: 'ALLOW',
    receipt_id: 'receipt-ignored',
  });
  server.publish({
    agent_id: 'checkout-agent',
    decision: 'DENY',
    receipt_id: 'receipt-delivered',
  });

  const event = await client.next('governance_event');
  assert.equal(event.data.agent_id, 'checkout-agent');
  assert.equal(event.data.decision, 'DENY');
  assert.equal(event.data.receipt_id, 'receipt-delivered');
});

test('WebSocket subscribe messages update filtering by agent and decision type', async (t) => {
  const { server, started } = await buildServer(t);
  const client = await WebSocketReader.connect(`${started.wsUrl}/ws/events`);

  await client.next('connection_ack');
  client.socket.send(JSON.stringify({
    type: 'subscribe',
    agents: ['deploy-agent'],
    decisions: ['ALLOW'],
    event_types: ['tool_call'],
  }));
  await client.next('subscription_updated');

  server.publish({ agent_id: 'deploy-agent', decision: 'DENY', event_type: 'tool_call', receipt_id: 'receipt-denied' });
  server.publish({ agent_id: 'deploy-agent', decision: 'ALLOW', event_type: 'audit_log', receipt_id: 'receipt-other-type' });
  server.publish({ agent_id: 'deploy-agent', decision: 'ALLOW', event_type: 'tool_call', receipt_id: 'receipt-allowed' });

  const event = await client.next('governance_event');
  assert.equal(event.data.receipt_id, 'receipt-allowed');
});

test('WebSocket reconnect with cursor replays missed events', async (t) => {
  const { server, started } = await buildServer(t);
  const first = server.publish({ agent_id: 'replay-agent', decision: 'ALLOW', receipt_id: 'receipt-1' });
  const second = server.publish({ agent_id: 'replay-agent', decision: 'DENY', receipt_id: 'receipt-2' });

  const client = await WebSocketReader.connect(`${started.wsUrl}/ws/events?agent=replay-agent&cursor=${first.cursor}`);
  const replayed = await client.next('governance_event');
  assert.equal(replayed.type, 'governance_event');
  assert.equal(replayed.id, second.id);
  assert.equal(replayed.data.receipt_id, 'receipt-2');
});

test('WebSocket heartbeat sends ping and heartbeat messages', async (t) => {
  const { started } = await buildServer(t, { heartbeatIntervalMs: 20 });
  const client = await WebSocketReader.connect(`${started.wsUrl}/ws/events`);
  const pingReceived = new Promise<void>((resolve) => client.socket.once('ping', () => resolve()));

  await client.next('connection_ack');
  await pingReceived;
  const heartbeat = await client.next('heartbeat');
  assert.equal(heartbeat.type, 'heartbeat');
});

test('SSE fallback streams matching governance events', async (t) => {
  const { server, started } = await buildServer(t, { heartbeatIntervalMs: 50 });
  const bodyPromise = readUntilSseEvent(
    `${started.httpUrl}/sse/events?agent=sse-agent`,
    'governance_event',
    'receipt-sse',
  );

  setTimeout(() => {
    server.publish({ agent_id: 'sse-agent', decision: 'ALLOW', receipt_id: 'receipt-sse' });
  }, 10);

  const body = await bodyPromise;
  assert.match(body, /event: governance_event/);
  assert.match(body, /receipt-sse/);
});

test('WebSocket stream handles more than 100 events per second without dropping', async (t) => {
  const { server, started } = await buildServer(t, {
    heartbeatIntervalMs: 1_000,
    clientBufferLimit: 500,
  });
  const client = await WebSocketReader.connect(`${started.wsUrl}/ws/events?agent=load-agent`);
  await client.next('connection_ack');

  for (let index = 0; index < 125; index++) {
    server.publish({
      agent_id: 'load-agent',
      decision: index % 2 === 0 ? 'ALLOW' : 'DENY',
      receipt_id: `receipt-${index}`,
    });
  }

  const events = await client.nextMany('governance_event', 125, 5_000);
  assert.equal(events.length, 125);
  assert.equal(server.stream.metrics().dropped_for_backpressure, 0);
});

test('bounded client buffer drops oldest events when slow clients exceed capacity', () => {
  const queue = new BoundedEventQueue<number>(3);
  queue.push(1);
  queue.push(2);
  queue.push(3);
  queue.push(4);
  queue.push(5);

  assert.equal(queue.droppedCount, 2);
  assert.deepEqual([queue.shift(), queue.shift(), queue.shift()], [3, 4, 5]);
});

test('TealEngine adapter publishes decisions produced by evaluation methods', async () => {
  const stream = new GovernanceEventStream();
  const received = new Promise((resolve) => {
    const unsubscribe = stream.subscribe((event) => {
      unsubscribe();
      resolve(event.message);
    });
  });
  const engine = {
    evaluateWithMode(context: { agentId: string }) {
      return {
        action: 'DENY',
        reason: 'blocked by policy',
        correlation_id: 'corr-1',
        reason_codes: ['POLICY_VIOLATION'],
        metadata: { source: 'test' },
        context,
      };
    },
  };

  const detach = attachTealEngineStreaming(engine, stream);
  engine.evaluateWithMode({ agentId: 'adapter-agent' });
  const message = await received as { data: Record<string, unknown> };
  detach();

  assert.equal(message.data.agent_id, 'adapter-agent');
  assert.equal(message.data.decision, 'DENY');
  assert.equal(message.data.correlation_id, 'corr-1');
});

async function buildServer(
  t: test.TestContext,
  options: Parameters<typeof createGovernanceStreamServer>[0] = {},
): Promise<{ server: GovernanceStreamServer; started: Awaited<ReturnType<GovernanceStreamServer['start']>> }> {
  const server = createGovernanceStreamServer(options);
  const started = await server.start(0);

  t.after(async () => {
    await server.stop();
  });

  return { server, started };
}

class WebSocketReader {
  readonly messages: StreamMessage[] = [];

  private waiters: Array<() => boolean> = [];

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (payload) => {
      this.messages.push(JSON.parse(payload.toString()) as StreamMessage);
      this.resolveWaiters();
    });
  }

  static connect(url: string): Promise<WebSocketReader> {
    const socket = new WebSocket(url);
    const reader = new WebSocketReader(socket);
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(reader));
      socket.once('error', reject);
    });
  }

  next(type: StreamMessage['type'], timeoutMs = 1_000): Promise<StreamMessage> {
    const existing = this.take(type);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${type}`));
      }, timeoutMs);
      const waiter = (): boolean => {
        const message = this.take(type);
        if (!message) {
          return false;
        }
        clearTimeout(timeout);
        resolve(message);
        return true;
      };
      this.waiters.push(waiter);
      timeout.unref();
    });
  }

  async nextMany(
    type: StreamMessage['type'],
    count: number,
    timeoutMs = 1_000,
  ): Promise<StreamMessage[]> {
    const result: StreamMessage[] = [];
    const deadline = Date.now() + timeoutMs;
    while (result.length < count) {
      result.push(await this.next(type, Math.max(1, deadline - Date.now())));
    }
    return result;
  }

  private take(type: StreamMessage['type']): StreamMessage | undefined {
    const index = this.messages.findIndex((message) => message.type === type);
    if (index === -1) {
      return undefined;
    }
    const [message] = this.messages.splice(index, 1);
    return message;
  }

  private resolveWaiters(): void {
    this.waiters = this.waiters.filter((waiter) => !waiter());
  }
}

function readUntilSseEvent(url: string, eventName: string, containsText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    const request = get(url, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
        if (body.includes(`event: ${eventName}`) && body.includes(containsText)) {
          request.destroy();
          resolve(body);
        }
      });
      response.on('error', reject);
    });
    request.on('error', (error) => {
      if (body.includes(`event: ${eventName}`) && body.includes(containsText)) {
        resolve(body);
        return;
      }
      reject(error);
    });
  });
}
