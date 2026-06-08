'use strict';

const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const {
  DEFAULT_DB_PATH,
  DEFAULT_PORT,
  CliError,
  openEventStore,
  parseDashboardArgs,
  parsePort,
  resolveDatabasePath,
  rowToReceipt,
} = require('../../cli/tealtiger-dashboard-cli');

test('dashboard args default to localhost port 3000 with browser open', () => {
  assert.deepEqual(parseDashboardArgs([]), {
    port: DEFAULT_PORT,
    open: true,
    db: DEFAULT_DB_PATH,
    help: false,
  });
});

test('dashboard args accept custom port, db path, and no-open flag', () => {
  assert.deepEqual(parseDashboardArgs(['--port', '4321', '--db', './events.sqlite', '--no-open']), {
    port: 4321,
    open: false,
    db: './events.sqlite',
    help: false,
  });

  assert.deepEqual(parseDashboardArgs(['--port=3200', '--db=/tmp/events.db']), {
    port: 3200,
    open: true,
    db: '/tmp/events.db',
    help: false,
  });
});

test('dashboard args reject unknown options and invalid ports', () => {
  assert.throws(() => parseDashboardArgs(['--unknown']), CliError);
  assert.throws(() => parseDashboardArgs(['--port', '0']), /Invalid port/);
  assert.throws(() => parseDashboardArgs(['--port=70000']), /Invalid port/);
  assert.throws(() => parsePort('not-a-number'), /Invalid port/);
});

test('database path resolution expands the default store path', () => {
  const home = join('/tmp', 'tealtiger-home');
  const resolved = resolveDatabasePath(DEFAULT_DB_PATH, home);

  assert.equal(resolved.url, `file:${resolve(home, '.tealtiger/events.db')}`);
  assert.equal(resolved.displayPath, DEFAULT_DB_PATH);
});

test('database path resolution accepts file urls and custom relative paths', () => {
  assert.deepEqual(resolveDatabasePath('file:/tmp/events.db'), {
    url: 'file:/tmp/events.db',
    displayPath: '/tmp/events.db',
  });

  const resolved = resolveDatabasePath('./local-events.db', '/tmp/ignored');
  assert.equal(resolved.url, `file:${resolve('./local-events.db')}`);
  assert.equal(resolved.displayPath, resolve('./local-events.db'));
});

test('event store opens a missing database and initializes the schema', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-dashboard-db-'));
  const databasePath = join(directory, 'nested', 'events.db');
  const { client } = await openEventStore(`file:${databasePath}`);

  t.after(() => {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const tables = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'governance_events'
  `);

  assert.equal(tables.rows.length, 1);
  assert.equal(existsSync(databasePath), true);
});

test('event store rows become dashboard stream receipts', () => {
  const receipt = rowToReceipt({
    id: 'evt-1',
    timestamp: Date.parse('2026-06-01T12:00:00.000Z'),
    agent_id: 'checkout-agent',
    agent_name: 'Checkout Agent',
    decision: 'DENY',
    tool: 'delete_record',
    provider: 'openai',
    model: 'gpt-4o-mini',
    cost_usd: 0.15,
    severity: 'high',
    reason: 'Tool denied by policy',
    framework: 'eu-ai-act',
    receipt_json: '{"receipt_id":"receipt-1","reason":"from receipt"}',
    metadata_json: '{"trace_id":"trace-1"}',
  });

  assert.equal(receipt.event_id, 'evt-1');
  assert.equal(receipt.timestamp, '2026-06-01T12:00:00.000Z');
  assert.equal(receipt.agent_id, 'checkout-agent');
  assert.equal(receipt.decision, 'DENY');
  assert.equal(receipt.reason, 'Tool denied by policy');
  assert.equal(receipt.receipt_id, 'receipt-1');
  assert.deepEqual(receipt.metadata, { trace_id: 'trace-1' });
});
