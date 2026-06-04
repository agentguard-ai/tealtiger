/**
 * Property 6: Governance gate — model invoked if and only if policy allows
 *
 * For any request evaluated by wrapGenerate, the underlying model (doGenerate)
 * is invoked if and only if the TealEngine policy Decision action is ALLOW.
 * When the Decision is DENY, a PolicyViolationError containing the Decision
 * is thrown without any model invocation.
 *
 * Feature: vercel-ai-sdk-integration, Property 6: Governance gate correctness
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2**
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbSafeContent } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import { createWrapGenerateHook } from '../../hooks/wrapGenerate';
import { PolicyViolationError } from '../../errors';
import type { Decision, DecisionAction } from '../../types/decision';

describe('Feature: vercel-ai-sdk-integration, Property 6: Governance gate correctness', () => {
  /**
   * Helper: create an orchestrator with a mock engine that returns
   * the specified decision action for any policy evaluation.
   */
  function createOrchestratorWithPolicyDecision(action: DecisionAction) {
    const orchestrator = new GovernanceOrchestrator({
      guardrails: { pii: false, promptInjection: false, contentModeration: false },
    });

    const o = orchestrator as unknown as {
      initialized: boolean;
      engine: {
        evaluateV12: (req: unknown, ctx: { correlation_id: string }) => Promise<Decision>;
      } | null;
      guard: null;
    };
    o.initialized = true;
    o.guard = null;
    o.engine = {
      evaluateV12: async (_req: unknown, ctx: { correlation_id: string }): Promise<Decision> => ({
        action,
        reason_codes: action === 'ALLOW' ? ['POLICY_COMPLIANT'] : ['POLICY_VIOLATION'],
        risk_score: action === 'ALLOW' ? 0 : 85,
        correlation_id: ctx.correlation_id,
        reason: action === 'ALLOW' ? 'Policy allows request' : 'Policy denies request',
      }),
    };

    return orchestrator;
  }

  it('model is invoked when policy decision is ALLOW', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbSafeContent(),
        async (modelId, content) => {
          const orchestrator = createOrchestratorWithPolicyDecision('ALLOW');
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          let modelInvoked = false;
          const doGenerate = async () => {
            modelInvoked = true;
            return {
              text: 'Hello from the model',
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            };
          };

          const result = await wrapGenerate({
            doGenerate,
            params: {
              modelId,
              prompt: [{ role: 'user', content }],
            },
            model: { modelId },
          });

          // PROPERTY: model MUST be invoked when policy is ALLOW
          expect(modelInvoked).toBe(true);

          // PROPERTY: response MUST be returned
          expect(result).toBeDefined();
          expect(result.text).toBe('Hello from the model');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('model is NOT invoked when policy decision is DENY, and PolicyViolationError is thrown', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbSafeContent(),
        async (modelId, content) => {
          const orchestrator = createOrchestratorWithPolicyDecision('DENY');
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          let modelInvoked = false;
          const doGenerate = async () => {
            modelInvoked = true;
            return {
              text: 'Should not reach here',
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            };
          };

          let thrownError: unknown;
          try {
            await wrapGenerate({
              doGenerate,
              params: {
                modelId,
                prompt: [{ role: 'user', content }],
              },
              model: { modelId },
            });
            throw new Error('Expected PolicyViolationError but request succeeded');
          } catch (error) {
            thrownError = error;
          }

          // PROPERTY: model MUST NOT be invoked when policy is DENY
          expect(modelInvoked).toBe(false);

          // PROPERTY: PolicyViolationError MUST be thrown
          expect(thrownError).toBeInstanceOf(PolicyViolationError);

          const policyError = thrownError as PolicyViolationError;

          // PROPERTY: decision MUST have DENY action
          expect(policyError.decision.action).toBe('DENY');

          // PROPERTY: decision MUST contain relevant reason codes
          expect(policyError.decision.reason_codes).toContain('POLICY_VIOLATION');

          // PROPERTY: correlation_id MUST be present
          expect(policyError.decision.correlation_id).toBeDefined();
          expect(policyError.decision.correlation_id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
