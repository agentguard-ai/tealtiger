import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import { governanceEvents, type NewGovernanceEventRow } from './schema';

export interface ApiDatabase {
  client: Client;
  db: LibSQLDatabase;
}

export async function createApiDatabase(databaseUrl: string): Promise<ApiDatabase> {
  ensureDatabaseDirectory(databaseUrl);
  const client = createClient({ url: databaseUrl });
  const db = drizzle(client);
  await initializeSchema(client);
  return { client, db };
}

function ensureDatabaseDirectory(databaseUrl: string): void {
  if (!databaseUrl.startsWith('file:') || databaseUrl === 'file::memory:') {
    return;
  }

  const filePath = databaseUrl.replace('file:', '');
  if (!filePath || filePath.startsWith(':')) {
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
}

export async function initializeSchema(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS governance_events (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT,
      decision TEXT NOT NULL,
      tool TEXT,
      provider TEXT,
      model TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      severity TEXT,
      reason TEXT NOT NULL,
      framework TEXT,
      receipt_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON governance_events(timestamp)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_agent ON governance_events(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_decision ON governance_events(decision)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_tool ON governance_events(tool)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_severity ON governance_events(severity)');
}

export async function seedGovernanceEvents(
  database: ApiDatabase,
  events: NewGovernanceEventRow[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await database.db.insert(governanceEvents).values(events);
}
