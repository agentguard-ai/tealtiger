import assert from 'node:assert/strict';

import {
  filterSecurityEvents,
  sampleSecurityEvents,
  summarizeSeverityByDay,
  type SecurityEventFilters,
} from './security-events';

const baseFilters: SecurityEventFilters = {
  severity: 'all',
  type: 'all',
  agent: 'all',
  timeRange: 'all',
  search: '',
};

const now = Date.parse('2026-05-30T15:00:00.000Z');

assert.equal(
  filterSecurityEvents(sampleSecurityEvents, { ...baseFilters, severity: 'critical' }, now).length,
  2,
  'filters by severity',
);

assert.deepEqual(
  filterSecurityEvents(sampleSecurityEvents, { ...baseFilters, type: 'budget_exceeded' }, now).map((event) => event.id),
  ['sec-002'],
  'filters by event type',
);

assert.deepEqual(
  filterSecurityEvents(sampleSecurityEvents, { ...baseFilters, agent: 'code-agent' }, now).map((event) => event.id),
  ['sec-003'],
  'filters by agent',
);

assert.deepEqual(
  filterSecurityEvents(sampleSecurityEvents, { ...baseFilters, timeRange: '24h' }, now).map((event) => event.id),
  ['sec-001', 'sec-002', 'sec-003', 'sec-004'],
  'filters by 24 hour range',
);

assert.deepEqual(
  filterSecurityEvents(sampleSecurityEvents, { ...baseFilters, search: 'ASI-01' }, now).map((event) => event.id),
  ['sec-003'],
  'searches OWASP ASI tags',
);

assert.deepEqual(
  summarizeSeverityByDay(sampleSecurityEvents),
  [
    { date: '2026-05-27', critical: 0, high: 0, medium: 0, low: 0, info: 1 },
    { date: '2026-05-28', critical: 0, high: 0, medium: 0, low: 1, info: 0 },
    { date: '2026-05-29', critical: 1, high: 0, medium: 0, low: 0, info: 0 },
    { date: '2026-05-30', critical: 1, high: 1, medium: 1, low: 0, info: 0 },
  ],
  'summarizes severity distribution by day',
);

console.log('security event filters passed');
