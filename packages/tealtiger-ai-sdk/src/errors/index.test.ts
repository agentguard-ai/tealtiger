/**
 * Unit tests for TealTiger AI SDK error types.
 *
 * Validates:
 * - Error inheritance hierarchy (all extend TealRuntimeError → Error)
 * - Correct field assignment for each error type
 * - Error names, codes, and recoverability flags
 * - instanceof checks across the hierarchy
 */

import { describe, it, expect } from 'vitest';
import {
  TealRuntimeError,
  TealConfigError,
  PolicyViolationError,
  GuardrailViolationError,
  CircuitOpenError,
  BudgetExceededError,
} from './index';
import type { Decision } from '../types/decision';

// ── Test Helpers ─────────────────────────────────────────────────

function makeDecision(overrides?: Partial<Decision>): Decision {
  return {
    action: 'DENY',
    reason_codes: ['POLICY_VIOLATION'],
    risk_score: 85,
    correlation_id: 'test-corr-id-1234',
    reason: 'Policy denied the request',
    ...overrides,
  };
}

// ── TealRuntimeError (base) ──────────────────────────────────────

describe('TealRuntimeError', () => {
  it('extends Error', () => {
    const err = new TealRuntimeError('test', 'TEST_CODE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TealRuntimeError);
  });

  it('sets name, code, message correctly', () => {
    const err = new TealRuntimeError('something failed', 'FAIL_CODE');
    expect(err.name).toBe('TealRuntimeError');
    expect(err.code).toBe('FAIL_CODE');
    expect(err.message).toBe('something failed');
  });

  it('defaults recoverable to false', () => {
    const err = new TealRuntimeError('msg', 'CODE');
    expect(err.recoverable).toBe(false);
  });

  it('accepts optional module and correlation_id', () => {
    const err = new TealRuntimeError('msg', 'CODE', {
      module: 'TealGuard',
      correlation_id: 'abc-123',
      recoverable: true,
    });
    expect(err.module).toBe('TealGuard');
    expect(err.correlation_id).toBe('abc-123');
    expect(err.recoverable).toBe(true);
  });

  it('has a stack trace', () => {
    const err = new TealRuntimeError('msg', 'CODE');
    expect(err.stack).toBeDefined();
  });
});

// ── TealConfigError ──────────────────────────────────────────────

describe('TealConfigError', () => {
  it('extends Error', () => {
    const err = new TealConfigError('invalid budget', 'costTracking.dailyLimit');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TealConfigError);
  });

  it('sets name and config_key correctly', () => {
    const err = new TealConfigError('must be positive', 'circuitBreaker.failureThreshold');
    expect(err.name).toBe('TealConfigError');
    expect(err.config_key).toBe('circuitBreaker.failureThreshold');
    expect(err.message).toBe('must be positive');
  });
});

// ── PolicyViolationError ─────────────────────────────────────────

