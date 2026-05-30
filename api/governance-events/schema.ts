import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const governanceEvents = sqliteTable('governance_events', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
  agentId: text('agent_id').notNull(),
  agentName: text('agent_name'),
  decision: text('decision').notNull(),
  tool: text('tool'),
  provider: text('provider'),
  model: text('model'),
  costUsd: real('cost_usd').notNull().default(0),
  severity: text('severity'),
  reason: text('reason').notNull(),
  framework: text('framework'),
  receiptJson: text('receipt_json').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
});

export type GovernanceEventRow = typeof governanceEvents.$inferSelect;
export type NewGovernanceEventRow = typeof governanceEvents.$inferInsert;
