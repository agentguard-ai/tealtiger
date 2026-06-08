/**
 * Unit tests for circuit breaker methods (Task 3.5)
 *
 * Tests the InternalCircuitBreaker state machine and the GovernanceOrchestrator
 * circuit breaker integration methods: checkCircuit, reportOutcome, extractProvider.
 *
 * @module __tests__/circuit-breaker.test.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InternalCircuitBreaker } from '../core/InternalCircuitBreaker';
import { GovernanceOrchestrator } from '../core/GovernanceOrchestrator';
import { CircuitOpenError } from '../errors';
import type { TealTigerMiddlewareConfig } from '../types/config';

// ── InternalCircuitBreaker Unit Tests ────────────────────────────

describe('InternalCircuitBreaker', () => {
  let breaker: InternalCircuitBreaker;

  beforeEach(() => {
    breaker = new InternalCircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      halfOpenRequests: 2,
    });
  });

  describe('initial state', () => {
    it('starts in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('evaluate returns ALLOW in initial state', () => {
      const decision = breaker.evaluate();
      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('POLICY_COMPLIANT');
      expect(decision.risk_score).toBe(0);
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('stays CLOSED when failures < failureThreshold', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getConsecutiveFailures()).toBe(2);
    });

    it('transitions to OPEN when failures reach failureThreshold', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // 3 = threshold
      expect(breaker.getState()).toBe('OPEN');
    });

    it('evaluate returns DENY when OPEN', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure();
      const decision = breaker.evaluate();
      expect(decision.action).toBe('DENY');
      expect(decision.reason_codes).toContain('CIRCUIT_OPEN');
      expect(decision.risk_score).toBe(100);
    });
  });

  describe('success resets failure count in CLOSED state', () => {
    it('resets consecutive failures on success', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      expect(breaker.getConsecutiveFailures()).toBe(2);
      breaker.reportSuccess();
      expect(breaker.getConsecutiveFailures()).toBe(0);
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('does not transition to OPEN after reset + more failures below threshold', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportSuccess(); // reset
      breaker.reportFailure();
      breaker.reportFailure();
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('stays OPEN before timeout elapses', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // → OPEN
      vi.advanceTimersByTime(500); // less than 1000ms timeout
      expect(breaker.getState()).toBe('OPEN');
    });

    it('transitions to HALF_OPEN after timeout elapses', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // → OPEN
      vi.advanceTimersByTime(1000); // equal to timeout
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('evaluate returns ALLOW with risk_score 50 in HALF_OPEN', () => {
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // → OPEN
      vi.advanceTimersByTime(1000);
      const decision = breaker.evaluate();
      expect(decision.action).toBe('ALLOW');
      expect(decision.risk_score).toBe(50);
    });
  });

  describe('HALF_OPEN → CLOSED transition', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Get to HALF_OPEN state
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // → OPEN
      vi.advanceTimersByTime(1000); // → HALF_OPEN
      breaker.evaluate(); // trigger state check
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions to CLOSED after halfOpenRequests successes', () => {
      breaker.reportSuccess();
      expect(breaker.getState()).toBe('HALF_OPEN'); // only 1 of 2 needed
      breaker.reportSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('resets failure count after transitioning to CLOSED', () => {
      breaker.reportSuccess();
      breaker.reportSuccess(); // → CLOSED
      expect(breaker.getConsecutiveFailures()).toBe(0);
    });
  });

  describe('HALF_OPEN → OPEN transition', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Get to HALF_OPEN state
      breaker.reportFailure();
      breaker.reportFailure();
      breaker.reportFailure(); // → OPEN
      vi.advanceTimersByTime(1000); // → HALF_OPEN
      breaker.evaluate(); // trigger state check
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions immediately back to OPEN on any failure in HALF_OPEN', () => {
      breaker.reportFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('resets half-open successes on failure', () => {
      breaker.reportSuccess(); // 1 success
      breaker.reportFailure(); // fail → back to OPEN
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.getHalfOpenSuccesses()).toBe(0);
    });
  });

  describe('default configuration', () => {
    it('uses default values when no config provided', () => {
      const defaultBreaker = new InternalCircuitBreaker();
      expect(defaultBreaker.getTimeout()).toBe(60_000);

      // Should take 5 failures to open (default failureThreshold)
      for (let i = 0; i < 4; i++) {
        defaultBreaker.reportFailure();
      }
      expect(defaultBreaker.getState()).toBe('CLOSED');
      defaultBreaker.reportFailure();
      expect(defaultBreaker.getState()).toBe('OPEN');
    });
  });
});

// ── GovernanceOrchestrator.extractProvider Tests ─────────────────

describe('GovernanceOrchestrator.extractProvider', () => {
  it('extracts provider from standard format "provider/model-name"', () => {
    expect(GovernanceOrchestrator.extractProvider('openai/gpt-4')).toBe('openai');
  });

  it('extracts provider from multi-part model name', () => {
    expect(GovernanceOrchestrator.extractProvider('anthropic/claude-3-opus')).toBe('anthropic');
  });

  it('returns "unknown" when no slash present', () => {
    expect(GovernanceOrchestrator.extractProvider('gpt-4')).toBe('unknown');
  });

  it('returns "unknown" for empty string', () => {
    expect(GovernanceOrchestrator.extractProvider('')).toBe('unknown');
  });

  it('returns "unknown" when slash is at position 0', () => {
    expect(GovernanceOrchestrator.extractProvider('/model-name')).toBe('unknown');
  });

  it('handles multiple slashes — takes only the first segment', () => {
    expect(GovernanceOrchestrator.extractProvider('azure/openai/gpt-4')).toBe('azure');
  });
});

// ── GovernanceOrchestrator.checkCircuit Tests ────────────────────

describe('GovernanceOrchestrator.checkCircuit', () => {
  let orchestrator: GovernanceOrchestrator;

  describe('when circuit breaker is not configured', () => {
    beforeEach(() => {
      orchestrator = new GovernanceOrchestrator({} as TealTigerMiddlewareConfig);
    });

    it('returns ALLOW decision', () => {
      const decision = orchestrator.checkCircuit('openai');
      expect(decision.action).toBe('ALLOW');
      expect(decision.reason).toBe('Circuit breaker disabled');
    });
  });

  describe('when circuit breaker is configured', () => {
    beforeEach(() => {
      orchestrator = new GovernanceOrchestrator({
        circuitBreaker: {
          failureThreshold: 2,
          timeout: 5000,
          halfOpenRequests: 1,
        },
      } as TealTigerMiddlewareConfig);
    });

    it('returns ALLOW when circuit is CLOSED', () => {
      const decision = orchestrator.checkCircuit('openai');
      expect(decision.action).toBe('ALLOW');
    });

    it('throws CircuitOpenError when circuit is OPEN', () => {
      // Trip the circuit
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', false); // threshold = 2

      expect(() => orchestrator.checkCircuit('openai')).toThrow(CircuitOpenError);
    });

    it('CircuitOpenError includes provider name and retryAfterMs', () => {
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', false);

      try {
        orchestrator.checkCircuit('openai');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        const circuitError = error as CircuitOpenError;
        expect(circuitError.provider).toBe('openai');
        expect(circuitError.retryAfterMs).toBe(5000);
      }
    });

    it('lazily creates circuit breaker for new providers', () => {
      orchestrator.checkCircuit('openai');
      orchestrator.checkCircuit('anthropic');
      expect(orchestrator.getCircuits().size).toBe(2);
    });
  });
});

// ── GovernanceOrchestrator.reportOutcome Tests ───────────────────

describe('GovernanceOrchestrator.reportOutcome', () => {
  describe('when circuit breaker is not configured', () => {
    it('is a no-op (does not throw)', () => {
      const orchestrator = new GovernanceOrchestrator({} as TealTigerMiddlewareConfig);
      expect(() => orchestrator.reportOutcome('openai', true)).not.toThrow();
      expect(() => orchestrator.reportOutcome('openai', false)).not.toThrow();
    });
  });

  describe('when circuit breaker is configured', () => {
    let orchestrator: GovernanceOrchestrator;

    beforeEach(() => {
      orchestrator = new GovernanceOrchestrator({
        circuitBreaker: {
          failureThreshold: 3,
          timeout: 1000,
          halfOpenRequests: 2,
        },
      } as TealTigerMiddlewareConfig);
    });

    it('success resets failure count', () => {
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', true); // reset
      // Should not be open — only 2 failures then reset
      const decision = orchestrator.checkCircuit('openai');
      expect(decision.action).toBe('ALLOW');
    });

    it('consecutive failures trip the circuit', () => {
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', false);
      orchestrator.reportOutcome('openai', false);
      expect(() => orchestrator.checkCircuit('openai')).toThrow(CircuitOpenError);
    });
  });
});

// ── Provider Independence Tests ──────────────────────────────────

describe('Circuit breaker provider independence', () => {
  let orchestrator: GovernanceOrchestrator;

  beforeEach(() => {
    orchestrator = new GovernanceOrchestrator({
      circuitBreaker: {
        failureThreshold: 2,
        timeout: 5000,
        halfOpenRequests: 1,
      },
    } as TealTigerMiddlewareConfig);
  });

  it('failures on one provider do not affect another', () => {
    // Trip openai circuit
    orchestrator.reportOutcome('openai', false);
    orchestrator.reportOutcome('openai', false);

    // Anthropic should still be ALLOW
    const decision = orchestrator.checkCircuit('anthropic');
    expect(decision.action).toBe('ALLOW');

    // OpenAI should be OPEN
    expect(() => orchestrator.checkCircuit('openai')).toThrow(CircuitOpenError);
  });

  it('maintains separate state for each provider', () => {
    orchestrator.reportOutcome('openai', false);
    orchestrator.reportOutcome('anthropic', false);
    orchestrator.reportOutcome('anthropic', false); // trip anthropic

    // OpenAI: 1 failure, still closed
    const openaiDecision = orchestrator.checkCircuit('openai');
    expect(openaiDecision.action).toBe('ALLOW');

    // Anthropic: 2 failures, open
    expect(() => orchestrator.checkCircuit('anthropic')).toThrow(CircuitOpenError);
  });
});
