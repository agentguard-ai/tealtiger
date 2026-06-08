/**
 * Property 2: Invalid configuration always throws TealConfigError with field path
 *
 * For any TealTigerMiddlewareConfig object that violates a validation constraint
 * (negative budget, invalid threshold range, malformed policy), the factory function
 * SHALL throw a TealConfigError with a non-empty config_key field identifying the
 * invalid path and a descriptive message.
 *
 * **Validates: Requirements 1.4, 9.1, 9.3**
 *
 * Feature: vercel-ai-sdk-integration, Property 2: Invalid configuration always throws TealConfigError with field path
 *
 * @module __tests__/properties/property-02-invalid-config
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbInvalidConfig } from '../helpers/arbitraries';
import { validateConfig } from '../../config/validator';
import { TealConfigError } from '../../errors';

describe('Feature: vercel-ai-sdk-integration, Property 2: Invalid configuration always throws TealConfigError with field path', () => {
  it('validateConfig throws TealConfigError with non-empty config_key for any invalid config', () => {
    fc.assert(
      fc.property(arbInvalidConfig(), ({ config, invalidField }) => {
        // Act & Assert: validateConfig must throw for invalid configs
        let thrownError: unknown;
        try {
          validateConfig(config as any);
          // If we reach here, the validator did not throw — property violated
          throw new Error(
            `Expected TealConfigError for invalid field "${invalidField}" but validateConfig did not throw`,
          );
        } catch (error) {
          thrownError = error;
        }

        // The thrown error must be an instance of TealConfigError
        expect(thrownError).toBeInstanceOf(TealConfigError);

        const configError = thrownError as TealConfigError;

        // config_key must be non-empty
        expect(configError.config_key).toBeTruthy();
        expect(configError.config_key.length).toBeGreaterThan(0);

        // config_key must match the expected invalid field path
        expect(configError.config_key).toBe(invalidField);

        // message must be non-empty and descriptive
        expect(configError.message).toBeTruthy();
        expect(configError.message.length).toBeGreaterThan(0);

        // error name should be TealConfigError
        expect(configError.name).toBe('TealConfigError');
      }),
      { numRuns: 100 },
    );
  });
});
