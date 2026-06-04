/**
 * Property 7: Cost lifecycle — estimate before, record after, deny on budget exceeded
 *
 * For any model call with cost tracking configured, the Cost_Tracker estimates
 * cost before execution and records actual cost after execution. For any request
 * where the estimated cost exceeds any configured budget limit (per-request,
 * per-session, or daily), the request is denied with COST_BUDGET_EXCEEDED reason
 * code and the remaining budget amount.
 *
 * Feature: vercel-ai-sdk-integration, Property 7: Cost lifecycle correctness
 *
 * **Validates: Requirements 3.4, 4.4, 6.1, 6.2, 6.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbTokenUsage } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import type { ICostTracker } from '../../core/GovernanceOrchestrator';
import { createWrapGenerateHook } from '../../hooks/wrapGenerate';
import { BudgetExceededError } from '../../errors';
import type { TokenUsage } from '../../types/decision';

describe('Feature: vercel-ai-sdk-integration, Property 7: Cost lifecycle correctness', () => {
  it('budget exceeded throws BudgetExceededError with COST_BUDGET_EXCEEDED reason code', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        fc.integer({ min: 1000, max: 50_000 }), // Token count for estimation
        async (modelId, inputTokens) => {
          // Very small budget that will be exceeded
          const budgetLimit = 0.0001;

          // The mock cost tracker returns estimatedCost based on input tokens.
          // With 1000+ tokens at 0.03/1K, cost >= 0.03, exceeding 0.0001.
          const mockTracker: ICostTracker = {
            estimateCost(model: string, tokens: TokenUsage) {
              const estimatedCost = (tokens.inputTokens / 1000) * 0.03;
              return {
                estimatedCost,
                model,
                provider: model.split('/')[0] ?? 'unknown',
                estimatedTokens: tokens,
                breakdown: { inputCost: estimatedCost, outputCost: 0 },
                timestamp: new Date().toISOString(),
              };
            },
            calculateActualCost(_r: string, _a: string, model: string, t: TokenUsage) {
              return {
                id: 'c', requestId: _r, agentId: _a, model,
                provider: model.split('/')[0] ?? 'unknown', actualTokens: t,
                actualCost: 0, breakdown: { inputCost: 0, outputCost: 0 },
                timestamp: new Date().toISOString(),
              };
            },
          };

          const orchestrator = new GovernanceOrchestrator({
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
            costTracking: {
              enabled: true,
              perRequestLimit: budgetLimit,
            },
          });

          const o = orchestrator as unknown as {
            initialized: boolean;
            costTracker: ICostTracker | null;
            engine: null;
            guard: null;
          };
          o.initialized = true;
          o.costTracker = mockTracker;
          o.engine = null;
          o.guard = null;

          const wrapGenerate = createWrapGenerateHook(orchestrator);

          let modelInvoked = false;
          const doGenerate = async () => {
            modelInvoked = true;
            return {
              text: 'response',
              usage: { promptTokens: inputTokens, completionTokens: 100, totalTokens: inputTokens + 100 },
            };
          };

          // Use maxTokens in params — the extractEstimatedTokens function
          // checks this first and uses it as the estimated token count.
          const params = {
            modelId,
            maxTokens: inputTokens,
            prompt: [{ role: 'user', content: 'test' }],
          };

          let thrownError: unknown;
          try {
            await wrapGenerate({ doGenerate, params, model: { modelId } });
          } catch (error) {
            thrownError = error;
          }

          // PROPERTY: BudgetExceededError MUST be thrown
          expect(thrownError).toBeInstanceOf(BudgetExceededError);

          const budgetError = thrownError as BudgetExceededError;

          // PROPERTY: decision MUST have COST_BUDGET_EXCEEDED reason code
          expect(budgetError.decision.reason_codes).toContain('COST_BUDGET_EXCEEDED');

          // PROPERTY: decision action MUST be DENY
          expect(budgetError.decision.action).toBe('DENY');

          // PROPERTY: remaining budget amount MUST be provided
          expect(budgetError.remainingBudget).toBeDefined();
          expect(typeof budgetError.remainingBudget).toBe('number');

          // PROPERTY: model MUST NOT be invoked when budget exceeded
          expect(modelInvoked).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('within-budget request proceeds and records actual cost after execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbTokenUsage(),
        async (modelId, usage) => {
          // Large budget that won't be exceeded
          const budgetLimit = 1000.0;

          const orchestrator = new GovernanceOrchestrator({
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
            costTracking: {
              enabled: true,
              perRequestLimit: budgetLimit,
            },
          });

          // Track whether calculateActualCost was called
          let actualCostRecorded = false;
          let recordedTokens: TokenUsage | null = null;

          const mockTracker: ICostTracker = {
            estimateCost(model: string, tokens: TokenUsage) {
              const estimatedCost = (tokens.inputTokens / 1000) * 0.03;
              return {
                estimatedCost,
                model,
                provider: model.split('/')[0] ?? 'unknown',
                estimatedTokens: tokens,
                breakdown: { inputCost: estimatedCost, outputCost: 0 },
                timestamp: new Date().toISOString(),
              };
            },
            calculateActualCost(_requestId: string, _agentId: string, model: string, actualTokens: TokenUsage) {
              actualCostRecorded = true;
              recordedTokens = actualTokens;
              const inputCost = (actualTokens.inputTokens / 1000) * 0.03;
              const outputCost = (actualTokens.outputTokens / 1000) * 0.06;
              return {
                id: `cost-${Date.now()}`,
                requestId: _requestId,
                agentId: _agentId,
                model,
                provider: model.split('/')[0] ?? 'unknown',
                actualTokens,
                actualCost: inputCost + outputCost,
                breakdown: { inputCost, outputCost },
                timestamp: new Date().toISOString(),
              };
            },
          };

          const o = orchestrator as unknown as {
            initialized: boolean;
            costTracker: ICostTracker | null;
            engine: null;
            guard: null;
          };
          o.initialized = true;
          o.costTracker = mockTracker;
          o.engine = null;
          o.guard = null;

          const wrapGenerate = createWrapGenerateHook(orchestrator);

          const doGenerate = async () => ({
            text: 'Hello world',
            usage: {
              promptTokens: usage.inputTokens,
              completionTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
            },
          });

          // Use maxTokens to control the estimated token count
          const params = {
            modelId,
            maxTokens: 100, // Small token count => small cost => within budget
            prompt: [{ role: 'user', content: 'test' }],
          };

          const result = await wrapGenerate({ doGenerate, params, model: { modelId } });

          // PROPERTY: response MUST be returned (within budget)
          expect(result).toBeDefined();
          expect(result.text).toBe('Hello world');

          // PROPERTY: actual cost MUST be recorded after execution
          expect(actualCostRecorded).toBe(true);

          // PROPERTY: recorded tokens MUST match the model response usage
          expect(recordedTokens).not.toBeNull();
          expect(recordedTokens!.inputTokens).toBe(usage.inputTokens);
          expect(recordedTokens!.outputTokens).toBe(usage.outputTokens);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('budget type is correctly reported in BudgetExceededError', async () => {
    const budgetTypes: Array<'per-request' | 'per-session' | 'daily'> = ['per-request', 'per-session', 'daily'];

    for (const budgetType of budgetTypes) {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { pii: false, promptInjection: false, contentModeration: false },
        costTracking: {
          enabled: true,
          ...(budgetType === 'per-request' && { perRequestLimit: 0.0001 }),
          ...(budgetType === 'per-session' && { perSessionLimit: 0.0001 }),
          ...(budgetType === 'daily' && { dailyLimit: 0.0001 }),
        },
      });

      const mockTracker: ICostTracker = {
        estimateCost(model: string, tokens: TokenUsage) {
          return {
            estimatedCost: 10.0, // Way over any limit
            model,
            provider: model.split('/')[0] ?? 'unknown',
            estimatedTokens: tokens,
            breakdown: { inputCost: 5.0, outputCost: 5.0 },
            timestamp: new Date().toISOString(),
          };
        },
        calculateActualCost(_r: string, _a: string, model: string, t: TokenUsage) {
          return {
            id: 'c', requestId: _r, agentId: _a, model,
            provider: 'unknown', actualTokens: t, actualCost: 0,
            breakdown: { inputCost: 0, outputCost: 0 }, timestamp: '',
          };
        },
      };

      const o = orchestrator as unknown as {
        initialized: boolean;
        costTracker: ICostTracker | null;
        engine: null;
        guard: null;
      };
      o.initialized = true;
      o.costTracker = mockTracker;
      o.engine = null;
      o.guard = null;

      const wrapGenerate = createWrapGenerateHook(orchestrator);

      try {
        await wrapGenerate({
          doGenerate: async () => ({ text: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
          params: { modelId: 'openai/gpt-4', prompt: [{ role: 'user', content: 'test' }] },
          model: { modelId: 'openai/gpt-4' },
        });
        expect.fail('Expected BudgetExceededError');
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        const budgetError = error as BudgetExceededError;
        expect(budgetError.budgetType).toBe(budgetType);
      }
    }
  });
});
