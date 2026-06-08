/**
 * Property 1: Valid configuration always produces a well-formed middleware
 *
 * For any valid TealTigerMiddlewareConfig object (including undefined/no-args),
 * the factory function SHALL return an object containing `wrapGenerate`,
 * `wrapStream`, and `transformParams` functions without throwing.
 *
 * Feature: vercel-ai-sdk-integration, Property 1: Valid configuration always produces a well-formed middleware
 *
 * **Validates: Requirements 1.1, 1.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbValidConfig } from '../helpers/arbitraries';
import tealtigerMiddleware from '../../index';

describe('Feature: vercel-ai-sdk-integration, Property 1: Valid configuration always produces a well-formed middleware', () => {
  it('zero-config (undefined) produces a well-formed middleware object', () => {
    const middleware = tealtigerMiddleware();

    expect(middleware).toBeDefined();
    expect(typeof middleware.transformParams).toBe('function');
    expect(typeof middleware.wrapGenerate).toBe('function');
    expect(typeof middleware.wrapStream).toBe('function');
  });

  it('any valid config produces a well-formed middleware without throwing', () => {
    fc.assert(
      fc.property(arbValidConfig(), (config) => {
        // The factory must not throw for any valid config
        const middleware = tealtigerMiddleware(config);

        // Must return a defined object
        expect(middleware).toBeDefined();
        expect(middleware).not.toBeNull();

        // Must contain transformParams as a function
        expect(typeof middleware.transformParams).toBe('function');

        // Must contain wrapGenerate as a function
        expect(typeof middleware.wrapGenerate).toBe('function');

        // Must contain wrapStream as a function
        expect(typeof middleware.wrapStream).toBe('function');
      }),
      { numRuns: 100 },
    );
  });

  it('empty object config {} produces a well-formed middleware', () => {
    const middleware = tealtigerMiddleware({});

    expect(middleware).toBeDefined();
    expect(typeof middleware.transformParams).toBe('function');
    expect(typeof middleware.wrapGenerate).toBe('function');
    expect(typeof middleware.wrapStream).toBe('function');
  });
});
