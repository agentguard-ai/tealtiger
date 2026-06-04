/**
 * Property 9: Circuit breaker state machine correctness
 *
 * For any provider, the circuit breaker SHALL maintain correct state transitions:
 * (a) CLOSED → OPEN after exactly failureThreshold consecutive failures
 * (b) Any success in CLOSED resets the failure count
 * (c) OPEN → HALF_OPEN after timeout duration
 * (d) HALF_OPEN → CLOSED after halfOpenRequests consecutive successes
 * (e) Any failure in HALF_OPEN transitions immediately back to OPEN
 * (f) While OPEN, all requests throw CircuitOpenError
 *
 * Feature: vercel-ai-sdk-integration, Property 9: Circuit breaker state machine correctness
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { InternalCircuitBreaker } from '../../core/InternalCircuitBreaker';
import type { CircuitBreakerConfig } from '../../types/config';

/**
 * Arbitrary for valid circuit breaker configurations.
 */
function arbCircuitConfig(): fc.Arbitrary<CircuitBreakerConfig> {
  return fc.record({
    failureThreshold: fc.integer({ min: 1, max: 10 }),
    timeout: fc.integer({ min: 100, max: 5000 }),
    halfOpenRequests: fc.integer({ min: 1, max: 10 }),
  });
}

/**
 * Arbitrary for a sequence of outcomes (true = success, false = failure).
 */
function arbOutcomeSequence(minLength: number, maxLength: number): fc.Arbitrary<boolean[]> {
  return fc.array(fc.boolean(), { minLength, maxLength });
}

describe('Feature: vercel-ai-sdk-integration, Property 9: Circuit breaker state machine correctness', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) CLOSED → OPEN after exactly failureThreshold consecutive failures', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        (config) => {
          const cb = new InternalCircuitBreaker(config);

          // Report exactly failureThreshold - 1 failures: should stay CLOSED
          for (let i = 0; i < config.failureThreshold! - 1; i++) {
            cb.reportFailure();
            expect(cb.getState()).toBe('CLOSED');
          }

          // One more failure should transition to OPEN
          cb.reportFailure();
          expect(cb.getState()).toBe('OPEN');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(b) Any success in CLOSED state resets the failure count', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        fc.integer({ min: 1, max: 9 }),
        (config, failuresBeforeSuccess) => {
          // Ensure failuresBeforeSuccess < failureThreshold
          const failures = Math.min(failuresBeforeSuccess, config.failureThreshold! - 1);

          const cb = new InternalCircuitBreaker(config);

          // Report some failures (less than threshold)
          for (let i = 0; i < failures; i++) {
            cb.reportFailure();
          }
          expect(cb.getState()).toBe('CLOSED');

          // Report success — should reset failure count
          cb.reportSuccess();

          // Now need full failureThreshold failures to open again
          for (let i = 0; i < config.failureThreshold! - 1; i++) {
            cb.reportFailure();
            expect(cb.getState()).toBe('CLOSED');
          }
          cb.reportFailure();
          expect(cb.getState()).toBe('OPEN');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(c) OPEN → HALF_OPEN after timeout duration', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        (config) => {
          const cb = new InternalCircuitBreaker(config);

          // Force to OPEN state
          for (let i = 0; i < config.failureThreshold!; i++) {
            cb.reportFailure();
          }
          expect(cb.getState()).toBe('OPEN');

          // Mock time passing beyond timeout
          const originalDateNow = Date.now;
          const openedAt = Date.now();
          Date.now = () => openedAt + config.timeout! + 1;

          try {
            // After timeout elapsed, state should transition to HALF_OPEN
            expect(cb.getState()).toBe('HALF_OPEN');
          } finally {
            Date.now = originalDateNow;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(d) HALF_OPEN → CLOSED after halfOpenRequests consecutive successes', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        (config) => {
          const cb = new InternalCircuitBreaker(config);

          // Force to OPEN state
          for (let i = 0; i < config.failureThreshold!; i++) {
            cb.reportFailure();
          }
          expect(cb.getState()).toBe('OPEN');

          // Mock time passing to transition to HALF_OPEN
          const originalDateNow = Date.now;
          const openedAt = Date.now();
          Date.now = () => openedAt + config.timeout! + 1;

          try {
            // Trigger transition to HALF_OPEN by calling getState or evaluate
            expect(cb.getState()).toBe('HALF_OPEN');

            // Report halfOpenRequests successes
            for (let i = 0; i < config.halfOpenRequests!; i++) {
              cb.reportSuccess();
            }

            // Should now be CLOSED
            expect(cb.getState()).toBe('CLOSED');
          } finally {
            Date.now = originalDateNow;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(e) Any failure in HALF_OPEN transitions immediately back to OPEN', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        fc.integer({ min: 0, max: 9 }),
        (config, successesBeforeFailure) => {
          const halfOpenSuccesses = Math.min(successesBeforeFailure, config.halfOpenRequests! - 1);

          const cb = new InternalCircuitBreaker(config);

          // Force to OPEN state
          for (let i = 0; i < config.failureThreshold!; i++) {
            cb.reportFailure();
          }

          // Mock time passing to transition to HALF_OPEN
          const originalDateNow = Date.now;
          const openedAt = Date.now();
          Date.now = () => openedAt + config.timeout! + 1;

          try {
            // Trigger transition to HALF_OPEN
            expect(cb.getState()).toBe('HALF_OPEN');

            // Report some successes (less than halfOpenRequests)
            for (let i = 0; i < halfOpenSuccesses; i++) {
              cb.reportSuccess();
            }

            // One failure should immediately go back to OPEN
            cb.reportFailure();
            expect(cb.getState()).toBe('OPEN');
          } finally {
            Date.now = originalDateNow;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(f) While OPEN, evaluate returns DENY with CIRCUIT_OPEN reason code', () => {
    fc.assert(
      fc.property(
        arbCircuitConfig(),
        (config) => {
          const cb = new InternalCircuitBreaker(config);

          // Force to OPEN state
          for (let i = 0; i < config.failureThreshold!; i++) {
            cb.reportFailure();
          }
          expect(cb.getState()).toBe('OPEN');

          // evaluate() should return DENY decision
          const decision = cb.evaluate();
          expect(decision.action).toBe('DENY');
          expect(decision.reason_codes).toContain('CIRCUIT_OPEN');
          expect(decision.risk_score).toBe(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});
