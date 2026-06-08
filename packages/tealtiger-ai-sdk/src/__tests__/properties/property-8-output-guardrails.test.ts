/**
 * Property 8: Output guardrail violations block the response
 *
 * For any model response that triggers an output guardrail violation,
 * the wrapGenerate hook SHALL throw a GuardrailViolationError with the
 * names of failed guardrails, and the response SHALL NOT be returned
 * to the caller.
 *
 * Feature: vercel-ai-sdk-integration, Property 8: Output guardrail violations block response
 *
 * **Validates: Requirements 3.5, 3.6, 4.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbSafeContent } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import type { ITealGuard } from '../../core/GovernanceOrchestrator';
import { createWrapGenerateHook } from '../../hooks/wrapGenerate';
import { GuardrailViolationError } from '../../errors';
import type { Decision, DecisionAction } from '../../types/decision';

/**
 * Arbitrary for guardrail names that could be violated.
 */
function arbFailedGuardrails(): fc.Arbitrary<string[]> {
  return fc.subarray(
    ['HARMFUL_CONTENT_DETECTED', 'TOXICITY_DETECTED', 'BIAS_DETECTED', 'PII_IN_OUTPUT', 'PROFANITY_DETECTED'],
    { minLength: 1, maxLength: 3 },
  );
}

describe('Feature: vercel-ai-sdk-integration, Property 8: Output guardrail violations block response', () => {
  /**
   * Helper: create an orchestrator with a mock guard that denies output evaluation.
   */
  function createOrchestratorWithOutputGuardrailViolation(failedGuardrails: string[]) {
    const orchestrator = new GovernanceOrchestrator({
      guardrails: {
        pii: false,
        promptInjection: false,
        contentModeration: false,
        output: { enabled: true },
      },
    });

    const mockGuard: ITealGuard = {
      async check(_input: string, context?: unknown): Promise<Decision> {
        const ctx = context as { phase?: string; correlation_id?: string } | undefined;
        // If this is an output phase check, return DENY
        if (ctx?.phase === 'output') {
          return {
            action: 'DENY',
            reason_codes: failedGuardrails,
            risk_score: 90,
            correlation_id: ctx?.correlation_id ?? '',
            reason: `Output guardrail violated: ${failedGuardrails.join(', ')}`,
          };
        }
        // Input checks pass
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: ctx?.correlation_id ?? '',
          reason: 'Input checks passed',
        };
      },
    };

    const o = orchestrator as unknown as {
      initialized: boolean;
      guard: ITealGuard | null;
      engine: null;
    };
    o.initialized = true;
    o.guard = mockGuard;
    o.engine = null;

    return orchestrator;
  }

  it('output guardrail violation throws GuardrailViolationError and does NOT return response', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbSafeContent(),
        arbFailedGuardrails(),
        async (modelId, content, failedGuardrails) => {
          const orchestrator = createOrchestratorWithOutputGuardrailViolation(failedGuardrails);
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          const modelResponse = `Harmful response that triggers guardrails: ${content}`;
          const doGenerate = async () => ({
            text: modelResponse,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          });

          let thrownError: unknown;
          let responseReturned = false;
          try {
            const result = await wrapGenerate({
              doGenerate,
              params: {
                modelId,
                prompt: [{ role: 'user', content }],
              },
              model: { modelId },
            });
            responseReturned = true;
          } catch (error) {
            thrownError = error;
          }

          // PROPERTY: response MUST NOT be returned to the caller
          expect(responseReturned).toBe(false);

          // PROPERTY: GuardrailViolationError MUST be thrown
          expect(thrownError).toBeInstanceOf(GuardrailViolationError);

          const guardrailError = thrownError as GuardrailViolationError;

          // PROPERTY: failedGuardrails MUST contain the names of violated guardrails
          expect(guardrailError.failedGuardrails).toBeDefined();
          expect(guardrailError.failedGuardrails.length).toBeGreaterThan(0);
          for (const guardrail of failedGuardrails) {
            expect(guardrailError.failedGuardrails).toContain(guardrail);
          }

          // PROPERTY: decision MUST have DENY action
          expect(guardrailError.decision.action).toBe('DENY');

          // PROPERTY: correlation_id MUST be present
          expect(guardrailError.decision.correlation_id).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
