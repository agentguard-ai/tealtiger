/**
 * TealTiger v1.1.0 Error Handler
 *
 * Categorises errors, determines retryability, computes exponential-backoff
 * delays, and selects recovery strategies for the launch coordination system.
 *
 * Requirements: 14.3, 14.4
 */

import type {
  ErrorContext,
  ErrorResponse,
  RetryConfig,
  ErrorRecoveryStrategy,
} from './types';

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: Readonly<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

/** Interface for the error handler */
export interface IErrorHandler {
  handleError(error: Error, context: ErrorContext): ErrorResponse;
  isRetryable(error: Error): boolean;
}

// ── Recovery strategies ────────────────────────────────────────────

export class NetworkErrorRecovery implements ErrorRecoveryStrategy {
  canRecover(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('network')
    );
  }

  getRecommendedDelay(_error: Error): number {
    return 5_000; // 5 s base for network issues
  }
}

export class RateLimitRecovery implements ErrorRecoveryStrategy {
  canRecover(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests');
  }

  getRecommendedDelay(error: Error): number {
    // Try to extract a Retry-After hint from the message
    const match = error.message.match(/retry.?after[:\s]*(\d+)/i);
    if (match) {
      return parseInt(match[1], 10) * 1_000;
    }
    return 60_000; // default 60 s for rate limits
  }
}

// ── ErrorHandler ───────────────────────────────────────────────────

export class ErrorHandler implements IErrorHandler {
  private readonly retryConfig: RetryConfig;
  private readonly recoveryStrategies: ErrorRecoveryStrategy[];

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.recoveryStrategies = [new NetworkErrorRecovery(), new RateLimitRecovery()];
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Evaluate an error and return a recommended response.
   */
  handleError(error: Error, context: ErrorContext): ErrorResponse {
    const category = context.category;
    const retryable = this.isRetryable(error);

    // Pre-flight errors always halt — nothing has been published yet.
    if (category === 'pre_flight') {
      return {
        action: 'halt',
        message: `Pre-flight check failed: ${error.message}. Fix issues and retry.`,
        retryable: false,
        category,
      };
    }

    // Retryable + attempts remaining → retry with backoff
    if (retryable && context.attemptNumber < context.maxRetries) {
      const delay = this.calculateBackoff(context.attemptNumber);
      return {
        action: 'retry',
        message: `Transient error detected. Retrying (attempt ${context.attemptNumber + 1}/${context.maxRetries})...`,
        retryable: true,
        delay,
        category,
      };
    }

    // Publication / validation errors that are exhausted or non-retryable → rollback
    if (category === 'publication' || category === 'validation') {
      return {
        action: 'rollback',
        message: `Critical error in ${category}: ${error.message}. Initiating rollback.`,
        retryable: false,
        category,
      };
    }

    // Rollback errors or anything else → report and continue
    return {
      action: 'report',
      message: `Error during ${category}: ${error.message}`,
      retryable: false,
      category,
    };
  }

  /**
   * Determine whether an error is transient and worth retrying.
   */
  isRetryable(error: Error): boolean {
    const msg = error.message.toLowerCase();

    // Network errors → retryable
    if (
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('network')
    ) {
      return true;
    }

    // Rate limiting → retryable
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
      return true;
    }

    // Explicit transient markers
    if (msg.includes('transient') || msg.includes('temporary') || msg.includes('503')) {
      return true;
    }

    // Auth errors → NOT retryable
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      return false;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter.
   *
   *   delay = min(baseDelay × 2^(attempt-1), maxDelay) × jitter
   *
   * where jitter ∈ [0.5, 1.0)
   */
  calculateBackoff(attempt: number): number {
    const { baseDelayMs, maxDelayMs } = this.retryConfig;
    const exponential = baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, maxDelayMs);
    const jitter = 0.5 + Math.random() * 0.5;
    return Math.floor(capped * jitter);
  }

  /**
   * Find a matching recovery strategy for the given error.
   */
  getRecoveryStrategy(error: Error): ErrorRecoveryStrategy | undefined {
    return this.recoveryStrategies.find((s) => s.canRecover(error));
  }

  /** Expose the active retry config (useful for tests). */
  getRetryConfig(): Readonly<RetryConfig> {
    return this.retryConfig;
  }
}
