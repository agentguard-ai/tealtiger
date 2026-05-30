import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createGovernanceApiServer, type GovernanceApiServer } from '../../api/governance-events/server';
import { type NewGovernanceEventRow } from '../../api/governance-events/schema';

const baseTime = Date.parse('2026-05-30T12:00:00.000Z');

test('health and OpenAPI endpoints are available', async (t) => {
  const server = await buildTestServer(t);

  const health = await server.app.inject({ method: 'GET', url: '/api/v1/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, 'ok');
  assert.equal(health.json().database, 'connected');

  const openApi = await server.app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
  assert.equal(openApi.statusCode, 200);
  assert.equal(openApi.json().info.title, 'TealTiger Governance Events API');
  assert.ok(openApi.json().paths['/api/v1/events']);
});

test('events endpoint supports pagination, filtering, sorting, and search', async (t) => {
  const server = await buildTestServer(t);

  const pageOne = await server.app.inject({
    method: 'GET',
    url: '/api/v1/events?agent=checkout-agent&limit=1&page=1&sort=timestamp',
  });
  assert.equal(pageOne.statusCode, 200);
  assert.equal(pageOne.json().data.length, 1);
  assert.equal(pageOne.json().pagination.total, 2);
  assert.equal(pageOne.json().data[0].id, 'evt-1');
  assert.ok(pageOne.json().meta.query_time_ms < 50);

  const pageTwo = await server.app.inject({
    method: 'GET',
    url: '/api/v1/events?agent=checkout-agent&limit=1&page=2&sort=timestamp',
  });
  assert.equal(pageTwo.json().data[0].id, 'evt-2');

  const denied = await server.app.inject({
    method: 'GET',
    url: '/api/v1/events?decision=DENY&tool=delete_record&search=denied',
  });
  assert.equal(denied.statusCode, 200);
  assert.equal(denied.json().pagination.total, 1);
  assert.equal(denied.json().data[0].decision, 'DENY');

  const ranged = await server.app.inject({
    method: 'GET',
    url: `/api/v1/events?from=${encodeURIComponent(new Date(baseTime + 1).toISOString())}`,
  });
  assert.equal(ranged.statusCode, 200);
  assert.equal(ranged.json().pagination.total, 4);

  const invalid = await server.app.inject({
    method: 'GET',
    url: '/api/v1/events?decision=BLOCK',
  });
  assert.equal(invalid.statusCode, 400);
});

test('single event endpoint returns the full TEEC receipt', async (t) => {
  const server = await buildTestServer(t);

  const found = await server.app.inject({ method: 'GET', url: '/api/v1/events/evt-2' });
  assert.equal(found.statusCode, 200);
  assert.equal(found.json().id, 'evt-2');
  assert.equal(found.json().receipt.decision, 'DENY');
  assert.equal(found.json().receipt.receipt_id, 'receipt-evt-2');

  const missing = await server.app.inject({ method: 'GET', url: '/api/v1/events/not-found' });
  assert.equal(missing.statusCode, 404);
});

test('agents endpoints return known agents and aggregate stats', async (t) => {
  const server = await buildTestServer(t);

  const agents = await server.app.inject({ method: 'GET', url: '/api/v1/agents?limit=2' });
  assert.equal(agents.statusCode, 200);
  assert.equal(agents.json().pagination.total, 3);
  assert.equal(agents.json().data.length, 2);

  const stats = await server.app.inject({ method: 'GET', url: '/api/v1/agents/checkout-agent/stats' });
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.json().event_count, 2);
  assert.equal(stats.json().decisions.ALLOW, 1);
  assert.equal(stats.json().decisions.DENY, 1);
  assert.equal(stats.json().security_event_count, 1);
});

test('cost endpoints summarize by agent, provider, and timeline bucket', async (t) => {
  const server = await buildTestServer(t);

  const summary = await server.app.inject({ method: 'GET', url: '/api/v1/cost/summary?provider=openai' });
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json().total_events, 4);
  assert.ok(summary.json().total_cost_usd > 0);
  assert.equal(summary.json().by_provider[0].provider, 'openai');

  const timeline = await server.app.inject({ method: 'GET', url: '/api/v1/cost/timeline?granularity=hourly' });
  assert.equal(timeline.statusCode, 200);
  assert.ok(timeline.json().data.length >= 1);
  assert.ok(timeline.json().data[0].bucket.endsWith('Z'));
});

