/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes & P0.2: Deterministic Decision Contract
 * 
 * Unit tests for TypeScript interfaces and enums
 * 
 * @module core/engine/types.test
 * @version 1.1.0
 */

import { 
  PolicyMode, 
  DecisionAction, 
  ReasonCode, 
  Decision,
  ModeConfig,
  ComponentVersions,
  CostInfo,
  InvalidConfigurationError,
  PolicyViolationError,
  isValidPolicyMode,
  isValidDecisionAction,
  isValidReasonCode,
  isValidRiskScore,
  validateDecision,
  validateModeConfig
} from './types';

describe('PolicyMode enum', () => {
  it('should have exactly 3 modes', () => {
    const modes = Object.values(PolicyMode);
    expect(modes).toHaveLength(3);
  });
  
  it('should have ENFORCE mode', () => {
    expect(PolicyMode.ENFORCE).toBe('ENFORCE');
  });
  
  it('should have MONITOR mode', () => {
    expect(PolicyMode.MONITOR).toBe('MONITOR');
  });
  
  it('should have REPORT_ONLY mode', () => {
    expect(PolicyMode.REPORT_ONLY).toBe('REPORT_ONLY');
  });
});

describe('DecisionAction enum', () => {
  it('should have exactly 6 actions', () => {
    const actions = Object.values(DecisionAction);
    expect(actions).toHaveLength(6);
  });
  
  it('should have all required actions', () => {
    expect(DecisionAction.ALLOW).toBe('ALLOW');
    expect(DecisionAction.DENY).toBe('DENY');
    expect(DecisionAction.REDACT).toBe('REDACT');
    expect(DecisionAction.TRANSFORM).toBe('TRANSFORM');
    expect(DecisionAction.REQUIRE_APPROVAL).toBe('REQUIRE_APPROVAL');
    expect(DecisionAction.DEGRADE).toBe('DEGRADE');
  });
});

describe('ReasonCode enum', () => {
  it('should include policy compliance codes', () => {
    expect(ReasonCode.POLICY_COMPLIANT).toBe('POLICY_COMPLIANT');
    expect(ReasonCode.POLICY_VIOLATION).toBe('POLICY_VIOLATION');
  });
  
  it('should include content safety codes', () => {
    expect(ReasonCode.PII_DETECTED).toBe('PII_DETECTED');
    expect(ReasonCode.PROMPT_INJECTION_DETECTED).toBe('PROMPT_INJECTION_DETECTED');
    expect(ReasonCode.HARMFUL_CONTENT_DETECTED).toBe('HARMFUL_CONTENT_DETECTED');
    expect(ReasonCode.UNSAFE_CODE_DETECTED).toBe('UNSAFE_CODE_DETECTED');
  });
  
  it('should include tool misuse codes (ASI02)', () => {
    expect(ReasonCode.TOOL_NOT_ALLOWED).toBe('TOOL_NOT_ALLOWED');
    expect(ReasonCode.TOOL_PARAMETER_INVALID).toBe('TOOL_PARAMETER_INVALID');
    expect(ReasonCode.TOOL_RATE_LIMIT_EXCEEDED).toBe('TOOL_RATE_LIMIT_EXCEEDED');
  });
  
  it('should include circuit breaker codes', () => {
    expect(ReasonCode.CIRCUIT_OPEN).toBe('CIRCUIT_OPEN');
    expect(ReasonCode.CIRCUIT_HALF_OPEN).toBe('CIRCUIT_HALF_OPEN');
  });
  
  it('should include cost governance codes (P0.6)', () => {
    expect(ReasonCode.COST_BUDGET_EXCEEDED).toBe('COST_BUDGET_EXCEEDED');
    expect(ReasonCode.COST_VELOCITY_ANOMALY).toBe('COST_VELOCITY_ANOMALY');
    expect(ReasonCode.COST_MODEL_TIER_VIOLATION).toBe('COST_MODEL_TIER_VIOLATION');
    expect(ReasonCode.COST_ESTIMATED_TOO_HIGH).toBe('COST_ESTIMATED_TOO_HIGH');
  });
  
  it('should include mode-specific codes', () => {
    expect(ReasonCode.MONITOR_MODE_VIOLATION).toBe('MONITOR_MODE_VIOLATION');
    expect(ReasonCode.REPORT_ONLY_MODE).toBe('REPORT_ONLY_MODE');
  });
});

