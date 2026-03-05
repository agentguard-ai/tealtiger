/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes & P0.2: Deterministic Decision Contract
 * 
 * TypeScript interfaces and enums for policy evaluation modes and decision objects.
 * 
 * @module core/engine/types
 * @version 1.1.0
 */

/**
 * Policy evaluation mode that determines enforcement behavior
 * 
 * @enum {string}
 */
export enum PolicyMode {
  /** Block operations that violate the policy */
  ENFORCE = 'ENFORCE',
  /** Allow operations but log violations */
  MONITOR = 'MONITOR',
  /** Allow all operations and log decisions without evaluating rules */
  REPORT_ONLY = 'REPORT_ONLY'
}

/**
 * Hierarchical mode configuration
 * Priority: policy-specific > environment-specific > global default
 * 
 * @interface ModeConfig
 */
export interface ModeConfig {
  /** Global default mode for all policies */
  default: PolicyMode;
  
  /** Environment-specific mode overrides (e.g., 'production', 'staging') */
  environment?: {
    [envName: string]: PolicyMode;
  };
  
  /** Policy-specific mode overrides (highest priority) */
  policy?: {
    [policyId: string]: PolicyMode;
  };
}

/**
 * Decision action returned by policy-enforcing components
 * 
 * @enum {string}
 */
export enum DecisionAction {
  /** Allow the operation to proceed */
  ALLOW = 'ALLOW',
  /** Deny the operation */
  DENY = 'DENY',
  /** Redact sensitive content before proceeding */
  REDACT = 'REDACT',
  /** Transform content before proceeding */
  TRANSFORM = 'TRANSFORM',
  /** Require manual approval before proceeding */
  REQUIRE_APPROVAL = 'REQUIRE_APPROVAL',
  /** Degrade service quality (e.g., use cheaper model) */
  DEGRADE = 'DEGRADE'
}

/**
 * Standardized reason codes explaining why a decision was made
 * 
 * @enum {string}
 */
export enum ReasonCode {
  // Policy compliance
  POLICY_COMPLIANT = 'POLICY_COMPLIANT',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  
  // Content safety
  PII_DETECTED = 'PII_DETECTED',
  PROMPT_INJECTION_DETECTED = 'PROMPT_INJECTION_DETECTED',
  HARMFUL_CONTENT_DETECTED = 'HARMFUL_CONTENT_DETECTED',
  UNSAFE_CODE_DETECTED = 'UNSAFE_CODE_DETECTED',
  
  // Tool misuse (ASI02)
  TOOL_NOT_ALLOWED = 'TOOL_NOT_ALLOWED',
  TOOL_PARAMETER_INVALID = 'TOOL_PARAMETER_INVALID',
  TOOL_RATE_LIMIT_EXCEEDED = 'TOOL_RATE_LIMIT_EXCEEDED',
  
  // Circuit breaker
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  CIRCUIT_HALF_OPEN = 'CIRCUIT_HALF_OPEN',
  
  // Cost governance (P0.6)
  COST_BUDGET_EXCEEDED = 'COST_BUDGET_EXCEEDED',
  COST_VELOCITY_ANOMALY = 'COST_VELOCITY_ANOMALY',
  COST_MODEL_TIER_VIOLATION = 'COST_MODEL_TIER_VIOLATION',
  COST_ESTIMATED_TOO_HIGH = 'COST_ESTIMATED_TOO_HIGH',
  
  // Mode-specific
  MONITOR_MODE_VIOLATION = 'MONITOR_MODE_VIOLATION',
  REPORT_ONLY_MODE = 'REPORT_ONLY_MODE'
}

/**
 * Component version information
 * 
 * @interface ComponentVersions
 */
export interface ComponentVersions {
  /** SDK version */
  sdk: string;
  /** TealEngine version */
  engine: string;
  /** TealGuard version (optional) */
  guard?: string;
  /** TealCircuit version (optional) */
  circuit?: string;
  /** TealMonitor version (optional) */
  monitor?: string;
  /** TealAudit version (optional) */
  audit?: string;
}

/**
 * Cost information for a decision
 * 
 * @interface CostInfo
 */
export interface CostInfo {
  /** Estimated cost before execution */
  estimated?: number;
  /** Actual cost after execution */
  actual?: number;
  /** Currency code (e.g., 'USD') */
  currency?: string;
  /** Model used for cost calculation */
  model?: string;
  /** Token usage breakdown */
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

/**
 * Deterministic decision object returned by all policy-enforcing components
 * 
 * @interface Decision
 */
export interface Decision {
  /** Action to take (ALLOW, DENY, REDACT, etc.) */
  action: DecisionAction;
  
  /** Non-empty array of reason codes explaining the decision */
  reason_codes: ReasonCode[];
  
  /** Risk score between 0 and 100 (inclusive) */
  risk_score: number;
  
  /** Evaluation mode used for this decision */
  mode: PolicyMode;
  
  /** Policy ID that was evaluated */
  policy_id: string;
  
  /** Policy version */
  policy_version: string;
  
  /** Component versions involved in the decision */
  component_versions: ComponentVersions;
  
  /** Non-empty correlation ID for request tracing */
  correlation_id: string;
  
  /** Optional trace ID for distributed tracing */
  trace_id?: string;
  
  /** Optional workflow ID for governance-grade aggregation */
  workflow_id?: string;
  
  /** Optional run ID for execution instance tracking */
  run_id?: string;
  
  /** Optional span ID for operation tracking */
  span_id?: string;
  
  /** Optional parent span ID for nested operations */
  parent_span_id?: string;
  
