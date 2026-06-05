/**
 * Unit Tests — wrapGenerate Hook (Task 5.2)
 *
 * Validates:
 * - Circuit breaker check (throws CircuitOpenError if OPEN)
 * - Policy evaluation (throws PolicyViolationError if DENY)
 * - Budget check (throws BudgetExceededError if exceeded)
 * - doGenerate() invocation on ALLOW
 * - Output guardrail evaluation (throws GuardrailViolationError if violated)
 * - Cost recording from token usage
 * - Circuit breaker success/failure reporting
 * - Audit entry emission with correlation_id, decision, tokens, duration
 * - Provider error propagation with circuit reporting
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */

import { describe, it, expect, vi } from 'vitest';
import { createWrapGenerateHook } from './wrapGenerate';
import { GovernanceOrchestrator } from '../core/GovernanceOrchestrator';
import type { AuditEntry } from '../core/GovernanceOrchestrator';
import {
  PolicyViolationError,
  GuardrailViolationError,
  BudgetExceededError,
  CircuitOpenError,
} from '../errors';
import type { Decision } from '../types/decision';

// ── Test Helpers ─────────────────────────────────────────────────

function createTestOrchestrator(overrides: {
  policyDecision?: Decision;
  outputDecision?: Decision;
  budgetResult?: { withinBudget: boolean; estimatedCost: number; exceededBudgetType?: string; remainingBudget?: number };
  circuitThrows?: boolean;
  failOpen?: boolean;
  audit?: { log: (entry: unknown) => void };
  engine?: { evaluateV12: (...args: unknown[]) => Promise<Decision> };
} = {}) {
  const config: Record<string, unknown> = {};
  if (overrides.failOpen) config.failOpen = true;
  if (overrides.engine || overrides.policyDecision) config.policy = { mode: 'ENFORCE' };

  const orchestrator = new GovernanceOrchestrator(config as any);

  const o = orchestrator as unknown as {
    initialized: boolean;
    guard: unknown;
    engine: unknown;
    costTracker: unknown;
    audit: unknown;
    circuits: Map<string, unknown>;
    config: Record<string, unknown>;
  };
  o.initialized = true;
  o.guard = {
    async check(): Promise<Decision> {
      if (overrides.outputDecision) return overrides.outputDecision;
      return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'], risk_score: 0, correlation_id: '', reason: 'OK' };
    },
  };

  if (overrides.engine) {
    o.engine = overrides.engine;
  } else if (overrides.policyDecision) {
    o.engine = {
      async evaluateV12(_req: unknown, ctx: { correlation_id: string }): Promise<Decision> {
        return { ...overrides.policyDecision!, correlation_id: ctx.correlation_id };
      },
    };
  }

  if (overrides.audit) o.audit = overrides.audit;

  return orchestrator;
}

function makeDoGenerate(result: Record<string, unknown> = {}) {
  return vi.fn(async () => ({
    text: 'Hello from the model',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    ...result,
  }));
}

// ── Tests ────────────────────────────────────────────────────────