describe('ModeConfig interface', () => {
  it('should create valid mode config with default only', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE
    };
    
    expect(config.default).toBe(PolicyMode.ENFORCE);
    expect(config.environment).toBeUndefined();
    expect(config.policy).toBeUndefined();
  });
  
  it('should create valid mode config with environment overrides', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE,
      environment: {
        'production': PolicyMode.ENFORCE,
        'staging': PolicyMode.MONITOR,
        'development': PolicyMode.REPORT_ONLY
      }
    };
    
    expect(config.environment?.['production']).toBe(PolicyMode.ENFORCE);
    expect(config.environment?.['staging']).toBe(PolicyMode.MONITOR);
    expect(config.environment?.['development']).toBe(PolicyMode.REPORT_ONLY);
  });
  
  it('should create valid mode config with policy overrides', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE,
      policy: {
        'pii-detection': PolicyMode.MONITOR,
        'prompt-injection': PolicyMode.ENFORCE
      }
    };
    
    expect(config.policy?.['pii-detection']).toBe(PolicyMode.MONITOR);
    expect(config.policy?.['prompt-injection']).toBe(PolicyMode.ENFORCE);
  });
  
  it('should create valid mode config with all overrides', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE,
      environment: {
        'staging': PolicyMode.MONITOR
      },
      policy: {
        'pii-detection': PolicyMode.REPORT_ONLY
      }
    };
    
    expect(config.default).toBe(PolicyMode.ENFORCE);
    expect(config.environment?.['staging']).toBe(PolicyMode.MONITOR);
    expect(config.policy?.['pii-detection']).toBe(PolicyMode.REPORT_ONLY);
  });
});

describe('Decision interface', () => {
  const createValidDecision = (): Decision => ({
    action: DecisionAction.ALLOW,
    reason_codes: [ReasonCode.POLICY_COMPLIANT],
    risk_score: 0,
    mode: PolicyMode.ENFORCE,
    policy_id: 'test-policy',
    policy_version: '1.0.0',
    component_versions: { sdk: '1.1.0', engine: '1.1.0' },
    correlation_id: 'test-correlation-id',
    reason: 'Policy compliant'
  });
  
  it('should create valid decision object with required fields', () => {
    const decision = createValidDecision();
    
    expect(decision.action).toBe(DecisionAction.ALLOW);
    expect(decision.reason_codes).toEqual([ReasonCode.POLICY_COMPLIANT]);
    expect(decision.risk_score).toBe(0);
    expect(decision.mode).toBe(PolicyMode.ENFORCE);
    expect(decision.policy_id).toBe('test-policy');
    expect(decision.policy_version).toBe('1.0.0');
    expect(decision.component_versions).toEqual({ sdk: '1.1.0', engine: '1.1.0' });
    expect(decision.correlation_id).toBe('test-correlation-id');
    expect(decision.reason).toBe('Policy compliant');
  });
  
  it('should support optional trace_id', () => {
    const decision: Decision = {
      ...createValidDecision(),
      trace_id: 'test-trace-id'
    };
    
    expect(decision.trace_id).toBe('test-trace-id');
  });
  
  it('should support optional workflow_id and run_id (P0.3)', () => {
    const decision: Decision = {
      ...createValidDecision(),
      workflow_id: 'customer-support-workflow',
      run_id: 'run-12345'
    };
    
    expect(decision.workflow_id).toBe('customer-support-workflow');
    expect(decision.run_id).toBe('run-12345');
  });
  
  it('should support optional span_id and parent_span_id (P0.3)', () => {
    const decision: Decision = {
      ...createValidDecision(),
      span_id: 'span-abc',
      parent_span_id: 'span-parent'
    };
    
    expect(decision.span_id).toBe('span-abc');
    expect(decision.parent_span_id).toBe('span-parent');
  });
  
  it('should support optional provider', () => {
    const decision: Decision = {
      ...createValidDecision(),
      provider: 'openai'
    };
    
    expect(decision.provider).toBe('openai');
  });
  
  it('should support optional metadata', () => {
    const decision: Decision = {
      ...createValidDecision(),
      metadata: {
        evaluation_time_ms: 5,
        cache_hit: false,
        triggered_policies: ['pii-detection', 'prompt-injection']
      }
    };
    
    expect(decision.metadata?.evaluation_time_ms).toBe(5);
    expect(decision.metadata?.cache_hit).toBe(false);
    expect(decision.metadata?.triggered_policies).toEqual(['pii-detection', 'prompt-injection']);
  });
  
  it('should support cost information in metadata (P0.6)', () => {
    const decision: Decision = {
      ...createValidDecision(),
      metadata: {
        cost: {
          estimated: 0.001,
          actual: 0.0012,
          currency: 'USD',
          model: 'gpt-4',
          tokens: {
            prompt: 100,
            completion: 50,
            total: 150
          }
        }
      }
    };
    
    expect(decision.metadata?.cost?.estimated).toBe(0.001);
    expect(decision.metadata?.cost?.actual).toBe(0.0012);
    expect(decision.metadata?.cost?.currency).toBe('USD');
    expect(decision.metadata?.cost?.tokens?.total).toBe(150);
  });
  
  it('should enforce risk_score bounds (0-100)', () => {
    const decision = createValidDecision();
    
    expect(decision.risk_score).toBeGreaterThanOrEqual(0);
    expect(decision.risk_score).toBeLessThanOrEqual(100);
  });
  
  it('should require non-empty reason_codes array', () => {
    const decision = createValidDecision();
    
    expect(Array.isArray(decision.reason_codes)).toBe(true);
    expect(decision.reason_codes.length).toBeGreaterThan(0);
  });
});

