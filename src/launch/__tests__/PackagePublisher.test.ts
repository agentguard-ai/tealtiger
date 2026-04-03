/**
 * Unit tests for PackagePublisher
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 15.2, 15.3
 */
import { PackagePublisher, REQUIRED_PROVIDERS } from '../PackagePublisher';
import type { PackagePublisherOptions } from '../PackagePublisher';
import type { ICredentialManager } from '../CredentialManager';
import type { IErrorHandler } from '../ErrorHandler';
import type { ChannelCredentials, ErrorContext, ErrorResponse } from '../types';

// ── Test helpers ───────────────────────────────────────────────────

/** Minimal mock credential manager */
function mockCredentialManager(overrides: Partial<ICredentialManager> = {}): ICredentialManager {
  return {
    getCredentials: jest.fn().mockResolvedValue({
      channel: 'npm',
      type: 'token',
      credentials: { NPM_TOKEN: 'test-token' },
    } satisfies ChannelCredentials),
    validateAllCredentials: jest.fn().mockResolvedValue(undefined),
    checkRotationNeeded: jest.fn().mockResolvedValue([]),
    rotateCredentials: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Minimal mock error handler */
function mockErrorHandler(overrides: Partial<IErrorHandler> = {}): IErrorHandler {
  return {
    handleError: jest.fn().mockImplementation((error: Error, ctx: ErrorContext): ErrorResponse => ({
      action: 'rollback',
      message: `Publication error: ${error.message}`,
      retryable: false,
      category: ctx.category,
    })),
    isRetryable: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

/** Build default options for tests */
function makeOptions(overrides: Partial<PackagePublisherOptions> = {}): PackagePublisherOptions {
  return {
    credentialManager: mockCredentialManager(),
    errorHandler: mockErrorHandler(),
    dryRun: false,
    readPackageVersion: jest.fn().mockResolvedValue('1.1.0'),
    readPyProjectVersion: jest.fn().mockResolvedValue('1.1.0'),
    getIncludedProviders: jest.fn().mockResolvedValue([...REQUIRED_PROVIDERS]),
    execCommand: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('PackagePublisher', () => {
  // ── publishToNpm ────────────────────────────────────────────────

  describe('publishToNpm', () => {
    it('publishes successfully with valid package (Req 1.1)', async () => {
      const opts = makeOptions();
      const publisher = new PackagePublisher(opts);

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.channel).toBe('npm');
      expect(result.status).toBe('success');
      expect(result.artifactUrl).toContain('npmjs.com');
      expect(opts.execCommand).toHaveBeenCalledWith('npm publish --access public');
    });

    it('retrieves npm credentials before publishing', async () => {
      const cm = mockCredentialManager();
      const publisher = new PackagePublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToNpm('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('npm');
    });

    it('fails when package.json version does not match (Req 15.2)', async () => {
      const publisher = new PackagePublisher(
        makeOptions({ readPackageVersion: jest.fn().mockResolvedValue('1.0.0') }),
      );

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Version mismatch');
    });

    it('fails when credential retrieval fails', async () => {
      const cm = mockCredentialManager({
        getCredentials: jest.fn().mockRejectedValue(new Error('Missing credential: NPM_TOKEN')),
      });
      const publisher = new PackagePublisher(makeOptions({ credentialManager: cm }));

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('fails when npm publish command fails', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          execCommand: jest.fn().mockRejectedValue(new Error('npm ERR! 403 Forbidden')),
        }),
      );

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('failed');
    });
  });

  // ── publishToPyPI ───────────────────────────────────────────────

  describe('publishToPyPI', () => {
    it('publishes successfully with valid package (Req 1.2)', async () => {
      const opts = makeOptions();
      const publisher = new PackagePublisher(opts);

      const result = await publisher.publishToPyPI('1.1.0');

      expect(result.channel).toBe('pypi');
      expect(result.status).toBe('success');
      expect(result.artifactUrl).toContain('pypi.org');
      expect(opts.execCommand).toHaveBeenCalledWith('twine upload dist/*');
    });

    it('retrieves pypi credentials before publishing', async () => {
      const cm = mockCredentialManager();
      const publisher = new PackagePublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToPyPI('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('pypi');
    });

    it('fails when pyproject.toml version does not match (Req 15.3)', async () => {
      const publisher = new PackagePublisher(
        makeOptions({ readPyProjectVersion: jest.fn().mockResolvedValue('1.0.0') }),
      );

      const result = await publisher.publishToPyPI('1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Version mismatch');
    });

    it('fails when credential retrieval fails', async () => {
      const cm = mockCredentialManager({
        getCredentials: jest.fn().mockRejectedValue(new Error('Missing credential: PYPI_TOKEN')),
      });
      const publisher = new PackagePublisher(makeOptions({ credentialManager: cm }));

      const result = await publisher.publishToPyPI('1.1.0');

      expect(result.status).toBe('failed');
    });
  });

  // ── Publication failure handling ────────────────────────────────

  describe('publication failure handling', () => {
    it('delegates errors to ErrorHandler', async () => {
      const eh = mockErrorHandler();
      const publisher = new PackagePublisher(
        makeOptions({
          errorHandler: eh,
          execCommand: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
        }),
      );

      await publisher.publishToNpm('1.1.0');

      expect(eh.handleError).toHaveBeenCalled();
      const call = (eh.handleError as jest.Mock).mock.calls[0];
      expect(call[1].category).toBe('publication');
      expect(call[1].channel).toBe('npm');
    });

    it('returns error message from ErrorHandler in result', async () => {
      const eh = mockErrorHandler({
        handleError: jest.fn().mockReturnValue({
          action: 'rollback',
          message: 'Custom error: network failure',
          retryable: false,
          category: 'publication',
        }),
      });
      const publisher = new PackagePublisher(
        makeOptions({
          errorHandler: eh,
          execCommand: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        }),
      );

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.error).toBe('Custom error: network failure');
    });
  });

  // ── Dry-run mode ────────────────────────────────────────────────

  describe('dry-run mode', () => {
    it('does not execute npm publish in dry-run mode', async () => {
      const opts = makeOptions({ dryRun: true });
      const publisher = new PackagePublisher(opts);

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('success');
      expect(opts.execCommand).not.toHaveBeenCalled();
    });

    it('does not execute twine upload in dry-run mode', async () => {
      const opts = makeOptions({ dryRun: true });
      const publisher = new PackagePublisher(opts);

      const result = await publisher.publishToPyPI('1.1.0');

      expect(result.status).toBe('success');
      expect(opts.execCommand).not.toHaveBeenCalled();
    });

    it('still validates version in dry-run mode', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          dryRun: true,
          readPackageVersion: jest.fn().mockResolvedValue('0.9.0'),
        }),
      );

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('failed');
    });

    it('still verifies provider completeness in dry-run mode', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          dryRun: true,
          getIncludedProviders: jest.fn().mockResolvedValue(['OpenAI']),
        }),
      );

      const result = await publisher.publishToNpm('1.1.0');

      expect(result.status).toBe('failed');
    });

    it('supports dry-run via publish() method parameter', async () => {
      const opts = makeOptions({ dryRun: false });
      const publisher = new PackagePublisher(opts);

      const results = await publisher.publish('1.1.0', true);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      // execCommand should not be called since dry-run overrides
      expect(opts.execCommand).not.toHaveBeenCalled();
    });
  });

  // ── Provider completeness verification ──────────────────────────

  describe('provider completeness verification (Req 1.3, 1.4)', () => {
    it('passes when all 7 providers are present', async () => {
      const publisher = new PackagePublisher(makeOptions());

      await expect(publisher.verifyProviderCompleteness()).resolves.toBeUndefined();
    });

    it('fails when a provider is missing', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          getIncludedProviders: jest.fn().mockResolvedValue([
            'OpenAI', 'Anthropic', 'Gemini', 'Bedrock', 'Azure OpenAI', 'Cohere',
            // Missing: Mistral
          ]),
        }),
      );

      await expect(publisher.verifyProviderCompleteness()).rejects.toThrow(/Missing providers.*Mistral/);
    });

    it('fails when multiple providers are missing', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          getIncludedProviders: jest.fn().mockResolvedValue(['OpenAI', 'Anthropic']),
        }),
      );

      await expect(publisher.verifyProviderCompleteness()).rejects.toThrow(/Missing providers/);
    });

    it('provider matching is case-insensitive', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          getIncludedProviders: jest.fn().mockResolvedValue([
            'openai', 'anthropic', 'gemini', 'bedrock', 'azure openai', 'cohere', 'mistral',
          ]),
        }),
      );

      await expect(publisher.verifyProviderCompleteness()).resolves.toBeUndefined();
    });

    it('REQUIRED_PROVIDERS contains exactly 7 providers', () => {
      expect(REQUIRED_PROVIDERS).toHaveLength(7);
      expect(REQUIRED_PROVIDERS).toContain('OpenAI');
      expect(REQUIRED_PROVIDERS).toContain('Anthropic');
      expect(REQUIRED_PROVIDERS).toContain('Gemini');
      expect(REQUIRED_PROVIDERS).toContain('Bedrock');
      expect(REQUIRED_PROVIDERS).toContain('Azure OpenAI');
      expect(REQUIRED_PROVIDERS).toContain('Cohere');
      expect(REQUIRED_PROVIDERS).toContain('Mistral');
    });
  });

  // ── Version validation ──────────────────────────────────────────

  describe('version validation (Req 15.2, 15.3)', () => {
    it('accepts valid semver versions', () => {
      const publisher = new PackagePublisher(makeOptions());

      expect(() => publisher.validateVersionFormat('1.1.0')).not.toThrow();
      expect(() => publisher.validateVersionFormat('0.0.1')).not.toThrow();
      expect(() => publisher.validateVersionFormat('2.0.0-beta.1')).not.toThrow();
    });

    it('rejects invalid version formats', () => {
      const publisher = new PackagePublisher(makeOptions());

      expect(() => publisher.validateVersionFormat('')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('v1.1.0')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('1.1')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('abc')).toThrow(/Invalid version format/);
    });

    it('npm publish fails with invalid version', async () => {
      const publisher = new PackagePublisher(makeOptions());

      const result = await publisher.publishToNpm('invalid');

      expect(result.status).toBe('failed');
    });

    it('pypi publish fails with invalid version', async () => {
      const publisher = new PackagePublisher(makeOptions());

      const result = await publisher.publishToPyPI('not-a-version');

      expect(result.status).toBe('failed');
    });
  });

  // ── publish() (Publisher interface) ─────────────────────────────

  describe('publish() – Publisher interface', () => {
    it('returns results for both npm and pypi', async () => {
      const publisher = new PackagePublisher(makeOptions());

      const results = await publisher.publish('1.1.0');

      expect(results).toHaveLength(2);
      const channels = results.map((r) => r.channel);
      expect(channels).toContain('npm');
      expect(channels).toContain('pypi');
    });

    it('returns both results even when one fails', async () => {
      const publisher = new PackagePublisher(
        makeOptions({
          readPackageVersion: jest.fn().mockResolvedValue('0.0.1'), // npm will fail
          readPyProjectVersion: jest.fn().mockResolvedValue('1.1.0'), // pypi will succeed
        }),
      );

      const results = await publisher.publish('1.1.0');

      expect(results).toHaveLength(2);
      const npm = results.find((r) => r.channel === 'npm');
      const pypi = results.find((r) => r.channel === 'pypi');
      expect(npm?.status).toBe('failed');
      expect(pypi?.status).toBe('success');
    });
  });
});
