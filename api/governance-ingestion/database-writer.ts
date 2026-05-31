import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

import { createClient, type Client } from '@libsql/client';

import type { BatchWriteResult, GovernanceEventWriter, NormalizedGovernanceEvent } from './types';

type SqlArg = string | number | null;

export class InMemoryGovernanceEventWriter implements GovernanceEventWriter {
  readonly records = new Map<string, NormalizedGovernanceEvent>();
  readonly batchSizes: number[] = [];

  async writeBatch(events: NormalizedGovernanceEvent[]): Promise<BatchWriteResult> {
    this.batchSizes.push(events.length);
    let inserted = 0;
    let duplicates = 0;
    for (const event of events) {
      if (this.records.has(event.correlationId)) {
        duplicates++;
        continue;
      }
      this.records.set(event.correlationId, event);
      inserted++;
    }
    return { inserted, duplicates };
  }
}

export class LibSqlGovernanceEventWriter implements GovernanceEventWriter {
  readonly client: Client;

  constructor(databaseUrl: string) {
    ensureDatabaseDirectory(databaseUrl);
    this.client = createClient({ url: databaseUrl });
  }

  async initialize(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS governance_events (
        correlation_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        agent_id TEXT,
        decision TEXT NOT NULL,
        event_type TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      )
    `);
    await this.client.execute('CREATE INDEX IF NOT EXISTS idx_ingestion_timestamp ON governance_events(timestamp)');
    await this.client.execute('CREATE INDEX IF NOT EXISTS idx_ingestion_agent ON governance_events(agent_id)');
    await this.client.execute('CREATE INDEX IF NOT EXISTS idx_ingestion_decision ON governance_events(decision)');
  }

  async writeBatch(events: NormalizedGovernanceEvent[]): Promise<BatchWriteResult> {
    let inserted = 0;
    let duplicates = 0;
    for (const event of events) {
      const result = await this.client.execute({
        sql: `
          INSERT OR IGNORE INTO governance_events
            (correlation_id, timestamp, agent_id, decision, event_type, receipt_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: eventToArgs(event),
      });
      if (Number(result.rowsAffected) > 0) {
        inserted++;
      } else {
        duplicates++;
      }
    }
    return { inserted, duplicates };
  }

  async count(): Promise<number> {
    const result = await this.client.execute('SELECT COUNT(*) AS total FROM governance_events');
    return Number(result.rows[0]?.total ?? 0);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

function eventToArgs(event: NormalizedGovernanceEvent): SqlArg[] {
  return [
    event.correlationId,
    event.timestamp,
    event.agentId,
    event.decision,
    event.eventType,
    JSON.stringify(event.receipt),
  ];
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