describe('PolicyViolationError', () => {
  it('extends TealRuntimeError', () => {
    const decision = makeDecision();
    const err = new PolicyViolationError('Policy denied', decision);
    expect(err).toBeInstanceOf(TealRuntimeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct name and code', () => {
    const decision = makeDecision();
    const err = new PolicyViolationError('Policy denied', decision);
    expect(err.name).toBe('PolicyViolationError');
    expect(err.code).toBe('POLICY_VIOLATION');
  });

  it('stores the decision', () => {
    const decision = makeDecision({ risk_score: 95 });
    const err = new PolicyViolationError('Blocked', decision);
    expect(err.decision).toBe(decision);
    expect(err.decision.risk_score).toBe(95);
  });

  it('propagates correlation_id from decision', () => {
    const decision = makeDecision({ correlation_id: 'corr-xyz' });
    const err = new PolicyViolationError('Blocked', decision);
    expect(err.correlation_id).toBe('corr-xyz');
  });

  it('is not recoverable', () => {
    const decision = makeDecision();
    const err = new PolicyViolationError('Blocked', decision);
    expect(err.recoverable).toBe(false);
  });
});

// ── GuardrailViolationError ──────────────────────────────────────

describe('GuardrailViolationError', () => {
  it('extends TealRuntimeError', () => {
    const decision = makeDecision();
    const err = new GuardrailViolationError('Output blocked', ['hate-speech', 'pii'], decision);
    expect(err).toBeInstanceOf(TealRuntimeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct name and code', () => {
    const decision = makeDecision();
    const err = new GuardrailViolationError('Output blocked', ['hate-speech'], decision);
    expect(err.name).toBe('GuardrailViolationError');
    expect(err.code).toBe('GUARDRAIL_VIOLATION');
  });

  it('stores failedGuardrails array', () => {
    const decision = makeDecision();
    const guardrails = ['content-moderation', 'pii-output'];
    const err = new GuardrailViolationError('Blocked', guardrails, decision);
    expect(err.failedGuardrails).toEqual(['content-moderation', 'pii-output']);
  });

  it('stores the decision', () => {
    const decision = makeDecision({ reason_codes: ['HARMFUL_CONTENT_DETECTED'] });
    const err = new GuardrailViolationError('Blocked', ['content'], decision);
    expect(err.decision).toBe(decision);
    expect(err.decision.reason_codes).toContain('HARMFUL_CONTENT_DETECTED');
  });

  it('propagates correlation_id from decision', () => {
    const decision = makeDecision({ correlation_id: 'guard-corr-1' });
    const err = new GuardrailViolationError('Blocked', ['x'], decision);
    expect(err.correlation_id).toBe('guard-corr-1');
  });

  it('is not recoverable', () => {
    const decision = makeDecision();
    const err = new GuardrailViolationError('Blocked', ['x'], decision);
    expect(err.recoverable).toBe(false);
  });
});

// ── CircuitOpenError ─────────────────────────────────────────────

describe('CircuitOpenError', () => {
  it('extends TealRuntimeError', () => {
    const err = new CircuitOpenError('openai', 30000);
    expect(err).toBeInstanceOf(TealRuntimeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct name and code', () => {
    const err = new CircuitOpenError('anthropic', 60000);
    expect(err.name).toBe('CircuitOpenError');
    expect(err.code).toBe('CIRCUIT_OPEN');
  });

  it('stores provider and retryAfterMs', () => {
    const err = new CircuitOpenError('openai', 45000);
    expect(err.provider).toBe('openai');
    expect(err.retryAfterMs).toBe(45000);
  });

  it('generates descriptive message', () => {
    const err = new CircuitOpenError('anthropic', 60000);
    expect(err.message).toContain('anthropic');
    expect(err.message).toContain('60000');
  });

  it('is recoverable (transient failure)', () => {
    const err = new CircuitOpenError('openai', 30000);
    expect(err.recoverable).toBe(true);
  });
});

// ── BudgetExceededError ──────────────────────────────────────────

describe('BudgetExceededError', () => {
  it('extends TealRuntimeError', () => {
    const decision = makeDecision();
    const err = new BudgetExceededError('daily', 0.5, decision);
    expect(err).toBeInstanceOf(TealRuntimeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets correct name and code', () => {
    const decision = makeDecision();
    const err = new BudgetExceededError('per-request', 1.25, decision);
    expect(err.name).toBe('BudgetExceededError');
    expect(err.code).toBe('COST_BUDGET_EXCEEDED');
  });

  it('stores budgetType, remainingBudget, and decision', () => {
    const decision = makeDecision({ correlation_id: 'budget-corr' });
    const err = new BudgetExceededError('per-session', 2.5, decision);
    expect(err.budgetType).toBe('per-session');
    expect(err.remainingBudget).toBe(2.5);
    expect(err.decision).toBe(decision);
  });

  it('supports all budget types', () => {
    const decision = makeDecision();
    const types: Array<'per-request' | 'per-session' | 'daily'> = [
      'per-request',
      'per-session',
      'daily',
    ];
    for (const budgetType of types) {
      const err = new BudgetExceededError(budgetType, 0, decision);
      expect(err.budgetType).toBe(budgetType);
    }
  });

  it('generates descriptive message with budget info', () => {
    const decision = makeDecision();
    const err = new BudgetExceededError('daily', 1.2345, decision);
    expect(err.message).toContain('daily');
    expect(err.message).toContain('1.2345');
  });

  it('propagates correlation_id from decision', () => {
    const decision = makeDecision({ correlation_id: 'cost-track-1' });
    const err = new BudgetExceededError('daily', 0, decision);
    expect(err.correlation_id).toBe('cost-track-1');
  });

  it('is not recoverable', () => {
    const decision = makeDecision();
    const err = new BudgetExceededError('daily', 0, decision);
    expect(err.recoverable).toBe(false);
  });
});

// ── Cross-error instanceof discrimination ────────────────────────

describe('Error type discrimination', () => {
  it('can distinguish between error types with instanceof', () => {
    const decision = makeDecision();
    const errors = [
      new PolicyViolationError('policy', decision),
      new GuardrailViolationError('guardrail', ['x'], decision),
      new CircuitOpenError('openai', 1000),
      new BudgetExceededError('daily', 0, decision),
    ];

    // All are TealRuntimeError
    for (const err of errors) {
      expect(err).toBeInstanceOf(TealRuntimeError);
    }

    // Each is only its own type
    expect(errors[0]).toBeInstanceOf(PolicyViolationError);
    expect(errors[0]).not.toBeInstanceOf(GuardrailViolationError);
    expect(errors[0]).not.toBeInstanceOf(CircuitOpenError);
    expect(errors[0]).not.toBeInstanceOf(BudgetExceededError);

    expect(errors[1]).toBeInstanceOf(GuardrailViolationError);
    expect(errors[1]).not.toBeInstanceOf(PolicyViolationError);

    expect(errors[2]).toBeInstanceOf(CircuitOpenError);
    expect(errors[2]).not.toBeInstanceOf(BudgetExceededError);

    expect(errors[3]).toBeInstanceOf(BudgetExceededError);
    expect(errors[3]).not.toBeInstanceOf(CircuitOpenError);
  });

  it('TealConfigError is not a TealRuntimeError', () => {
    const err = new TealConfigError('bad config', 'some.path');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TealConfigError);
    expect(err).not.toBeInstanceOf(TealRuntimeError);
  });
});
