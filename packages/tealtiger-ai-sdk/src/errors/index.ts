/**
 * TealTiger AI SDK — Error Types
 *
 * Extends the TealTiger v1.2 error hierarchy with middleware-specific
 * runtime errors for policy violations, guardrail failures, circuit
 * breaker state, and budget enforcement.
 *
 * @module errors
 */

import type { Decision } from '../types/decision';

// ── Base error (mirrors TealTiger v1.2 TealRuntimeError) ─────────

/**
 * Base runtime error for the TealTiger AI SDK middleware.
 */
export class TealRuntimeError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly module?: string | undefined;
  readonly correlation_id?: string | undefined;

  constructor(
    message: string,
    code: string,
    options?: {
      module?: string;
      correlation_id?: string;
      recoverable?: boolean;
    },
  ) {
    super(message);
    this.name = 'TealRuntimeError';
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.module = options?.module;
    this.correlation_id = options?.correlation_id;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when configuration validation fails at factory call time.
 */
export class TealConfigError extends Error {
  /** Path to the invalid configuration field */
  readonly config_key: string;

  constructor(message: string, configKey: string) {
    super(message);
    this.name = 'TealConfigError';
    this.config_key = configKey;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Middleware-specific errors ────────────────────────────────────

/**
 * Thrown when TealEngine policy evaluation denies a request.
 */
export class PolicyViolationError extends TealRuntimeError {
  readonly decision: Decision;

  constructor(message: string, decision: Decision) {
    super(message, 'POLICY_VIOLATION', {
      recoverable: false,
      correlation_id: decision.correlation_id,
    });
    this.name = 'PolicyViolationError';
    this.decision = decision;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when output guardrails detect content violations in a model response.
 */
export class GuardrailViolationError extends TealRuntimeError {
  readonly decision: Decision;
  readonly failedGuardrails: string[];

  constructor(message: string, failedGuardrails: string[], decision: Decision) {
    super(message, 'GUARDRAIL_VIOLATION', {
      recoverable: false,
      correlation_id: decision.correlation_id,
    });
    this.name = 'GuardrailViolationError';
    this.failedGuardrails = failedGuardrails;
    this.decision = decision;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the circuit breaker is in OPEN state for a provider.
 */
export class CircuitOpenError extends TealRuntimeError {
  readonly provider: string;
  readonly retryAfterMs: number;

  constructor(provider: string, retryAfterMs: number) {
    super(
      `Circuit breaker is open for provider "${provider}". Retry after ${retryAfterMs}ms.`,
      'CIRCUIT_OPEN',
      { recoverable: true },
    );
    this.name = 'CircuitOpenError';
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a cost budget limit is exceeded.
 */
export class BudgetExceededError extends TealRuntimeError {
  readonly budgetType: 'per-request' | 'per-session' | 'daily';
  readonly remainingBudget: number;
  readonly decision: Decision;

  constructor(
    budgetType: 'per-request' | 'per-session' | 'daily',
    remainingBudget: number,
    decision: Decision,
  ) {
    super(
      `Cost budget exceeded: ${budgetType} limit reached. Remaining budget: $${remainingBudget.toFixed(4)}`,
      'COST_BUDGET_EXCEEDED',
      {
        recoverable: false,
        correlation_id: decision.correlation_id,
      },
    );
    this.name = 'BudgetExceededError';
    this.budgetType = budgetType;
    this.remainingBudget = remainingBudget;
    this.decision = decision;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
