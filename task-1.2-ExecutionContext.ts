/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.3: Correlation IDs and Traceability
 * 
 * ExecutionContext for request tracking and context propagation
 * 
 * @module core/context/ExecutionContext
 * @version 1.1.0
 */

/**
 * Execution context for request tracking and traceability
 * Contains correlation ID, trace ID, and optional governance metadata
 * 
 * @interface ExecutionContext
 */
export interface ExecutionContext {
  /** Unique correlation ID for request tracing (UUID v4) */
  correlation_id: string;
  
  /** Optional trace ID for distributed tracing (OpenTelemetry-compatible) */
  trace_id?: string;
  
  /** Optional workflow ID for governance-grade aggregation */
  workflow_id?: string;
  
  /** Optional run ID for execution instance tracking */
  run_id?: string;
  
  /** Optional span ID for operation tracking */
  span_id?: string;
  
  /** Optional parent span ID for nested operations */
  parent_span_id?: string;
  
  /** Optional tenant ID for multi-tenancy */
  tenant_id?: string;
  
  /** Optional application name */
  application?: string;
  
  /** Optional environment (e.g., 'production', 'staging', 'development') */
  environment?: string;
  
  /** Optional agent purpose or role */
  agent_purpose?: string;
  
  /** Optional session ID for multi-request conversations */
  session_id?: string;
  
  /** Optional user ID for user-level tracking */
  user_id?: string;
  
  /** Timestamp when context was created (ISO 8601) */
  created_at?: string;
  
  /** Additional custom metadata */
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Options for creating an ExecutionContext
 * 
 * @interface ExecutionContextOptions
 */
export interface ExecutionContextOptions {
  /** Existing correlation ID (if not provided, will be auto-generated) */
  correlation_id?: string;
  
  /** Trace ID for distributed tracing */
  trace_id?: string;
  
  /** Workflow ID for governance-grade aggregation */
  workflow_id?: string;
  
  /** Run ID for execution instance tracking */
  run_id?: string;
  
  /** Span ID for operation tracking */
  span_id?: string;
  
  /** Parent span ID for nested operations */
  parent_span_id?: string;
  
  /** Tenant ID for multi-tenancy */
  tenant_id?: string;
  
  /** Application name */
  application?: string;
  
  /** Environment */
  environment?: string;
  
  /** Agent purpose or role */
  agent_purpose?: string;
  
  /** Session ID */
  session_id?: string;
  
  /** User ID */
  user_id?: string;
  
  /** Additional custom metadata */
  metadata?: {
    [key: string]: any;
  };
}

/**
 * HTTP header names for context propagation
 * Follows W3C Trace Context and OpenTelemetry conventions
 */
export const CONTEXT_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  TRACE_ID: 'traceparent',
  WORKFLOW_ID: 'x-workflow-id',
  RUN_ID: 'x-run-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
  TENANT_ID: 'x-tenant-id',
  APPLICATION: 'x-application',
  ENVIRONMENT: 'x-environment',
  AGENT_PURPOSE: 'x-agent-purpose',
  SESSION_ID: 'x-session-id',
  USER_ID: 'x-user-id'
} as const;

/**
 * Validates that a string is a valid UUID v4
 * 
 * @param uuid - The string to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUUIDv4(uuid: string): boolean {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(uuid);
}

/**
 * Validates that a correlation ID is valid (non-empty string, preferably UUID v4)
 * 
 * @param correlationId - The correlation ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidCorrelationId(correlationId: string): boolean {
  return typeof correlationId === 'string' && correlationId.length > 0;
}

/**
 * Validates that an ExecutionContext has all required fields
 * 
 * @param context - The context to validate
 * @throws {Error} if context is invalid
 */
export function validateExecutionContext(context: ExecutionContext): void {
  if (!context) {
    throw new Error('ExecutionContext is required');
  }
  
  if (!isValidCorrelationId(context.correlation_id)) {
    throw new Error('ExecutionContext must have a non-empty correlation_id');
  }
}
