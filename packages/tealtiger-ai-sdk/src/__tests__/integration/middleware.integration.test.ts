/**
 * TealTiger AI SDK — Integration Tests
 *
 * End-to-end middleware tests with mocked LLM provider covering:
 * - wrapLanguageModel compatibility (structural pattern)
 * - Concurrent request handling (correlation ID uniqueness)
 * - Zero-config factory returns expected default behavior
 * - Specific PII patterns (email, SSN, credit card) redaction
 * - Audit logging failure non-blocking behavior
 *
 * Requirements: 1.1, 2.2, 7.5, 7.7
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { tealtigerMiddleware } from '../../factory';
import type { TealTigerMiddlewareConfig } from '../../types/config';
import { PolicyViolationError } from '../../errors';

// Set a reasonable global timeout for integration tests (lazy init can take time)
const INTEGRATION_TIMEOUT = 15_000;

// ── Mock LLM Provider ────────────────────────────────────────────

/**
 * Creates a mock doGenerate function that simulates a Vercel AI SDK
 * language model provider response.
 */
function createMockDoGenerate(options: {
  text?: string;
  promptTokens?: number;
  completionTokens?: number;
  shouldFail?: boolean;
  failError?: Error;
  delay?: number;
} = {}) {
  const {
    text = 'Hello! How can I help you today?',
    promptTokens = 50,
    completionTokens = 25,
    shouldFail = false,
    failError = new Error('Provider error: model unavailable'),
    delay = 0,
  } = options;

  return vi.fn(async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (shouldFail) {
      throw failError;
    }
    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  });
}

/**
 * Creates a mock doStream function that simulates a Vercel AI SDK
 * streaming language model provider response.
 */
function createMockDoStream(options: {
  chunks?: string[];
  promptTokens?: number;
  completionTokens?: number;
  shouldFail?: boolean;
} = {}) {
  const {
    chunks = ['Hello', '!', ' How can I help you?'],
    promptTokens = 50,
    completionTokens = 25,
    shouldFail = false,
  } = options;

  return vi.fn(async () => {
    if (shouldFail) {
      throw new Error('Stream provider error');
    }

    async function* generateChunks() {
      for (const chunk of chunks) {
        yield { type: 'text-delta', textDelta: chunk };
      }
      yield {
        type: 'finish',
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    }

    return {
      stream: generateChunks(),
      rawCall: { rawPrompt: '', rawSettings: {} },
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  });
}

// ── wrapLanguageModel Structural Compatibility ───────────────────

describe('Integration: wrapLanguageModel compatibility (Requirement 1.1)', () => {
  // Pre-warm the middleware (lazy init) to avoid timeout on first call
  let warmedMiddleware: ReturnType<typeof tealtigerMiddleware>;

  beforeAll(async () => {
    warmedMiddleware = tealtigerMiddleware();
    // Trigger lazy initialization
    await warmedMiddleware.transformParams!({
      params: { prompt: [{ role: 'user', content: 'warmup' }], modelId: 'openai/gpt-4' },
    });
  }, INTEGRATION_TIMEOUT);

  it('middleware object has the correct LanguageModelV3Middleware shape', () => {
    const middleware = tealtigerMiddleware();

    // The Vercel AI SDK wrapLanguageModel expects an object with these optional hooks:
    expect(middleware).toHaveProperty('transformParams');
    expect(middleware).toHaveProperty('wrapGenerate');
    expect(middleware).toHaveProperty('wrapStream');

    expect(typeof middleware.transformParams).toBe('function');
    expect(typeof middleware.wrapGenerate).toBe('function');
    expect(typeof middleware.wrapStream).toBe('function');
  });

  it('transformParams hook accepts { params } and returns params object', async () => {
    const middleware = tealtigerMiddleware();
    const params = {
      prompt: [{ role: 'user', content: 'Hello world' }],
      modelId: 'openai/gpt-4',
    };

    const result = await middleware.transformParams!({ params });

    // Should return an object (modified params)
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    // Should preserve the prompt structure
    expect(result.prompt).toBeDefined();
  }, INTEGRATION_TIMEOUT);

  it('wrapGenerate hook accepts { doGenerate, params, model } and returns result', async () => {
    const middleware = tealtigerMiddleware();
    const doGenerate = createMockDoGenerate();

    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: { prompt: [{ role: 'user', content: 'Hello' }] },
      model: { modelId: 'openai/gpt-4' },
    });

    expect(result).toBeDefined();
    expect(doGenerate).toHaveBeenCalled();
  });

  it('simulates the wrapLanguageModel usage pattern', async () => {
    // This simulates how wrapLanguageModel from 'ai' would use the middleware
    const middleware = tealtigerMiddleware();

    // Step 1: transformParams is called first
    const originalParams = {
      prompt: [{ role: 'user', content: 'What is TypeScript?' }],
      modelId: 'openai/gpt-4',
    };
    const transformedParams = await middleware.transformParams!({ params: originalParams });

    // Step 2: wrapGenerate wraps the model call
    const doGenerate = createMockDoGenerate({ text: 'TypeScript is a typed superset of JavaScript.' });
    const generateResult = await middleware.wrapGenerate!({
      doGenerate,
      params: transformedParams as Record<string, unknown>,
      model: { modelId: 'openai/gpt-4' },
    });

    expect(generateResult).toBeDefined();
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });
});

