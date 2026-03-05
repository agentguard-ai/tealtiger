/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.3: Correlation IDs and Traceability
 * 
 * Unit tests for ExecutionContext and ContextManager
 * 
 * @module core/context/context.test
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

import {
  ContextManager,
  generateUUIDv4,
  generateCorrelationId,
  generateSpanId,
  generateTraceId
} from './ContextManager';

describe('ExecutionContext interface', () => {
  it('should create valid execution context with required fields', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation-id'
    };
    
    expect(context.correlation_id).toBe('test-correlation-id');
  });
  
  it('should support all optional fields', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation-id',
      trace_id: 'test-trace-id',
      workflow_id: 'test-workflow',
      run_id: 'test-run',
      span_id: 'test-span',
      parent_span_id: 'test-parent-span',
      tenant_id: 'test-tenant',
      application: 'test-app',
      environment: 'test',
      agent_purpose: 'test-purpose',
      session_id: 'test-session',
      user_id: 'test-user',
      created_at: '2026-03-05T10:00:00Z',
      metadata: { custom: 'value' }
    };
    
    expect(context.trace_id).toBe('test-trace-id');
    expect(context.workflow_id).toBe('test-workflow');
    expect(context.run_id).toBe('test-run');
    expect(context.span_id).toBe('test-span');
    expect(context.parent_span_id).toBe('test-parent-span');
    expect(context.tenant_id).toBe('test-tenant');
    expect(context.application).toBe('test-app');
    expect(context.environment).toBe('test');
    expect(context.agent_purpose).toBe('test-purpose');
    expect(context.session_id).toBe('test-session');
    expect(context.user_id).toBe('test-user');
    expect(context.metadata?.custom).toBe('value');
  });
});

describe('CONTEXT_HEADERS', () => {
  it('should define all required header names', () => {
    expect(CONTEXT_HEADERS.CORRELATION_ID).toBe('x-correlation-id');
    expect(CONTEXT_HEADERS.TRACE_ID).toBe('traceparent');
    expect(CONTEXT_HEADERS.WORKFLOW_ID).toBe('x-workflow-id');
    expect(CONTEXT_HEADERS.RUN_ID).toBe('x-run-id');
    expect(CONTEXT_HEADERS.SPAN_ID).toBe('x-span-id');
    expect(CONTEXT_HEADERS.PARENT_SPAN_ID).toBe('x-parent-span-id');
    expect(CONTEXT_HEADERS.TENANT_ID).toBe('x-tenant-id');
    expect(CONTEXT_HEADERS.APPLICATION).toBe('x-application');
    expect(CONTEXT_HEADERS.ENVIRONMENT).toBe('x-environment');
    expect(CONTEXT_HEADERS.AGENT_PURPOSE).toBe('x-agent-purpose');
    expect(CONTEXT_HEADERS.SESSION_ID).toBe('x-session-id');
    expect(CONTEXT_HEADERS.USER_ID).toBe('x-user-id');
  });
});

