/**
 * Mock factories for TealTiger v1.3 governance components.
 *
 * Each factory returns a mock object with configurable behavior,
 * enabling property-based and unit tests to control governance outcomes
 * without requiring the full TealTiger SDK runtime.
 *
 * @module __tests__/helpers/mock-factories
 */

import { vi } from 'vitest';
import type { Decision, DecisionAction, TokenUsage } from '../../types/decision';

// ── Helper Types ─────────────────────────────────────────────────

export interface MockDecisionOptions {
  action?: DecisionAction;
  reason_codes?: string[];
  risk_score?: number;
  correlation_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

function makeDecision(opts: MockDecisionOptions = {}): Decision {
  return {
    action: opts.action ?? 'ALLOW',
    reason_codes: opts.reason_codes ?? ['POLICY_COMPLIANT'],
    risk_score: opts.risk_score ?? 0,
    correlation_id: opts.correlation_id ?? 'mock-correlation-id',
    reason: opts.reason ?? 'Mock decision',
    ...(opts.metadata && { metadata: opts.metadata }),
  };
}

// ── TealEngineV12 Mock ───────────────────────────────────────────

export interface MockTealEngineV12Options {
  /** Default decision action returned by evaluateV12 */
  defaultAction?: DecisionAction;
  /** Decision to return on specific requests (matched by content) */
  decisions?: Map<string, Decision>;
  /** Whether evaluateV12 should throw an error */
  shouldThrow?: boolean;
  /** Error to throw when shouldThrow is true */
  throwError?: Error;
  /** Custom evaluateV12 implementation */
  evaluateV12Fn?: (request: Record<string, unknown>, ctx: { correlation_id: string }) => Promise<Decision>;
}

export interface MockTealEngineV12 {
  evaluateV12: ReturnType<typeof vi.fn>;
  getModuleStatus: ReturnType<typeof vi.fn>;
  getTEECRegistry: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock TealEngineV12 instance with configurable policy evaluation behavior.
 *
 * @example
 * ```typescript
 * const engine = createMockTealEngineV12({ defaultAction: 'DENY' });
 * const decision = await engine.evaluateV12({ content: 'test' }, { correlation_id: 'abc' });
 * // decision.action === 'DENY'
 * ```
 */
export function createMockTealEngineV12(options: MockTealEngineV12Options = {}): MockTealEngineV12 {
  const {
    defaultAction = 'ALLOW',
    decisions = new Map(),
    shouldThrow = false,
    throwError = new Error('TealEngineV12 evaluation failed'),
    evaluateV12Fn,
  } = options;

  const evaluateV12 = vi.fn(
    async (request: Record<string, unknown>, ctx: { correlation_id: string }): Promise<Decision> => {
      if (shouldThrow) throw throwError;

      if (evaluateV12Fn) {
        return evaluateV12Fn(request, ctx);
      }

      const content = (request.content as string) ?? '';
      const matchedDecision = decisions.get(content);
      if (matchedDecision) return { ...matchedDecision, correlation_id: ctx.correlation_id };

      return makeDecision({
        action: defaultAction,
        correlation_id: ctx.correlation_id,
        reason_codes: defaultAction === 'ALLOW' ? ['POLICY_COMPLIANT'] : ['POLICY_VIOLATION'],
        risk_score: defaultAction === 'ALLOW' ? 0 : 85,
        reason: defaultAction === 'ALLOW' ? 'Policy allows request' : 'Policy denies request',
      });
    },
  );

  const getModuleStatus = vi.fn(() => ({}));
  const getTEECRegistry = vi.fn(() => ({ version: '0.1.0', reason_codes: new Map(), event_types: new Map(), decision_actions: new Map() }));

  return { evaluateV12, getModuleStatus, getTEECRegistry };
}

// ── TealGuard Mock ───────────────────────────────────────────────

export interface MockTealGuardOptions {
  /** Whether PII is detected in input */
  detectPii?: boolean;
  /** PII types to detect */
  piiTypes?: string[];
  /** Whether prompt injection is detected */
  detectInjection?: boolean;
  /** Whether content moderation is triggered */
  detectHarmfulContent?: boolean;
  /** Whether the check should throw an error */
  shouldThrow?: boolean;
  /** Custom check implementation */
  checkFn?: (input: string) => Promise<Decision>;
}

export interface MockTealGuard {
  check: ReturnType<typeof vi.fn>;
  registerGuardrail: ReturnType<typeof vi.fn>;
  clearGuardrails: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock TealGuard instance with configurable guardrail detection.
 *
 * @example
 * ```typescript
 * const guard = createMockTealGuard({ detectPii: true, detectInjection: false });
 * const decision = await guard.check('my email is test@example.com');
 * // decision.action === 'REDACT' (PII detected → redact)
 * ```
 */
export function createMockTealGuard(options: MockTealGuardOptions = {}): MockTealGuard {
  const {
    detectPii = false,
    piiTypes = ['email'],
    detectInjection = false,
    detectHarmfulContent = false,
    shouldThrow = false,
    checkFn,
  } = options;

  const check = vi.fn(async (input: string, _context?: unknown): Promise<Decision> => {
    if (shouldThrow) throw new Error('TealGuard check failed');

    if (checkFn) return checkFn(input);

    const reasonCodes: string[] = [];
    let action: DecisionAction = 'ALLOW';
    let riskScore = 0;

    if (detectInjection) {
      action = 'DENY';
      reasonCodes.push('PROMPT_INJECTION_DETECTED');
      riskScore = 95;
    } else if (detectPii) {
      action = 'REDACT';
      reasonCodes.push('PII_DETECTED');
      riskScore = 60;
    } else if (detectHarmfulContent) {
      action = 'DENY';
      reasonCodes.push('HARMFUL_CONTENT_DETECTED');
      riskScore = 90;
    }

    if (reasonCodes.length === 0) {
      reasonCodes.push('POLICY_COMPLIANT');
    }

    return makeDecision({
      action,
      reason_codes: reasonCodes,
      risk_score: riskScore,
      reason: action === 'ALLOW'
        ? 'All guardrail checks passed'
        : `Guardrail triggered: ${reasonCodes.join(', ')}`,
      metadata: detectPii ? { pii_types: piiTypes } : undefined,
    });
  });

  const registerGuardrail = vi.fn();
  const clearGuardrails = vi.fn();

  return { check, registerGuardrail, clearGuardrails };
}

// ── TealCircuit Mock ─────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface MockTealCircuitOptions {
  /** Initial circuit state */
  initialState?: CircuitState;
  /** Failure threshold before opening */
  failureThreshold?: number;
  /** Timeout before transitioning to half-open (ms) */
  timeout?: number;
  /** Half-open requests before closing */
  halfOpenRequests?: number;
}

export interface MockTealCircuit {
  execute: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  forceOpen: ReturnType<typeof vi.fn>;
  forceClose: ReturnType<typeof vi.fn>;
  /** Direct state manipulation for testing */
  _setState: (state: CircuitState) => void;
  _getFailures: () => number;
}

/**
 * Creates a mock TealCircuit instance with configurable circuit breaker behavior.
 *
 * @example
 * ```typescript
 * const circuit = createMockTealCircuit({ initialState: 'open' });
 * const decision = circuit.evaluate();
 * // decision.action === 'DENY'
 * ```
 */
export function createMockTealCircuit(options: MockTealCircuitOptions = {}): MockTealCircuit {
  const {
    initialState = 'closed',
    failureThreshold = 5,
    timeout = 60_000,
    halfOpenRequests = 3,
  } = options;

  let state: CircuitState = initialState;
  let failures = 0;
  let halfOpenAttempts = 0;

  const execute = vi.fn(async <T>(fn: () => Promise<T>): Promise<T> => {
    if (state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      // Success
      if (state === 'half-open') {
        halfOpenAttempts++;
        if (halfOpenAttempts >= halfOpenRequests) {
          state = 'closed';
          failures = 0;
          halfOpenAttempts = 0;
        }
      } else if (state === 'closed') {
        failures = 0;
      }
      return result;
    } catch (error) {
      failures++;
      if (state === 'half-open') {
        state = 'open';
        halfOpenAttempts = 0;
      } else if (state === 'closed' && failures >= failureThreshold) {
        state = 'open';
      }
      throw error;
    }
  });

  const evaluate = vi.fn((): Decision => {
    if (state === 'open') {
      return makeDecision({
        action: 'DENY',
        reason_codes: ['CIRCUIT_OPEN'],
        risk_score: 100,
        reason: 'Circuit breaker is open',
        metadata: { circuit_state: state, failures },
      });
    }
    return makeDecision({
      action: 'ALLOW',
      reason_codes: ['POLICY_COMPLIANT'],
      risk_score: state === 'half-open' ? 50 : 0,
      reason: state === 'half-open'
        ? 'Circuit breaker is half-open'
        : 'Circuit breaker is closed',
      metadata: { circuit_state: state, failures },
    });
  });

  const getState = vi.fn(() => state);
  const getStats = vi.fn(() => ({
    state,
    failures,
    lastFailureTime: null,
    halfOpenAttempts,
  }));
  const reset = vi.fn(() => { state = 'closed'; failures = 0; halfOpenAttempts = 0; });
  const forceOpen = vi.fn(() => { state = 'open'; });
  const forceClose = vi.fn(() => { state = 'closed'; failures = 0; halfOpenAttempts = 0; });
  const _setState = (newState: CircuitState) => { state = newState; };
  const _getFailures = () => failures;

  return { execute, evaluate, getState, getStats, reset, forceOpen, forceClose, _setState, _getFailures };
}

// ── TealAudit Mock ───────────────────────────────────────────────

export interface MockTealAuditOptions {
  /** Whether the log method should throw */
  shouldThrow?: boolean;
  /** Capture logged entries for inspection */
  captureEntries?: boolean;
}

export interface MockTealAudit {
  log: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  getEventCount: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  /** Get captured log entries (if captureEntries was true) */
  getCapturedEntries: () => unknown[];
}

/**
 * Creates a mock TealAudit instance for audit log testing.
 *
 * @example
 * ```typescript
 * const audit = createMockTealAudit({ captureEntries: true });
 * audit.log({ schema_version: '1.0.0', ... });
 * const entries = audit.getCapturedEntries();
 * // entries.length === 1
 * ```
 */
export function createMockTealAudit(options: MockTealAuditOptions = {}): MockTealAudit {
  const { shouldThrow = false, captureEntries = true } = options;
  const entries: unknown[] = [];

  const log = vi.fn((event: unknown) => {
    if (shouldThrow) throw new Error('TealAudit log failed');
    if (captureEntries) entries.push(event);
  });

  const query = vi.fn(() => [...entries]);
  const clear = vi.fn(() => { entries.length = 0; });
  const getEventCount = vi.fn(() => entries.length);
  const close = vi.fn();
  const getCapturedEntries = () => [...entries];

  return { log, query, clear, getEventCount, close, getCapturedEntries };
}

// ── CostTracker Mock ─────────────────────────────────────────────

export interface MockCostTrackerOptions {
  /** Default estimated cost per request */
  defaultEstimatedCost?: number;
  /** Whether a budget limit should be exceeded */
  budgetExceeded?: boolean;
  /** Which budget type is exceeded */
  exceededBudgetType?: 'per-request' | 'per-session' | 'daily';
  /** Remaining budget to report */
  remainingBudget?: number;
  /** Whether pricing data is available */
  hasPricingData?: boolean;
  /** Custom pricing overrides */
  customPricing?: Record<string, { inputCostPer1K: number; outputCostPer1K: number }>;
}

export interface MockCostTracker {
  estimateCost: ReturnType<typeof vi.fn>;
  calculateActualCost: ReturnType<typeof vi.fn>;
  getPricing: ReturnType<typeof vi.fn>;
  addCustomPricing: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
  /** Get total recorded cost */
  getTotalRecordedCost: () => number;
}

/**
 * Creates a mock CostTracker instance with configurable cost behavior.
 *
 * @example
 * ```typescript
 * const tracker = createMockCostTracker({ budgetExceeded: true, exceededBudgetType: 'daily' });
 * const estimate = tracker.estimateCost('openai/gpt-4', { inputTokens: 1000, outputTokens: 500 });
 * // estimate.budgetExceeded === true
 * ```
 */
export function createMockCostTracker(options: MockCostTrackerOptions = {}): MockCostTracker {
  const {
    defaultEstimatedCost = 0.01,
    budgetExceeded = false,
    exceededBudgetType = 'per-request',
    remainingBudget = 0,
    hasPricingData = true,
    customPricing = {},
  } = options;

  let totalRecordedCost = 0;

  const estimateCost = vi.fn((model: string, tokens: TokenUsage) => {
    const pricing = customPricing[model] ?? (hasPricingData
      ? { inputCostPer1K: 0.03, outputCostPer1K: 0.06 }
      : null);

    if (!pricing) {
      return {
        estimatedCost: 0,
        model,
        provider: 'unknown',
        estimatedTokens: tokens,
        breakdown: { inputCost: 0, outputCost: 0 },
        pricingUnavailable: true,
        timestamp: new Date().toISOString(),
      };
    }

    const inputCost = (tokens.inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (tokens.outputTokens / 1000) * pricing.outputCostPer1K;
    const estimatedCost = inputCost + outputCost;

    return {
      estimatedCost: estimatedCost || defaultEstimatedCost,
      model,
      provider: model.split('/')[0] ?? 'unknown',
      estimatedTokens: tokens,
      breakdown: { inputCost, outputCost },
      budgetExceeded,
      exceededBudgetType: budgetExceeded ? exceededBudgetType : undefined,
      remainingBudget: budgetExceeded ? remainingBudget : undefined,
      timestamp: new Date().toISOString(),
    };
  });

  const calculateActualCost = vi.fn((
    _requestId: string,
    _agentId: string,
    model: string,
    actualTokens: TokenUsage,
  ) => {
    const pricing = customPricing[model] ?? (hasPricingData
      ? { inputCostPer1K: 0.03, outputCostPer1K: 0.06 }
      : null);

    const inputCost = pricing ? (actualTokens.inputTokens / 1000) * pricing.inputCostPer1K : 0;
    const outputCost = pricing ? (actualTokens.outputTokens / 1000) * pricing.outputCostPer1K : 0;
    const actualCost = inputCost + outputCost;
    totalRecordedCost += actualCost;

    return {
      id: `cost-${Date.now()}`,
      requestId: _requestId,
      agentId: _agentId,
      model,
      provider: model.split('/')[0] ?? 'unknown',
      actualTokens,
      actualCost,
      breakdown: { inputCost, outputCost },
      timestamp: new Date().toISOString(),
    };
  });

  const getPricing = vi.fn((model: string) => customPricing[model] ?? (hasPricingData ? { inputCostPer1K: 0.03, outputCostPer1K: 0.06 } : undefined));
  const addCustomPricing = vi.fn((model: string, pricing: { inputCostPer1K: number; outputCostPer1K: number }) => {
    customPricing[model] = pricing;
  });
  const getConfig = vi.fn(() => ({ enabled: true }));
  const getTotalRecordedCost = () => totalRecordedCost;

  return { estimateCost, calculateActualCost, getPricing, addCustomPricing, getConfig, getTotalRecordedCost };
}

// ── TealSecrets Mock ─────────────────────────────────────────────

export interface MockTealSecretsOptions {
  /** Whether secrets are detected in content */
  detectSecrets?: boolean;
  /** Types of secrets to detect */
  secretTypes?: string[];
  /** Confidence scores for detections */
  confidenceScore?: number;
  /** Whether the scan should throw */
  shouldThrow?: boolean;
}

export interface MockTealSecrets {
  evaluate: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  readonly name: string;
  readonly version: string;
}

/**
 * Creates a mock TealSecrets instance with configurable secret detection.
 *
 * @example
 * ```typescript
 * const secrets = createMockTealSecrets({ detectSecrets: true, secretTypes: ['aws_key'] });
 * const result = await secrets.evaluate({ content: 'AKIA...' }, ctx, policy);
 * // result.action === 'DENY'
 * ```
 */
export function createMockTealSecrets(options: MockTealSecretsOptions = {}): MockTealSecrets {
  const {
    detectSecrets = false,
    secretTypes = ['api_key'],
    confidenceScore = 0.95,
    shouldThrow = false,
  } = options;

  const evaluate = vi.fn(async (
    request: { content?: string },
    _ctx: unknown,
    _policy: unknown,
  ) => {
    if (shouldThrow) throw new Error('TealSecrets evaluation failed');

    if (!detectSecrets || !request.content) {
      return {
        action: 'ALLOW' as DecisionAction,
        reason_codes: [] as string[],
        event_type: 'secret_scan',
      };
    }

    return {
      action: 'DENY' as DecisionAction,
      reason_codes: ['SECRET_DETECTED', 'CREDENTIAL_LEAKAGE'],
      event_type: 'secret_detected',
      findings: secretTypes.map((type, i) => ({
        finding_id: `finding-${i}`,
        type,
        category: 'cloud',
        confidence: confidenceScore,
        severity: 'critical',
        fingerprint: `fp-${type}-${i}`,
      })),
      metadata: { total_findings: secretTypes.length, enforced_findings: secretTypes.length },
    };
  });

  const scan = vi.fn((content: string) => {
    if (!detectSecrets || !content) return [];
    return secretTypes.map((type, i) => ({
      finding_id: `finding-${i}`,
      type,
      category: 'cloud',
      confidence: confidenceScore,
      severity: 'critical',
      fingerprint: `fp-${type}-${i}`,
      evidence_signals: [],
      location: { offset: 0, length: 20, line: 1, column: 1 },
    }));
  });

  const init = vi.fn(async () => {});
  const destroy = vi.fn(async () => {});

  return {
    evaluate,
    scan,
    init,
    destroy,
    name: 'TealSecrets',
    version: '1.2.0',
  };
}

// ── TealRegistry Mock ────────────────────────────────────────────

export interface MockTealRegistryOptions {
  /** Models that are allowlisted */
  allowedModels?: string[];
  /** Whether to enable provenance checks */
  requireProvenance?: boolean;
  /** Whether evaluation should throw */
  shouldThrow?: boolean;
}

export interface MockTealRegistry {
  evaluate: ReturnType<typeof vi.fn>;
  lookupModel: ReturnType<typeof vi.fn>;
  lookupTool: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  readonly name: string;
  readonly version: string;
}

/**
 * Creates a mock TealRegistry instance with configurable model allowlisting.
 *
 * @example
 * ```typescript
 * const registry = createMockTealRegistry({ allowedModels: ['openai/gpt-4'] });
 * const result = await registry.evaluate({ model: 'anthropic/claude-3' }, ctx, policy);
 * // result.action === 'DENY', result.reason_codes includes 'MODEL_NOT_ALLOWLISTED'
 * ```
 */
export function createMockTealRegistry(options: MockTealRegistryOptions = {}): MockTealRegistry {
  const {
    allowedModels = [],
    requireProvenance = false,
    shouldThrow = false,
  } = options;

  const evaluate = vi.fn(async (
    request: { model?: string; tool?: string },
    _ctx: unknown,
    _policy: unknown,
  ) => {
    if (shouldThrow) throw new Error('TealRegistry evaluation failed');

    // Check model allowlist
    if (request.model && allowedModels.length > 0) {
      if (!allowedModels.includes(request.model)) {
        return {
          action: 'DENY' as DecisionAction,
          reason_codes: ['MODEL_NOT_ALLOWLISTED'],
          event_type: 'registry.model_denied',
          metadata: { model: request.model },
        };
      }
    }

    return {
      action: 'ALLOW' as DecisionAction,
      reason_codes: ['POLICY_COMPLIANT'],
      event_type: 'registry.evaluate',
      metadata: {},
    };
  });

  const lookupModel = vi.fn((modelId: string) => {
    if (allowedModels.includes(modelId)) {
      return {
        id: modelId,
        catalog: 'models' as const,
        version: '1.0.0',
        hash: 'mock-hash',
        environment: 'production',
      };
    }
    return undefined;
  });

  const lookupTool = vi.fn((_toolId: string) => undefined);
  const init = vi.fn(async () => {});
  const destroy = vi.fn(async () => {});

  return {
    evaluate,
    lookupModel,
    lookupTool,
    init,
    destroy,
    name: 'TealRegistry',
    version: '1.2.0',
  };
}
