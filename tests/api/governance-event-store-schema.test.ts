import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient, type Client } from '@libsql/client';

const apiDecisionValues = ['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL'] as const;

test('governance event store schema accepts all API decision values', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-schema-'));
  const databasePath = join(directory, 'events.sqlite');
  const client = createClient({ url: `file:${databasePath}` });

  t.after(async () => {
    client.close();
    await removeTempDirectory(directory);
  });

  const schema = readFileSync(join(process.cwd(), 'api/governance-events/schema.sql'), 'utf8');
  await client.executeMultiple(schema);
  await client.execute({
    sql: `
      INSERT INTO agents (id, external_id, name, registered_at, updated_at)
      VALUES ('agent-1', 'agent-1', 'Schema Test Agent', 1780000000000, 1780000000000)
    `,
    args: [],
  });

  for (const decision of apiDecisionValues) {
    await insertGovernanceEvent(client, decision);
  }

  const result = await client.execute('SELECT decision FROM governance_events ORDER BY decision');
  assert.deepEqual(
    result.rows.map((row) => row.decision),
    [...apiDecisionValues].sort(),
  );

  await assert.rejects(
    () => insertGovernanceEvent(client, 'BLOCK'),
    /CHECK constraint failed/,
  );
});

async function insertGovernanceEvent(client: Client, decision: string): Promise<void> {
  await client.execute({
    sql: `
      INSERT INTO governance_events (
        id,
        timestamp,
        agent_id,
        decision,
        cost_usd,
        reason,
        receipt_json,
        metadata_json
      )
      VALUES (?, 1780000000000, 'agent-1', ?, 0, 'schema compatibility test', '{}', '{}')
    `,
    args: [`event-${decision.toLowerCase()}`, decision],
  });
}

async function removeTempDirectory(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 19 || !isWindowsPermissionError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

function isWindowsPermissionError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EPERM';
}
