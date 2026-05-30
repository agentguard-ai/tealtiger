import swagger from '@fastify/swagger';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { createApiDatabase, seedGovernanceEvents, type ApiDatabase } from './database';
import {
  eventListOpenApiSchema,
  eventWithReceiptOpenApiSchema,
  metaOpenApiSchema,
  paginationOpenApiSchema,
  standardErrorOpenApiSchema,
} from './openapi';
import { GovernanceEventRepository } from './repository';
import { type NewGovernanceEventRow } from './schema';
import {
  complianceReportBodySchema,
  costQuerySchema,
  eventQuerySchema,
  eventWithReceiptResponseSchema,
  healthResponseSchema,
  paginatedAgentsResponseSchema,
  paginatedEventsResponseSchema,
  paginationQuerySchema,
  timelineQuerySchema,
} from './validation';

export interface CreateServerOptions {
  databaseUrl?: string;
  seedEvents?: NewGovernanceEventRow[];
  logger?: boolean;
}

export interface GovernanceApiServer {
  app: FastifyInstance;
  database: ApiDatabase;
  repository: GovernanceEventRepository;
}

const DEFAULT_DATABASE_URL = 'file:./data/tealtiger-events.sqlite';

export async function createGovernanceApiServer(
  options: CreateServerOptions = {},
): Promise<GovernanceApiServer> {
  const app = Fastify({ logger: options.logger ?? false });
  const database = await createApiDatabase(options.databaseUrl ?? process.env.TEALTIGER_DB_URL ?? DEFAULT_DATABASE_URL);
  const repository = new GovernanceEventRepository(database);
  const startedAt = Date.now();

  if (options.seedEvents) {
    await seedGovernanceEvents(database, options.seedEvents);
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TealTiger Governance Events API',
        version: '1.0.0',
      },
      tags: [
        { name: 'events', description: 'Governance event queries' },
        { name: 'agents', description: 'Agent inventory and statistics' },
        { name: 'cost', description: 'Cost analytics' },
        { name: 'security', description: 'Security event views' },
        { name: 'compliance', description: 'Compliance evidence and reports' },
        { name: 'health', description: 'Service health' },
      ],
    },
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error instanceof ZodError
      ? 400
      : error.statusCode && error.statusCode >= 400
        ? error.statusCode
        : 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'internal_server_error' : 'request_error',
      message: error.message,
    });
  });

  app.get('/api/v1/health', {
    schema: {
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            database: { type: 'string' },
            uptime_seconds: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => healthResponseSchema.parse({
    status: 'ok',
    service: 'tealtiger-governance-api',
    database: 'connected',
    uptime_seconds: (Date.now() - startedAt) / 1000,
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1/openapi.json', {
    schema: {
      tags: ['health'],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async () => app.swagger());

  app.get('/api/v1/events', {
    schema: {
      tags: ['events'],
      querystring: eventQueryOpenApiSchema(),
      response: {
        200: eventListOpenApiSchema,
        400: standardErrorOpenApiSchema,
      },
    },
  }, async (request) => {
    const query = eventQuerySchema.parse(request.query);
    return paginatedEventsResponseSchema.parse(await repository.listEvents(query));
  });

  app.get('/api/v1/events/stream', {
    schema: {
      tags: ['events'],
      response: {
        200: { type: 'string' },
      },
    },
  }, async (_request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write('event: ready\n');
    reply.raw.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);
    reply.raw.end();
  });

  app.get('/api/v1/events/:id', {
    schema: {
      tags: ['events'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: eventWithReceiptOpenApiSchema,
        404: standardErrorOpenApiSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await repository.getEvent(id);
    if (!event) {
      return reply.status(404).send({ error: 'not_found', message: `Event ${id} not found` });
    }
    return eventWithReceiptResponseSchema.parse(event);
  });

  app.get('/api/v1/agents', {
    schema: {
      tags: ['agents'],
      querystring: paginationOpenApiQuerySchema(),
      response: {
        200: {
          type: 'object',
          required: ['data', 'pagination', 'meta'],
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  event_count: { type: 'integer' },
                  total_cost_usd: { type: 'number' },
                  last_seen: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
                },
              },
            },
            pagination: paginationOpenApiSchema,
            meta: metaOpenApiSchema,
          },
        },
      },
    },
  }, async (request) => {
    const query = paginationQuerySchema.parse(request.query);
    return paginatedAgentsResponseSchema.parse(await repository.listAgents(query.page, query.limit));
  });

  app.get('/api/v1/agents/:id/stats', {
    schema: {
      tags: ['agents'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        404: standardErrorOpenApiSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const stats = await repository.getAgentStats(id);
    if (!stats) {
      return reply.status(404).send({ error: 'not_found', message: `Agent ${id} not found` });
    }
    return stats;
  });

  app.get('/api/v1/cost/summary', {
    schema: {
      tags: ['cost'],
      querystring: costQueryOpenApiSchema(),
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request) => repository.getCostSummary(costQuerySchema.parse(request.query)));

  app.get('/api/v1/cost/timeline', {
    schema: {
      tags: ['cost'],
      querystring: timelineQueryOpenApiSchema(),
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request) => repository.getCostTimeline(timelineQuerySchema.parse(request.query)));

  app.get('/api/v1/security/events', {
    schema: {
      tags: ['security'],
      querystring: eventQueryOpenApiSchema(),
      response: {
        200: eventListOpenApiSchema,
      },
    },
  }, async (request) => {
    const query = eventQuerySchema.parse(request.query);
    return paginatedEventsResponseSchema.parse(await repository.listSecurityEvents(query));
  });

  app.get('/api/v1/compliance/:framework', {
    schema: {
      tags: ['compliance'],
      params: {
        type: 'object',
        required: ['framework'],
        properties: { framework: { type: 'string' } },
      },
      querystring: costQueryOpenApiSchema(),
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request) => {
    const { framework } = request.params as { framework: string };
    return repository.getComplianceStatus(framework, costQuerySchema.parse(request.query));
  });

  app.post('/api/v1/compliance/report', {
    schema: {
      tags: ['compliance'],
      body: {
        type: 'object',
        required: ['framework'],
        properties: {
          framework: { type: 'string' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request) => repository.generateComplianceReport(
    complianceReportBodySchema.parse(request.body),
  ));

  return { app, database, repository };
}

function eventQueryOpenApiSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      agent: { type: 'string' },
      decision: { type: 'string', enum: ['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL'] },
      tool: { type: 'string' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
      severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      sort: { type: 'string', default: '-timestamp' },
      search: { type: 'string' },
    },
  };
}

function paginationOpenApiQuerySchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
  };
}

function costQueryOpenApiSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      agent: { type: 'string' },
      provider: { type: 'string' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    },
  };
}

function timelineQueryOpenApiSchema(): Record<string, unknown> {
  return {
    ...costQueryOpenApiSchema(),
    properties: {
      ...costQueryOpenApiSchema().properties as Record<string, unknown>,
      granularity: { type: 'string', enum: ['hourly', 'daily'], default: 'daily' },
    },
  };
}