describe('isValidUUIDv4', () => {
  it('should return true for valid UUID v4', () => {
    expect(isValidUUIDv4('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUIDv4('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(false); // v1
    expect(isValidUUIDv4('6ba7b811-9dad-41d1-80b4-00c04fd430c8')).toBe(false); // v1
  });
  
  it('should return false for invalid UUIDs', () => {
    expect(isValidUUIDv4('not-a-uuid')).toBe(false);
    expect(isValidUUIDv4('')).toBe(false);
    expect(isValidUUIDv4('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1
  });
});

describe('isValidCorrelationId', () => {
  it('should return true for non-empty strings', () => {
    expect(isValidCorrelationId('test-id')).toBe(true);
    expect(isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });
  
  it('should return false for empty or invalid values', () => {
    expect(isValidCorrelationId('')).toBe(false);
    expect(isValidCorrelationId(null as any)).toBe(false);
    expect(isValidCorrelationId(undefined as any)).toBe(false);
  });
});

describe('validateExecutionContext', () => {
  it('should not throw for valid context', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-id'
    };
    expect(() => validateExecutionContext(context)).not.toThrow();
  });
  
  it('should throw for null context', () => {
    expect(() => validateExecutionContext(null as any)).toThrow('ExecutionContext is required');
  });
  
  it('should throw for missing correlation_id', () => {
    const context = {} as ExecutionContext;
    expect(() => validateExecutionContext(context)).toThrow('non-empty correlation_id');
  });
  
  it('should throw for empty correlation_id', () => {
    const context: ExecutionContext = { correlation_id: '' };
    expect(() => validateExecutionContext(context)).toThrow('non-empty correlation_id');
  });
});

describe('generateUUIDv4', () => {
  it('should generate valid UUID v4', () => {
    const uuid = generateUUIDv4();
    expect(typeof uuid).toBe('string');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
  
  it('should generate unique UUIDs', () => {
    const uuid1 = generateUUIDv4();
    const uuid2 = generateUUIDv4();
    expect(uuid1).not.toBe(uuid2);
  });
  
  it('should generate 100 unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUIDv4());
    }
    expect(uuids.size).toBe(100);
  });
});

describe('generateCorrelationId', () => {
  it('should generate valid correlation ID', () => {
    const id = generateCorrelationId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
  
  it('should generate unique correlation IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateSpanId', () => {
  it('should generate 16 character hex string', () => {
    const spanId = generateSpanId();
    expect(typeof spanId).toBe('string');
    expect(spanId).toMatch(/^[0-9a-f]{16}$/i);
  });
  
  it('should generate unique span IDs', () => {
    const span1 = generateSpanId();
    const span2 = generateSpanId();
    expect(span1).not.toBe(span2);
  });
});

describe('generateTraceId', () => {
  it('should generate 32 character hex string', () => {
    const traceId = generateTraceId();
    expect(typeof traceId).toBe('string');
    expect(traceId).toMatch(/^[0-9a-f]{32}$/i);
  });
  
  it('should generate unique trace IDs', () => {
    const trace1 = generateTraceId();
    const trace2 = generateTraceId();
    expect(trace1).not.toBe(trace2);
  });
});

describe('ContextManager.createContext', () => {
  it('should create context with auto-generated correlation_id', () => {
    const context = ContextManager.createContext();
    expect(context.correlation_id).toBeDefined();
    expect(typeof context.correlation_id).toBe('string');
    expect(context.correlation_id.length).toBeGreaterThan(0);
  });
  
  it('should use provided correlation_id', () => {
    const context = ContextManager.createContext({
      correlation_id: 'custom-id'
    });
    expect(context.correlation_id).toBe('custom-id');
  });
  
  it('should include all provided optional fields', () => {
    const options: ExecutionContextOptions = {
      correlation_id: 'test-id',
      trace_id: 'test-trace',
      workflow_id: 'test-workflow',
      run_id: 'test-run',
      span_id: 'test-span',
      parent_span_id: 'test-parent',
      tenant_id: 'test-tenant',
      application: 'test-app',
      environment: 'production',
      agent_purpose: 'customer-support',
      session_id: 'test-session',
      user_id: 'test-user',
      metadata: { custom: 'value' }
    };
    
    const context = ContextManager.createContext(options);
    
    expect(context.correlation_id).toBe('test-id');
    expect(context.trace_id).toBe('test-trace');
    expect(context.workflow_id).toBe('test-workflow');
    expect(context.run_id).toBe('test-run');
    expect(context.span_id).toBe('test-span');
    expect(context.parent_span_id).toBe('test-parent');
    expect(context.tenant_id).toBe('test-tenant');
    expect(context.application).toBe('test-app');
    expect(context.environment).toBe('production');
    expect(context.agent_purpose).toBe('customer-support');
    expect(context.session_id).toBe('test-session');
    expect(context.user_id).toBe('test-user');
    expect(context.metadata?.custom).toBe('value');
  });
  
  it('should set created_at timestamp', () => {
    const context = ContextManager.createContext();
    expect(context.created_at).toBeDefined();
    expect(typeof context.created_at).toBe('string');
    expect(new Date(context.created_at!).getTime()).toBeGreaterThan(0);
  });
});

describe('ContextManager.fromHeaders', () => {
  it('should extract context from headers', () => {
    const headers = {
      'x-correlation-id': 'test-correlation',
      'traceparent': 'test-trace',
      'x-workflow-id': 'test-workflow',
      'x-run-id': 'test-run',
      'x-span-id': 'test-span',
      'x-tenant-id': 'test-tenant',
      'x-application': 'test-app',
      'x-environment': 'production'
    };
    
    const context = ContextManager.fromHeaders(headers);
    
    expect(context.correlation_id).toBe('test-correlation');
    expect(context.trace_id).toBe('test-trace');
    expect(context.workflow_id).toBe('test-workflow');
    expect(context.run_id).toBe('test-run');
    expect(context.span_id).toBe('test-span');
    expect(context.tenant_id).toBe('test-tenant');
    expect(context.application).toBe('test-app');
    expect(context.environment).toBe('production');
  });
  
  it('should handle missing headers', () => {
    const headers = {};
    const context = ContextManager.fromHeaders(headers);
    
    expect(context.correlation_id).toBeDefined(); // Auto-generated
    expect(context.trace_id).toBeUndefined();
    expect(context.workflow_id).toBeUndefined();
  });
  
  it('should handle array header values', () => {
    const headers = {
      'x-correlation-id': ['test-correlation', 'ignored']
    };
    
    const context = ContextManager.fromHeaders(headers);
    expect(context.correlation_id).toBe('test-correlation');
  });
  
  it('should handle case-insensitive headers', () => {
    const headers = {
      'X-Correlation-ID': 'test-correlation',
      'X-WORKFLOW-ID': 'test-workflow'
    };
    
    const context = ContextManager.fromHeaders(headers);
    expect(context.correlation_id).toBe('test-correlation');
    expect(context.workflow_id).toBe('test-workflow');
  });
});

describe('ContextManager.toHeaders', () => {
  it('should convert context to headers', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation',
      trace_id: 'test-trace',
      workflow_id: 'test-workflow',
      run_id: 'test-run',
      span_id: 'test-span',
      tenant_id: 'test-tenant',
      application: 'test-app',
      environment: 'production'
    };
    
    const headers = ContextManager.toHeaders(context);
    
    expect(headers['x-correlation-id']).toBe('test-correlation');
    expect(headers['traceparent']).toBe('test-trace');
    expect(headers['x-workflow-id']).toBe('test-workflow');
    expect(headers['x-run-id']).toBe('test-run');
    expect(headers['x-span-id']).toBe('test-span');
    expect(headers['x-tenant-id']).toBe('test-tenant');
    expect(headers['x-application']).toBe('test-app');
    expect(headers['x-environment']).toBe('production');
  });
  
  it('should only include defined fields', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation'
    };
    
    const headers = ContextManager.toHeaders(context);
    
    expect(headers['x-correlation-id']).toBe('test-correlation');
    expect(headers['traceparent']).toBeUndefined();
    expect(headers['x-workflow-id']).toBeUndefined();
  });
});

describe('ContextManager.propagate', () => {
  it('should preserve correlation_id from parent', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation'
    };
    
    const child = ContextManager.propagate(parent);
    
    expect(child.correlation_id).toBe('parent-correlation');
  });
  
  it('should preserve workflow_id and run_id from parent', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation',
      workflow_id: 'parent-workflow',
      run_id: 'parent-run'
    };
    
    const child = ContextManager.propagate(parent);
    
    expect(child.workflow_id).toBe('parent-workflow');
    expect(child.run_id).toBe('parent-run');
  });
  
  it('should generate new span_id', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation',
      span_id: 'parent-span'
    };
    
    const child = ContextManager.propagate(parent);
    
    expect(child.span_id).toBeDefined();
    expect(child.span_id).not.toBe('parent-span');
  });
  
  it('should set parent_span_id to parent span_id', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation',
      span_id: 'parent-span'
    };
    
    const child = ContextManager.propagate(parent);
    
    expect(child.parent_span_id).toBe('parent-span');
  });
  
  it('should allow overrides', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation',
      workflow_id: 'parent-workflow'
    };
    
    const child = ContextManager.propagate(parent, {
      workflow_id: 'child-workflow'
    });
    
    expect(child.workflow_id).toBe('child-workflow');
  });
  
  it('should merge metadata', () => {
    const parent: ExecutionContext = {
      correlation_id: 'parent-correlation',
      metadata: { parent: 'value' }
    };
    
    const child = ContextManager.propagate(parent, {
      metadata: { child: 'value' }
    });
    
    expect(child.metadata?.parent).toBe('value');
    expect(child.metadata?.child).toBe('value');
  });
});

