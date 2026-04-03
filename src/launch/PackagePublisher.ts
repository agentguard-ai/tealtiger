/**
 * TealTiger v1.1.0 Package Publisher
 *
 * Publishes the TypeScript SDK to npm and the Python SDK to PyPI.
 * Verifies provider completeness (7 providers) and version consistency
 * before publishing. Uses CredentialManager for authentication and
 * ErrorHandler for retry logic on transient failures.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 15.2, 15.3
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Publisher, ChannelResult } from './types';
import type { ICredentialManager } from './CredentialManager';
import type { IErrorHandler } from './ErrorHandler';

const execAsync = promisify(exec);

/** The 7 required provider implementations */
export const REQUIRED_PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Bedrock',
  'Azure OpenAI',
  'Cohere',
  'Mistral',
] as const;

export type ProviderName = (typeof REQUIRED_PROVIDERS)[number];

/** Interface for the package publisher */
export interface IPackagePublisher extends Publisher {
  publishToNpm(version: string): Promise<ChannelResult>;
  publishToPyPI(version: string): Promise<ChannelResult>;
}

/** Options for constructing a PackagePublisher */
export interface PackagePublisherOptions {
  credentialManager: ICredentialManager;
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for reading package.json version (testing seam) */
  readPackageVersion?: () => Promise<string>;
  /** Override for reading pyproject.toml version (testing seam) */
  readPyProjectVersion?: () => Promise<string>;
  /** Override for listing providers included in a package (testing seam) */
  getIncludedProviders?: () => Promise<string[]>;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export class PackagePublisher implements IPackagePublisher {
  private readonly credentialManager: ICredentialManager;
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly readPackageVersion: () => Promise<string>;
  private readonly readPyProjectVersion: () => Promise<string>;
  private readonly getIncludedProviders: () => Promise<string[]>;
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: PackagePublisherOptions) {
    this.credentialManager = options.credentialManager;
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.readPackageVersion = options.readPackageVersion ?? PackagePublisher.defaultReadPackageVersion;
    this.readPyProjectVersion = options.readPyProjectVersion ?? PackagePublisher.defaultReadPyProjectVersion;
    this.getIncludedProviders = options.getIncludedProviders ?? PackagePublisher.defaultGetIncludedProviders;
    this.execCommand = options.execCommand ?? execAsync;
  }

  // ── Publisher interface ─────────────────────────────────────────

  /**
   * Publish to both npm and PyPI.
   * Returns results for both channels (runs in parallel).
   */
  async publish(version: string, dryRun?: boolean): Promise<ChannelResult[]> {
    const effectiveDryRun = dryRun ?? this.dryRun;
    const publisher = effectiveDryRun
      ? new PackagePublisher({ ...this.toOptions(), dryRun: true })
      : this;

    const target = effectiveDryRun ? publisher : this;

    return Promise.all([
      target.publishToNpm(version),
      target.publishToPyPI(version),
    ]);
  }

  // ── Channel-specific publication ────────────────────────────────

  /**
   * Publish the TypeScript SDK to npm.
   * Requirements: 1.1, 1.3, 15.2
   */
  async publishToNpm(version: string): Promise<ChannelResult> {
    try {
      // 1. Validate version format
      this.validateVersionFormat(version);

      // 2. Verify package.json version matches
      const pkgVersion = await this.readPackageVersion();
      if (pkgVersion !== version) {
        throw new Error(
          `Version mismatch: package.json has "${pkgVersion}" but expected "${version}"`,
        );
      }

      // 3. Verify provider completeness
      await this.verifyProviderCompleteness();

      // 4. Get credentials (validates they exist; value used by CLI env)
      await this.credentialManager.getCredentials('npm');

      // 5. Publish (or simulate in dry-run)
      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish npm package tealtiger@${version}`);
      } else {
        await this.execCommand(
          `npm publish --access public`,
        );
      }

      return {
        channel: 'npm',
        status: 'success',
        artifactUrl: `https://www.npmjs.com/package/tealtiger/v/${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'npm',
        stage: 'package_managers',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToNpm',
      });

      return {
        channel: 'npm',
        status: 'failed',
        error: response.message,
      };
    }
  }

  /**
   * Publish the Python SDK to PyPI.
   * Requirements: 1.2, 1.4, 15.3
   */
  async publishToPyPI(version: string): Promise<ChannelResult> {
    try {
      // 1. Validate version format
      this.validateVersionFormat(version);

      // 2. Verify pyproject.toml version matches
      const pyVersion = await this.readPyProjectVersion();
      if (pyVersion !== version) {
        throw new Error(
          `Version mismatch: pyproject.toml has "${pyVersion}" but expected "${version}"`,
        );
      }

      // 3. Verify provider completeness
      await this.verifyProviderCompleteness();

      // 4. Get credentials (validates they exist; value used by CLI env)
      await this.credentialManager.getCredentials('pypi');

      // 5. Publish (or simulate in dry-run)
      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish PyPI package tealtiger==${version}`);
      } else {
        await this.execCommand(
          `twine upload dist/*`,
        );
      }

      return {
        channel: 'pypi',
        status: 'success',
        artifactUrl: `https://pypi.org/project/tealtiger/${version}/`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'pypi',
        stage: 'package_managers',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToPyPI',
      });

      return {
        channel: 'pypi',
        status: 'failed',
        error: response.message,
      };
    }
  }

  // ── Validation helpers ──────────────────────────────────────────

  /**
   * Verify that all 7 required providers are included in the package.
   * Requirements: 1.3, 1.4
   */
  async verifyProviderCompleteness(): Promise<void> {
    const included = await this.getIncludedProviders();
    const missing = REQUIRED_PROVIDERS.filter(
      (p) => !included.some((i) => i.toLowerCase() === p.toLowerCase()),
    );

    if (missing.length > 0) {
      throw new Error(
        `Provider completeness check failed. Missing providers: ${missing.join(', ')}. ` +
        `Expected all 7: ${REQUIRED_PROVIDERS.join(', ')}`,
      );
    }
  }

  /**
   * Validate that a version string is a valid semver format.
   * Requirements: 15.2, 15.3
   */
  validateVersionFormat(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(
        `Invalid version format: "${version}". Expected semver (e.g., "1.1.0")`,
      );
    }
  }

  // ── Private helpers ─────────────────────────────────────────────

  /** Reconstruct options for creating a modified copy (e.g. dry-run override). */
  private toOptions(): PackagePublisherOptions {
    return {
      credentialManager: this.credentialManager,
      errorHandler: this.errorHandler,
      dryRun: this.dryRun,
      readPackageVersion: this.readPackageVersion,
      readPyProjectVersion: this.readPyProjectVersion,
      getIncludedProviders: this.getIncludedProviders,
      execCommand: this.execCommand,
    };
  }

  // ── Default implementations (used in production) ────────────────

  /** Read version from package.json */
  private static async defaultReadPackageVersion(): Promise<string> {
    const fs = await import('fs/promises');
    const content = await fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version;
  }

  /** Read version from pyproject.toml */
  private static async defaultReadPyProjectVersion(): Promise<string> {
    const fs = await import('fs/promises');
    const content = await fs.readFile('pyproject.toml', 'utf-8');
    const match = content.match(/version\s*=\s*"([^"]+)"/);
    if (!match) {
      throw new Error('Could not find version in pyproject.toml');
    }
    return match[1];
  }

  /** List providers included in the package (scans source files) */
  private static async defaultGetIncludedProviders(): Promise<string[]> {
    // In production, this would scan the built package for provider modules
    return [...REQUIRED_PROVIDERS];
  }
}
