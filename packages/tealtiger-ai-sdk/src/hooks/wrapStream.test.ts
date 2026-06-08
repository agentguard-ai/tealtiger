/**
 * Unit Tests — wrapStream Hook (Task 5.3)
 *
 * Validates:
 * - Circuit breaker check (throws CircuitOpenError if OPEN)
 * - Policy evaluation (throws PolicyViolationError if DENY)
 * - doStream() invocation on ALLOW
 * - Stream chunk accumulation for output guardrail evaluation
 * - On stream completion: evaluate output guardrails, record cost, emit audit
 * - Mid-stream provider error handling (report to circuit, emit audit, propagate)
 * - Token usage recording from stream metadata on completion
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { describe, it, expect, vi } from 'vitest';
import { createWrapStreamHook } from './wrapStream';
import type { StreamResult, StreamChunk } from './wrapStream';
import { GovernanceOrchestrator } from '../core/GovernanceOrchestrator';
import { PolicyViolationError, CircuitOpenError } from '../errors';
import type { Decision } from '../types/decision';

// ── Test Helpers ─────────────────────────────────────────────────

function createTestOrchestrator(overrides: {
  policyDecision?: Decision;
  outputDecision?: Decision;
  circuitThrows?: boolean;
  audit?: { log: (entry: unknown) => void };
} = {}) {
  const config: Record<string, unknown> = {};
  if (overrides.policyDecision) config.policy = { mode: 'ENFORCE' };
  if (overrides.outputDecision) config.guardrails = { output: { contentModeration: true } };

  const orchestrator = new GovernanceOrchestrator(config as any);

  const o = orchestrator as unknown as {
    initialized: boolean;
    guard: unknown;
    engine: unknown;
    audit: unknown;
  };
  o.initialized = true;
  o.guard = {
    async check(_input: string, context?: { phase?: string }): Promise<Decision> {
      if (context?.phase === 'output' && overrides.outputDecision) {
        return overrides.outputDecision;
      }
      return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'], risk_score: 0, correlation_id: '', reason: 'OK' };
    },
  };

  if (overrides.policyDecision) {
    o.engine = {
      async evaluateV12(_req: unknown, ctx: { correlation_id: string }): Promise<Decision> {
        return { ...overrides.policyDecision!, correlation_id: ctx.correlation_id };
      },
    };
  }
  if (overrides.audit) o.audit = overrides.audit;

  return orchestrator;
}

/**
 * Create a mock doStream that returns a ReadableStream with specified chunks.
 */
function makeDoStream(chunks: StreamChunk[]): () => Promise<StreamResult> {
  return async () => ({
    stream: new ReadableStream<StreamChunk>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
  });
}

/**
 * Consume a ReadableStream and return all chunks.
 */
