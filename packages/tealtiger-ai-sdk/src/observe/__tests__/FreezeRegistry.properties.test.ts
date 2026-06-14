import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FreezeRegistry } from '../FreezeRegistry';

const agentId = fc.string({ minLength: 1 }).filter((id) => id !== '*');

describe('FreezeRegistry properties', () => {
  it('freezing the same id repeatedly is equivalent to freezing once', () => {
    // Property 1: Idempotence
    fc.assert(
      fc.property(agentId, fc.integer({ min: 1, max: 50 }), (id, count) => {
        const once = new FreezeRegistry();
        const repeated = new FreezeRegistry();

        once.freeze(id);
        for (let i = 0; i < count; i += 1) {
          repeated.freeze(id);
        }

        expect(repeated.isFrozen(id)).toBe(once.isFrozen(id));
      }),
      { numRuns: 100 },
    );
  });

  it('freezing and unfreezing an id clears its frozen state', () => {
    // Property 2: Round-trip
    fc.assert(
      fc.property(agentId, (id) => {
        const registry = new FreezeRegistry();

        registry.freeze(id);
        registry.unfreeze(id);

        expect(registry.isFrozen(id)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('freezing the wildcard freezes any agent id', () => {
    // Property 3: Wildcard
    fc.assert(
      fc.property(agentId, (id) => {
        const registry = new FreezeRegistry();

        registry.freeze('*');

        expect(registry.isFrozen(id)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('unfreezing a non-frozen id is a no-op', () => {
    // Property 4: No-op unfreeze
    fc.assert(
      fc.property(agentId, (id) => {
        const registry = new FreezeRegistry();

        expect(() => registry.unfreeze(id)).not.toThrow();
        expect(registry.isFrozen(id)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('freezing one concrete id does not freeze another concrete id', () => {
    // Property 5: Independence
    fc.assert(
      fc.property(agentId, agentId, (first, second) => {
        fc.pre(first !== second);
        const registry = new FreezeRegistry();

        registry.freeze(first);

        expect(registry.isFrozen(first)).toBe(true);
        expect(registry.isFrozen(second)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
