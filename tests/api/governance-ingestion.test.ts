import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachTealEngineIngestion,
  createGovernanceIngestionPipeline,
  FileWriteAheadLog,
  InMemoryGovernanceEventWriter,
  LibSqlGovernanceEventWriter,
  MemoryWriteAheadLog,
  type BatchWriteResult,
  type GovernanceEventWriter,
  type IngestionWarning,
  type NormalizedGovernanceEvent,
} from '../../api/governance-ingestion';

test('events flow from TealEngine evaluations to SQLite database', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-ingestion-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const writer = new LibSqlGovernanceEventWriter(`file:${join(directory, 'events.sqlite')}`);
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    wal: new MemoryWriteAheadLog(),
    batchSize: 1,
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  const engine = {
    evaluateWithMode(context: { agentId: string; correlation_id: string }) {
      return {
        action: 'DENY',
        reason: 'blocked by policy',
        correlation_id: context.correlation_id,
        reason_codes: ['POLICY_VIOLATION'],
      };
    },
  };
  const detach = attachTealEngineIngestion(engine, pipeline);

  engine.evaluateWithMode({ agentId: 'checkout-agent', correlation_id: 'corr-sqlite-1' });
  await pipeline.waitForIdle();
  detach();

  assert.equal(await writer.count(), 1);
  assert.equal(pipeline.metrics().written, 1);
});

test('batched writes reduce I/O with configurable batch size', async (t) => {
  const writer = new InMemoryGovernanceEventWriter();
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    batchSize: 3,
    flushIntervalMs: 60_000,
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  for (let index = 0; index < 3; index++) {
    pipeline.ingest(receipt(`batch-${index}`));
  }

  await pipeline.waitForIdle();
  assert.deepEqual(writer.batchSizes, [3]);
  assert.equal(writer.records.size, 3);
});

test('ingestion does not block the governance evaluation path', async (t) => {
  const writer = new DelayedWriter(50);
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    batchSize: 500,
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  const start = performance.now();
  for (let index = 0; index < 500; index++) {
    const result = pipeline.ingest(receipt(`latency-${index}`));
    assert.equal(result.accepted, true);
  }
  const averageMs = (performance.now() - start) / 500;

  assert.ok(averageMs < 1, `expected <1ms average ingestion latency, got ${averageMs}`);
  assert.equal(writer.records.size, 0);
  await pipeline.waitForIdle();
  assert.equal(writer.records.size, 500);
});

test('pipeline handles 1000+ events/sec sustained without dropping when buffer is sized', async (t) => {
  const writer = new InMemoryGovernanceEventWriter();
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    batchSize: 100,
    maxBufferSize: 2_000,
    flushIntervalMs: 1_000,
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  const start = performance.now();
  for (let index = 0; index < 1_250; index++) {
    pipeline.ingest(receipt(`throughput-${index}`));
  }
  await pipeline.waitForIdle();

  assert.equal(writer.records.size, 1_250);
  assert.equal(pipeline.metrics().dropped, 0);
  assert.ok(performance.now() - start < 1_000);
});

test('deduplication treats repeated correlation IDs as idempotent inserts', async (t) => {
  const writer = new InMemoryGovernanceEventWriter();
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    batchSize: 10,
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  pipeline.ingest(receipt('dedupe-1'));
  pipeline.ingest(receipt('dedupe-1'));
  await pipeline.waitForIdle();

  assert.equal(writer.records.size, 1);
  assert.equal(pipeline.metrics().duplicates, 1);
});

test('buffer overflow drops oldest events and reports a warning', async (t) => {
  const warnings: IngestionWarning[] = [];
  const writer = new InMemoryGovernanceEventWriter();
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    batchSize: 100,
    flushIntervalMs: 60_000,
    maxBufferSize: 3,
    onWarning: (warning) => warnings.push(warning),
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  for (let index = 0; index < 5; index++) {
    pipeline.ingest(receipt(`overflow-${index}`));
  }

  await pipeline.waitForIdle();
  assert.equal(writer.records.size, 3);
  assert.equal(pipeline.metrics().dropped, 2);
  assert.equal(warnings.filter((warning) => warning.code === 'buffer_overflow').length, 2);
  assert.equal(writer.records.has('overflow-0'), false);
  assert.equal(writer.records.has('overflow-1'), false);
});

test('invalid TEEC receipts are rejected before persistence', async (t) => {
  const warnings: IngestionWarning[] = [];
  const writer = new InMemoryGovernanceEventWriter();
  const pipeline = createGovernanceIngestionPipeline({
    writer,
    onWarning: (warning) => warnings.push(warning),
  });
  await pipeline.start();
  t.after(async () => {
    await pipeline.stop();
  });

  const result = pipeline.ingest({ correlation_id: 'invalid-without-decision' });
  await pipeline.waitForIdle();

  assert.equal(result.accepted, false);
  assert.equal(writer.records.size, 0);
  assert.equal(pipeline.metrics().invalid, 1);
  assert.equal(warnings[0]?.code, 'invalid_event');
});

test('write-ahead log recovers events after a failed database write', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-wal-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const walPath = join(directory, 'events.wal');
  const warnings: IngestionWarning[] = [];

  const failingPipeline = createGovernanceIngestionPipeline({
    writer: new FailingWriter(),
    wal: new FileWriteAheadLog(walPath),
    batchSize: 1,
    onWarning: (warning) => warnings.push(warning),
  });
  await failingPipeline.start();
  failingPipeline.ingest(receipt('recover-1'));
  await failingPipeline.waitForIdle();
  await failingPipeline.stop();

  const recoveredWriter = new InMemoryGovernanceEventWriter();
  const recoveredPipeline = createGovernanceIngestionPipeline({
    writer: recoveredWriter,
    wal: new FileWriteAheadLog(walPath),
    batchSize: 1,
  });
  await recoveredPipeline.start();
  await recoveredPipeline.waitForIdle();
  await recoveredPipeline.stop();

  assert.equal(warnings.some((warning) => warning.code === 'writer_error'), true);
  assert.equal(recoveredWriter.records.size, 1);
  assert.equal(recoveredWriter.records.has('recover-1'), true);
});

function receipt(correlationId: string): Record<string, unknown> {
  return {
    correlation_id: correlationId,
    agent_id: 'agent-1',
    decision: 'ALLOW',
    event_type: 'governance_event',
    timestamp: '2026-05-30T10:30:01.000Z',
    reason_codes: ['POLICY_COMPLIANT'],
  };
}

class DelayedWriter extends InMemoryGovernanceEventWriter {
  constructor(private readonly delayMs: number) {
    super();
  }

  override async writeBatch(events: NormalizedGovernanceEvent[]): Promise<BatchWriteResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return super.writeBatch(events);
  }
}

class FailingWriter implements GovernanceEventWriter {
  async writeBatch(): Promise<BatchWriteResult> {
    throw new Error('database unavailable');
  }
}
