/**
 * Property 10: Provider extraction and independent circuit state
 *
 * For any model identifier in the format "provider/model-name", the middleware
 * correctly extracts the provider prefix. Distinct providers have independent
 * circuit state — failures on one provider do not affect the other.
 *
 * Feature: vercel-ai-sdk-integration, Property 10: Provider extraction and independent circuit state
 *
 * **Validates: Requirements 5.7**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbProvider } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';

describe('Feature: vercel-ai-sdk-integration, Property 10: Provider extraction and independent circuit state', () => {
  it('extractProvider correctly extracts provider prefix from "provider/model-name" format', () => {
    fc.assert(
      fc.property(
        arbModelId(),
        (modelId) => {
          const provider = GovernanceOrchestrator.extractProvider(modelId);

          // PROPERTY: Provider must be the substring before the first '/'
          const expectedProvider = modelId.substring(0, modelId.indexOf('/'));
          expect(provider).toBe(expectedProvider);

          // PROPERTY: Provider must be non-empty for valid model IDs
          expect(provider.length).toBeGreaterThan(0);

          // PROPERTY: Provider must NOT contain '/'
          expect(provider).not.toContain('/');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('model IDs without "/" return "unknown" as provider', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')) })
          .filter((s) => !s.includes('/')),
        (modelId) => {
          const provider = GovernanceOrchestrator.extractProvider(modelId);
          expect(provider).toBe('unknown');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('distinct providers have independent circuit breaker state', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbProvider(), arbProvider()).filter(([a, b]) => a !== b),
        fc.integer({ min: 1, max: 10 }),
        ([providerA, providerB], failureCount) => {
          const orchestrator = new GovernanceOrchestrator({
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
            circuitBreaker: { failureThreshold: 5, timeout: 60000, halfOpenRequests: 3 },
          });

          // Bypass initialization since we only test circuit breaker logic
          const o = orchestrator as unknown as { initialized: boolean };
          o.initialized = true;

          // Report failures only for providerA
          const effectiveFailures = Math.min(failureCount, 4); // Stay below threshold
          for (let i = 0; i < effectiveFailures; i++) {
            orchestrator.reportOutcome(providerA, false);
          }

          // PROPERTY: providerB circuit should still be CLOSED (unaffected)
          const decisionB = orchestrator.checkCircuit(providerB);
          expect(decisionB.action).toBe('ALLOW');

          // PROPERTY: providerA circuit should also still be CLOSED (below threshold)
          const decisionA = orchestrator.checkCircuit(providerA);
          expect(decisionA.action).toBe('ALLOW');

          // Now push providerA over the threshold
          for (let i = effectiveFailures; i < 5; i++) {
            orchestrator.reportOutcome(providerA, false);
          }

          // PROPERTY: providerA should now be OPEN (throws CircuitOpenError)
          let providerAOpen = false;
          try {
            orchestrator.checkCircuit(providerA);
          } catch {
            providerAOpen = true;
          }
          expect(providerAOpen).toBe(true);

          // PROPERTY: providerB should STILL be CLOSED (independent state)
          const decisionB2 = orchestrator.checkCircuit(providerB);
          expect(decisionB2.action).toBe('ALLOW');
        },
      ),
      { numRuns: 100 },
    );
  });
});
