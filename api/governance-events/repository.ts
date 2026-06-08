import { type Client, type Row } from '@libsql/client';
import { and, asc, count, desc, eq, gte, like, lte, sql, type SQL } from 'drizzle-orm';

import { type ApiDatabase } from './database';
import { governanceEvents, type GovernanceEventRow, type NewGovernanceEventRow } from './schema';
import {
  type ComplianceReportBody,
  type CostQuery,
  type EventQuery,
  type EventResponse,
  type EventWithReceiptResponse,
  type TimelineQuery,
} from './validation';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  meta: {
    query_time_ms: number;
  };
}

export interface AgentStats {
  id: string;
  name: string | null;
  event_count: number;
  total_cost_usd: number;
  security_event_count: number;
  decisions: Record<string, number>;
  tools: Array<{ tool: string; count: number; total_cost_usd: number }>;
  last_seen: string | null;
}

type SqlArgs = Array<string | number | bigint | boolean | null>;

export class GovernanceEventRepository {
  constructor(private readonly database: ApiDatabase) {}

  async insertEvents(events: NewGovernanceEventRow[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.database.db.insert(governanceEvents).values(events);
  }

  async listEvents(query: EventQuery): Promise<PaginatedResult<EventResponse>> {
    return this.listEventsWithScope(query);
  }

  async listSecurityEvents(query: EventQuery): Promise<PaginatedResult<EventResponse>> {
    return this.listEventsWithScope(query, true);
  }

  private async listEventsWithScope(
    query: EventQuery,
    securityOnly = false,
  ): Promise<PaginatedResult<EventResponse>> {
    const startedAt = Date.now();
    const whereClause = buildEventWhereClause(query, securityOnly);
    const orderBy = getEventOrderBy(query.sort);
    const offset = (query.page - 1) * query.limit;

    const [rows, totalResult] = await Promise.all([
      this.database.db
        .select()
        .from(governanceEvents)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(governanceEvents)
        .where(whereClause),
    ]);

    return {
      data: rows.map((row) => mapEventRow(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: Number(totalResult[0]?.total ?? 0),
      },
      meta: {
        query_time_ms: Date.now() - startedAt,
      },
    };
  }

  async getEvent(id: string): Promise<EventWithReceiptResponse | null> {
    const rows = await this.database.db
      .select()
      .from(governanceEvents)
      .where(eq(governanceEvents.id, id))
      .limit(1);

    if (!rows[0]) {
      return null;
    }

    return mapEventRow(rows[0], true);
  }

  async listAgents(page = 1, limit = 50): Promise<PaginatedResult<{
    id: string;
    name: string | null;
    event_count: number;
    total_cost_usd: number;
    last_seen: string | null;
  }>> {
    const startedAt = Date.now();
    const offset = (page - 1) * limit;
    const [agentRows, totalRows] = await Promise.all([
      executeRows(this.database.client, `
        SELECT
          agent_id,
          MAX(agent_name) AS agent_name,
          COUNT(*) AS event_count,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
          MAX(timestamp) AS last_seen
        FROM governance_events
        GROUP BY agent_id
        ORDER BY last_seen DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      executeRows(this.database.client, 'SELECT COUNT(*) AS total FROM (SELECT agent_id FROM governance_events GROUP BY agent_id)', []),
    ]);

    return {
      data: agentRows.map((row) => ({
        id: stringValue(row.agent_id),
        name: nullableStringValue(row.agent_name),
        event_count: numberValue(row.event_count),
        total_cost_usd: numberValue(row.total_cost_usd),
        last_seen: dateValue(row.last_seen),
      })),
      pagination: {
        page,
        limit,
        total: numberValue(totalRows[0]?.total),
      },
      meta: {
        query_time_ms: Date.now() - startedAt,
      },
    };
  }

  async getAgentStats(agentId: string): Promise<AgentStats | null> {
    const [agentRows, decisionRows, toolRows, securityRows] = await Promise.all([
      executeRows(this.database.client, `
        SELECT
          agent_id,
          MAX(agent_name) AS agent_name,
          COUNT(*) AS event_count,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
          MAX(timestamp) AS last_seen
        FROM governance_events
        WHERE agent_id = ?
        GROUP BY agent_id
      `, [agentId]),
      executeRows(this.database.client, `
        SELECT decision, COUNT(*) AS count
        FROM governance_events
        WHERE agent_id = ?
        GROUP BY decision
      `, [agentId]),
      executeRows(this.database.client, `
        SELECT COALESCE(tool, 'unknown') AS tool, COUNT(*) AS count, COALESCE(SUM(cost_usd), 0) AS total_cost_usd
        FROM governance_events
        WHERE agent_id = ?
        GROUP BY tool
        ORDER BY count DESC
      `, [agentId]),
      executeRows(this.database.client, `
        SELECT COUNT(*) AS count
        FROM governance_events
        WHERE agent_id = ? AND severity IS NOT NULL
      `, [agentId]),
    ]);

    const agent = agentRows[0];
    if (!agent) {
      return null;
    }

    return {
      id: stringValue(agent.agent_id),
      name: nullableStringValue(agent.agent_name),
      event_count: numberValue(agent.event_count),
      total_cost_usd: numberValue(agent.total_cost_usd),
      security_event_count: numberValue(securityRows[0]?.count),
      decisions: Object.fromEntries(
        decisionRows.map((row) => [stringValue(row.decision), numberValue(row.count)]),
      ),
      tools: toolRows.map((row) => ({
        tool: stringValue(row.tool),
        count: numberValue(row.count),
        total_cost_usd: numberValue(row.total_cost_usd),
      })),
      last_seen: dateValue(agent.last_seen),
    };
  }

  async getCostSummary(query: CostQuery): Promise<{
    total_cost_usd: number;
    total_events: number;
    by_agent: Array<{ agent_id: string; total_cost_usd: number; event_count: number }>;
    by_provider: Array<{ provider: string; total_cost_usd: number; event_count: number }>;
    meta: { query_time_ms: number };
  }> {
    const startedAt = Date.now();
    const { whereSql, args } = buildSqlFilter(query);
    const [summaryRows, agentRows, providerRows] = await Promise.all([
      executeRows(this.database.client, `
        SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd, COUNT(*) AS total_events
        FROM governance_events
        ${whereSql}
      `, args),
      executeRows(this.database.client, `
        SELECT agent_id, COALESCE(SUM(cost_usd), 0) AS total_cost_usd, COUNT(*) AS event_count
        FROM governance_events
        ${whereSql}
        GROUP BY agent_id
        ORDER BY total_cost_usd DESC
      `, args),
      executeRows(this.database.client, `
        SELECT COALESCE(provider, 'unknown') AS provider, COALESCE(SUM(cost_usd), 0) AS total_cost_usd, COUNT(*) AS event_count
        FROM governance_events
        ${whereSql}
        GROUP BY provider
        ORDER BY total_cost_usd DESC
      `, args),
    ]);

    return {
      total_cost_usd: numberValue(summaryRows[0]?.total_cost_usd),
      total_events: numberValue(summaryRows[0]?.total_events),
      by_agent: agentRows.map((row) => ({
        agent_id: stringValue(row.agent_id),
        total_cost_usd: numberValue(row.total_cost_usd),
        event_count: numberValue(row.event_count),
      })),
      by_provider: providerRows.map((row) => ({
        provider: stringValue(row.provider),
        total_cost_usd: numberValue(row.total_cost_usd),
        event_count: numberValue(row.event_count),
      })),
      meta: {
        query_time_ms: Date.now() - startedAt,
      },
    };
  }

  async getCostTimeline(query: TimelineQuery): Promise<{
    data: Array<{ bucket: string; total_cost_usd: number; event_count: number }>;
    meta: { query_time_ms: number };
  }> {
    const startedAt = Date.now();
    const { whereSql, args } = buildSqlFilter(query);
    const divisor = query.granularity === 'hourly' ? 3600000 : 86400000;
    const rows = await executeRows(this.database.client, `
      SELECT
        CAST((timestamp / ?) AS INTEGER) * ? AS bucket_start,
        COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
        COUNT(*) AS event_count
      FROM governance_events
      ${whereSql}
      GROUP BY bucket_start
      ORDER BY bucket_start ASC
    `, [divisor, divisor, ...args]);

    return {
      data: rows.map((row) => ({
        bucket: dateValue(row.bucket_start) ?? new Date(0).toISOString(),
        total_cost_usd: numberValue(row.total_cost_usd),
        event_count: numberValue(row.event_count),
      })),
      meta: {
        query_time_ms: Date.now() - startedAt,
      },
    };
  }

  async getComplianceStatus(framework: string, query: CostQuery = {}): Promise<{
    framework: string;
    status: 'pass' | 'warn' | 'fail';
    total_events: number;
    violation_count: number;
    evidence_count: number;
    controls: Array<{ id: string; status: 'pass' | 'warn' | 'fail'; evidence_count: number }>;
    meta: { query_time_ms: number };
  }> {
    const startedAt = Date.now();
    const scopedQuery = { ...query, framework };
    const { whereSql, args } = buildSqlFilter(scopedQuery);
    const rows = await executeRows(this.database.client, `
      SELECT
        COUNT(*) AS total_events,
        SUM(CASE WHEN decision IN ('DENY', 'REQUIRE_APPROVAL') OR severity IN ('high', 'critical') THEN 1 ELSE 0 END) AS violation_count,
        SUM(CASE WHEN receipt_json IS NOT NULL THEN 1 ELSE 0 END) AS evidence_count
      FROM governance_events
      ${whereSql}
    `, args);

    const totalEvents = numberValue(rows[0]?.total_events);
    const violationCount = numberValue(rows[0]?.violation_count);
    const evidenceCount = numberValue(rows[0]?.evidence_count);
    const status = totalEvents === 0 ? 'warn' : violationCount > 0 ? 'fail' : 'pass';

    return {
      framework,
      status,
      total_events: totalEvents,
      violation_count: violationCount,
      evidence_count: evidenceCount,
      controls: [
        {
          id: `${framework}:runtime-governance`,
          status,
          evidence_count: evidenceCount,
        },
      ],
      meta: {
        query_time_ms: Date.now() - startedAt,
      },
    };
  }

  async generateComplianceReport(body: ComplianceReportBody): Promise<{
    id: string;
    framework: string;
    generated_at: string;
    status: 'pass' | 'warn' | 'fail';
    summary: {
      total_events: number;
      violation_count: number;
      evidence_count: number;
    };
    controls: Array<{ id: string; status: 'pass' | 'warn' | 'fail'; evidence_count: number }>;
  }> {
    const status = await this.getComplianceStatus(body.framework, {
      from: body.from,
      to: body.to,
    });

    return {
      id: `report_${body.framework}_${Date.now()}`,
      framework: body.framework,
      generated_at: new Date().toISOString(),
      status: status.status,
      summary: {
        total_events: status.total_events,
        violation_count: status.violation_count,
        evidence_count: status.evidence_count,
      },
      controls: status.controls,
    };
  }
}

function buildEventWhereClause(query: EventQuery, securityOnly = false): SQL {
  const clauses: SQL[] = [];

  if (query.agent) clauses.push(eq(governanceEvents.agentId, query.agent));
  if (query.decision) clauses.push(eq(governanceEvents.decision, query.decision));
  if (query.tool) clauses.push(eq(governanceEvents.tool, query.tool));
  if (query.severity) clauses.push(eq(governanceEvents.severity, query.severity));
  if (query.from) clauses.push(gte(governanceEvents.timestamp, Date.parse(query.from)));
  if (query.to) clauses.push(lte(governanceEvents.timestamp, Date.parse(query.to)));
  if (query.search) clauses.push(like(governanceEvents.reason, `%${query.search}%`));
  if (securityOnly) clauses.push(sql`${governanceEvents.severity} IS NOT NULL`);

  return clauses.length > 0 ? and(...clauses) ?? sql`1 = 1` : sql`1 = 1`;
}

function getEventOrderBy(sort: string): SQL {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const columns: Record<string, typeof governanceEvents.timestamp> = {
    timestamp: governanceEvents.timestamp,
  };
  const genericColumns = {
    agent: governanceEvents.agentId,
    decision: governanceEvents.decision,
    tool: governanceEvents.tool,
    severity: governanceEvents.severity,
    cost: governanceEvents.costUsd,
    cost_usd: governanceEvents.costUsd,
  };
  const column = columns[field] ?? genericColumns[field as keyof typeof genericColumns] ?? governanceEvents.timestamp;
  return descending ? desc(column) : asc(column);
}

function mapEventRow(row: GovernanceEventRow, includeReceipt = false): EventWithReceiptResponse {
  const event = {
    id: row.id,
    timestamp: new Date(row.timestamp).toISOString(),
    agent_id: row.agentId,
    agent_name: row.agentName,
    decision: row.decision as EventWithReceiptResponse['decision'],
    tool: row.tool,
    provider: row.provider,
    model: row.model,
    cost_usd: row.costUsd,
    severity: row.severity as EventWithReceiptResponse['severity'],
    reason: row.reason,
    framework: row.framework,
    metadata: parseJson(row.metadataJson, {}),
    receipt: includeReceipt ? parseJson(row.receiptJson, {}) : {},
  };

  if (!includeReceipt) {
    delete (event as Partial<typeof event>).receipt;
  }

  return event as EventWithReceiptResponse;
}

function buildSqlFilter(query: CostQuery & { framework?: string }): { whereSql: string; args: SqlArgs } {
  const clauses: string[] = [];
  const args: SqlArgs = [];

  if (query.agent) {
    clauses.push('agent_id = ?');
    args.push(query.agent);
  }
  if (query.provider) {
    clauses.push('provider = ?');
    args.push(query.provider);
  }
  if (query.framework) {
    clauses.push('framework = ?');
    args.push(query.framework);
  }
  if (query.from) {
    clauses.push('timestamp >= ?');
    args.push(Date.parse(query.from));
  }
  if (query.to) {
    clauses.push('timestamp <= ?');
    args.push(Date.parse(query.to));
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    args,
  };
}

async function executeRows(client: Client, statement: string, args: SqlArgs): Promise<Row[]> {
  const result = await client.execute({ sql: statement, args });
  return [...result.rows];
}

function parseJson(value: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function stringValue(value: unknown): string {
  return String(value ?? '');
}

function nullableStringValue(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function dateValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const ts = numberValue(value);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}
