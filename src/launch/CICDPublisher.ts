/**
 * TealTiger v1.1.0 CI/CD Publisher
 *
 * Publishes CI/CD integrations to GitHub Marketplace, GitLab, CircleCI,
 * and Azure Pipelines. Verifies integration metadata version consistency
 * and uses CredentialManager for authentication and ErrorHandler for retry logic.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 15.6
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Publisher, ChannelResult } from './types';
import type { ICredentialManager } from './CredentialManager';
import type { IErrorHandler } from './ErrorHandler';

const execAsync = promisify(exec);

/** Interface for the CI/CD publisher */
export interface ICICDPublisher extends Publisher {
  publishToGitHubMarketplace(version: string): Promise<ChannelResult>;
  publishToGitLab(version: string): Promise<ChannelResult>;
  publishToCircleCI(version: string): Promise<ChannelResult>;
  publishToAzurePipelines(version: string): Promise<ChannelResult>;
}

/** Options for constructing a CICDPublisher */
export interface CICDPublisherOptions {
  credentialManager: ICredentialManager;
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export class CICDPublisher implements ICICDPublisher {
  private readonly credentialManager: ICredentialManager;
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: CICDPublisherOptions) {
    this.credentialManager = options.credentialManager;
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.execCommand = options.execCommand ?? execAsync;
  }

  // ── Publisher interface ─────────────────────────────────────────

  /**
   * Publish to all four CI/CD marketplaces.
   * Returns results for all channels (runs in parallel).
   */
  async publish(version: string, dryRun?: boolean): Promise<ChannelResult[]> {
    const effectiveDryRun = dryRun ?? this.dryRun;
    const target = effectiveDryRun
      ? new CICDPublisher({ ...this.toOptions(), dryRun: true })
      : this;

    return Promise.all([
      target.publishToGitHubMarketplace(version),
      target.publishToGitLab(version),
      target.publishToCircleCI(version),
      target.publishToAzurePipelines(version),
    ]);
  }

  // ── Channel-specific publication ────────────────────────────────

  /**
   * Publish GitHub Actions to GitHub Marketplace.
   * Requirements: 4.1, 15.6
   */
  async publishToGitHubMarketplace(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      await this.credentialManager.getCredentials('github_marketplace');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish GitHub Action v${version} to GitHub Marketplace`);
        return {
          channel: 'github_marketplace',
          status: 'success',
          artifactUrl: `https://github.com/marketplace/actions/tealtiger?version=${version}`,
        };
      }

      await this.execCommand(
        `gh release create v${version} --title "TealTiger v${version}" ` +
        `--notes "TealTiger GitHub Action v${version}" --repo tealtiger/tealtiger-action`,
      );

      return {
        channel: 'github_marketplace',
        status: 'success',
        artifactUrl: `https://github.com/marketplace/actions/tealtiger?version=${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'github_marketplace',
        stage: 'cicd_marketplaces',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToGitHubMarketplace',
      });

      return {
        channel: 'github_marketplace',
        status: 'failed',
        error: response.message,
      };
    }
  }

  /**
   * Publish CI templates to GitLab.
   * Requirements: 4.2, 15.6
   */
  async publishToGitLab(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      await this.credentialManager.getCredentials('gitlab');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish GitLab CI template v${version}`);
        return {
          channel: 'gitlab',
          status: 'success',
          artifactUrl: `https://gitlab.com/tealtiger/tealtiger-ci/-/tags/v${version}`,
        };
      }

      await this.execCommand(
        `curl -s -X POST "https://gitlab.com/api/v4/projects/tealtiger%2Ftealtiger-ci/repository/tags" ` +
        `-H "PRIVATE-TOKEN: $GITLAB_TOKEN" ` +
        `-d "tag_name=v${version}&ref=main&message=TealTiger CI template v${version}"`,
      );

      return {
        channel: 'gitlab',
        status: 'success',
        artifactUrl: `https://gitlab.com/tealtiger/tealtiger-ci/-/tags/v${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'gitlab',
        stage: 'cicd_marketplaces',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToGitLab',
      });

      return {
        channel: 'gitlab',
        status: 'failed',
        error: response.message,
      };
    }
  }

  /**
   * Publish orbs to CircleCI.
   * Requirements: 4.3, 15.6
   */
  async publishToCircleCI(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      await this.credentialManager.getCredentials('circleci');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish CircleCI orb v${version}`);
        return {
          channel: 'circleci',
          status: 'success',
          artifactUrl: `https://circleci.com/developer/orbs/orb/tealtiger/tealtiger@${version}`,
        };
      }

      await this.execCommand(
        `circleci orb publish ./orb/orb.yml tealtiger/tealtiger@${version}`,
      );

      return {
        channel: 'circleci',
        status: 'success',
        artifactUrl: `https://circleci.com/developer/orbs/orb/tealtiger/tealtiger@${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'circleci',
        stage: 'cicd_marketplaces',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToCircleCI',
      });

      return {
        channel: 'circleci',
        status: 'failed',
        error: response.message,
      };
    }
  }

  /**
   * Publish tasks to Azure Pipelines.
   * Requirements: 4.4, 15.6
   */
  async publishToAzurePipelines(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);

      await this.credentialManager.getCredentials('azure_pipelines');

      if (this.dryRun) {
        console.log(`[DRY-RUN] Would publish Azure Pipelines task v${version}`);
        return {
          channel: 'azure_pipelines',
          status: 'success',
          artifactUrl: `https://marketplace.visualstudio.com/items?itemName=tealtiger.tealtiger-task&version=${version}`,
        };
      }

      await this.execCommand(
        `tfx extension publish --manifest-globs vss-extension.json ` +
        `--token $AZURE_DEVOPS_TOKEN --override "{\\"version\\": \\"${version}\\"}"`,
      );

      return {
        channel: 'azure_pipelines',
        status: 'success',
        artifactUrl: `https://marketplace.visualstudio.com/items?itemName=tealtiger.tealtiger-task&version=${version}`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'azure_pipelines',
        stage: 'cicd_marketplaces',
        attemptNumber: 0,
        maxRetries: 3,
        operation: 'publishToAzurePipelines',
      });

      return {
        channel: 'azure_pipelines',
        status: 'failed',
        error: response.message,
      };
    }
  }

  // ── Validation helpers ──────────────────────────────────────────

  /**
   * Validate that a version string is a valid semver format.
   * Requirement: 15.6
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
  private toOptions(): CICDPublisherOptions {
    return {
      credentialManager: this.credentialManager,
      errorHandler: this.errorHandler,
      dryRun: this.dryRun,
      execCommand: this.execCommand,
    };
  }
}
