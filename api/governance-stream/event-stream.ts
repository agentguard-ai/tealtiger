import { EventEmitter } from 'node:events';

import { matchesFilter, readAgentId, readDecision, readEventType } from './filters';
import type {
  GovernanceEventMessage,
  PublishOptions,
  StoredGovernanceEvent,
  StreamMetrics,
  SubscriptionFilter,
  TEECReceipt,
} from './types';

export interface GovernanceEventStreamOptions {
  historyLimit?: number;
}

export class GovernanceEventStream {
  private readonly emitter = new EventEmitter();
  private readonly historyLimit: number;
  private readonly history: StoredGovernanceEvent[] = [];
  private sequence = 0;
  private published = 0;
  private subscriberCount = 0;
  private droppedForBackpressure = 0;

  constructor(options: GovernanceEventStreamOptions = {}) {
    this.historyLimit = options.historyLimit ?? 10_000;
  }

  publish(receipt: TEECReceipt, options: PublishOptions = {}): GovernanceEventMessage {
    const sequence = ++this.sequence;
    const timestamp = normalizeTimestamp(options.timestamp ?? receipt.timestamp ?? Date.now());
    const message: GovernanceEventMessage = {
      type: 'governance_event',
      id: options.id ?? `evt_${sequence}`,
      cursor: String(sequence),
      timestamp,
      data: receipt,
    };
    const event: StoredGovernanceEvent = {
      sequence,
      message,
      agentId: readAgentId(receipt),
      decision: readDecision(receipt),
      eventType: options.eventType ?? readEventType(receipt),
    };

    this.published++;
    this.history.push(event);
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    this.emitter.emit('event', event);
    return message;
  }

  subscribe(listener: (event: StoredGovernanceEvent) => void): () => void {
    this.subscriberCount++;
    this.emitter.on('event', listener);
    return () => {
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
      this.emitter.off('event', listener);
    };
  }

  replayAfter(cursor: string | undefined, filter: SubscriptionFilter): StoredGovernanceEvent[] {
    if (!cursor) {
      return [];
    }
    const sequence = parseCursor(cursor);
    return this.history.filter((event) => event.sequence > sequence && matchesFilter(event, filter));
  }

  latestCursor(): string {
    return String(this.sequence);
  }

  recordBackpressureDrop(count = 1): void {
    this.droppedForBackpressure += count;
  }

  metrics(): StreamMetrics {
    return {
      published: this.published,
      retained: this.history.length,
      subscribers: this.subscriberCount,
      dropped_for_backpressure: this.droppedForBackpressure,
    };
  }
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  const parsed = Number(cursor);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeTimestamp(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
