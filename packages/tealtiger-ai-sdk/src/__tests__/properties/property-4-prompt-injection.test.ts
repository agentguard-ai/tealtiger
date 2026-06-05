/**
 * Property 4: Prompt injection in input always blocks the request
 *
 * For any request content that triggers prompt injection detection,
 * the transformParams hook SHALL throw a PolicyViolationError containing
 * a Decision with reason code PROMPT_INJECTION_DETECTED, and the request
 * SHALL NOT be forwarded to the model provider.
 *
 * Feature: vercel-ai-sdk-integration, Property 4: Prompt injection blocks request
 *
 * **Validates: Requirements 2.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbPromptInjectionContent, arbModelId } from '../helpers/arbitraries';
import { createMockTealGuard } from '../helpers/mock-factories';
import { createTransformParamsHook } from '../../hooks/transformParams';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import type { ITealGuard } from '../../core/GovernanceOrchestrator';
import { PolicyViolationError } from '../../errors';
import type { TealTigerMiddlewareConfig } from '../../types/config';

// ── Helper: Create orchestrator with injection-detecting guard ────

function createInjectionDetectingOrchestrator(
  config: TealTigerMiddlewareConfig = {},
): GovernanceOrchestrator {
  const mockGuard = createMockTealGuard({ detectInjection: true });

  const orchestrator = new GovernanceOrchestrator(config);

  // Bypass lazy initialization and inject mock guard directly
  const o = orchestrator as unknown as {
    initialized: boolean;
    guard: ITealGuard | null;
  };
  o.initialized = true;
  o.guard = mockGuard as unknown as ITealGuard;

  return orchestrator;
}

describe('Feature: vercel-ai-sdk-integration, Property 4: Prompt injection blocks request', () => {
  it('any prompt injection content always throws PolicyViolationError with PROMPT_INJECTION_DETECTED', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPromptInjectionContent(),
        arbModelId(),
        async (injectionContent, modelId) => {
          const orchestrator = createInjectionDetectingOrchestrator({
            guardrails: { promptInjection: true },
          });
          const transformParams = createTransformParamsHook(orchestrator);

          const params = {
            modelId,
            prompt: [
              { role: 'user', content: injectionContent },
            ],
          };

          // The hook must throw PolicyViolationError
          let thrownError: unknown;
          try {
            await transformParams({ params });
            // If we get here, the request was forwarded — property violated
            throw new Error('Expected PolicyViolationError but request was forwarded');
          } catch (error) {
            thrownError = error;
          }

          // Verify the thrown error is a PolicyViolationError
          expect(thrownError).toBeInstanceOf(PolicyViolationError);

          const policyError = thrownError as PolicyViolationError;

          // Verify the decision contains PROMPT_INJECTION_DETECTED reason code
          expect(policyError.decision).toBeDefined();
          expect(policyError.decision.reason_codes).toContain('PROMPT_INJECTION_DETECTED');

          // Verify the decision action is DENY
          expect(policyError.decision.action).toBe('DENY');

          // Verify a correlation_id is present (request was tracked)
          expect(policyError.decision.correlation_id).toBeDefined();
          expect(policyError.decision.correlation_id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('prompt injection content as system message also blocks the request', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPromptInjectionContent(),
        async (injectionContent) => {
          const orchestrator = createInjectionDetectingOrchestrator({
            guardrails: { promptInjection: true },
          });
          const transformParams = createTransformParamsHook(orchestrator);

          const params = {
            modelId: 'openai/gpt-4',
            prompt: [
              { role: 'system', content: injectionContent },
            ],
          };

          let thrownError: unknown;
          try {
            await transformParams({ params });
            throw new Error('Expected PolicyViolationError but request was forwarded');
          } catch (error) {
            thrownError = error;
          }

          expect(thrownError).toBeInstanceOf(PolicyViolationError);
          const policyError = thrownError as PolicyViolationError;
          expect(policyError.decision.reason_codes).toContain('PROMPT_INJECTION_DETECTED');
          expect(policyError.decision.action).toBe('DENY');
        },
      ),
      { numRuns: 100 },
    );
  });
});
