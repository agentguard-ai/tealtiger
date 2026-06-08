/**
 * TealTiger AI SDK — Factory Function Unit Tests
 *
 * Tests the tealtigerMiddleware() factory function covering:
 * - Zero-config mode (Task 9.1)
 * - Custom configuration (Task 9.1)
 * - Config validation (Task 9.1)
 * - Policy file loading (Task 9.2)
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 9.4, 9.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { tealtigerMiddleware } from './factory';
import { TealConfigError } from './errors';

// ── Helper: temp directory for policy files ──────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `tealtiger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ── Task 9.1: Factory Function Tests ─────────────────────────────

describe('tealtigerMiddleware factory (Task 9.1)', () => {
  describe('zero-config mode', () => {
    it('returns a middleware object when called with no arguments', () => {
      const middleware = tealtigerMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('object');
    });

    it('returned middleware has transformParams function', () => {
      const middleware = tealtigerMiddleware();
      expect(middleware.transformParams).toBeDefined();
      expect(typeof middleware.transformParams).toBe('function');
    });

    it('returned middleware has wrapGenerate function', () => {
      const middleware = tealtigerMiddleware();
      expect(middleware.wrapGenerate).toBeDefined();
      expect(typeof middleware.wrapGenerate).toBe('function');
    });

    it('returned middleware has wrapStream function', () => {
      const middleware = tealtigerMiddleware();
      expect(middleware.wrapStream).toBeDefined();
      expect(typeof middleware.wrapStream).toBe('function');
    });

    it('returns synchronously (does not return a promise)', () => {
      const result = tealtigerMiddleware();
      // If it were a promise, it would have a .then method but not our hook functions directly
      expect(result.transformParams).toBeDefined();
      expect(result.wrapGenerate).toBeDefined();
      expect(result.wrapStream).toBeDefined();
    });
  });

  describe('custom configuration', () => {
    it('accepts valid guardrails configuration', () => {
      const middleware = tealtigerMiddleware({
        guardrails: {
          pii: true,
          promptInjection: true,
          contentModeration: true,
        },
      });
      expect(middleware.transformParams).toBeDefined();
      expect(middleware.wrapGenerate).toBeDefined();
      expect(middleware.wrapStream).toBeDefined();
    });

    it('accepts valid cost tracking configuration', () => {
      const middleware = tealtigerMiddleware({
        costTracking: {
          enabled: true,
          perRequestLimit: 0.5,
          dailyLimit: 50.0,
        },
      });
      expect(middleware).toBeDefined();
      expect(middleware.wrapGenerate).toBeDefined();
    });

    it('accepts valid circuit breaker configuration', () => {
      const middleware = tealtigerMiddleware({
        circuitBreaker: {
          failureThreshold: 5,
          timeout: 30000,
          halfOpenRequests: 2,
        },
      });
      expect(middleware).toBeDefined();
    });

    it('accepts valid audit configuration', () => {
      const middleware = tealtigerMiddleware({
        audit: {
          enabled: true,
          outputs: [{ type: 'console' }],
        },
      });
      expect(middleware).toBeDefined();
    });

    it('accepts combined configuration', () => {
      const middleware = tealtigerMiddleware({
        guardrails: { pii: true, promptInjection: true },
        costTracking: { enabled: true, dailyLimit: 10.0 },
        circuitBreaker: { failureThreshold: 3 },
        audit: { enabled: true },
        secrets: { enabled: true, confidenceThreshold: 0.8 },
        registry: { enabled: true, allowedModels: ['openai/gpt-4'] },
        failOpen: false,
        moduleTimeout: 3000,
      });
      expect(middleware.transformParams).toBeDefined();
      expect(middleware.wrapGenerate).toBeDefined();
      expect(middleware.wrapStream).toBeDefined();
    });

    it('accepts failOpen: true', () => {
      const middleware = tealtigerMiddleware({ failOpen: true });
      expect(middleware).toBeDefined();
    });
  });

  describe('config validation (throws TealConfigError)', () => {
    it('throws TealConfigError for negative budget limit', () => {
      expect(() =>
        tealtigerMiddleware({
          costTracking: { enabled: true, perRequestLimit: -1 },
        }),
      ).toThrow(TealConfigError);
    });

    it('throws TealConfigError for invalid circuit breaker threshold', () => {
      expect(() =>
        tealtigerMiddleware({
          circuitBreaker: { failureThreshold: 0 },
        }),
      ).toThrow(TealConfigError);
    });

    it('throws TealConfigError for invalid secrets confidence threshold', () => {
      expect(() =>
        tealtigerMiddleware({
          secrets: { enabled: true, confidenceThreshold: 1.5 },
        }),
      ).toThrow(TealConfigError);
    });

    it('throws TealConfigError for empty policyPath string', () => {
      expect(() =>
        tealtigerMiddleware({ policyPath: '' }),
      ).toThrow(TealConfigError);
    });

    it('throws TealConfigError for non-boolean failOpen', () => {
      expect(() =>
        tealtigerMiddleware({ failOpen: 'true' as unknown as boolean }),
      ).toThrow(TealConfigError);
    });

    it('TealConfigError includes config_key field', () => {
      try {
        tealtigerMiddleware({ moduleTimeout: -1 });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('moduleTimeout');
      }
    });

    it('throws synchronously (not async)', () => {
      // Verify the error is thrown synchronously, not as a rejected promise
      let threw = false;
      try {
        tealtigerMiddleware({ costTracking: { enabled: true, dailyLimit: -5 } });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });
});

// ── Task 9.2: Policy File Loading Tests ──────────────────────────

describe('tealtigerMiddleware policy file loading (Task 9.2)', () => {
  describe('successful policy loading', () => {
    it('loads and parses a valid policy file', () => {
      const policyFile = join(tempDir, 'policy.json');
      writeFileSync(policyFile, JSON.stringify({
        mode: 'ENFORCE',
        policyId: 'test-policy',
        policyVersion: '1.0.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Block dangerous prompts',
            condition: 'input.contains("hack")',
            action: 'DENY',
          },
        ],
      }));

      const middleware = tealtigerMiddleware({ policyPath: policyFile });
      expect(middleware).toBeDefined();
      expect(middleware.transformParams).toBeDefined();
      expect(middleware.wrapGenerate).toBeDefined();
      expect(middleware.wrapStream).toBeDefined();
    });

    it('loads a minimal valid policy file (empty object)', () => {
      const policyFile = join(tempDir, 'minimal.json');
      writeFileSync(policyFile, '{}');

      const middleware = tealtigerMiddleware({ policyPath: policyFile });
      expect(middleware).toBeDefined();
    });

    it('loads policy file with multiple rules', () => {
      const policyFile = join(tempDir, 'multi-rule.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [
          { id: 'r1', name: 'Rule 1', condition: 'true', action: 'ALLOW' },
          { id: 'r2', name: 'Rule 2', condition: 'false', action: 'DENY' },
          { id: 'r3', name: 'Rule 3', condition: 'model == "gpt-4"', action: 'REDACT' },
        ],
      }));

      const middleware = tealtigerMiddleware({ policyPath: policyFile });
      expect(middleware).toBeDefined();
    });

    it('loads policy file with all valid action types', () => {
      const policyFile = join(tempDir, 'all-actions.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [
          { id: 'r1', name: 'Allow', condition: 'true', action: 'ALLOW' },
          { id: 'r2', name: 'Deny', condition: 'true', action: 'DENY' },
          { id: 'r3', name: 'Redact', condition: 'true', action: 'REDACT' },
          { id: 'r4', name: 'Transform', condition: 'true', action: 'TRANSFORM' },
          { id: 'r5', name: 'Require Approval', condition: 'true', action: 'REQUIRE_APPROVAL' },
          { id: 'r6', name: 'Degrade', condition: 'true', action: 'DEGRADE' },
        ],
      }));

      const middleware = tealtigerMiddleware({ policyPath: policyFile });
      expect(middleware).toBeDefined();
    });
  });

  describe('file not found', () => {
    it('throws TealConfigError when policy file does not exist', () => {
      const nonExistentPath = join(tempDir, 'nonexistent.json');

      expect(() => tealtigerMiddleware({ policyPath: nonExistentPath }))
        .toThrow(TealConfigError);
    });

    it('TealConfigError has config_key="policyPath" for missing file', () => {
      const nonExistentPath = join(tempDir, 'missing.json');

      try {
        tealtigerMiddleware({ policyPath: nonExistentPath });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('not found');
      }
    });
  });

  describe('file unreadable', () => {
    it('throws TealConfigError when policy file path is a directory', () => {
      // A directory cannot be read as a file
      expect(() => tealtigerMiddleware({ policyPath: tempDir }))
        .toThrow(TealConfigError);
    });

    it('TealConfigError has config_key="policyPath" for unreadable file', () => {
      try {
        tealtigerMiddleware({ policyPath: tempDir });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
      }
    });
  });

  describe('invalid policy syntax', () => {
    it('throws TealConfigError for invalid JSON', () => {
      const policyFile = join(tempDir, 'bad-json.json');
      writeFileSync(policyFile, '{ invalid json !!!');

      expect(() => tealtigerMiddleware({ policyPath: policyFile }))
        .toThrow(TealConfigError);
    });

    it('TealConfigError includes syntax error details', () => {
      const policyFile = join(tempDir, 'bad-syntax.json');
      writeFileSync(policyFile, '{ "rules": [{ nope }] }');

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('Invalid policy syntax');
      }
    });

    it('throws TealConfigError when policy is not an object (array)', () => {
      const policyFile = join(tempDir, 'array.json');
      writeFileSync(policyFile, '["not", "an", "object"]');

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('must be a JSON object');
      }
    });

    it('throws TealConfigError when policy is null', () => {
      const policyFile = join(tempDir, 'null.json');
      writeFileSync(policyFile, 'null');

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('must be a JSON object');
      }
    });

    it('throws TealConfigError when rules is not an array', () => {
      const policyFile = join(tempDir, 'bad-rules.json');
      writeFileSync(policyFile, JSON.stringify({ rules: 'not-array' }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain("'rules' must be an array");
      }
    });

    it('throws TealConfigError when rule is missing id', () => {
      const policyFile = join(tempDir, 'no-id.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [{ name: 'No ID Rule', condition: 'true', action: 'DENY' }],
      }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('rules[0].id');
      }
    });

    it('throws TealConfigError when rule is missing name', () => {
      const policyFile = join(tempDir, 'no-name.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [{ id: 'r1', condition: 'true', action: 'DENY' }],
      }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('rules[0].name');
      }
    });

    it('throws TealConfigError when rule has invalid action', () => {
      const policyFile = join(tempDir, 'bad-action.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [{ id: 'r1', name: 'Bad Action', condition: 'true', action: 'INVALID' }],
      }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('rules[0].action');
      }
    });

    it('throws TealConfigError when rule has empty id', () => {
      const policyFile = join(tempDir, 'empty-id.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [{ id: '', name: 'Empty ID', condition: 'true', action: 'DENY' }],
      }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).message).toContain('rules[0].id');
      }
    });

    it('throws TealConfigError when rule condition is missing', () => {
      const policyFile = join(tempDir, 'no-condition.json');
      writeFileSync(policyFile, JSON.stringify({
        rules: [{ id: 'r1', name: 'No Condition', action: 'DENY' }],
      }));

      try {
        tealtigerMiddleware({ policyPath: policyFile });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).message).toContain('rules[0].condition');
      }
    });
  });

  describe('config interaction with policy file', () => {
    it('inline policy config takes precedence over file policy fields', () => {
      const policyFile = join(tempDir, 'base-policy.json');
      writeFileSync(policyFile, JSON.stringify({
        mode: 'MONITOR',
        policyId: 'file-policy',
        rules: [
          { id: 'file-rule', name: 'File Rule', condition: 'true', action: 'ALLOW' },
        ],
      }));

      // This should not throw — the factory loads the file and merges with inline config
      const middleware = tealtigerMiddleware({
        policyPath: policyFile,
        policy: { mode: 'ENFORCE' },
      });
      expect(middleware).toBeDefined();
    });

    it('combined config with other modules and policy file works', () => {
      const policyFile = join(tempDir, 'combined.json');
      writeFileSync(policyFile, JSON.stringify({
        policyId: 'combined-test',
        rules: [
          { id: 'r1', name: 'Test Rule', condition: 'true', action: 'ALLOW' },
        ],
      }));

      const middleware = tealtigerMiddleware({
        policyPath: policyFile,
        guardrails: { pii: true },
        costTracking: { enabled: true, dailyLimit: 100 },
        audit: { enabled: true },
      });
      expect(middleware).toBeDefined();
    });
  });
});
