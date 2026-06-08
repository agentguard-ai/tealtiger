import { performance } from 'node:perf_hooks';

import { normalizeGovernanceEvent, decisionFromEvaluationResult } from './validator';
import { MemoryWriteAheadLog } from './wal';
import type {
  GovernanceIngestionPipelineOptions,
  IngestionMetrics,
  IngestionResult,
  IngestionWarning,
  NormalizedGovernanceEvent,
  TEECReceipt,
} from './types';

export class GovernanceIngestionPipeline {
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly buffer: NormalizedGovernanceEvent[] = [];
  private readonly metricsState: IngestionMetrics = {
    accepted: 0,
    invalid: 0,
    queued: 0,
    written: 0,
    duplicates: 0,
    dropped: 0,
    batches: 0,
    writer_errors: 0,
    wal_errors: 0,
    buffer_size: 0,
    last_flush_duration_ms: null,
  };

  private flushTimer: NodeJS.Timeout | null = null;
  private appendQueue: Promise<void> = Promise.resolve();
  private flushPromise: Promise<void> | null = null;

  constructor(private readonly options: GovernanceIngestionPipelineOptions) {
    this.batchSize = options.batchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 1_000;
    this.maxBufferSize = options.maxBufferSize ?? 10_000;
    if (this.batchSize < 1 || this.maxBufferSize < 1) {
      throw new Error('batchSize and maxBufferSize must be positive integers');
    }
    this.options.wal ??= new MemoryWriteAheadLog();
  }

  async start(): Promise<void> {
    await this.options.writer.initialize?.();
    await this.options.wal?.initialize?.();
    const recovered = await this.options.wal?.recover() ?? [];
    for (const event of recovered) {
      this.enqueue(event);
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.flushTimer.unref();
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.waitForIdle();
    await this.options.writer.close?.();
    await this.options.wal?.close?.();
  }

  ingest(receipt: TEECReceipt, context: Record<string, unknown> = {}): IngestionResult {
    const startedAt = performance.now();
    let event: NormalizedGovernanceEvent;
    try {
      event = normalizeGovernanceEvent(receipt, context);
    } catch (error) {
      this.metricsState.invalid++;
      this.warn({
        code: 'invalid_event',
        message: error instanceof Error ? error.message : 'Invalid TEEC receipt',
        error,
      });
      return {
        accepted: false,
        reason: error instanceof Error ? error.message : 'Invalid TEEC receipt',
        latencyMs: performance.now() - startedAt,
      };
    }

    this.metricsState.accepted++;
    this.appendQueue = this.appendQueue
      .then(async () => {
        await this.options.wal?.append(event);
        this.enqueue(event);
        this.options.broadcast?.(event);
      })
      .catch((error: unknown) => {
        this.metricsState.wal_errors++;
        this.warn({
          code: 'wal_error',
          message: 'Failed to append governance event to write-ahead log',
          correlationId: event.correlationId,
          error,
        });
      });

    return {
      accepted: true,
      correlationId: event.correlationId,
      latencyMs: performance.now() - startedAt,
    };
  }

  ingestDecision(decision: unknown, context?: unknown): IngestionResult {
    return this.ingest(decisionFromEvaluationResult(decision, context), toRecord(context));
  }

  async flush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }
    this.flushPromise = this.drain();
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }

  async waitForIdle(): Promise<void> {
    await this.appendQueue;
    await this.flush();
  }

  metrics(): IngestionMetrics {
    return {
      ...this.metricsState,
      buffer_size: this.buffer.length,
    };
  }

  private enqueue(event: NormalizedGovernanceEvent): void {
    if (this.buffer.length >= this.maxBufferSize) {
      const dropped = this.buffer.shift();
      if (dropped) {
        this.metricsState.dropped++;
        this.metricsState.queued = Math.max(0, this.metricsState.queued - 1);
        void this.options.wal?.remove([dropped.correlationId]);
        this.warn({
          code: 'buffer_overflow',
          message: 'Governance ingestion buffer is full; dropped oldest event',
          correlationId: dropped.correlationId,
        });
      }
    }

    this.buffer.push(event);
    this.metricsState.queued++;
    if (this.buffer.length >= this.batchSize) {
      setImmediate(() => {
        void this.flush();
      });
    }
  }

  private async drain(): Promise<void> {
    await this.appendQueue;
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.batchSize);
      const startedAt = performance.now();
      try {
        const result = await this.options.writer.writeBatch(batch);
        this.metricsState.written += result.inserted;
        this.metricsState.duplicates += result.duplicates;
        this.metricsState.batches++;
        this.metricsState.queued = Math.max(0, this.metricsState.queued - batch.length);
        this.metricsState.last_flush_duration_ms = performance.now() - startedAt;
        await this.options.wal?.remove(batch.map((event) => event.correlationId));
      } catch (error) {
        this.metricsState.writer_errors++;
        this.buffer.unshift(...batch);
        this.warn({
          code: 'writer_error',
          message: 'Failed to persist governance event batch',
          error,
        });
        return;
      }
    }
  }

  private warn(warning: IngestionWarning): void {
    this.options.onWarning?.(warning);
  }
}

export function createGovernanceIngestionPipeline(
  options: GovernanceIngestionPipelineOptions,
): GovernanceIngestionPipeline {
  return new GovernanceIngestionPipeline(options);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
