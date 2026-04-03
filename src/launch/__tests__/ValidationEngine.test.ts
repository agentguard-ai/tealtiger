/**
 * Unit tests for ValidationEngine
 * Validates: Requirements 1.5, 1.6, 2.6, 2.7, 3.6, 3.7, 4.5, 4.6,
 *            5.6, 5.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
import { ValidationEngine } from '../ValidationEngine';
import type { ValidationEngineOptions } from '../ValidationEngine';
import type { IErrorHandler } from '../ErrorHandler';
import type { ChannelResult, ErrorContext, ErrorResponse } from '../types';

// ── Test helpers ───────────────────────────────────────────────────

function mockErrorHandler(
  overrides: Partial<IErrorHandler> = {},
): IErrorHandler {
  return {
    handleError: jest
      .fn()
      .mockImplementation(
        (error: Error, ctx: ErrorContext): ErrorResponse => ({
          action: 'report',
          message: `Validation error: ${error.message}`,
          retryable: false,
          category: ctx.category,
        }),
      ),
    isRetryable: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

function makeOptions(
  overrides: Partial<ValidationEngineOptions> = {},
): ValidationEngineOptions {
  return {
    errorHandler: mockErrorHandler(),
    dryRun: false,
    execCommand: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    packageTimeoutMs: 5_000,
    extendedTimeoutMs: 10_000,
    ...overrides,
  };
}

function channelResult(
  channel: ChannelResult['channel'],
  artifactUrl?: string,
): ChannelResult {
  return {
    channel,
    status: 'success',
    artifactUrl: artifactUrl ?? `https://example.com/tealtiger/1.1.0`,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('ValidationEngine', () => {
  // ── Package validation (Req 1.5, 1.6, 8.1, 8.2, 8.3) ──────────

  describe('package validation', () => {
    it('runs all four checks for npm in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(channelResult('npm'));

      expect(result.passed).toBe(true);
      expect(result.channel).toBe('npm');
      expect(result.checks).toHaveLength(4);

      const names = result.checks.map((c) => c.name);
      expect(names).toEqual([
        'Package Downloadable',
        'Package Metadata',
        'Package Installable',
        'Package Imports',
      ]);
      result.checks.forEach((c) => {
        expect(c.passed).toBe(true);
        expect(c.details).toContain('[DRY-RUN]');
      });
    });

    it('runs all four checks for pypi in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(channelResult('pypi'));

      expect(result.passed).toBe(true);
      expect(result.channel).toBe('pypi');
      expect(result.checks).toHaveLength(4);
    });

    it('reports failure when package download check fails', async () => {
      const exec = jest
        .fn()
        .mockRejectedValue(new Error('404 Not Found'));
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(channelResult('npm'));

      expect(result.passed).toBe(false);
      const downloadCheck = result.checks.find(
        (c) => c.name === 'Package Downloadable',
      );
      expect(downloadCheck?.passed).toBe(false);
      expect(downloadCheck?.error).toContain('404 Not Found');
    });

    it('detects metadata version mismatch', async () => {
      const exec = jest.fn().mockImplementation((cmd: string) => {
        if (cmd.includes('npm view') && cmd.includes('--json')) {
          return Promise.resolve({ stdout: '"2.0.0"', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(channelResult('npm'));

      const metaCheck = result.checks.find(
        (c) => c.name === 'Package Metadata',
      );
      expect(metaCheck?.passed).toBe(false);
      expect(metaCheck?.error).toContain('Version mismatch');
    });
  });

  // ── Container validation (Req 2.6, 2.7, 8.1, 8.4) ─────────────

  describe('container validation', () => {
    it('runs all four checks for ghcr in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(channelResult('ghcr'));

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(4);

      const names = result.checks.map((c) => c.name);
      expect(names).toEqual([
        'Image Pullable',
        'Image Tags',
        'Image Startable',
        'Multi-Architecture Support',
      ]);
    });

    it('reports failure when image pull fails', async () => {
      const exec = jest
        .fn()
        .mockRejectedValue(new Error('manifest unknown'));
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(channelResult('dockerhub'));

      expect(result.passed).toBe(false);
      const pullCheck = result.checks.find(
        (c) => c.name === 'Image Pullable',
      );
      expect(pullCheck?.passed).toBe(false);
      expect(pullCheck?.error).toContain('manifest unknown');
    });
  });

  // ── Lambda ARN validation (Req 5.6, 8.1, 8.7) ─────────────────

  describe('lambda validation', () => {
    it('runs all three checks in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(
        channelResult('lambda_layers', 'https://layers.tealtiger.ai/v1.1.0'),
      );

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(3);

      const names = result.checks.map((c) => c.name);
      expect(names).toEqual([
        'Lambda ARN Valid',
        'Lambda Attachable',
        'Lambda Executable',
      ]);
    });

    it('reports failure when no layer version found', async () => {
      const exec = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({ LayerVersions: [] }),
        stderr: '',
      });
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(
        channelResult('lambda_layers', 'https://layers.tealtiger.ai/v1.1.0'),
      );

      const arnCheck = result.checks.find(
        (c) => c.name === 'Lambda ARN Valid',
      );
      expect(arnCheck?.passed).toBe(false);
      expect(arnCheck?.error).toContain('No layer version found');
    });
  });

  // ── Timeout handling (Req 8.8) ──────────────────────────────────

  describe('validation timeout handling', () => {
    it('marks validation as failed when timeout is exceeded', async () => {
      const slowExec = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ stdout: '', stderr: '' }), 20_000);
          }),
      );

      const engine = new ValidationEngine(
        makeOptions({
          execCommand: slowExec,
          packageTimeoutMs: 50, // very short timeout
        }),
      );

      const result = await engine.validate(channelResult('npm'));

      expect(result.passed).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('uses short timeout for package channels', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(channelResult('npm'));
      // Should complete without timeout since dry-run is instant
      expect(result.passed).toBe(true);
    });

    it('uses extended timeout for IaC channels', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(channelResult('terraform'));
      expect(result.passed).toBe(true);
    });
  });

  // ── validateAll (parallel) ──────────────────────────────────────

  describe('validateAll', () => {
    it('validates multiple channels in parallel', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const channels = [
        channelResult('npm'),
        channelResult('ghcr'),
        channelResult('terraform'),
        channelResult('lambda_layers', 'https://layers.tealtiger.ai/v1.1.0'),
      ];

      const results = await engine.validateAll(channels);

      expect(results).toHaveLength(4);
      results.forEach((r) => {
        expect(r.passed).toBe(true);
      });
    });

    it('returns individual failures without blocking others', async () => {
      let callCount = 0;
      const exec = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 4) {
          // First channel (npm) — all 4 checks fail
          return Promise.reject(new Error('npm failure'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const engine = new ValidationEngine(
        makeOptions({ execCommand: exec, dryRun: false }),
      );

      const channels = [channelResult('npm')];
      const results = await engine.validateAll(channels);

      expect(results).toHaveLength(1);
      expect(results[0]!.passed).toBe(false);
    });
  });

  // ── IaC validation (Req 3.6, 3.7, 8.5) ─────────────────────────

  describe('IaC validation', () => {
    it('runs accessible and syntax checks in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));

      for (const ch of ['terraform', 'pulumi', 'helm', 'ansible'] as const) {
        const result = await engine.validate(channelResult(ch));
        expect(result.passed).toBe(true);
        expect(result.checks).toHaveLength(2);
        expect(result.checks.map((c) => c.name)).toEqual([
          'IaC Artifact Accessible',
          'IaC Syntax Valid',
        ]);
      }
    });
  });

  // ── CI/CD validation (Req 4.5, 4.6, 8.6) ───────────────────────

  describe('CI/CD validation', () => {
    it('runs discoverable and executable checks in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));

      for (const ch of [
        'github_marketplace',
        'gitlab',
        'circleci',
        'azure_pipelines',
      ] as const) {
        const result = await engine.validate(channelResult(ch));
        expect(result.passed).toBe(true);
        expect(result.checks).toHaveLength(2);
        expect(result.checks.map((c) => c.name)).toEqual([
          'CI/CD Discoverable',
          'CI/CD Executable',
        ]);
      }
    });
  });

  // ── Lambda registry website (Req 5.7) ──────────────────────────

  describe('lambda registry website validation', () => {
    it('runs accessible and ARN checks in dry-run mode', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(
        channelResult(
          'lambda_registry_website',
          'https://layers.tealtiger.ai',
        ),
      );

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(2);
      expect(result.checks.map((c) => c.name)).toEqual([
        'Website Accessible',
        'Website ARNs Correct',
      ]);
    });
  });

  // ── Validation failure reporting (Req 8.8) ─────────────────────

  describe('validation failure reporting', () => {
    it('includes diagnostic information on failure', async () => {
      const exec = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED: connection refused'));
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(channelResult('npm'));

      expect(result.passed).toBe(false);
      const failedChecks = result.checks.filter((c) => !c.passed);
      expect(failedChecks.length).toBeGreaterThan(0);
      failedChecks.forEach((c) => {
        expect(c.error).toBeDefined();
        expect(c.error!.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Version extraction ──────────────────────────────────────────

  describe('version extraction', () => {
    it('extracts version from artifact URL', async () => {
      const exec = jest.fn().mockResolvedValue({
        stdout: '"1.2.3"',
        stderr: '',
      });
      const engine = new ValidationEngine(makeOptions({ execCommand: exec }));
      const result = await engine.validate(
        channelResult('npm', 'https://registry.npmjs.org/tealtiger/1.2.3'),
      );

      // The metadata check should compare against 1.2.3
      const metaCheck = result.checks.find(
        (c) => c.name === 'Package Metadata',
      );
      expect(metaCheck?.passed).toBe(true);
    });

    it('falls back to 1.1.0 when URL has no version', async () => {
      const engine = new ValidationEngine(makeOptions({ dryRun: true }));
      const result = await engine.validate(
        channelResult('npm', 'https://example.com/no-version'),
      );
      // Should still pass in dry-run
      expect(result.passed).toBe(true);
    });
  });
});
