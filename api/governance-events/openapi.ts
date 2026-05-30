export const paginationOpenApiSchema = {
  type: 'object',
  required: ['page', 'limit', 'total'],
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
    total: { type: 'integer', minimum: 0 },
  },
} as const;

export const metaOpenApiSchema = {
  type: 'object',
  required: ['query_time_ms'],
  properties: {
    query_time_ms: { type: 'number' },
  },
} as const;

export const eventOpenApiSchema = {
  type: 'object',
  required: [
    'id',
    'timestamp',
    'agent_id',
    'decision',
    'cost_usd',
    'reason',
    'metadata',
  ],
  properties: {
    id: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    agent_id: { type: 'string' },
    agent_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    decision: { type: 'string', enum: ['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL'] },
    tool: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    provider: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    model: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    cost_usd: { type: 'number' },
    severity: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    reason: { type: 'string' },
    framework: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    metadata: { type: 'object', additionalProperties: true },
  },
} as const;

export const eventWithReceiptOpenApiSchema = {
  ...eventOpenApiSchema,
  required: [...eventOpenApiSchema.required, 'receipt'],
  properties: {
    ...eventOpenApiSchema.properties,
    receipt: { type: 'object', additionalProperties: true },
  },
} as const;

export const eventListOpenApiSchema = {
  type: 'object',
  required: ['data', 'pagination', 'meta'],
  properties: {
    data: { type: 'array', items: eventOpenApiSchema },
    pagination: paginationOpenApiSchema,
    meta: metaOpenApiSchema,
  },
} as const;

export const standardErrorOpenApiSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
} as const;
