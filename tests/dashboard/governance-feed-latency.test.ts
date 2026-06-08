import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateLatencyBuckets } from '../../dashboard/governance-feed/src/event-utils';
import type { FeedEvent } from '../../dashboard/governance-feed/src/types';

test('latency buckets count events across required ranges', () => {
  const buckets = calculateLatencyBuckets([
    eventWithLatency(0),
    eventWithLatency(0.99),
    eventWithLatency(1),
    eventWithLatency(1.99),
    eventWithLatency(2),
    eventWithLatency(4.99),
    eventWithLatency(5),
    eventWithLatency(9.99),
    eventWithLatency(10),
    eventWithLatency(42),
  ]);

  assert.deepEqual(
    buckets.map(({ label, count }) => ({ label, count })),
    [
      { label: '0-1ms', count: 2 },
      { label: '1-2ms', count: 2 },
      { label: '2-5ms', count: 2 },
      { label: '5-10ms', count: 2 },
      { label: '10ms+', count: 2 },
    ],
  );
});

test('latency buckets preserve all ranges for empty data', () => {
  const buckets = calculateLatencyBuckets([]);

  assert.deepEqual(
    buckets.map(({ label, count }) => ({ label, count })),
    [
      { label: '0-1ms', count: 0 },
      { label: '1-2ms', count: 0 },
      { label: '2-5ms', count: 0 },
      { label: '5-10ms', count: 0 },
      { label: '10ms+', count: 0 },
    ],
  );
});

function eventWithLatency(latencyMs: number): FeedEvent {
  return {
    id: `evt-${latencyMs}`,
    cursor: String(latencyMs),
    timestamp: '2026-06-01T12:00:00.000Z',
    agent: 'test-agent',
    tool: 'test.tool',
    decision: 'ALLOW',
    reason: 'Allowed by policy',
    latencyMs,
    receipt: {},
  };
}
