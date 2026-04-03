/**
 * Unit tests for ContainerPublisher
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 15.4
 */
import {
  ContainerPublisher,
  SUPPORTED_ARCHITECTURES,
  GHCR_IMAGE,
  DOCKERHUB_IMAGE,
} from '../ContainerPublisher';
import type { ContainerPublisherOptions } from '../ContainerPublisher';
import type { ICredentialManager } from '../CredentialManager';
import type { IErrorHandler } from '../ErrorHandler';
import type { ChannelCredentials, ErrorContext, ErrorResponse } from '../types';

// ── Test helpers ───────────────────────────────────────────────────

function mockCredentialManager(overrides: Partial<ICredentialManager> = {}): ICredentialManager {
  return {
    getCredentials: jest.fn().mockImplementation((channel: string) => {
      if (channel === 'ghcr') {
        return Promise.resolve({
          channel: 'ghcr',
          type: 'token',
          credentials: { GITHUB_TOKEN: 'ghp_test-token' },
        } satisfies ChannelCredentials);
      }
      return Promise.resolve({
        channel: 'dockerhub',
        type: 'username_password',
        credentials: { DOCKERHUB_USERNAME: 'tealtiger', DOCKERHUB_TOKEN: 'dckr_test-token' },
      } satisfies ChannelCredentials);
    }),
    validateAllCredentials: jest.fn().mockResolvedValue(undefined),
    checkRotationNeeded: jest.fn().mockResolvedValue([]),
    rotateCredentials: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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

function makeOptions(overrides: Partial<ContainerPublisherOptions> = {}): ContainerPublisherOptions {
  return {
    credentialManager: mockCredentialManager(),
    errorHandler: mockErrorHandler(),
    dryRun: false,
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

describe('ContainerPublisher', () => {
  // ── Multi-arch image build ──────────────────────────────────────

  describe('multi-arch image build (Req 2.3)', () => {
    it('builds with both amd64 and arm64 platforms for GHCR', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToGHCR('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toBeDefined();
      expect(buildCmd).toContain('linux/amd64');
      expect(buildCmd).toContain('linux/arm64');
    });

    it('builds with both amd64 and arm64 platforms for Docker Hub', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToDockerHub('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toBeDefined();
      expect(buildCmd).toContain('linux/amd64');
      expect(buildCmd).toContain('linux/arm64');
    });

    it('SUPPORTED_ARCHITECTURES contains amd64 and arm64', () => {
      expect(SUPPORTED_ARCHITECTURES).toContain('linux/amd64');
      expect(SUPPORTED_ARCHITECTURES).toContain('linux/arm64');
      expect(SUPPORTED_ARCHITECTURES).toHaveLength(2);
    });
  });

  // ── GHCR publication ────────────────────────────────────────────

  describe('publishToGHCR (Req 2.1, 2.4)', () => {
    it('publishes successfully with valid version', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      const result = await publisher.publishToGHCR('1.1.0');

      expect(result.channel).toBe('ghcr');
      expect(result.status).toBe('success');
      expect(result.artifactUrl).toContain('ghcr.io/tealtiger/tealtiger:1.1.0');
    });

    it('uses GitHub Actions authentication (GITHUB_TOKEN)', async () => {
      const cm = mockCredentialManager();
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToGHCR('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('ghcr');
    });

    it('logs into ghcr.io before pushing', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToGHCR('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const loginCmd = calls.find((c: string) => c.includes('docker login ghcr.io'));
      expect(loginCmd).toBeDefined();
    });

    it('pushes to the correct GHCR image name', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToGHCR('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toContain(`${GHCR_IMAGE}:1.1.0`);
      expect(buildCmd).toContain('--push');
    });

    it('fails when credential retrieval fails', async () => {
      const cm = mockCredentialManager({
        getCredentials: jest.fn().mockRejectedValue(new Error('Missing credential: GITHUB_TOKEN')),
      });
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      const result = await publisher.publishToGHCR('1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('fails when docker buildx command fails', async () => {
      const publisher = new ContainerPublisher(
        makeOptions({
          execCommand: jest.fn().mockRejectedValue(new Error('buildx: command not found')),
        }),
      );

      const result = await publisher.publishToGHCR('1.1.0');

      expect(result.status).toBe('failed');
    });
  });

  // ── Docker Hub publication ──────────────────────────────────────

  describe('publishToDockerHub (Req 2.2, 2.5)', () => {
    it('publishes successfully with valid version', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      const result = await publisher.publishToDockerHub('1.1.0');

      expect(result.channel).toBe('dockerhub');
      expect(result.status).toBe('success');
      expect(result.artifactUrl).toContain('hub.docker.com');
    });

    it('uses username/password authentication from CredentialManager', async () => {
      const cm = mockCredentialManager();
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToDockerHub('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('dockerhub');
    });

    it('logs into Docker Hub before pushing', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToDockerHub('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const loginCmd = calls.find((c: string) =>
        c.includes('docker login') && !c.includes('ghcr.io'),
      );
      expect(loginCmd).toBeDefined();
    });

    it('pushes to the correct Docker Hub image name', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToDockerHub('1.1.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toContain(`${DOCKERHUB_IMAGE}:1.1.0`);
      expect(buildCmd).toContain('--push');
    });

    it('fails when credential retrieval fails', async () => {
      const cm = mockCredentialManager({
        getCredentials: jest.fn().mockRejectedValue(new Error('Missing credential: DOCKERHUB_TOKEN')),
      });
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      const result = await publisher.publishToDockerHub('1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('fails when docker push fails', async () => {
      const publisher = new ContainerPublisher(
        makeOptions({
          execCommand: jest.fn().mockRejectedValue(new Error('denied: access forbidden')),
        }),
      );

      const result = await publisher.publishToDockerHub('1.1.0');

      expect(result.status).toBe('failed');
    });
  });

  // ── Image tagging ──────────────────────────────────────────────

  describe('image tagging (Req 15.4)', () => {
    it('tags GHCR image with the provided version', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToGHCR('2.0.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toContain(`${GHCR_IMAGE}:2.0.0`);
    });

    it('tags Docker Hub image with the provided version', async () => {
      const opts = makeOptions();
      const publisher = new ContainerPublisher(opts);

      await publisher.publishToDockerHub('2.0.0');

      const calls = (opts.execCommand as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const buildCmd = calls.find((c: string) => c.includes('docker buildx build'));
      expect(buildCmd).toContain(`${DOCKERHUB_IMAGE}:2.0.0`);
    });

    it('rejects invalid version formats', () => {
      const publisher = new ContainerPublisher(makeOptions());

      expect(() => publisher.validateVersionFormat('')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('v1.1.0')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('1.1')).toThrow(/Invalid version format/);
      expect(() => publisher.validateVersionFormat('abc')).toThrow(/Invalid version format/);
    });

    it('accepts valid semver versions', () => {
      const publisher = new ContainerPublisher(makeOptions());

      expect(() => publisher.validateVersionFormat('1.1.0')).not.toThrow();
      expect(() => publisher.validateVersionFormat('0.0.1')).not.toThrow();
      expect(() => publisher.validateVersionFormat('2.0.0-beta.1')).not.toThrow();
    });

    it('GHCR publish fails with invalid version', async () => {
      const publisher = new ContainerPublisher(makeOptions());
      const result = await publisher.publishToGHCR('invalid');
      expect(result.status).toBe('failed');
    });

    it('Docker Hub publish fails with invalid version', async () => {
      const publisher = new ContainerPublisher(makeOptions());
      const result = await publisher.publishToDockerHub('not-a-version');
      expect(result.status).toBe('failed');
    });
  });

  // ── Dry-run mode ────────────────────────────────────────────────

  describe('dry-run mode', () => {
    it('does not execute docker commands in dry-run mode for GHCR', async () => {
      const opts = makeOptions({ dryRun: true });
      const publisher = new ContainerPublisher(opts);

      const result = await publisher.publishToGHCR('1.1.0');

      expect(result.status).toBe('success');
      expect(opts.execCommand).not.toHaveBeenCalled();
    });

    it('does not execute docker commands in dry-run mode for Docker Hub', async () => {
      const opts = makeOptions({ dryRun: true });
      const publisher = new ContainerPublisher(opts);

      const result = await publisher.publishToDockerHub('1.1.0');

      expect(result.status).toBe('success');
      expect(opts.execCommand).not.toHaveBeenCalled();
    });

    it('still validates version in dry-run mode', async () => {
      const publisher = new ContainerPublisher(makeOptions({ dryRun: true }));

      const result = await publisher.publishToGHCR('bad-version');

      expect(result.status).toBe('failed');
    });

    it('still retrieves credentials in dry-run mode', async () => {
      const cm = mockCredentialManager();
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm, dryRun: true }));

      await publisher.publishToGHCR('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('ghcr');
    });

    it('supports dry-run via publish() method parameter', async () => {
      const opts = makeOptions({ dryRun: false });
      const publisher = new ContainerPublisher(opts);

      const results = await publisher.publish('1.1.0', true);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      expect(opts.execCommand).not.toHaveBeenCalled();
    });
  });

  // ── Credential authentication ───────────────────────────────────

  describe('credential authentication', () => {
    it('retrieves GHCR credentials before publishing', async () => {
      const cm = mockCredentialManager();
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToGHCR('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('ghcr');
    });

    it('retrieves Docker Hub credentials before publishing', async () => {
      const cm = mockCredentialManager();
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      await publisher.publishToDockerHub('1.1.0');

      expect(cm.getCredentials).toHaveBeenCalledWith('dockerhub');
    });
  });

  // ── Failure handling ────────────────────────────────────────────

  describe('failure handling', () => {
    it('delegates GHCR errors to ErrorHandler', async () => {
      const eh = mockErrorHandler();
      const publisher = new ContainerPublisher(
        makeOptions({
          errorHandler: eh,
          execCommand: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
        }),
      );

      await publisher.publishToGHCR('1.1.0');

      expect(eh.handleError).toHaveBeenCalled();
      const call = (eh.handleError as jest.Mock).mock.calls[0];
      expect(call[1].category).toBe('publication');
      expect(call[1].channel).toBe('ghcr');
    });

    it('delegates Docker Hub errors to ErrorHandler', async () => {
      const eh = mockErrorHandler();
      const publisher = new ContainerPublisher(
        makeOptions({
          errorHandler: eh,
          execCommand: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        }),
      );

      await publisher.publishToDockerHub('1.1.0');

      expect(eh.handleError).toHaveBeenCalled();
      const call = (eh.handleError as jest.Mock).mock.calls[0];
      expect(call[1].category).toBe('publication');
      expect(call[1].channel).toBe('dockerhub');
    });

    it('returns error message from ErrorHandler in result', async () => {
      const eh = mockErrorHandler({
        handleError: jest.fn().mockReturnValue({
          action: 'rollback',
          message: 'Custom error: docker daemon not running',
          retryable: false,
          category: 'publication',
        }),
      });
      const publisher = new ContainerPublisher(
        makeOptions({
          errorHandler: eh,
          execCommand: jest.fn().mockRejectedValue(new Error('Cannot connect to Docker daemon')),
        }),
      );

      const result = await publisher.publishToGHCR('1.1.0');

      expect(result.error).toBe('Custom error: docker daemon not running');
    });
  });

  // ── publish() (Publisher interface) ─────────────────────────────

  describe('publish() – Publisher interface', () => {
    it('returns results for both ghcr and dockerhub', async () => {
      const publisher = new ContainerPublisher(makeOptions());

      const results = await publisher.publish('1.1.0');

      expect(results).toHaveLength(2);
      const channels = results.map((r) => r.channel);
      expect(channels).toContain('ghcr');
      expect(channels).toContain('dockerhub');
    });

    it('returns both results even when one fails', async () => {
      const cm = mockCredentialManager({
        getCredentials: jest.fn().mockImplementation((channel: string) => {
          if (channel === 'ghcr') {
            return Promise.reject(new Error('Missing GITHUB_TOKEN'));
          }
          return Promise.resolve({
            channel: 'dockerhub',
            type: 'username_password' as const,
            credentials: { DOCKERHUB_USERNAME: 'tealtiger', DOCKERHUB_TOKEN: 'tok' },
          });
        }),
      });
      const publisher = new ContainerPublisher(makeOptions({ credentialManager: cm }));

      const results = await publisher.publish('1.1.0');

      expect(results).toHaveLength(2);
      const ghcr = results.find((r) => r.channel === 'ghcr');
      const dh = results.find((r) => r.channel === 'dockerhub');
      expect(ghcr?.status).toBe('failed');
      expect(dh?.status).toBe('success');
    });
  });
});
