/**
 * Property 14: Configuration serialization round-trip
 *
 * For any valid TealTigerMiddlewareConfig object, serializing to JSON
 * (JSON.stringify) and deserializing (JSON.parse) then creating a middleware
 * from the deserialized config SHALL produce a middleware that validates
 * successfully (same as the original). Additionally, the deserialized config
 * should be deeply equal to the original.
 *
 * **Validates: Requirements 9.6**
 *
 * @tags Feature: vercel-ai-sdk-integration, Property 14: Configuration serialization round-trip
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbValidConfig } from '../helpers/arbitraries';
import { validateConfig } from '../../config/validator';
import { tealtigerMiddleware } from '../../factory';

describe('Feature: vercel-ai-sdk-integration, Property 14: Configuration serialization round-trip', () => {
  it('serialized and deserialized config is deeply equal to the original', () => {
    fc.assert(
      fc.property(arbValidConfig(), (config) => {
        // Step 1: Serialize to JSON
        const serialized = JSON.stringify(config);

        // Step 2: Deserialize from JSON
        const deserialized = JSON.parse(serialized);

        // Step 3: Verify deep equality — deserialized config matches original
        expect(deserialized).toEqual(config);
      }),
      { numRuns: 100 },
    );
  });

  it('deserialized config passes validation without throwing', () => {
    fc.assert(
      fc.property(arbValidConfig(), (config) => {
        // Serialize and deserialize
        const serialized = JSON.stringify(config);
        const deserialized = JSON.parse(serialized);

        // Validate the deserialized config — should not throw
        expect(() => validateConfig(deserialized)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it('factory accepts deserialized config without throwing', () => {
    fc.assert(
      fc.property(arbValidConfig(), (config) => {
        // Serialize and deserialize
        const serialized = JSON.stringify(config);
        const deserialized = JSON.parse(serialized);

        // Factory should accept the deserialized config without throwing
        expect(() => tealtigerMiddleware(deserialized)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it('middleware from deserialized config has the same hook structure as original', () => {
    fc.assert(
      fc.property(arbValidConfig(), (config) => {
        // Create middleware from original config
        const originalMiddleware = tealtigerMiddleware(config);

        // Serialize and deserialize
        const serialized = JSON.stringify(config);
        const deserialized = JSON.parse(serialized);

        // Create middleware from deserialized config
        const deserializedMiddleware = tealtigerMiddleware(deserialized);

        // Both should have the same hook structure
        expect(typeof originalMiddleware.transformParams).toBe(typeof deserializedMiddleware.transformParams);
        expect(typeof originalMiddleware.wrapGenerate).toBe(typeof deserializedMiddleware.wrapGenerate);
        expect(typeof originalMiddleware.wrapStream).toBe(typeof deserializedMiddleware.wrapStream);
      }),
      { numRuns: 100 },
    );
  });
});
