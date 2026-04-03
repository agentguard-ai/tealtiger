/**
 * TealTiger v1.1.0 Container Publisher
 *
 * Publishes multi-arch container images to GitHub Container Registry (GHCR)
 * and Docker Hub. Uses docker buildx for amd64/arm64 builds, CredentialManager
 * for authentication, and ErrorHandler for retry logic on transient failures.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 15.4
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Publisher, ChannelResult } from './types';
import type { ICredentialManager } from './CredentialManager';
import type { IErrorHandler } from './ErrorHandler';

const execAsync = promisify(exec);

/** Supported architectures for multi-arch builds */
export const SUPPORTED_ARCHITECTURES = ['linux/amd64', 'linux/arm64'] as const;

/** GHCR image name */
export const GHCR_IMAGE = 'ghcr.io/tealtiger/tealtiger';

/** Docker Hub image name */
export const DOCKERHUB_IMAGE = 'tealtiger/tealtiger';

/** Interface for the container publisher */
export interface IContainerPublisher extends Publisher {
  publishToGHCR(version: string): Promise<ChannelResult>;
  publishToDockerHub(version: string): Promise<ChannelResult>;
}

/** Options for constructing a ContainerPublisher */
export interface ContainerPublisherOptions {
  credentialManager: ICredentialManager;
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export class ContainerPublisher implements IContainerPublisher {
  private readonly credentialManager: ICredentialManager;
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: ContainerPublisherOptions) {
    this.credentialManager = options.credentialManager;
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.execCommand = options.execCommand ?? execAsync;
  }

  // ── Publisher interface ─────────────────────────────────────────

  /**
   * Publish to both GHCR and Docker Hub.
   * Returns results for both channels (runs in parallel).
   */
  async publish(version: string, dryRun?: boolean): Promise<ChannelResult[]> {
    const effectiveDryRun = dryRun ?? this.dryRun;
    const target = effectiveDryRun
      ? new ContainerPublisher({ ...this.toOptions(), dryRun: true })
      : this;

    return Promise.all([
      target.publishToGHCR(version),
      target.publishToDockerHub(version),
    ]);
  }

  // ── Channel-specific publication ────────────────────────────────

  /**
   * Publish multi-arch container image to GitHub Container Registry.
   * Uses GitHub Actions authentication (GITHUB_TOKEN).
   * Requirements: 2.1, 2.3, 2.4, 15.4
   */
  async publishToGHCR(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      // Get GHCR credentials (GITHUB_TOKEN via GitHub Actions)
      const creds = await this.credentialManager.getCredentials('ghcr');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish ${GHCR_IMAGE}:${version} (amd64, arm64)`);
        return {
          channel: 'ghcr',
          status: 'success',
          artifactUrl: `https://ghcr.io/tealtiger/tealtiger:${version}`,
        };
      }

      // Login to GHCR
      await this.execCommand(
        `echo "${creds.credentials.GITHUB_TOKEN}" | docker login ghcr.io -u tealtiger --password-stdin`,
      );

      // Build and push multi-arch image
      const platforms = SUPPORTED_ARCHITECTURES.join(',');
      await this.execCommand(
        `docker buildx build --platform ${platforms} -t ${GHCR_IMAGE}:${version} --push .`,
      );

      return {
        channel: 'ghcr',
        status: 'success',
        artifactUrl: `https://ghcr.io/tealtiger/tealtiger:${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'ghcr',
        stage: 'container_registries',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToGHCR',
      });

      return {
        channel: 'ghcr',
        status: 'failed',
        error: response.message,
      };
    }
  }

  /**
   * Publish multi-arch container image to Docker Hub.
   * Uses username/password authentication from CredentialManager.
   * Requirements: 2.2, 2.3, 2.5, 15.4
   */
  async publishToDockerHub(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      // Get Docker Hub credentials (username + token)
      const creds = await this.credentialManager.getCredentials('dockerhub');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish ${DOCKERHUB_IMAGE}:${version} (amd64, arm64)`);
        return {
          channel: 'dockerhub',
          status: 'success',
          artifactUrl: `https://hub.docker.com/r/tealtiger/tealtiger/tags?name=${version}`,
        };
      }

      // Login to Docker Hub
      await this.execCommand(
        `echo "${creds.credentials.DOCKERHUB_TOKEN}" | docker login -u ${creds.credentials.DOCKERHUB_USERNAME} --password-stdin`,
      );

      // Build and push multi-arch image
      const platforms = SUPPORTED_ARCHITECTURES.join(',');
      await this.execCommand(
        `docker buildx build --platform ${platforms} -t ${DOCKERHUB_IMAGE}:${version} --push .`,
      );

      return {
        channel: 'dockerhub',
        status: 'success',
        artifactUrl: `https://hub.docker.com/r/tealtiger/tealtiger/tags?name=${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'dockerhub',
        stage: 'container_registries',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToDockerHub',
      });

      return {
        channel: 'dockerhub',
        status: 'failed',
        error: response.message,
      };
    }
  }

  // ── Validation helpers ──────────────────────────────────────────

  /**
   * Validate that a version string is a valid semver format.
   * Requirement: 15.4
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
  private toOptions(): ContainerPublisherOptions {
    return {
      credentialManager: this.credentialManager,
      errorHandler: this.errorHandler,
      dryRun: this.dryRun,
      execCommand: this.execCommand,
    };
  }
}