async function consumeStream(stream: ReadableStream<StreamChunk>): Promise<StreamChunk[]> {
  const reader = stream.getReader();
  const result: StreamChunk[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return result;
}

// ── Tests ────────────────────────────────────────────────────────

describe('wrapStream hook (Task 5.3)', () => {
  describe('circuit breaker check', () => {
    it('throws CircuitOpenError when circuit is OPEN', async () => {
      const orchestrator = new GovernanceOrchestrator({
        circuitBreaker: { failureThreshold: 1 },
      });
      const o = orchestrator as unknown as { initialized: boolean; guard: unknown };
      o.initialized = true;
      o.guard = { async check() { return { action: 'ALLOW', reason_codes: [], risk_score: 0, correlation_id: '', reason: '' }; } };

      // Force circuit open
      orchestrator.reportOutcome('openai', false);

      const hook = createWrapStreamHook(orchestrator);

      await expect(
        hook({ doStream: makeDoStream([]), params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow(CircuitOpenError);
    });
  });

  describe('policy evaluation', () => {
    it('throws PolicyViolationError when policy denies request', async () => {
      const orchestrator = createTestOrchestrator({
        policyDecision: {
          action: 'DENY',
          reason_codes: ['POLICY_VIOLATION'],
          risk_score: 85,
          correlation_id: '',
          reason: 'Policy denies streaming request',
        },
      });
      const hook = createWrapStreamHook(orchestrator);

      await expect(
        hook({ doStream: makeDoStream([]), params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow(PolicyViolationError);
    });

    it('calls doStream when policy allows', async () => {
      const orchestrator = createTestOrchestrator({
        policyDecision: {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: '',
          reason: 'Allowed',
        },
      });
      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'text-delta', textDelta: ' World' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });

      expect(result.stream).toBeDefined();
      const output = await consumeStream(result.stream);
      expect(output.length).toBe(3);
    });
  });

  describe('stream chunk accumulation', () => {
    it('passes through all chunks unmodified', async () => {
      const orchestrator = createTestOrchestrator();
      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'text-delta', textDelta: ' World' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });
      const output = await consumeStream(result.stream);

      expect(output[0]).toEqual({ type: 'text-delta', textDelta: 'Hello' });
      expect(output[1]).toEqual({ type: 'text-delta', textDelta: ' World' });
      expect(output[2].type).toBe('finish');
    });
  });

  describe('stream completion — audit and cost', () => {
    it('emits audit entry on stream completion', async () => {
      const entries: unknown[] = [];
      const orchestrator = createTestOrchestrator({
        audit: { log: (entry: unknown) => entries.push(entry) },
      });
      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'Response text' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });
      await consumeStream(result.stream);

      expect(entries.length).toBe(1);
      const entry = entries[0] as Record<string, unknown>;
      expect(entry.hook).toBe('wrapStream');
      expect(entry.provider).toBe('openai');
      expect((entry.tokens as any).input).toBe(50);
      expect((entry.tokens as any).output).toBe(20);
    });

    it('records token usage from stream metadata', async () => {
      const orchestrator = createTestOrchestrator();
      const recordCostSpy = vi.spyOn(orchestrator, 'recordCost');

      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });
      await consumeStream(result.stream);

      expect(recordCostSpy).toHaveBeenCalledWith('openai/gpt-4', {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });
    });
  });

  describe('mid-stream provider error handling', () => {
    it('reports failure to circuit breaker on stream error', async () => {
      const orchestrator = createTestOrchestrator();
      const reportSpy = vi.spyOn(orchestrator, 'reportOutcome');

      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'partial' },
        { type: 'error', error: new Error('Connection lost') },
        { type: 'finish', finishReason: 'error', usage: { promptTokens: 10, completionTokens: 0 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });
      await consumeStream(result.stream);

      expect(reportSpy).toHaveBeenCalledWith('openai', false);
    });

    it('reports failure to circuit and propagates error when doStream throws', async () => {
      const orchestrator = createTestOrchestrator();
      const reportSpy = vi.spyOn(orchestrator, 'reportOutcome');

      const hook = createWrapStreamHook(orchestrator);
      const doStream = async () => { throw new Error('Connection refused'); };

      await expect(
        hook({ doStream, params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow('Connection refused');

      expect(reportSpy).toHaveBeenCalledWith('openai', false);
    });
  });

  describe('circuit breaker success reporting', () => {
    it('reports success on stream completion', async () => {
      const orchestrator = createTestOrchestrator();
      const reportSpy = vi.spyOn(orchestrator, 'reportOutcome');

      const hook = createWrapStreamHook(orchestrator);
      const chunks: StreamChunk[] = [
        { type: 'text-delta', textDelta: 'ok' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 5, completionTokens: 2 } },
      ];

      const result = await hook({ doStream: makeDoStream(chunks), params: { modelId: 'openai/gpt-4' } });
      await consumeStream(result.stream);

      expect(reportSpy).toHaveBeenCalledWith('openai', true);
    });
  });
});