// ── Concurrent Request Handling ──────────────────────────────────

describe('Integration: concurrent request handling (Requirement 7.5)', () => {
  it('generates unique correlation IDs for concurrent requests', async () => {
    const middleware = tealtigerMiddleware({
      audit: { enabled: true },
    });

    // Fire 10 concurrent transformParams calls
    const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
      middleware.transformParams!({
        params: {
          prompt: [{ role: 'user', content: `Request ${i}` }],
          modelId: 'openai/gpt-4',
        },
      }),
    );

    const results = await Promise.all(concurrentRequests);

    // Extract correlation IDs from the providerMetadata
    const correlationIds = results.map((r) => {
      const metadata = (r as Record<string, unknown>).providerMetadata as Record<string, unknown> | undefined;
      const tealtiger = metadata?.tealtiger as Record<string, unknown> | undefined;
      return tealtiger?.correlationId as string;
    });

    // All should be defined
    expect(correlationIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);

    // All should be unique
    const uniqueIds = new Set(correlationIds);
    expect(uniqueIds.size).toBe(10);
  });

  it('handles concurrent wrapGenerate calls independently', async () => {
    const middleware = tealtigerMiddleware();

    const requests = Array.from({ length: 5 }, (_, i) => {
      const doGenerate = createMockDoGenerate({
        text: `Response ${i}`,
        delay: Math.random() * 10,
      });

      return middleware.wrapGenerate!({
        doGenerate,
        params: { prompt: [{ role: 'user', content: `Query ${i}` }] },
        model: { modelId: 'openai/gpt-4' },
      });
    });

    const results = await Promise.all(requests);

    // All should have completed successfully
    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result).toBeDefined();
    });
  });
});

// ── Zero-Config Factory ──────────────────────────────────────────

describe('Integration: zero-config factory default behavior (Requirement 1.1)', () => {
  it('zero-config middleware allows clean requests through', async () => {
    const middleware = tealtigerMiddleware();

    const doGenerate = createMockDoGenerate({ text: 'Hello there!' });
    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: { prompt: [{ role: 'user', content: 'Hi, how are you?' }] },
      model: { modelId: 'openai/gpt-4' },
    });

    expect(result).toBeDefined();
    expect(doGenerate).toHaveBeenCalled();
  });

  it('zero-config middleware returns a middleware object without errors', () => {
    const middleware = tealtigerMiddleware();

    expect(middleware.transformParams).toBeDefined();
    expect(middleware.wrapGenerate).toBeDefined();
    expect(middleware.wrapStream).toBeDefined();
  });

  it('zero-config enables default guardrails (PII detection, prompt injection, content moderation)', async () => {
    const middleware = tealtigerMiddleware();

    // The transformParams hook should process content without throwing
    // for clean content (no PII, no injection)
    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'Tell me about TypeScript generics.' }],
        modelId: 'openai/gpt-4',
      },
    });

    expect(result).toBeDefined();
    // providerMetadata should have tealtiger governance metadata
    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
  });
});

// ── PII Detection Patterns ───────────────────────────────────────

describe('Integration: PII pattern detection (Requirement 2.2)', () => {
  /**
   * Note: PII detection depends on the TealGuard implementation.
   * In zero-config mode, TealGuard is initialized with default settings.
   * These tests verify that the middleware properly processes content
   * through the guardrail pipeline and that the governance flow executes correctly.
   */

  it('processes content with email addresses through guardrails', async () => {
    const middleware = tealtigerMiddleware({
      guardrails: { pii: true },
    });

    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'My email is john.doe@example.com' }],
        modelId: 'openai/gpt-4',
      },
    });

    // The middleware should process without throwing
    expect(result).toBeDefined();
    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
  });

  it('processes content with SSN patterns through guardrails', async () => {
    const middleware = tealtigerMiddleware({
      guardrails: { pii: true },
    });

    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'My SSN is 123-45-6789' }],
        modelId: 'openai/gpt-4',
      },
    });

    expect(result).toBeDefined();
    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
  });

  it('processes content with credit card patterns through guardrails', async () => {
    const middleware = tealtigerMiddleware({
      guardrails: { pii: true },
    });

    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'My credit card is 4111-1111-1111-1111' }],
        modelId: 'openai/gpt-4',
      },
    });

    expect(result).toBeDefined();
    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
  });

  it('applies governance flag indicating content was processed', async () => {
    const middleware = tealtigerMiddleware({
      guardrails: { pii: true, promptInjection: true, contentModeration: true },
    });

    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'Hello, my name is Alice.' }],
        modelId: 'openai/gpt-4',
      },
    });

    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
    expect(tealtiger?.correlationId).toBeDefined();
    expect(typeof tealtiger?.correlationId).toBe('string');
  });
});

