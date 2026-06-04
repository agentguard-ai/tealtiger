/**
 * TealTiger AI SDK — Build Verification Tests
 *
 * Verifies the package build output and npm package structure:
 * - Dual ESM+CJS build produces expected files
 * - Default export is a function (CJS require)
 * - Package.json has correct peer dependencies
 * - Package.json has correct exports map
 * - TypeScript declarations are generated
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.6
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageRoot = resolve(__dirname, '../../..');
const distDir = join(packageRoot, 'dist');
const packageJsonPath = join(packageRoot, 'package.json');

describe('Build Verification (Task 10.2)', () => {
  beforeAll(() => {
    // Run the build
    execSync('npx tsup', {
      cwd: packageRoot,
      stdio: 'pipe',
      timeout: 60_000,
    });
  }, 90_000);

  describe('built output file existence', () => {
    it('dist/index.mjs exists (ESM output)', () => {
      expect(existsSync(join(distDir, 'index.mjs'))).toBe(true);
    });

    it('dist/index.js exists (CJS output)', () => {
      expect(existsSync(join(distDir, 'index.js'))).toBe(true);
    });

    it('dist/index.d.mts exists (ESM type declarations)', () => {
      expect(existsSync(join(distDir, 'index.d.mts'))).toBe(true);
    });

    it('dist/index.d.ts exists (CJS type declarations)', () => {
      expect(existsSync(join(distDir, 'index.d.ts'))).toBe(true);
    });
  });

  describe('CJS default export verification', () => {
    it('default export from CJS bundle is a function', () => {
      // Use require to load the CJS output and verify default export
      const cjsPath = join(distDir, 'index.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cjsModule = require(cjsPath);

      // The default export should be available either as module.default or directly
      const defaultExport = cjsModule.default ?? cjsModule.tealtigerMiddleware;
      expect(typeof defaultExport).toBe('function');
    });

    it('named export tealtigerMiddleware is a function', () => {
      const cjsPath = join(distDir, 'index.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cjsModule = require(cjsPath);

      expect(typeof cjsModule.tealtigerMiddleware).toBe('function');
    });

    it('error classes are exported from CJS bundle', () => {
      const cjsPath = join(distDir, 'index.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cjsModule = require(cjsPath);

      expect(cjsModule.PolicyViolationError).toBeDefined();
      expect(cjsModule.GuardrailViolationError).toBeDefined();
      expect(cjsModule.CircuitOpenError).toBeDefined();
      expect(cjsModule.BudgetExceededError).toBeDefined();
      expect(cjsModule.TealRuntimeError).toBeDefined();
      expect(cjsModule.TealConfigError).toBeDefined();
    });
  });

  describe('package.json peer dependencies', () => {
    let packageJson: Record<string, unknown>;

    beforeAll(() => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    });

    it('declares "ai" as a peer dependency', () => {
      const peerDeps = packageJson.peerDependencies as Record<string, string>;
      expect(peerDeps).toBeDefined();
      expect(peerDeps.ai).toBeDefined();
      expect(typeof peerDeps.ai).toBe('string');
    });

    it('declares "tealtiger-sdk" as a peer dependency', () => {
      const peerDeps = packageJson.peerDependencies as Record<string, string>;
      expect(peerDeps).toBeDefined();
      expect(peerDeps['tealtiger-sdk']).toBeDefined();
      expect(typeof peerDeps['tealtiger-sdk']).toBe('string');
    });

    it('"ai" peer dependency uses semver range (not bundled)', () => {
      const peerDeps = packageJson.peerDependencies as Record<string, string>;
      // Should be a semver range like ">=3.0.0" or "^3.0.0"
      expect(peerDeps.ai).toMatch(/^[\^~>=<*]/);
    });

    it('"tealtiger-sdk" peer dependency uses semver range', () => {
      const peerDeps = packageJson.peerDependencies as Record<string, string>;
      expect(peerDeps['tealtiger-sdk']).toMatch(/^[\^~>=<*]/);
    });

    it('does not include "ai" in bundled dependencies', () => {
      const deps = packageJson.dependencies as Record<string, string> | undefined;
      if (deps) {
        expect(deps.ai).toBeUndefined();
      }
    });

    it('does not include "tealtiger-sdk" in bundled dependencies', () => {
      const deps = packageJson.dependencies as Record<string, string> | undefined;
      if (deps) {
        expect(deps['tealtiger-sdk']).toBeUndefined();
      }
    });
  });

  describe('package.json exports map', () => {
    let packageJson: Record<string, unknown>;

    beforeAll(() => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    });

    it('has an exports field', () => {
      expect(packageJson.exports).toBeDefined();
    });

    it('exports "." entry point', () => {
      const exports = packageJson.exports as Record<string, unknown>;
      expect(exports['.']).toBeDefined();
    });

    it('exports "." has import condition with types and default', () => {
      const exports = packageJson.exports as Record<string, unknown>;
      const main = exports['.'] as Record<string, unknown>;
      const importCondition = main.import as Record<string, string>;

      expect(importCondition).toBeDefined();
      expect(importCondition.types).toBeDefined();
      expect(importCondition.default).toBeDefined();
      // Types should point to .d.mts file
      expect(importCondition.types).toMatch(/\.d\.mts$/);
      // Default should point to .mjs file
      expect(importCondition.default).toMatch(/\.mjs$/);
    });

    it('exports "." has require condition with types and default', () => {
      const exports = packageJson.exports as Record<string, unknown>;
      const main = exports['.'] as Record<string, unknown>;
      const requireCondition = main.require as Record<string, string>;

      expect(requireCondition).toBeDefined();
      expect(requireCondition.types).toBeDefined();
      expect(requireCondition.default).toBeDefined();
      // Types should point to .d.ts file
      expect(requireCondition.types).toMatch(/\.d\.ts$/);
      // Default should point to .js file
      expect(requireCondition.default).toMatch(/\.js$/);
    });

    it('exports map files actually exist on disk after build', () => {
      const exports = packageJson.exports as Record<string, unknown>;
      const main = exports['.'] as Record<string, unknown>;
      const importCondition = main.import as Record<string, string>;
      const requireCondition = main.require as Record<string, string>;

      // Resolve paths relative to package root
      const importTypesPath = join(packageRoot, importCondition.types);
      const importDefaultPath = join(packageRoot, importCondition.default);
      const requireTypesPath = join(packageRoot, requireCondition.types);
      const requireDefaultPath = join(packageRoot, requireCondition.default);

      expect(existsSync(importTypesPath)).toBe(true);
      expect(existsSync(importDefaultPath)).toBe(true);
      expect(existsSync(requireTypesPath)).toBe(true);
      expect(existsSync(requireDefaultPath)).toBe(true);
    });
  });

  describe('TypeScript declaration content verification', () => {
    it('CJS declarations export tealtigerMiddleware function', () => {
      const dtsPath = join(distDir, 'index.d.ts');
      const content = readFileSync(dtsPath, 'utf-8');

      // Should declare the default export or named export
      expect(
        content.includes('tealtigerMiddleware') || content.includes('export default'),
      ).toBe(true);
    });

    it('ESM declarations export tealtigerMiddleware function', () => {
      const dtsPath = join(distDir, 'index.d.mts');
      const content = readFileSync(dtsPath, 'utf-8');

      expect(
        content.includes('tealtigerMiddleware') || content.includes('export default'),
      ).toBe(true);
    });

    it('declarations include TealTigerMiddlewareConfig type', () => {
      const dtsPath = join(distDir, 'index.d.ts');
      const content = readFileSync(dtsPath, 'utf-8');

      expect(content.includes('TealTigerMiddlewareConfig')).toBe(true);
    });

    it('declarations include error class exports', () => {
      const dtsPath = join(distDir, 'index.d.ts');
      const content = readFileSync(dtsPath, 'utf-8');

      expect(content.includes('PolicyViolationError')).toBe(true);
      expect(content.includes('GuardrailViolationError')).toBe(true);
      expect(content.includes('CircuitOpenError')).toBe(true);
      expect(content.includes('BudgetExceededError')).toBe(true);
    });
  });

  describe('dual format build target', () => {
    it('CJS output is valid JavaScript', () => {
      const cjsPath = join(distDir, 'index.js');
      const content = readFileSync(cjsPath, 'utf-8');

      // CJS files should have module.exports or exports patterns
      // tsup generates CJS with various patterns
      expect(content.length).toBeGreaterThan(0);
      // Should not have import/export statements (those are ESM)
      // Instead should have require() or module.exports patterns
      expect(
        content.includes('module.exports') ||
        content.includes('exports.') ||
        content.includes('require('),
      ).toBe(true);
    });

    it('ESM output uses import/export syntax', () => {
      const esmPath = join(distDir, 'index.mjs');
      const content = readFileSync(esmPath, 'utf-8');

      expect(content.length).toBeGreaterThan(0);
      // ESM should have export statements
      expect(content.includes('export')).toBe(true);
    });
  });
});