describe('wrapGenerate hook (Task 5.2)', () => {
  describe('circuit breaker check', () => {
    it('throws CircuitOpenError when circuit is OPEN', async () => {
      const orchestrator = new GovernanceOrchestrator({
        circuitBreaker: { failureThreshold: 1 },
      });
      const orch = orchestrator as unknown as { initialized: boolean; guard: unknown };
      orch.initialized = true;
      orch.guard = { async check() { return { action: 'ALLOW', reason_codes: [], risk_score: 0, correlation_id: '', reason: 'ok' }; } };

      // Force circuit open
      orchestrator.reportOutcome('openai', false); // triggers threshold of 1

      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate();

      await expect(
        hook({ doGenerate, params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow(CircuitOpenError);

      expect(doGenerate).not.toHaveBeenCalled();
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
          reason: 'Policy denies request',
        },
      });
      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate();

      await expect(
        hook({ doGenerate, params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow(PolicyViolationError);

      expect(doGenerate).not.toHaveBeenCalled();
    });

    it('calls doGenerate when policy allows request', async () => {
      const orchestrator = createTestOrchestrator({
        policyDecision: {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: '',
          reason: 'Allowed',
        },
      });
      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate();

      const result = await hook({ doGenerate, params: { modelId: 'openai/gpt-4' } });

      expect(doGenerate).toHaveBeenCalledTimes(1);
      expect((result as any).text).toBe('Hello from the model');
    });
  });

  describe('budget check', () => {
    it('throws BudgetExceededError when budget exceeded', async () => {
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perRequestLimit: 0.001 },
      });
      const o = orchestrator as unknown as {
        initialized: boolean;
        guard: unknown;
        costTracker: unknown;
      };
      o.initialized = true;
      o.guard = { async check() { return { action: 'ALLOW', reason_codes: [], risk_score: 0, correlation_id: '', reason: '' }; } };
      o.costTracker = {
        estimateCost() {
          return { estimatedCost: 5.0, budgetExceeded: true, exceededBudgetType: 'per-request', remainingBudget: 0 };
        },
        calculateActualCost() { return { actualCost: 0 }; },
      };

      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate();

      await expect(
        hook({ doGenerate, params: { modelId: 'openai/gpt-4', maxTokens: 10000 } }),
      ).rejects.toThrow(BudgetExceededError);

      expect(doGenerate).not.toHaveBeenCalled();
    });
  });

  describe('output guardrails', () => {
    it('throws GuardrailViolationError when output guardrails detect violation', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      const o = orchestrator as unknown as {
        initialized: boolean;
        guard: unknown;
      };
      o.initialized = true;
      o.guard = {
        async check(_input: string, context?: { phase?: string }): Promise<Decision> {
          if (context?.phase === 'output') {
            return {
              action: 'DENY',
              reason_codes: ['HARMFUL_CONTENT_DETECTED'],
              risk_score: 90,
              correlation_id: '',
              reason: 'Harmful content in response',
            };
          }
          return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'], risk_score: 0, correlation_id: '', reason: '' };
        },
      };

      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate({ text: 'Harmful response content' });

      await expect(
        hook({ doGenerate, params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow(GuardrailViolationError);
    });
  });

  describe('cost recording', () => {
    it('records actual cost from token usage after successful call', async () => {
      const recordCostSpy = vi.fn().mockReturnValue({ actualCost: 0.005, model: 'openai/gpt-4', usageReported: true });
      const orchestrator = createTestOrchestrator();
      vi.spyOn(orchestrator, 'recordCost').mockImplementation(recordCostSpy);

      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = makeDoGenerate({ usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } });

      await hook({ doGenerate, params: { modelId: 'openai/gpt-4' } });

      expect(recordCostSpy).toHaveBeenCalledWith('openai/gpt-4', {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });
    });
  });

  describe('circuit breaker reporting', () => {
    it('reports success to circuit breaker after successful call', async () => {
      const orchestrator = createTestOrchestrator();
      const spy = vi.spyOn(orchestrator, 'reportOutcome');

      const hook = createWrapGenerateHook(orchestrator);
      await hook({ doGenerate: makeDoGenerate(), params: { modelId: 'openai/gpt-4' } });

      expect(spy).toHaveBeenCalledWith('openai', true);
    });

    it('reports failure to circuit breaker on provider error', async () => {
      const orchestrator = createTestOrchestrator();
      const spy = vi.spyOn(orchestrator, 'reportOutcome');

      const hook = createWrapGenerateHook(orchestrator);
      const doGenerate = vi.fn(async () => { throw new Error('Provider timeout'); });

      await expect(
        hook({ doGenerate, params: { modelId: 'openai/gpt-4' } }),
      ).rejects.toThrow('Provider timeout');

      expect(spy).toHaveBeenCalledWith('openai', false);
    });
  });

  describe('audit entry emission', () => {
    it('emits audit entry with correlation_id, decision, token usage, and duration', async () => {
      const entries: unknown[] = [];
      const orchestrator = createTestOrchestrator({
        audit: { log: (entry: unknown) => entries.push(entry) },
      });
      const hook = createWrapGenerateHook(orchestrator);

      await hook({
        doGenerate: makeDoGenerate(),
        params: { modelId: 'openai/gpt-4' },
      });

      expect(entries.length).toBe(1);
      const entry = entries[0] as AuditEntry;
      expect(entry.schema_version).toBe('1.0.0');
      expect(entry.correlation_id).toBeDefined();
      expect(entry.hook).toBe('wrapGenerate');
      expect(entry.provider).toBe('openai');
      expect(entry.model).toBe('openai/gpt-4');
      expect(entry.tokens.input).toBe(100);
      expect(entry.tokens.output).toBe(50);
      expect(entry.tokens.total).toBe(150);
      expect(entry.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('provider error propagation', () => {
    it('propagates original provider error after reporting to circuit', async () => {
      const orchestrator = createTestOrchestrator();
      const hook = createWrapGenerateHook(orchestrator);

      const providerError = new Error('Rate limit exceeded');
      (providerError as any).code = 'rate_limit';
      const doGenerate = vi.fn(async () => { throw providerError; });

      try {
        await hook({ doGenerate, params: { modelId: 'anthropic/claude-3' } });
        expect.fail('Should throw');
      } catch (e) {
        expect(e).toBe(providerError);
      }
    });
  });
});
