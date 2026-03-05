/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.3: Correlation IDs and Traceability
 * 
 * ContextManager utility for creating and managing ExecutionContext
 * 
 * @module core/context/ContextManager
 * @version 1.1.0
 */

import { 
  ExecutionContext, 
  ExecutionContextOptions,
  CONTEXT_HEADERS,
  isValidUUIDv4,
  isValidCorrelationId,
  validateExecutionContext
} from './ExecutionContext';

/**
 * Generates a cryptographically random UUID v4
 * Uses crypto.randomUUID() if available, falls back to custom implementation
 * 
 * @returns UUID v4 string
 */
export function generateUUIDv4(): string {
  // Use native crypto.randomUUID() if available (Node.js 16.7.0+, modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for older environments
  // Uses crypto.getRandomValues() for cryptographic randomness
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    // Convert to hex string with dashes
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  
  // Last resort: Math.random() (NOT cryptographically secure, should not be used in production)
  console.warn('TealTiger: Using Math.random() for UUID generation. This is NOT cryptographically secure. Please upgrade to Node.js 16.7.0+ or use a modern browser.');
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generates a new correlation ID (UUID v4)
 * 
 * @returns Correlation ID string (UUID v4)
 */
export function generateCorrelationId(): string {
  return generateUUIDv4();
}

/**
 * Generates a new span ID (8 bytes hex)
 * Compatible with OpenTelemetry span ID format
 * 
 * @returns Span ID string (16 hex characters)
 */
export function generateSpanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for older environments
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Generates a W3C Trace Context compatible trace ID (32 hex characters)
 * 
 * @returns Trace ID string (32 hex characters)
 */
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for older environments
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * ContextManager utility class for creating and managing ExecutionContext
 * Provides methods for context creation, propagation, and HTTP header conversion
 */
export class ContextManager {
  /**
   * Creates a new ExecutionContext with auto-generated correlation ID
   * 
   * @param options - Optional context options
   * @returns New ExecutionContext with generated correlation_id
   */
  static createContext(options: ExecutionContextOptions = {}): ExecutionContext {
    const context: ExecutionContext = {
      correlation_id: options.correlation_id || generateCorrelationId(),
      created_at: new Date().toISOString()
    };
    
    // Add optional fields if provided
    if (options.trace_id) context.trace_id = options.trace_id;
    if (options.workflow_id) context.workflow_id = options.workflow_id;
    if (options.run_id) context.run_id = options.run_id;
    if (options.span_id) context.span_id = options.span_id;
    if (options.parent_span_id) context.parent_span_id = options.parent_span_id;
    if (options.tenant_id) context.tenant_id = options.tenant_id;
    if (options.application) context.application = options.application;
    if (options.environment) context.environment = options.environment;
    if (options.agent_purpose) context.agent_purpose = options.agent_purpose;
    if (options.session_id) context.session_id = options.session_id;
    if (options.user_id) context.user_id = options.user_id;
    if (options.metadata) context.metadata = { ...options.metadata };
    
    return context;
  }
  
  /**
   * Creates a new ExecutionContext from HTTP headers
   * Extracts context information from standard headers
   * 
   * @param headers - HTTP headers object (key-value pairs)
   * @returns ExecutionContext extracted from headers
   */
  static fromHeaders(headers: Record<string, string | string[] | undefined>): ExecutionContext {
    const getHeader = (key: string): string | undefined => {
      const value = headers[key] || headers[key.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };
    
    const options: ExecutionContextOptions = {
      correlation_id: getHeader(CONTEXT_HEADERS.CORRELATION_ID),
      trace_id: getHeader(CONTEXT_HEADERS.TRACE_ID),
      workflow_id: getHeader(CONTEXT_HEADERS.WORKFLOW_ID),
      run_id: getHeader(CONTEXT_HEADERS.RUN_ID),
      span_id: getHeader(CONTEXT_HEADERS.SPAN_ID),
      parent_span_id: getHeader(CONTEXT_HEADERS.PARENT_SPAN_ID),
      tenant_id: getHeader(CONTEXT_HEADERS.TENANT_ID),
      application: getHeader(CONTEXT_HEADERS.APPLICATION),
      environment: getHeader(CONTEXT_HEADERS.ENVIRONMENT),
      agent_purpose: getHeader(CONTEXT_HEADERS.AGENT_PURPOSE),
      session_id: getHeader(CONTEXT_HEADERS.SESSION_ID),
      user_id: getHeader(CONTEXT_HEADERS.USER_ID)
    };
    
    return this.createContext(options);
  }
  
  /**
   * Converts ExecutionContext to HTTP headers for propagation
   * 
   * @param context - ExecutionContext to convert
   * @returns HTTP headers object
   */
  static toHeaders(context: ExecutionContext): Record<string, string> {
    const headers: Record<string, string> = {
      [CONTEXT_HEADERS.CORRELATION_ID]: context.correlation_id
    };
    
    if (context.trace_id) headers[CONTEXT_HEADERS.TRACE_ID] = context.trace_id;
    if (context.workflow_id) headers[CONTEXT_HEADERS.WORKFLOW_ID] = context.workflow_id;
    if (context.run_id) headers[CONTEXT_HEADERS.RUN_ID] = context.run_id;
    if (context.span_id) headers[CONTEXT_HEADERS.SPAN_ID] = context.span_id;
    if (context.parent_span_id) headers[CONTEXT_HEADERS.PARENT_SPAN_ID] = context.parent_span_id;
    if (context.tenant_id) headers[CONTEXT_HEADERS.TENANT_ID] = context.tenant_id;
    if (context.application) headers[CONTEXT_HEADERS.APPLICATION] = context.application;
    if (context.environment) headers[CONTEXT_HEADERS.ENVIRONMENT] = context.environment;
    if (context.agent_purpose) headers[CONTEXT_HEADERS.AGENT_PURPOSE] = context.agent_purpose;
    if (context.session_id) headers[CONTEXT_HEADERS.SESSION_ID] = context.session_id;
    if (context.user_id) headers[CONTEXT_HEADERS.USER_ID] = context.user_id;
    
    return headers;
  }
  
  /**
   * Propagates context by creating a new child context
   * Preserves correlation_id, workflow_id, run_id
   * Generates new span_id and sets parent_span_id
   * 
   * @param parentContext - Parent ExecutionContext
   * @param options - Optional overrides for child context
   * @returns New child ExecutionContext
   */
  static propagate(
    parentContext: ExecutionContext,
    options: Partial<ExecutionContextOptions> = {}
  ): ExecutionContext {
    validateExecutionContext(parentContext);
    
    const childContext: ExecutionContext = {
      // Preserve from parent
      correlation_id: parentContext.correlation_id,
      workflow_id: parentContext.workflow_id,
      run_id: parentContext.run_id,
      trace_id: parentContext.trace_id,
      tenant_id: parentContext.tenant_id,
      application: parentContext.application,
      environment: parentContext.environment,
      agent_purpose: parentContext.agent_purpose,
      session_id: parentContext.session_id,
      user_id: parentContext.user_id,
      
      // Generate new span
      span_id: generateSpanId(),
      parent_span_id: parentContext.span_id,
      
      // Timestamp
      created_at: new Date().toISOString(),
      
      // Merge metadata
      metadata: {
        ...parentContext.metadata,
        ...options.metadata
      }
    };
    
    // Apply overrides
    if (options.trace_id !== undefined) childContext.trace_id = options.trace_id;
    if (options.workflow_id !== undefined) childContext.workflow_id = options.workflow_id;
    if (options.run_id !== undefined) childContext.run_id = options.run_id;
    if (options.span_id !== undefined) childContext.span_id = options.span_id;
    if (options.tenant_id !== undefined) childContext.tenant_id = options.tenant_id;
    if (options.application !== undefined) childContext.application = options.application;
    if (options.environment !== undefined) childContext.environment = options.environment;
    if (options.agent_purpose !== undefined) childContext.agent_purpose = options.agent_purpose;
    if (options.session_id !== undefined) childContext.session_id = options.session_id;
    if (options.user_id !== undefined) childContext.user_id = options.user_id;
    
    return childContext;
  }
  
  /**
   * Enriches an existing context with additional metadata
   * 
   * @param context - ExecutionContext to enrich
   * @param metadata - Additional metadata to add
   * @returns New ExecutionContext with enriched metadata
   */
  static enrich(
    context: ExecutionContext,
    metadata: Record<string, any>
  ): ExecutionContext {
    return {
      ...context,
      metadata: {
        ...context.metadata,
        ...metadata
      }
    };
  }
  
  /**
   * Validates that a context is valid
   * 
   * @param context - ExecutionContext to validate
   * @returns true if valid, false otherwise
   */
  static isValid(context: ExecutionContext): boolean {
    try {
      validateExecutionContext(context);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Extracts context from various sources (headers, existing context, or creates new)
   * 
   * @param source - Headers object, ExecutionContext, or undefined
   * @returns ExecutionContext
   */
  static extract(
    source?: Record<string, string | string[] | undefined> | ExecutionContext
  ): ExecutionContext {
    if (!source) {
      return this.createContext();
    }
    
    // If already an ExecutionContext, validate and return
    if ('correlation_id' in source) {
      validateExecutionContext(source as ExecutionContext);
      return source as ExecutionContext;
    }
    
    // Otherwise treat as headers
    return this.fromHeaders(source as Record<string, string | string[] | undefined>);
  }
}

// Export utility functions
export {
  ExecutionContext,
  ExecutionContextOptions,
  CONTEXT_HEADERS,
  isValidUUIDv4,
  isValidCorrelationId,
  validateExecutionContext
};
