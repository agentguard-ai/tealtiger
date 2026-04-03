/**
 * Unit tests for ErrorHandler
 * Validates: Requirements 14.3, 14.4
 */
import {
  ErrorHandler,
  DEFAULT_RETRY_CONFIG,
  NetworkErrorRecovery,
  RateLimitRecovery,
} from '../ErrorHandler';
import type { ErrorContext } from '../types';

// ── Helpers ────────────────────────────────────────────────────────

function makeContext(overrides: Partial<ErrorContext> = {}): ErrorContext {
  return {
    category: 'publication',
    attemptNumber: 0,
    maxRetries: 3,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('ErrorHandler', () => {
  // ── Error categorization ──────────────────────────────────────

  describe('handleError – error categorization', () => {
    it('returns halt action for pre_flight errors', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('Missing credential'),
        makeContext({ category: 'pre_flight' }),
      );
      expect(res.action).toBe('halt');
      expect(res.retryable).toBe(false);
      expect(res.category).toBe('pre_flight');
    });

    it('returns rollback for non-retryable publication errors', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('401 Unauthorized'),
        makeContext({ category: 'publication', attemptNumber: 0 }),
      );
      expect(res.action).toBe('rollback');
      expect(res.retryable).toBe(false);
      expect(res.category).toBe('publication');
    });

    it('returns rollback for non-retryable validation errors', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('Artifact corrupted'),
        makeContext({ category: 'validation' }),
      );
      expect(res.action).toBe('rollback');
      expect(res.retryable).toBe(false);
      expect(res.category).toBe('validation');
    });

    it('returns report for rollback category errors', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('Rollback partially failed'),
        makeContext({ category: 'rollback' }),
      );
      expect(res.action).toBe('report');
      expect(res.retryable).toBe(false);
      expect(res.category).toBe('rollback');
    });
  });

  // ── isRetryable ───────────────────────────────────────────────

  describe('isRetryable', () => {
    const handler = new ErrorHandler();

    it.each([
      ['ECONNREFUSED', true],
      ['ETIMEDOUT', true],
      ['ECONNRESET', true],
      ['ENOTFOUND', true],
      ['network error', true],
      ['rate limit exceeded', true],
      ['HTTP 429', true],
      ['too many requests', true],
      ['transient failure', true],
      ['temporary unavailable', true],
      ['503 Service Unavailable', true],
    ])('"%s" → %s', (message, expected) => {
      expect(handler.isRetryable(new Error(message))).toBe(expected);
    });

    it.each([
      ['401 Unauthorized', false],
      ['403 Forbidden', false],
      ['unauthorized access', false],
      ['forbidden resource', false],
      ['Invalid package.json', false],
      ['Version already exists', false],
    ])('"%s" → %s', (message, expected) => {
      expect(handler.isRetryable(new Error(message))).toBe(expected);
    });
  });

  // ── Exponential backoff ───────────────────────────────────────

  describe('calculateBackoff', () => {
    it('increases delay exponentially with attempt number', () => {
      const handler = new ErrorHandler({ baseDelayMs: 1000, maxDelayMs: 60_000 });

      // Run multiple samples to account for jitter and verify the trend
      const samples = 50;
      let avgDelay0 = 0;
      let avgDelay1 = 0;
      let avgDelay2 = 0;

      for (let i = 0; i < samples; i++) {
        avgDelay0 += handler.calculateBackoff(0);
        avgDelay1 += handler.calculateBackoff(1);
        avgDelay2 += handler.calculateBackoff(2);
      }

      avgDelay0 /= samples;
      avgDelay1 /= samples;
      avgDelay2 /= samples;

      // Each level should roughly double (within jitter range)
      expect(avgDelay1).toBeGreaterThan(avgDelay0);
      expect(avgDelay2).toBeGreaterThan(avgDelay1);
    });

    it('applies jitter so delay is in [0.5×base, 1.0×base) range for attempt 0', () => {
      const handler = new ErrorHandler({ baseDelayMs: 1000, maxDelayMs: 60_000 });

      for (let i = 0; i < 100; i++) {
        const delay = handler.calculateBackoff(0);
        // attempt 0 → base * 2^0 = 1000, jitter [0.5, 1.0) → [500, 1000)
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThan(1000);
      }
    });

    it('caps delay at maxDelayMs', () => {
      const handler = new ErrorHandler({ baseDelayMs: 1000, maxDelayMs: 5000 });

      for (let i = 0; i < 100; i++) {
        const delay = handler.calculateBackoff(10); // 2^10 = 1024 × 1000 >> 5000
        // capped at 5000, jitter [0.5, 1.0) → [2500, 5000)
        expect(delay).toBeGreaterThanOrEqual(2500);
        expect(delay).toBeLessThan(5000);
      }
    });

    it('returns integer values', () => {
      const handler = new ErrorHandler();
      for (let i = 0; i < 20; i++) {
        expect(Number.isInteger(handler.calculateBackoff(i))).toBe(true);
      }
    });
  });

  // ── Retry limit enforcement ───────────────────────────────────

  describe('retry limit enforcement (max 3 attempts)', () => {
    it('recommends retry when attempts remain', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('ETIMEDOUT'),
        makeContext({ attemptNumber: 0, maxRetries: 3 }),
      );
      expect(res.action).toBe('retry');
      expect(res.retryable).toBe(true);
      expect(res.delay).toBeDefined();
    });

    it('recommends retry on attempt 2 of 3', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('ETIMEDOUT'),
        makeContext({ attemptNumber: 2, maxRetries: 3 }),
      );
      expect(res.action).toBe('retry');
    });

    it('stops retrying when max attempts reached', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('ETIMEDOUT'),
        makeContext({ attemptNumber: 3, maxRetries: 3, category: 'publication' }),
      );
      // Exhausted retries → rollback for publication
      expect(res.action).toBe('rollback');
      expect(res.retryable).toBe(false);
    });

    it('default max retries is 3', () => {
      const handler = new ErrorHandler();
      expect(handler.getRetryConfig().maxRetries).toBe(3);
    });
  });

  // ── handleError with retryable vs non-retryable ───────────────

  describe('handleError – retryable vs non-retryable', () => {
    it('retries a network error on first attempt', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('ECONNREFUSED'),
        makeContext({ attemptNumber: 0 }),
      );
      expect(res.action).toBe('retry');
      expect(res.retryable).toBe(true);
    });

    it('retries a rate-limit error on first attempt', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('429 Too Many Requests'),
        makeContext({ attemptNumber: 1 }),
      );
      expect(res.action).toBe('retry');
    });

    it('does not retry an auth error', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('403 Forbidden'),
        makeContext({ attemptNumber: 0, category: 'publication' }),
      );
      expect(res.action).toBe('rollback');
      expect(res.retryable).toBe(false);
    });

    it('pre-flight errors are never retried even if message looks transient', () => {
      const handler = new ErrorHandler();
      const res = handler.handleError(
        new Error('ETIMEDOUT checking credentials'),
        makeContext({ category: 'pre_flight', attemptNumber: 0 }),
      );
      expect(res.action).toBe('halt');
      expect(res.retryable).toBe(false);
    });
  });

  // ── Recovery strategies ───────────────────────────────────────

  describe('recovery strategies', () => {
    describe('NetworkErrorRecovery', () => {
      const strategy = new NetworkErrorRecovery();

      it('can recover from ECONNREFUSED', () => {
        expect(strategy.canRecover(new Error('ECONNREFUSED'))).toBe(true);
      });

      it('can recover from ETIMEDOUT', () => {
        expect(strategy.canRecover(new Error('ETIMEDOUT'))).toBe(true);
      });

      it('cannot recover from auth errors', () => {
        expect(strategy.canRecover(new Error('401 Unauthorized'))).toBe(false);
      });

      it('recommends 5s delay', () => {
        expect(strategy.getRecommendedDelay(new Error('ECONNREFUSED'))).toBe(5_000);
      });
    });

    describe('RateLimitRecovery', () => {
      const strategy = new RateLimitRecovery();

      it('can recover from rate limit errors', () => {
        expect(strategy.canRecover(new Error('rate limit exceeded'))).toBe(true);
      });

      it('can recover from 429 errors', () => {
        expect(strategy.canRecover(new Error('HTTP 429'))).toBe(true);
      });

      it('cannot recover from generic errors', () => {
        expect(strategy.canRecover(new Error('Something broke'))).toBe(false);
      });

      it('extracts retry-after from message', () => {
        expect(strategy.getRecommendedDelay(new Error('rate limit, retry-after: 30'))).toBe(30_000);
      });

      it('defaults to 60s when no retry-after hint', () => {
        expect(strategy.getRecommendedDelay(new Error('rate limit exceeded'))).toBe(60_000);
      });
    });

    describe('getRecoveryStrategy', () => {
      const handler = new ErrorHandler();

      it('returns NetworkErrorRecovery for network errors', () => {
        const strategy = handler.getRecoveryStrategy(new Error('ECONNREFUSED'));
        expect(strategy).toBeInstanceOf(NetworkErrorRecovery);
      });

      it('returns RateLimitRecovery for rate limit errors', () => {
        const strategy = handler.getRecoveryStrategy(new Error('429 Too Many Requests'));
        expect(strategy).toBeInstanceOf(RateLimitRecovery);
      });

      it('returns undefined for unknown errors', () => {
        const strategy = handler.getRecoveryStrategy(new Error('Unknown error'));
        expect(strategy).toBeUndefined();
      });
    });
  });

  // ── Default config ────────────────────────────────────────────

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('has maxRetries of 3', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    });

    it('has baseDelayMs of 1000', () => {
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1_000);
    });

    it('has maxDelayMs of 30000', () => {
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30_000);
    });
  });
});
