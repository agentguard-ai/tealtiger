/**
 * Property 13: Fail-open allows requests on governance failure
 *
 * For any governance failure with failOpen: true configured, the middleware
 * SHALL allow the request to proceed to the model and SHALL record the failure
 * in a structured ERROR-level log entry containing correlation_id, failed module
 * name, and error description.
 *
 * Feature: vercel-ai-sdk-integration, Property 13: Fail-open allows requests on governance failure
 *
 * **Validates: Requirements 8.3**
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbSafeContent } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import type { ITealGuard } from '../../core/GovernanceOrchestrator';
import { createTransformParamsHook } from '../../hooks/transformParams';
import { PolicyViolationError } from '../../errors';

/**
 * Arbitrary for module error messages.
 */
function arbErrorMessage(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constant('Connection timeout'),
    fc.constant('Module initialization failed'),
    fc.constant('Service unavailable'),
    fc.constant('Rate limit exceeded'),
    fc.constant('Network error'),
  );
}

describe('Feature: vercel-ai-sdk-integration, Property 13: Fail-open allows requests on governance failure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fail-open mode allows request to proceed when guard module throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbSafeContent(),
        arbErrorMessage(),
        async (modelId, content, errorMessage) => {
          // Spy on console.error to capture fail-open log
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          const orchestrator = new GovernanceOrchestrator({
            failOpen: true,
            guardrails: { pii: true, promptInjection: true, contentModeration: true },
          });

          // Mock guard that always throws (simulating module failure)
          const throwingGuard: ITealGuard = {
            async check(_input: string, _context?: unknown): Promise<never> {
              throw new Error(errorMessage);
            },
          };

          const o = orchestrator as unknown as {
            initialized: boolean;
            guard: ITealGuard | null;
          };
          o.initialized = true;
          o.guard = throwingGuard;

          const transformParams = createTransformParamsHook(orchestrator);

          const params = {
            modelId,
            prompt: [{ role: 'user', content }],
          };

          // PROPERTY: Request MUST proceed (no PolicyViolationError thrown)
          let threwPolicyError = false;
          try {
            const result = await transformParams({ params });
            // PROPERTY: result should be defined (request allowed)
            expect(result).toBeDefined();
          } catch (error) {
            if (error instanceof PolicyViolationError) {
              threwPolicyError = true;
            }
          }
          expect(threwPolicyError).toBe(false);

          // PROPERTY: Error MUST be logged at ERROR level with correlation_id, module name, error
          expect(consoleErrorSpy).toHaveBeenCalled();
          const logMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
          expect(logMessage).toBeDefined();

          // Log must contain correlation_id
          expect(logMessage).toContain('correlation_id=');

          // Log must contain module name
          expect(logMessage).toContain('module=');

          // Log must contain error description
          expect(logMessage).toContain(errorMessage);

          consoleErrorSpy.mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fail-open mode logs ERROR with correct structured format', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbErrorMessage(),
        async (errorMessage) => {
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          const orchestrator = new GovernanceOrchestrator({
            failOpen: true,
            guardrails: { pii: true, promptInjection: true, contentModeration: true },
          });

          // Mock guard that throws
          const throwingGuard: ITealGuard = {
            async check(_input: string, _context?: unknown): Promise<never> {
              throw new Error(errorMessage);
            },
          };

          const o = orchestrator as unknown as {
            initialized: boolean;
            guard: ITealGuard | null;
          };
          o.initialized = true;
          o.guard = throwingGuard;

          const transformParams = createTransformParamsHook(orchestrator);

          const params = {
            modelId: 'openai/gpt-4',
            prompt: [{ role: 'user', content: 'test' }],
          };

          await transformParams({ params });

          // PROPERTY: structured log entry must contain all required fields
          expect(consoleErrorSpy).toHaveBeenCalled();
          const logMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;

          // Must be a structured log line with [TealTiger] prefix
          expect(logMessage).toContain('[TealTiger]');
          // Must contain fail-open indicator
          expect(logMessage).toContain('fail-open');

          consoleErrorSpy.mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });
});