test('security events endpoint returns severity-scoped events', async (t) => {
  const server = await buildTestServer(t);

  const allSecurity = await server.app.inject({ method: 'GET', url: '/api/v1/security/events' });
  assert.equal(allSecurity.statusCode, 200);
  assert.equal(allSecurity.json().pagination.total, 3);
  assert.ok(allSecurity.json().data.every((event: { severity: string | null }) => event.severity !== null));

  const highSeverity = await server.app.inject({ method: 'GET', url: '/api/v1/security/events?severity=high' });
  assert.equal(highSeverity.statusCode, 200);
  assert.equal(highSeverity.json().pagination.total, 1);
  assert.equal(highSeverity.json().data[0].id, 'evt-2');
});

test('compliance endpoints return status and generated reports', async (t) => {
  const server = await buildTestServer(t);

  const status = await server.app.inject({ method: 'GET', url: '/api/v1/compliance/eu-ai-act' });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().framework, 'eu-ai-act');
  assert.equal(status.json().status, 'fail');
  assert.equal(status.json().violation_count, 2);

  const report = await server.app.inject({
    method: 'POST',
    url: '/api/v1/compliance/report',
    payload: { framework: 'eu-ai-act' },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.json().framework, 'eu-ai-act');
  assert.equal(report.json().summary.violation_count, 2);
});

test('SSE stream endpoint returns an event stream response', async (t) => {
  const server = await buildTestServer(t);
  const response = await server.app.inject({ method: 'GET', url: '/api/v1/events/stream' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] as string, /text\/event-stream/);
  assert.match(response.body, /event: ready/);
});

async function buildTestServer(t: test.TestContext): Promise<GovernanceApiServer> {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-api-'));
  const databasePath = join(directory, 'events.sqlite');
  const server = await createGovernanceApiServer({
    databaseUrl: `file:${databasePath}`,
    seedEvents: fixtureEvents(),
  });

  t.after(async () => {
    await server.app.close();
    server.database.client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  return server;
}

function fixtureEvents(): NewGovernanceEventRow[] {
  return [
    eventFixture({
      id: 'evt-1',
      timestamp: baseTime,
      agentId: 'checkout-agent',
      agentName: 'Checkout Agent',
      decision: 'ALLOW',
      tool: 'search_docs',
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUsd: 0.12,
      severity: null,
      reason: 'Request allowed by policy',
      framework: 'eu-ai-act',
    }),
    eventFixture({
      id: 'evt-2',
      timestamp: baseTime + 60_000,
      agentId: 'checkout-agent',
      agentName: 'Checkout Agent',
      decision: 'DENY',
      tool: 'delete_record',
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUsd: 0.02,
      severity: 'high',
      reason: 'Tool denied by policy',
      framework: 'eu-ai-act',
    }),
    eventFixture({
      id: 'evt-3',
      timestamp: baseTime + 120_000,
      agentId: 'deploy-agent',
      agentName: 'Deploy Agent',
      decision: 'REQUIRE_APPROVAL',
      tool: 'deploy',
      provider: 'anthropic',
      model: 'claude-sonnet',
      costUsd: 0.28,
      severity: 'medium',
      reason: 'Deployment requires approval',
      framework: 'eu-ai-act',
    }),
    eventFixture({
      id: 'evt-4',
      timestamp: baseTime + 180_000,
      agentId: 'analyst-agent',
      agentName: 'Analyst Agent',
      decision: 'REVISE',
      tool: 'query_database',
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUsd: 0.06,
      severity: 'low',
      reason: 'Query must revise requested columns',
      framework: 'nist-ai-rmf',
    }),
    eventFixture({
      id: 'evt-5',
      timestamp: baseTime + 240_000,
      agentId: 'analyst-agent',
      agentName: 'Analyst Agent',
      decision: 'ALLOW',
      tool: 'read_report',
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUsd: 0.04,
      severity: null,
      reason: 'Report read allowed',
      framework: 'eu-ai-act',
    }),
  ];
}

function eventFixture(event: Omit<NewGovernanceEventRow, 'receiptJson' | 'metadataJson'>): NewGovernanceEventRow {
  return {
    ...event,
    receiptJson: JSON.stringify({
      receipt_id: `receipt-${event.id}`,
      decision: event.decision,
      agent_id: event.agentId,
      tool: event.tool,
      issued_at: new Date(event.timestamp).toISOString(),
    }),
    metadataJson: JSON.stringify({
      trace_id: `trace-${event.id}`,
      source: 'test',
    }),
  };
}