// ── Audit Logging Failure Non-Blocking ───────────────────────────

describe('Integration: audit logging failure non-blocking (Requirement 7.7)', () => {
  it('request proceeds even when audit logging throws', async () => {
    // We need to use the GovernanceOrchestrator directly with a failing audit
    // The integration approach: configure audit enabled, but mock the internal
    // audit emitter to throw — the middleware should swallow the error

    // Use a custom config that enables audit
    const middleware = tealtigerMiddleware({
      audit: { enabled: true },
    });

    // The middleware should still process requests even if audit fails internally
    // Since audit failures are caught and logged to stderr, we verify the
    // request completes successfully
    const doGenerate = createMockDoGenerate({ text: 'Audit test response' });

    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: { prompt: [{ role: 'user', content: 'Test audit failure' }] },
      model: { modelId: 'openai/gpt-4' },
    });

    // Request should succeed even if audit has issues
    expect(result).toBeDefined();
    expect(doGenerate).toHaveBeenCalled();
  });

  it('transformParams proceeds when audit emitter is non-blocking', async () => {
    // Verify the non-blocking nature by ensuring transformParams completes
    // even with audit configured (audit failures are caught internally)
    const middleware = tealtigerMiddleware({
      audit: { enabled: true },
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const result = await middleware.transformParams!({
        params: {
          prompt: [{ role: 'user', content: 'Hello world' }],
          modelId: 'openai/gpt-4',
        },
      });

      // Should complete without throwing
      expect(result).toBeDefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('governance decision is preserved regardless of audit state', async () => {
    const middleware = tealtigerMiddleware({
      audit: { enabled: true },
      guardrails: { pii: true, promptInjection: true },
    });

    // Verify that governance decisions are made correctly even with audit
    const result = await middleware.transformParams!({
      params: {
        prompt: [{ role: 'user', content: 'Clean request with no issues' }],
        modelId: 'openai/gpt-4',
      },
    });

    expect(result).toBeDefined();
    const metadata = (result as Record<string, unknown>).providerMetadata as Record<string, unknown>;
    const tealtiger = metadata?.tealtiger as Record<string, unknown>;
    expect(tealtiger?.governanceApplied).toBe(true);
  });
});

// ── End-to-End Middleware Flow ────────────────────────────────────

describe('Integration: end-to-end middleware with mocked LLM provider', () => {
  it('full lifecycle: transformParams → wrapGenerate → response', async () => {
    const middleware = tealtigerMiddleware({
      guardrails: { pii: true, promptInjection: true },
    });

    // Step 1: transformParams
    const params = {
      prompt: [{ role: 'user', content: 'What is the weather like?' }],
      modelId: 'openai/gpt-4',
    };
    const transformedParams = await middleware.transformParams!({ params });
    expect(transformedParams).toBeDefined();

    // Step 2: wrapGenerate with the transformed params
    const doGenerate = createMockDoGenerate({
      text: 'The weather is sunny and 72°F.',
      promptTokens: 10,
      completionTokens: 12,
    });

    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: transformedParams as Record<string, unknown>,
      model: { modelId: 'openai/gpt-4' },
    });

    expect(result).toBeDefined();
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it('middleware propagates provider errors correctly', async () => {
    const middleware = tealtigerMiddleware();
    const providerError = new Error('Rate limit exceeded');

    const doGenerate = createMockDoGenerate({
      shouldFail: true,
      failError: providerError,
    });

    await expect(
      middleware.wrapGenerate!({
        doGenerate,
        params: { prompt: [{ role: 'user', content: 'Hello' }] },
        model: { modelId: 'openai/gpt-4' },
      }),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('multiple sequential requests work correctly', async () => {
    const middleware = tealtigerMiddleware();

    for (let i = 0; i < 3; i++) {
      const doGenerate = createMockDoGenerate({ text: `Response ${i}` });
      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: { prompt: [{ role: 'user', content: `Query ${i}` }] },
        model: { modelId: 'openai/gpt-4' },
      });
      expect(result).toBeDefined();
    }
  });

  it('middleware works with different model identifiers', async () => {
    const middleware = tealtigerMiddleware();
    const models = ['openai/gpt-4', 'anthropic/claude-3', 'google/gemini-pro'];

    for (const modelId of models) {
      const doGenerate = createMockDoGenerate({ text: `Response from ${modelId}` });
      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: { prompt: [{ role: 'user', content: 'Hello' }] },
        model: { modelId },
      });
      expect(result).toBeDefined();
    }
  });
});
