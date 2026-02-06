/**
 * AgentGuard SDK - Main Export
 * 
 * This is the main entry point for the AgentGuard SDK
 */

// Main SDK class
export { AgentGuard } from './client/AgentGuard';

// Policy utilities
export { 
  PolicyBuilder, 
  createPolicy, 
  PolicyTemplates 
} from './policy/PolicyBuilder';

export { 
  PolicyTester, 
  createPolicyTester 
} from './policy/PolicyTester';

export { 
  PolicyValidator,
  createPolicyValidator
} from './policy/PolicyValidator';

export { 
  PolicySimulator,
  createPolicySimulator
} from './policy/PolicySimulator';

export type {
  PolicyTestResult,
  PolicyTestSuite
} from './policy/PolicyTester';

export type {
  PolicyValidationResult,
  PolicyConflict,
  PolicySetAnalysis
} from './policy/PolicyValidator';

export type {
  SimulationScenario,
  SimulationRequestResult,
  SimulationResult,
  BatchSimulationResult
} from './policy/PolicySimulator';

// Types and interfaces
export type {
  AgentGuardConfig,
  ToolParameters,
  SecurityContext,
  SecurityDecision,
  SecurityAction,
  RiskLevel,
  ToolExecutionRequest,
  ToolExecutionResult,
  SecurityEvaluationResponse,
  SecurityPolicy,
  PolicyCondition,
  PolicyTransformation,
  AuditEntry,
  AuditTrailResponse,
  SDKStatistics,
  AgentGuardError
} from './types';

// Error classes
export {
  BaseAgentGuardError,
  AgentGuardConfigError,
  AgentGuardNetworkError,
  AgentGuardServerError,
  AgentGuardSecurityError,
  AgentGuardValidationError,
  AgentGuardAuthError,
  createAgentGuardError,
  isAgentGuardError,
  getErrorDetails
} from './utils/errors';

// Error codes enum
export { AgentGuardErrorCode } from './types';

// Utility functions
export {
  validateConfig,
  validateToolName,
  validateToolParameters,
  validateAgentId,
  validateSecurityContext,
  sanitizeParameters,
  sanitizeConfig
} from './utils/validation';

// Configuration
export { Configuration, DEFAULT_CONFIG } from './config/Configuration';

// Guardrails
export {
  Guardrail,
  GuardrailResult,
  GuardrailConfig,
  GuardrailMetadata,
  GuardrailResultData,
  GuardrailEngine,
  GuardrailEngineResult,
  GuardrailEngineOptions,
  GuardrailExecutionResult,
  PIIDetectionGuardrail,
  PIIDetectionConfig,
  ContentModerationGuardrail,
  ContentModerationConfig,
  PromptInjectionGuardrail,
  PromptInjectionConfig
} from './guardrails';

// Version
export const VERSION = '0.1.0';