describe('ContextManager.enrich', () => {
  it('should add metadata to context', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation'
    };
    
    const enriched = ContextManager.enrich(context, {
      custom: 'value',
      another: 123
    });
    
    expect(enriched.metadata?.custom).toBe('value');
    expect(enriched.metadata?.another).toBe(123);
  });
  
  it('should merge with existing metadata', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation',
      metadata: { existing: 'value' }
    };
    
    const enriched = ContextManager.enrich(context, {
      new: 'value'
    });
    
    expect(enriched.metadata?.existing).toBe('value');
    expect(enriched.metadata?.new).toBe('value');
  });
});

describe('ContextManager.isValid', () => {
  it('should return true for valid context', () => {
    const context: ExecutionContext = {
      correlation_id: 'test-correlation'
    };
    
    expect(ContextManager.isValid(context)).toBe(true);
  });
  
  it('should return false for invalid context', () => {
    const context = {} as ExecutionContext;
    expect(ContextManager.isValid(context)).toBe(false);
  });
});

describe('ContextManager.extract', () => {
  it('should create new context when no source provided', () => {
    const context = ContextManager.extract();
    expect(context.correlation_id).toBeDefined();
  });
  
  it('should return existing context when ExecutionContext provided', () => {
    const existing: ExecutionContext = {
      correlation_id: 'existing-correlation'
    };
    
    const context = ContextManager.extract(existing);
    expect(context.correlation_id).toBe('existing-correlation');
  });
  
  it('should extract from headers when headers provided', () => {
    const headers = {
      'x-correlation-id': 'header-correlation'
    };
    
    const context = ContextManager.extract(headers);
    expect(context.correlation_id).toBe('header-correlation');
  });
});

describe('Property: Correlation ID Uniqueness', () => {
  it('should generate unique correlation IDs', () => {
    const contexts = Array.from({ length: 100 }, () => ContextManager.createContext());
    const ids = contexts.map(ctx => ctx.correlation_id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(100);
  });
});

describe('Property: Context Propagation Preserves Identity', () => {
  it('should preserve correlation_id and workflow_id when propagating', () => {
    const parent = ContextManager.createContext({
      workflow_id: 'test-workflow'
    });
    
    const child = ContextManager.propagate(parent);
    
    expect(child.correlation_id).toBe(parent.correlation_id);
    expect(child.workflow_id).toBe(parent.workflow_id);
  });
});