describe('InvalidConfigurationError', () => {
  it('should create error with correct name', () => {
    const error = new InvalidConfigurationError('Invalid mode');
    
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidConfigurationError');
    expect(error.message).toBe('Invalid mode');
  });
  
  it('should maintain stack trace', () => {
    const error = new InvalidConfigurationError('Test error');
    
    expect(error.stack).toBeDefined();
  });
});

describe('PolicyViolationError', () => {
  it('should create error with correct name and decision', () => {
    const decision = {
      action: DecisionAction.DENY,
      reason_codes: [ReasonCode.POLICY_VIOLATION],
      risk_score: 80,
      mode: PolicyMode.ENFORCE,
      policy_id: 'test-policy',
      policy_version: '1.0.0',
      component_versions: { sdk: '1.1.0', engine: '1.1.0' },
      correlation_id: 'test-correlation-id',
      reason: 'Policy violation detected'
    };
    
    const error = new PolicyViolationError('Violation', decision);
    
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PolicyViolationError');
    expect(error.message).toBe('Violation');
    expect(error.decision).toBe(decision);
  });
  
  it('should maintain stack trace', () => {
    const decision = {
      action: DecisionAction.DENY,
      reason_codes: [ReasonCode.POLICY_VIOLATION],
      risk_score: 80,
      mode: PolicyMode.ENFORCE,
      policy_id: 'test-policy',
      policy_version: '1.0.0',
      component_versions: { sdk: '1.1.0', engine: '1.1.0' },
      correlation_id: 'test-correlation-id',
      reason: 'Policy violation detected'
    };
    
    const error = new PolicyViolationError('Test error', decision);
    
    expect(error.stack).toBeDefined();
  });
});

describe('isValidPolicyMode', () => {
  it('should return true for valid modes', () => {
    expect(isValidPolicyMode(PolicyMode.ENFORCE)).toBe(true);
    expect(isValidPolicyMode(PolicyMode.MONITOR)).toBe(true);
    expect(isValidPolicyMode(PolicyMode.REPORT_ONLY)).toBe(true);
  });
  
  it('should return false for invalid modes', () => {
    expect(isValidPolicyMode('INVALID')).toBe(false);
    expect(isValidPolicyMode(null)).toBe(false);
    expect(isValidPolicyMode(undefined)).toBe(false);
    expect(isValidPolicyMode(123)).toBe(false);
  });
});

