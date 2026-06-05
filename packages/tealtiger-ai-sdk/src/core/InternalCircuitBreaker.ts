/**
 * TealTiger AI SDK — Internal Circuit Breaker State Machine
 *
 * Lightweight circuit breaker implementation that tracks per-provider state
 * using a standard CLOSED → OPEN → HALF_OPEN → CLOSED state machine.
 *
 * This is used internally by the GovernanceOrchestrator rather than relying
 * on the SDK's TealCircuit interface, since we only need the state machine
 * logic for the middleware's circuit breaker integration.
 *
 * @module core/InternalCircuitBreaker
 */

import type { Decision } from '../types/decision';
import type { CircuitBreakerConfig } from '../types/config';

/**
 * Circuit breaker states.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Default configuration values for the circuit breaker.
 */
const DEFAULTS = {
  failureThreshold: 5,
  timeout: 60_000,
  halfOpenRequests: 3,
} as const;

/**
 * Internal circuit breaker state machine for a single provider.
 *
 * State transitions:
 * - CLOSED → OPEN: when consecutive failures >= failureThreshold
 * - OPEN → HALF_OPEN: after timeout duration has elapsed
 * - HALF_OPEN → CLOSED: after halfOpenRequests consecutive successes
 * - HALF_OPEN → OPEN: on any failure
 *
 * Any success in CLOSED state resets the failure count.
 */
export class InternalCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private halfOpenSuccesses = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly timeout: number;
  private readonly halfOpenRequests: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? DEFAULTS.failureThreshold;
    this.timeout = config.timeout ?? DEFAULTS.timeout;
    this.halfOpenRequests = config.halfOpenRequests ?? DEFAULTS.halfOpenRequests;
  }

  /**
   * Evaluate the current circuit state.
   *
   * If the circuit is OPEN and the timeout has elapsed, transitions to HALF_OPEN.
   * Returns a Decision indicating whether requests should proceed.
   */
  evaluate(): Decision {
    // Check if OPEN → HALF_OPEN transition should occur
    if (this.state === 'OPEN' && this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.timeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenSuccesses = 0;
      }
    }

    if (this.state === 'OPEN') {
      return {
        action: 'DENY',
        reason_codes: ['CIRCUIT_OPEN'],
        risk_score: 100,
        correlation_id: '',
        reason: `Circuit breaker is open`,
        metadata: {
          circuit_state: this.state,
          consecutive_failures: this.consecutiveFailures,
        },
      };
    }

    return {
      action: 'ALLOW',
      reason_codes: ['POLICY_COMPLIANT'],
      risk_score: this.state === 'HALF_OPEN' ? 50 : 0,
      correlation_id: '',
      reason: this.state === 'HALF_OPEN'
        ? 'Circuit breaker is half-open — probe allowed'
        : 'Circuit breaker is closed',
      metadata: {
        circuit_state: this.state,
        consecutive_failures: this.consecutiveFailures,
      },
    };
  }

  /**
   * Report a successful outcome to the circuit breaker.
   *
   * - In CLOSED state: resets the consecutive failure count to zero
   * - In HALF_OPEN state: increments success counter, transitions to CLOSED
   *   when halfOpenRequests successes are reached
   */
  reportSuccess(): void {
    if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    } else if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.halfOpenRequests) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.halfOpenSuccesses = 0;
        this.openedAt = null;
      }
    }
  }

  /**
   * Report a failure outcome to the circuit breaker.
   *
   * - In CLOSED state: increments failure count, transitions to OPEN
   *   when failureThreshold is reached
   * - In HALF_OPEN state: immediately transitions back to OPEN
   */
  reportFailure(): void {
    if (this.state === 'CLOSED') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        this.halfOpenSuccesses = 0;
      }
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
    }
  }

  /**
   * Get the current circuit state.
   */
  getState(): CircuitState {
    // Check for OPEN → HALF_OPEN transition
    if (this.state === 'OPEN' && this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.timeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenSuccesses = 0;
      }
    }
    return this.state;
  }

  /**
   * Get the configured timeout duration in milliseconds.
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Get the consecutive failure count.
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Get the half-open success count.
   */
  getHalfOpenSuccesses(): number {
    return this.halfOpenSuccesses;
  }
}