  /** LLM provider (e.g., 'openai', 'anthropic') */
  provider?: string;
  
  /** Human-readable reason for the decision */
  reason: string;
  
  /** Optional metadata */
  metadata?: {
    /** Evaluation time in milliseconds */
    evaluation_time_ms?: number;
    
    /** Whether result was from cache */
    cache_hit?: boolean;
    
    /** Policies that were triggered */
    triggered_policies?: string[];
    
    /** Cost information (P0.6) */
    cost?: CostInfo;
    
    /** Tenant ID for multi-tenancy */
    tenant_id?: string;
    
    /** Application name */
    application?: string;
    
    /** Environment (e.g., 'production', 'staging') */
    environment?: string;
    
    /** Agent purpose or role */
    agent_purpose?: string;
    
    /** Additional custom metadata */
    [key: string]: any;
  };
}

/**
 * Configuration error thrown when invalid mode configuration is provided
 * 
 * @class InvalidConfigurationError
 * @extends {Error}
 */
export class InvalidConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigurationError';
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidConfigurationError);
    }
  }
}

/**
 * Policy violation error thrown in ENFORCE mode
 * Carries the Decision object that caused the violation
 * 
 * @class PolicyViolationError
 * @extends {Error}
 */
export class PolicyViolationError extends Error {
  public readonly decision: Decision;
  
  constructor(message: string, decision: Decision) {
    super(message);
    this.name = 'PolicyViolationError';
    this.decision = decision;
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolicyViolationError);
    }
  }
}

/**
 * Validates that a PolicyMode value is valid
 * 
 * @param mode - The mode to validate
 * @returns true if valid, false otherwise
 */
export function isValidPolicyMode(mode: any): mode is PolicyMode {
  return Object.values(PolicyMode).includes(mode);
}

/**
 * Validates that a DecisionAction value is valid
 * 
 * @param action - The action to validate
 * @returns true if valid, false otherwise
 */
export function isValidDecisionAction(action: any): action is DecisionAction {
  return Object.values(DecisionAction).includes(action);
}

/**
 * Validates that a ReasonCode value is valid
 * 
 * @param code - The reason code to validate
 * @returns true if valid, false otherwise
 */
export function isValidReasonCode(code: any): code is ReasonCode {
  return Object.values(ReasonCode).includes(code);
}

/**
 * Validates that a risk score is within valid range (0-100)
 * 
 * @param score - The risk score to validate
 * @returns true if valid, false otherwise
 */
export function isValidRiskScore(score: number): boolean {
  return typeof score === 'number' && score >= 0 && score <= 100 && !isNaN(score);
}

/**
 * Validates that a Decision object has all required fields
 * 
 * @param decision - The decision to validate
 * @throws {InvalidConfigurationError} if decision is invalid
 */
export function validateDecision(decision: Decision): void {
  if (!decision) {
    throw new InvalidConfigurationError('Decision object is required');
  }
  
  if (!isValidDecisionAction(decision.action)) {
    throw new InvalidConfigurationError(`Invalid decision action: ${decision.action}`);
  }
  
  if (!Array.isArray(decision.reason_codes) || decision.reason_codes.length === 0) {
    throw new InvalidConfigurationError('Decision must have at least one reason code');
  }
  
  for (const code of decision.reason_codes) {
    if (!isValidReasonCode(code)) {
      throw new InvalidConfigurationError(`Invalid reason code: ${code}`);
    }
  }
  
  if (!isValidRiskScore(decision.risk_score)) {
    throw new InvalidConfigurationError(`Risk score must be between 0 and 100, got: ${decision.risk_score}`);
  }
  
  if (!isValidPolicyMode(decision.mode)) {
    throw new InvalidConfigurationError(`Invalid policy mode: ${decision.mode}`);
  }
  
  if (!decision.policy_id || typeof decision.policy_id !== 'string') {
    throw new InvalidConfigurationError('Decision must have a valid policy_id');
  }
  
  if (!decision.policy_version || typeof decision.policy_version !== 'string') {
    throw new InvalidConfigurationError('Decision must have a valid policy_version');
  }
  
  if (!decision.correlation_id || typeof decision.correlation_id !== 'string') {
    throw new InvalidConfigurationError('Decision must have a non-empty correlation_id');
  }
  
  if (!decision.component_versions || typeof decision.component_versions !== 'object') {
    throw new InvalidConfigurationError('Decision must have component_versions');
  }
  
  if (!decision.reason || typeof decision.reason !== 'string') {
    throw new InvalidConfigurationError('Decision must have a human-readable reason');
  }
}

/**
 * Validates that a ModeConfig object is valid
 * 
 * @param config - The mode configuration to validate
 * @throws {InvalidConfigurationError} if configuration is invalid
 */
export function validateModeConfig(config: ModeConfig): void {
  if (!config) {
    throw new InvalidConfigurationError('ModeConfig is required');
  }
  
  if (!isValidPolicyMode(config.default)) {
    throw new InvalidConfigurationError(`Invalid default mode: ${config.default}`);
  }
  
  if (config.environment) {
    for (const [env, mode] of Object.entries(config.environment)) {
      if (!isValidPolicyMode(mode)) {
        throw new InvalidConfigurationError(`Invalid mode for environment '${env}': ${mode}`);
      }
    }
  }
  
  if (config.policy) {
    for (const [policyId, mode] of Object.entries(config.policy)) {
      if (!isValidPolicyMode(mode)) {
        throw new InvalidConfigurationError(`Invalid mode for policy '${policyId}': ${mode}`);
      }
    }
  }
}