describe('isValidDecisionAction', () => {
  it('should return true for valid actions', () => {
    expect(isValidDecisionAction(DecisionAction.ALLOW)).toBe(true);
    expect(isValidDecisionAction(DecisionAction.DENY)).toBe(true);
    expect(isValidDecisionAction(DecisionAction.REDACT)).toBe(true);
    expect(isValidDecisionAction(DecisionAction.TRANSFORM)).toBe(true);
    expect(isValidDecisionAction(DecisionAction.REQUIRE_APPROVAL)).toBe(true);
    expect(isValidDecisionAction(DecisionAction.DEGRADE)).toBe(true);
  });
  
  it('should return false for invalid actions', () => {
    expect(isValidDecisionAction('INVALID')).toBe(false);
    expect(isValidDecisionAction(null)).toBe(false);
    expect(isValidDecisionAction(undefined)).toBe(false);
  });
});

describe('isValidReasonCode', () => {
  it('should return true for valid reason codes', () => {
    expect(isValidReasonCode(ReasonCode.POLICY_COMPLIANT)).toBe(true);
    expect(isValidReasonCode(ReasonCode.PII_DETECTED)).toBe(true);
    expect(isValidReasonCode(ReasonCode.COST_BUDGET_EXCEEDED)).toBe(true);
  });
  
  it('should return false for invalid reason codes', () => {
    expect(isValidReasonCode('INVALID')).toBe(false);
    expect(isValidReasonCode(null)).toBe(false);
    expect(isValidReasonCode(undefined)).toBe(false);
  });
});

describe('isValidRiskScore', () => {
  it('should return true for valid risk scores', () => {
    expect(isValidRiskScore(0)).toBe(true);
    expect(isValidRiskScore(50)).toBe(true);
    expect(isValidRiskScore(100)).toBe(true);
  });
  
  it('should return false for invalid risk scores', () => {
    expect(isValidRiskScore(-1)).toBe(false);
    expect(isValidRiskScore(101)).toBe(false);
    expect(isValidRiskScore(NaN)).toBe(false);
    expect(isValidRiskScore(Infinity)).toBe(false);
  });
});

describe('validateDecision', () => {
  const createValidDecision = (): Decision => ({
    action: DecisionAction.ALLOW,
    reason_codes: [ReasonCode.POLICY_COMPLIANT],
    risk_score: 0,
    mode: PolicyMode.ENFORCE,
    policy_id: 'test-policy',
    policy_version: '1.0.0',
    component_versions: { sdk: '1.1.0', engine: '1.1.0' },
    correlation_id: 'test-correlation-id',
    reason: 'Policy compliant'
  });
  
  it('should not throw for valid decision', () => {
    const decision = createValidDecision();
    expect(() => validateDecision(decision)).not.toThrow();
  });
  
  it('should throw for null decision', () => {
    expect(() => validateDecision(null as any)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid action', () => {
    const decision = { ...createValidDecision(), action: 'INVALID' as any };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for empty reason_codes', () => {
    const decision = { ...createValidDecision(), reason_codes: [] };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid reason code', () => {
    const decision = { ...createValidDecision(), reason_codes: ['INVALID' as any] };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid risk_score', () => {
    const decision = { ...createValidDecision(), risk_score: 101 };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid mode', () => {
    const decision = { ...createValidDecision(), mode: 'INVALID' as any };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for missing policy_id', () => {
    const decision = { ...createValidDecision(), policy_id: '' };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for missing correlation_id', () => {
    const decision = { ...createValidDecision(), correlation_id: '' };
    expect(() => validateDecision(decision)).toThrow(InvalidConfigurationError);
  });
});

describe('validateModeConfig', () => {
  it('should not throw for valid config', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE
    };
    expect(() => validateModeConfig(config)).not.toThrow();
  });
  
  it('should throw for null config', () => {
    expect(() => validateModeConfig(null as any)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid default mode', () => {
    const config = { default: 'INVALID' as any };
    expect(() => validateModeConfig(config)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid environment mode', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE,
      environment: {
        'production': 'INVALID' as any
      }
    };
    expect(() => validateModeConfig(config)).toThrow(InvalidConfigurationError);
  });
  
  it('should throw for invalid policy mode', () => {
    const config: ModeConfig = {
      default: PolicyMode.ENFORCE,
      policy: {
        'test-policy': 'INVALID' as any
      }
    };
    expect(() => validateModeConfig(config)).toThrow(InvalidConfigurationError);
  });
});
