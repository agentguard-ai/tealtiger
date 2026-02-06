/**
 * AI Agent Security Platform SDK - Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the SDK
 */

// ============================================================================
// Core SDK Types
// ============================================================================

/**
 * Configuration options for the AgentGuard SDK
 */
export interface AgentGuardConfig {
  /** API key for authentication with the Security Sidecar Agent */
  apiKey: string;
  
  /** URL of the Security Sidecar Agent (SSA) */
  ssaUrl: string;
  
  /** Agent identifier for audit trail */
  agentId?: string | undefined;
  
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number | undefined;
  
  /** Number of retry attempts for failed requests (default: 3) */
  retries?: number | undefined;
  
  /** Enable debug logging (default: false) */
  debug?: boolean | undefined;
  
  /** Custom headers to include with requests */
  headers?: Record<string, string> | undefined;
}

/**
 * Tool execution parameters
 */
export interface ToolParameters {
  [key: string]: unknown;
}

/**
 * Additional context for security evaluation
 */
export interface SecurityContext {
  /** User agent or client information */
  userAgent?: string;
  
  /** Session or request identifier */
  sessionId?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Security Decision Types
// ============================================================================

/**
 * Security decision actions
 */
export type SecurityAction = 'allow' | 'deny' | 'transform';

/**
 * Risk levels for security evaluation
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security decision response from SSA
 */
export interface SecurityDecision {
  /** Unique identifier for this request */
  requestId: string;
  
  /** Agent identifier */
  agentId: string;
  
  /** Tool name that was evaluated */
  toolName: string;
  
  /** Security decision action */
  action: SecurityAction;
  
  /** Human-readable reason for the decision */
  reason: string;
  
  /** Risk level assessment */
  riskLevel: RiskLevel;
  
  /** Transformed request (if action is 'transform') */
  transformedRequest?: ToolExecutionRequest;
  
  /** Timestamp of the decision */
  timestamp: string;
  
  /** Additional metadata */
  metadata?: {
    policyVersion?: string;
    evaluationTime?: number;
    matchedPolicy?: string;
  };
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  /** Agent identifier */
  agentId: string;
  
  /** Name of the tool to execute */
  toolName: string;
  
  /** Parameters for the tool */
  parameters: ToolParameters;
  
  /** Additional context for security evaluation */
  context?: SecurityContext | undefined;
}

/**
 * Security evaluation response from SSA
 */
export interface SecurityEvaluationResponse {
  /** Whether the request was successful */
  success: boolean;
  
  /** Security decision */
  decision: SecurityDecision;
  
  /** Error information (if success is false) */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy condition types
 */
export type PolicyConditionType = 
  | 'tool_name' 
  | 'risk_level' 
  | 'agent_id' 
  | 'parameter_exists' 
  | 'parameter_value';

/**
 * Policy condition
 */
export interface PolicyCondition {
  type: PolicyConditionType;
  pattern?: string;
  operator?: string;
  value?: string;
  parameter?: string;
}

/**
 * Policy transformation types
 */
export interface PolicyTransformation {
  type: 'read_only' | 'parameter_filter' | 'parameter_anonymize';
  remove_parameters?: string[];
  anonymize_parameters?: string[];
}

/**
 * Security policy definition
 */
export interface SecurityPolicy {
  /** Policy name */
  name: string;
  
  /** Policy description */
  description?: string;
  
  /** Conditions that must be met for this policy to apply */
  conditions: PolicyCondition[];
  
  /** Action to take when policy matches */
  action: SecurityAction;
  
  /** Reason for the action */
  reason: string;
  
  /** Transformation to apply (if action is 'transform') */
  transformation?: PolicyTransformation;
  
  /** Policy priority (lower numbers = higher priority) */
  priority?: number;
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  /** Whether the policy is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
}

// ============================================================================
// Audit Types
// ============================================================================

/**
 * Audit trail entry
 */
export interface AuditEntry {
  /** Unique audit entry ID */
  id: string;
  
  /** Timestamp of the entry */
  timestamp: string;
  
  /** Type of audit entry */
  type: 'security_decision' | 'error' | 'info';
  
  /** Agent identifier */
  agentId: string;
  
  /** Request identifier */
  requestId?: string;
  
  /** Tool name */
  toolName?: string;
  
  /** Security action taken */
  action?: SecurityAction;
  
  /** Reason for the action */
  reason?: string;
  
  /** Risk level */
  riskLevel?: RiskLevel;
  
  /** Client IP address */
  clientIp?: string;
  
  /** User agent */
  userAgent?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit trail response
 */
export interface AuditTrailResponse {
  /** Whether the request was successful */
  success: boolean;
  
  /** Audit trail data */
  auditTrail: {
    /** Audit entries */
    entries: AuditEntry[];
    
    /** Total number of entries */
    total: number;
    
    /** Limit applied to the query */
    limit: number;
    
    /** Offset applied to the query */
    offset: number;
  };
  
  /** Error information (if success is false) */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * SDK error codes
 */
export enum AgentGuardErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_SSA_URL = 'INVALID_SSA_URL',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // Authentication errors
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_API_KEY_FORMAT = 'INVALID_API_KEY_FORMAT',
  
  // Request errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Security errors
  SECURITY_DENIED = 'SECURITY_DENIED',
  POLICY_ERROR = 'POLICY_ERROR'
}

/**
 * SDK error class
 */
export interface AgentGuardError extends Error {
  code: AgentGuardErrorCode;
  details?: Record<string, unknown> | undefined;
  cause?: Error | undefined;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  timeout?: number;
}

/**
 * HTTP response
 */
export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult<T = unknown> {
  /** Whether the tool execution was successful */
  success: boolean;
  
  /** Tool execution result data */
  data?: T | undefined;
  
  /** Security decision that was applied */
  securityDecision: SecurityDecision;
  
  /** Error information (if success is false) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | undefined;
}

/**
 * SDK statistics
 */
export interface SDKStatistics {
  /** Total number of requests made */
  totalRequests: number;
  
  /** Number of allowed requests */
  allowedRequests: number;
  
  /** Number of denied requests */
  deniedRequests: number;
  
  /** Number of transformed requests */
  transformedRequests: number;
  
  /** Average response time in milliseconds */
  averageResponseTime: number;
  
  /** Number of errors encountered */
  errorCount: number;
}