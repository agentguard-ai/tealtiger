import { z } from 'zod';

export const decisionSchema = z.enum(['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL']);
export const severitySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export const timelineGranularitySchema = z.enum(['hourly', 'daily']).default('daily');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const eventQuerySchema = paginationQuerySchema.extend({
  agent: z.string().min(1).optional(),
  decision: decisionSchema.optional(),
  tool: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  severity: severitySchema.optional(),
  sort: z.string().min(1).default('-timestamp'),
  search: z.string().min(1).optional(),
});

export const costQuerySchema = z.object({
  agent: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const timelineQuerySchema = costQuerySchema.extend({
  granularity: timelineGranularitySchema,
});

export const complianceReportBodySchema = z.object({
  framework: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const eventResponseSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agent_id: z.string(),
  agent_name: z.string().nullable(),
  decision: decisionSchema,
  tool: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  cost_usd: z.number(),
  severity: severitySchema.nullable(),
  reason: z.string(),
  framework: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const eventWithReceiptResponseSchema = eventResponseSchema.extend({
  receipt: z.record(z.string(), z.unknown()),
});

export const paginationResponseSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export const metaResponseSchema = z.object({
  query_time_ms: z.number(),
});

export const paginatedEventsResponseSchema = z.object({
  data: z.array(eventResponseSchema),
  pagination: paginationResponseSchema,
  meta: metaResponseSchema,
});

export const agentResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  event_count: z.number().int(),
  total_cost_usd: z.number(),
  last_seen: z.string().nullable(),
});

export const paginatedAgentsResponseSchema = z.object({
  data: z.array(agentResponseSchema),
  pagination: paginationResponseSchema,
  meta: metaResponseSchema,
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('tealtiger-governance-api'),
  database: z.literal('connected'),
  uptime_seconds: z.number(),
  timestamp: z.string(),
});

export type EventQuery = z.infer<typeof eventQuerySchema>;
export type CostQuery = z.infer<typeof costQuerySchema>;
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
export type ComplianceReportBody = z.infer<typeof complianceReportBodySchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type EventWithReceiptResponse = z.infer<typeof eventWithReceiptResponseSchema>;
