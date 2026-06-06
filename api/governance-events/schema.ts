import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  owner: text('owner'),
  environment: text('environment').notNull().default('development'),
  status: text('status').notNull().default('active'),
  provider: text('provider'),
  defaultModel: text('default_model'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  registeredAt: integer('registered_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_agents_external_id').on(table.externalId),
  index('idx_agents_status_environment').on(table.status, table.environment),
]);

export const governanceEvents = sqliteTable('governance_events', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
  agentId: text('agent_id').notNull(),
  agentName: text('agent_name'),
  decision: text('decision').notNull(),
  tool: text('tool'),
  toolName: text('tool_name'),
  provider: text('provider'),
  model: text('model'),
  costUsd: real('cost_usd').notNull().default(0),
  severity: text('severity'),
  reason: text('reason').notNull(),
  framework: text('framework'),
  receiptJson: text('receipt_json').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
}, (table) => [
  index('idx_events_timestamp').on(table.timestamp),
  index('idx_events_agent_timestamp').on(table.agentId, table.timestamp),
  index('idx_events_decision_timestamp').on(table.decision, table.timestamp),
  index('idx_events_tool_timestamp').on(table.tool, table.timestamp),
  index('idx_events_tool_name_timestamp').on(table.toolName, table.timestamp),
  index('idx_events_severity_timestamp').on(table.severity, table.timestamp),
]);

export const costRecords = sqliteTable('cost_records', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  agentId: text('agent_id').notNull(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  requestTokens: integer('request_tokens').notNull().default(0),
  responseTokens: integer('response_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  inputCostUsd: real('input_cost_usd').notNull().default(0),
  outputCostUsd: real('output_cost_usd').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  pricingVersion: text('pricing_version'),
  metadataJson: text('metadata_json').notNull().default('{}'),
}, (table) => [
  uniqueIndex('idx_cost_records_event_id').on(table.eventId),
  index('idx_cost_records_agent_timestamp').on(table.agentId, table.timestamp),
  index('idx_cost_records_provider_model').on(table.provider, table.model),
  index('idx_cost_records_timestamp').on(table.timestamp),
]);

export const securityEvents = sqliteTable('security_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  agentId: text('agent_id').notNull(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull(),
  decision: text('decision').notNull(),
  toolName: text('tool_name'),
  detector: text('detector'),
  redacted: integer('redacted', { mode: 'boolean' }).notNull().default(false),
  findingCount: integer('finding_count').notNull().default(0),
  evidenceJson: text('evidence_json').notNull().default('{}'),
  metadataJson: text('metadata_json').notNull().default('{}'),
}, (table) => [
  index('idx_security_events_agent_timestamp').on(table.agentId, table.timestamp),
  index('idx_security_events_type_timestamp').on(table.eventType, table.timestamp),
  index('idx_security_events_decision_timestamp').on(table.decision, table.timestamp),
  index('idx_security_events_tool_timestamp').on(table.toolName, table.timestamp),
]);

export const agentStatsHourly = sqliteTable('agent_stats_hourly', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  hourStart: integer('hour_start', { mode: 'number' }).notNull(),
  eventCount: integer('event_count').notNull().default(0),
  allowCount: integer('allow_count').notNull().default(0),
  denyCount: integer('deny_count').notNull().default(0),
  warnCount: integer('warn_count').notNull().default(0),
  securityEventCount: integer('security_event_count').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_agent_stats_hourly_agent_hour').on(table.agentId, table.hourStart),
  index('idx_agent_stats_hourly_hour').on(table.hourStart),
]);

export const costSummaryDaily = sqliteTable('cost_summary_daily', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  dayStart: integer('day_start', { mode: 'number' }).notNull(),
  provider: text('provider').notNull().default('all'),
  model: text('model').notNull().default('all'),
  requestCount: integer('request_count').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  budgetUsd: real('budget_usd'),
  budgetUtilization: real('budget_utilization'),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_cost_summary_daily_scope').on(table.agentId, table.dayStart, table.provider, table.model),
  index('idx_cost_summary_daily_day').on(table.dayStart),
]);

export const complianceStatus = sqliteTable('compliance_status', {
  id: text('id').primaryKey(),
  framework: text('framework').notNull(),
  controlId: text('control_id').notNull(),
  agentId: text('agent_id').notNull().default('all-agents'),
  status: text('status').notNull(),
  evidenceEventId: text('evidence_event_id'),
  lastEvaluatedAt: integer('last_evaluated_at', { mode: 'number' }).notNull(),
  nextReviewAt: integer('next_review_at', { mode: 'number' }),
  owner: text('owner'),
  notes: text('notes'),
  metadataJson: text('metadata_json').notNull().default('{}'),
}, (table) => [
  uniqueIndex('idx_compliance_status_scope').on(table.framework, table.controlId, table.agentId),
  index('idx_compliance_status_framework').on(table.framework, table.status),
  index('idx_compliance_status_next_review').on(table.nextReviewAt),
]);

export const policies = sqliteTable('policies', {
  id: text('id').primaryKey(),
  policyKey: text('policy_key').notNull(),
  version: text('version').notNull(),
  status: text('status').notNull().default('draft'),
  checksum: text('checksum').notNull(),
  policyJson: text('policy_json').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  activatedAt: integer('activated_at', { mode: 'number' }),
  retiredAt: integer('retired_at', { mode: 'number' }),
  createdBy: text('created_by'),
}, (table) => [
  uniqueIndex('idx_policies_key_version').on(table.policyKey, table.version),
  index('idx_policies_key_status').on(table.policyKey, table.status),
]);

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(),
  agentId: text('agent_id'),
  severity: text('severity').notNull().default('medium'),
  thresholdJson: text('threshold_json').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  notificationTarget: text('notification_target'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_alert_rules_enabled_type').on(table.enabled, table.ruleType),
  index('idx_alert_rules_agent').on(table.agentId),
]);

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
export type GovernanceEventRow = typeof governanceEvents.$inferSelect;
export type NewGovernanceEventRow = typeof governanceEvents.$inferInsert;
export type CostRecordRow = typeof costRecords.$inferSelect;
export type NewCostRecordRow = typeof costRecords.$inferInsert;
export type SecurityEventRow = typeof securityEvents.$inferSelect;
export type NewSecurityEventRow = typeof securityEvents.$inferInsert;
export type AgentStatsHourlyRow = typeof agentStatsHourly.$inferSelect;
export type NewAgentStatsHourlyRow = typeof agentStatsHourly.$inferInsert;
export type CostSummaryDailyRow = typeof costSummaryDaily.$inferSelect;
export type NewCostSummaryDailyRow = typeof costSummaryDaily.$inferInsert;
export type ComplianceStatusRow = typeof complianceStatus.$inferSelect;
export type NewComplianceStatusRow = typeof complianceStatus.$inferInsert;
export type PolicyRow = typeof policies.$inferSelect;
export type NewPolicyRow = typeof policies.$inferInsert;
export type AlertRuleRow = typeof alertRules.$inferSelect;
export type NewAlertRuleRow = typeof alertRules.$inferInsert;
