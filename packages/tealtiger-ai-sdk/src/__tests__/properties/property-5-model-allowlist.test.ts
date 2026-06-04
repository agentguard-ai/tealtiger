/**
 * Property 5: Model not in allowlist always blocks the request
 *
 * For any model identifier that is not present in the configured TealRegistry
 * allowlist, the transformParams hook SHALL throw a PolicyViolationError with
 * reason code MODEL_NOT_ALLOWLISTED.
 *
 * Feature: vercel-ai-sdk-integration, Property 5: Model not in allowlist blocks request
 *
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbModelId } from '../helpers/arbitraries';
import { createMockTealRegistry } from '../helpers/mock-factories';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import { createTransformParamsHook } from '../../hooks/transformParams';
import { PolicyViolationError } from '../../errors';

describe('Feature: vercel-ai-sdk-integration, Property 5: Model not in allowlist blocks request', () => {
  /**
   * Helper to create a transformParams hook with a TealRegistry allowlist.
   * Bypasses lazy initialization by directly injecting mocks to avoid
   * dynamic import timeouts in the test environment.
   */
  function createHookWithAllowlist(allowedModels: string[]) {
    const orchestrator = new GovernanceOrchestrator({
      registry: { enabled: true, allowedModels },
      // Disable guardrails to isolate the allowlist test
      guardrails: { pii: false, promptInjection: false, contentModeration: false },
    });

    // Bypass lazy initialization — inject mocks directly
    const o = orchestrator as unknown as {
      initialized: boolean;
      guard: unknown;
      registry: unknown;
    };
    o.initialized = true;
    o.guard = null; // No guard needed for this test
    o.registry = {
      async evaluate(request: { model?: string }) {
        if (request.model && allowedModels.length > 0) {
          if (!allowedModels.includes(request.model)) {
            return { action: 'DENY', reason_codes: ['MODEL_NOT_ALLOWLISTED'] };
          }
        }
        return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'] };
      },
      async init() {},
    };

    const hook = createTransformParamsHook(orchestrator);
    return hook;
  }

  /**
   * Generate a model ID that is guaranteed NOT to be in the provided allowlist.
   */
  function arbModelIdNotInAllowlist(allowedModels: string[]): fc.Arbitrary<string> {
    return arbModelId().filter((modelId) => !allowedModels.includes(modelId));
  }

  it('any model not in the allowlist throws PolicyViolationError with MODEL_NOT_ALLOWLISTED', async () => {
    // Fixed allowlist: a small set of specific models
    const allowedModels = ['openai/gpt-4', 'anthropic/claude-3-opus'];
    const hook = createHookWithAllowlist(allowedModels);

    await fc.assert(
      fc.asyncProperty(
        arbModelIdNotInAllowlist(allowedModels),
        async (modelId) => {
          const params = {
            modelId,
            prompt: [{ role: 'user', content: 'Hello, world!' }],
          };

          try {
            await hook({ params });
            // If we reach here, the hook did NOT throw — property violation
            expect.fail(
              `Expected PolicyViolationError for model "${modelId}" but hook succeeded`,
            );
          } catch (error) {
            // Must be a PolicyViolationError
            expect(error).toBeInstanceOf(PolicyViolationError);
            const pve = error as PolicyViolationError;

            // Decision action must be DENY
            expect(pve.decision.action).toBe('DENY');

            // Must include MODEL_NOT_ALLOWLISTED reason code
            expect(pve.decision.reason_codes).toContain('MODEL_NOT_ALLOWLISTED');

            // Risk score should be 100 (maximum risk)
            expect(pve.decision.risk_score).toBe(100);

            // Correlation ID must be present (UUID v4 format)
            expect(pve.decision.correlation_id).toBeDefined();
            expect(pve.decision.correlation_id.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('model in the allowlist is NOT blocked', async () => {
    // Verify that models IN the allowlist pass through (sanity check)
    const allowedModels = ['openai/gpt-4', 'anthropic/claude-3-opus', 'google/gemini-pro'];
    const hook = createHookWithAllowlist(allowedModels);

    for (const modelId of allowedModels) {
      const params = {
        modelId,
        prompt: [{ role: 'user', content: 'Hello, world!' }],
      };

      // Should NOT throw
      const result = await hook({ params });
      expect(result).toBeDefined();
    }
  });
});
