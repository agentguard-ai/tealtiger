/**
 * Property 12: Fail-closed produces complete failure metadata
 *
 * For any governance module failure with fail-closed mode active, the resulting
 * DENY Decision SHALL have risk_score of 100, a GOVERNANCE_MODULE_FAILURE reason
 * code, metadata listing all failed modules with name and error description, and
 * SHALL preserve the results of all successfully-evaluated modules in the metadata.
 *
 * Feature: vercel-ai-sdk-integration, Property 12: Fail-closed produces complete failure metadata
 *
 * **Validates: Requirements 8.1, 8.4, 8.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';

/**
 * Arbitrary for module names.
 */
function arbModuleName(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'TealGuard',
    'TealSecrets',
    'TealRegistry',
    'TealEngineV12',
    'CostTracker',
    'TealAudit',
  );
}

/**
 * Arbitrary for error messages.
 */
function arbErrorMessage(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constant('Connection timeout'),
    fc.constant('Module initialization failed'),
    fc.constant('Unexpected null reference'),
    fc.constant('Rate limit exceeded'),
    fc.constant('Service unavailable'),
    fc.string({ minLength: 5, maxLength: 50, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')) }),
  );
}

/**
 * Arbitrary for previous module results (successfully evaluated).
 */
function arbPreviousResults(): fc.Arbitrary<Array<{ module: string; action: string; risk_score: number }>> {
  return fc.array(
    fc.record({
      module: arbModuleName(),
      action: fc.constantFrom('ALLOW', 'REDACT'),
      risk_score: fc.integer({ min: 0, max: 50 }),
    }),
    { minLength: 0, maxLength: 3 },
  );
}

describe('Feature: vercel-ai-sdk-integration, Property 12: Fail-closed produces complete failure metadata', () => {
  it('fail-closed decision has risk_score 100 and GOVERNANCE_MODULE_FAILURE reason code', () => {
    fc.assert(
      fc.property(
        arbModuleName(),
        arbErrorMessage(),
        fc.integer({ min: 1, max: 5000 }),
        fc.uuid(),
        (moduleName, errorMessage, evaluationTimeMs, correlationId) => {
          const orchestrator = new GovernanceOrchestrator({
            failOpen: false,
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
          });

          const error = new Error(errorMessage);
          const decision = orchestrator.createFailClosedDecision(
            moduleName,
            error,
            evaluationTimeMs,
            correlationId,
          );

          // PROPERTY: risk_score MUST be 100
          expect(decision.risk_score).toBe(100);

          // PROPERTY: action MUST be DENY
          expect(decision.action).toBe('DENY');

          // PROPERTY: reason_codes MUST contain GOVERNANCE_MODULE_FAILURE
          expect(decision.reason_codes).toContain('GOVERNANCE_MODULE_FAILURE');

          // PROPERTY: correlation_id MUST match the provided one
          expect(decision.correlation_id).toBe(correlationId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fail-closed decision metadata lists failed modules with name and error description', () => {
    fc.assert(
      fc.property(
        arbModuleName(),
        arbErrorMessage(),
        fc.integer({ min: 1, max: 5000 }),
        fc.uuid(),
        (moduleName, errorMessage, evaluationTimeMs, correlationId) => {
          const orchestrator = new GovernanceOrchestrator({
            failOpen: false,
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
          });

          const error = new Error(errorMessage);
          const decision = orchestrator.createFailClosedDecision(
            moduleName,
            error,
            evaluationTimeMs,
            correlationId,
          );

          // PROPERTY: metadata MUST exist
          expect(decision.metadata).toBeDefined();

          const metadata = decision.metadata!;

          // PROPERTY: metadata.failed_modules MUST be an array with the failed module
          const failedModules = metadata.failed_modules as Array<{ name: string; error: string }>;
          expect(failedModules).toBeDefined();
          expect(Array.isArray(failedModules)).toBe(true);
          expect(failedModules.length).toBeGreaterThan(0);

          // PROPERTY: failed module entry MUST contain name and error description
          const failedModule = failedModules[0];
          expect(failedModule.name).toBe(moduleName);
          expect(failedModule.error).toBe(errorMessage);

          // PROPERTY: metadata MUST include total_evaluation_time_ms
          expect(metadata.total_evaluation_time_ms).toBe(evaluationTimeMs);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fail-closed decision preserves successful module results in metadata', () => {
    fc.assert(
      fc.property(
        arbModuleName(),
        arbErrorMessage(),
        fc.integer({ min: 1, max: 5000 }),
        fc.uuid(),
        arbPreviousResults(),
        (moduleName, errorMessage, evaluationTimeMs, correlationId, previousResults) => {
          const orchestrator = new GovernanceOrchestrator({
            failOpen: false,
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
          });

          const error = new Error(errorMessage);
          const decision = orchestrator.createFailClosedDecision(
            moduleName,
            error,
            evaluationTimeMs,
            correlationId,
            previousResults,
          );

          // PROPERTY: metadata MUST exist
          expect(decision.metadata).toBeDefined();
          const metadata = decision.metadata!;

          // PROPERTY: If previousResults were provided, they MUST be preserved in metadata
          if (previousResults.length > 0) {
            expect(metadata.previous_results).toBeDefined();
            const preserved = metadata.previous_results as unknown[];
            expect(preserved.length).toBe(previousResults.length);

            // Each preserved result matches the original
            for (let i = 0; i < previousResults.length; i++) {
              const original = previousResults[i];
              const saved = preserved[i] as { module: string; action: string; risk_score: number };
              expect(saved.module).toBe(original.module);
              expect(saved.action).toBe(original.action);
              expect(saved.risk_score).toBe(original.risk_score);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
