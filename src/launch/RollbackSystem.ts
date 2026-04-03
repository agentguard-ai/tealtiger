/**
 * TealTiger v1.1.0 Rollback System
 *
 * Handles rapid rollback across all distribution channels when critical
 * issues are detected. Each channel has a specific rollback strategy:
 * npm (deprecate), PyPI (yank), containers (delete tags), IaC (unpublish),
 * CI/CD (unpublish), Lambda (delete layer versions from all 33 regions).
 * Generates a rollback report summarising all actions taken.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { DistributionChannel, ChannelResult } from './types';
import type { IErrorHandler } from './ErrorHandler';
import { AWS_REGIONS } from './LambdaPublisher';

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────

/** Result of rolling back a single channel */
export interface ChannelRollbackResult {
  channel: DistributionChannel;
  status: 'success' | 'failed' | 'not_applicable';
  action: string;
  error?: string;
}

/** Result of a full rollback execution */
export interface RollbackResult {
  version: string;
  reason: string;
  startTime: Date;
  endTime: Date;
  channels: ChannelRollbackResult[];
  overallStatus: 'success' | 'partial' | 'failed';
}

/** Summary report generated after rollback completes */
export interface RollbackReport {
  version: string;
  reason: string;
  overallStatus: 'success' | 'partial' | 'failed';
  totalChannels: number;
  successfulRollbacks: number;
  failedRollbacks: number;
  skippedChannels: number;
  channels: ChannelRollbackResult[];
  duration: number;
  generatedAt: Date;
}

/** Interface for the rollback system */
export interface IRollbackSystem {
  /**
   * Execute rollback across all channels that were successfully published.
   * @param results - Channel results from the publication run
   * @param version - Version to rollback
   * @param reason - Reason for rollback
   * @returns Rollback result with per-channel status
   */
  executeRollback(
    results: ChannelResult[],
    version: string,
    reason: string,
  ): Promise<RollbackResult>;

  /**
   * Rollback a specific channel.
   * @param channel - Distribution channel to rollback
   * @param version - Version to rollback
   * @returns Channel rollback result
   */
  rollbackChannel(
    channel: DistributionChannel,
    version: string,
  ): Promise<ChannelRollbackResult>;
}

/** Options for constructing a RollbackSystem */
export interface RollbackSystemOptions {
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

// ── Rollback strategies per channel ────────────────────────────────

/**
 * Map from channel to the shell command template used for rollback.
 * `{{version}}` is replaced at runtime.
 */
const ROLLBACK_ACTIONS: Record<DistributionChannel, string> = {
  npm: 'npm deprecate',
  pypi: 'twine yank',
  ghcr: 'delete GHCR tag',
  dockerhub: 'delete Docker Hub tag',
  terraform: 'unpublish Terraform module',
  pulumi: 'unpublish Pulumi package',
  helm: 'remove Helm chart version',
  ansible: 'delete Ansible Galaxy version',
  github_marketplace: 'unpublish GitHub Action release',
  gitlab: 'delete GitLab tag',
  circleci: 'unpublish CircleCI orb version',
  azure_pipelines: 'unpublish Azure Pipelines task',
  lambda_layers: 'delete Lambda layer versions (all regions)',
  lambda_registry_website: 'not_applicable',
};

export class RollbackSystem implements IRollbackSystem {
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: RollbackSystemOptions) {
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.execCommand = options.execCommand ?? execAsync;
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Execute rollback for all channels that were successfully published.
   * Only channels with status === 'success' are rolled back.
   * Requirements: 9.1, 9.8
   */
  async executeRollback(
    results: ChannelResult[],
    version: string,
    reason: string,
  ): Promise<RollbackResult> {
    const startTime = new Date();
    const channelResults: ChannelRollbackResult[] = [];

    // Roll back only successfully published channels (Requirement: 9.1)
    const rollbackPromises = results.map(async (result) => {
      if (result.status !== 'success') {
        return {
          channel: result.channel,
          status: 'not_applicable' as const,
          action: 'skipped — publication was not successful',
        };
      }
      return this.rollbackChannel(result.channel, version);
    });

    const settled = await Promise.all(rollbackPromises);
    channelResults.push(...settled);

    const endTime = new Date();
    const hasFailures = channelResults.some((c) => c.status === 'failed');
    const allSkipped = channelResults.every((c) => c.status === 'not_applicable');

    return {
      version,
      reason,
      startTime,
      endTime,
      channels: channelResults,
      overallStatus: allSkipped
        ? 'success'
        : hasFailures
          ? 'partial'
          : 'success',
    };
  }

  /**
   * Rollback a specific distribution channel.
   * Dispatches to the channel-specific rollback strategy.
   */
  async rollbackChannel(
    channel: DistributionChannel,
    version: string,
  ): Promise<ChannelRollbackResult> {
    const action = ROLLBACK_ACTIONS[channel];

    // The registry website is static and doesn't need rollback
    if (channel === 'lambda_registry_website') {
      return { channel, status: 'not_applicable', action: 'no rollback needed for static website' };
    }

    try {
      switch (channel) {
        case 'npm':
          return await this.rollbackNpm(version);
        case 'pypi':
          return await this.rollbackPyPI(version);
        case 'ghcr':
          return await this.rollbackGhcr(version);
        case 'dockerhub':
          return await this.rollbackDockerHub(version);
        case 'terraform':
          return await this.rollbackTerraform(version);
        case 'pulumi':
          return await this.rollbackPulumi(version);
        case 'helm':
          return await this.rollbackHelm(version);
        case 'ansible':
          return await this.rollbackAnsible(version);
        case 'github_marketplace':
          return await this.rollbackGitHubMarketplace(version);
        case 'gitlab':
          return await this.rollbackGitLab(version);
        case 'circleci':
          return await this.rollbackCircleCI(version);
        case 'azure_pipelines':
          return await this.rollbackAzurePipelines(version);
        case 'lambda_layers':
          return await this.rollbackLambdaLayers(version);
        default:
          return { channel, status: 'failed', action, error: `Unknown channel: ${channel}` };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandler.handleError(err, {
        category: 'rollback',
        channel,
        attemptNumber: 0,
        maxRetries: 1,
        operation: `rollback_${channel}`,
      });
      return { channel, status: 'failed', action, error: err.message };
    }
  }

  // ── Channel-specific rollback strategies ────────────────────────

  /**
   * npm rollback: deprecate the version with a warning message.
   * Requirement: 9.2
   */
  private async rollbackNpm(version: string): Promise<ChannelRollbackResult> {
    const action = `npm deprecate tealtiger@${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would deprecate npm package tealtiger@${version}`);
      return { channel: 'npm', status: 'success', action };
    }

    await this.execCommand(
      `npm deprecate tealtiger@${version} "Critical issue detected. Please use a previous version."`,
    );
    return { channel: 'npm', status: 'success', action };
  }

  /**
   * PyPI rollback: yank the version from the index.
   * Requirement: 9.3
   */
  private async rollbackPyPI(version: string): Promise<ChannelRollbackResult> {
    const action = `twine yank tealtiger ${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would yank PyPI package tealtiger ${version}`);
      return { channel: 'pypi', status: 'success', action };
    }

    await this.execCommand(
      `twine yank tealtiger ${version} -r pypi --reason "Critical issue detected"`,
    );
    return { channel: 'pypi', status: 'success', action };
  }

  /**
   * GHCR rollback: delete the version tag from GitHub Container Registry.
   * Requirement: 9.4
   */
  private async rollbackGhcr(version: string): Promise<ChannelRollbackResult> {
    const action = `delete GHCR tag ghcr.io/tealtiger/tealtiger:${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete GHCR tag ${version}`);
      return { channel: 'ghcr', status: 'success', action };
    }

    await this.execCommand(
      `gh api -X DELETE /orgs/tealtiger/packages/container/tealtiger/versions ` +
      `--jq '.[] | select(.metadata.container.tags[] == "${version}") | .id' | ` +
      `xargs -I {} gh api -X DELETE /orgs/tealtiger/packages/container/tealtiger/versions/{}`,
    );
    return { channel: 'ghcr', status: 'success', action };
  }

  /**
   * Docker Hub rollback: delete the version tag.
   * Requirement: 9.4
   */
  private async rollbackDockerHub(version: string): Promise<ChannelRollbackResult> {
    const action = `delete Docker Hub tag tealtiger/tealtiger:${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete Docker Hub tag ${version}`);
      return { channel: 'dockerhub', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://hub.docker.com/v2/repositories/tealtiger/tealtiger/tags/${version}/" ` +
      `-H "Authorization: Bearer $DOCKERHUB_TOKEN"`,
    );
    return { channel: 'dockerhub', status: 'success', action };
  }

  /**
   * Terraform rollback: unpublish the module version from Terraform Registry.
   * Requirement: 9.5
   */
  private async rollbackTerraform(version: string): Promise<ChannelRollbackResult> {
    const action = `unpublish Terraform module tealtiger v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would unpublish Terraform module v${version}`);
      return { channel: 'terraform', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://app.terraform.io/api/v2/organizations/tealtiger/registry-modules/private/tealtiger/tealtiger/aws/${version}" ` +
      `-H "Authorization: Bearer $TERRAFORM_CLOUD_TOKEN"`,
    );
    return { channel: 'terraform', status: 'success', action };
  }

  /**
   * Pulumi rollback: unpublish the package version from Pulumi Registry.
   * Requirement: 9.5
   */
  private async rollbackPulumi(version: string): Promise<ChannelRollbackResult> {
    const action = `unpublish Pulumi package tealtiger v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would unpublish Pulumi package v${version}`);
      return { channel: 'pulumi', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://api.pulumi.com/api/packages/tealtiger/tealtiger/versions/${version}" ` +
      `-H "Authorization: token $PULUMI_ACCESS_TOKEN"`,
    );
    return { channel: 'pulumi', status: 'success', action };
  }

  /**
   * Helm rollback: remove the chart version from the Helm repository.
   * Requirement: 9.5
   */
  private async rollbackHelm(version: string): Promise<ChannelRollbackResult> {
    const action = `remove Helm chart tealtiger v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would remove Helm chart v${version}`);
      return { channel: 'helm', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://charts.tealtiger.ai/api/charts/tealtiger/${version}" ` +
      `-u "$HELM_REPO_USERNAME:$HELM_REPO_PASSWORD"`,
    );
    return { channel: 'helm', status: 'success', action };
  }

  /**
   * Ansible rollback: delete the version from Ansible Galaxy.
   * Requirement: 9.5
   */
  private async rollbackAnsible(version: string): Promise<ChannelRollbackResult> {
    const action = `delete Ansible Galaxy version tealtiger v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete Ansible Galaxy version v${version}`);
      return { channel: 'ansible', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/index/tealtiger/tealtiger/versions/${version}/" ` +
      `-H "Authorization: Token $ANSIBLE_GALAXY_TOKEN"`,
    );
    return { channel: 'ansible', status: 'success', action };
  }

  /**
   * GitHub Marketplace rollback: unpublish the GitHub Action release.
   * Requirement: 9.6
   */
  private async rollbackGitHubMarketplace(version: string): Promise<ChannelRollbackResult> {
    const action = `unpublish GitHub Action release v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would unpublish GitHub Action release v${version}`);
      return { channel: 'github_marketplace', status: 'success', action };
    }

    await this.execCommand(
      `gh release delete v${version} --repo tealtiger/tealtiger-action --yes`,
    );
    return { channel: 'github_marketplace', status: 'success', action };
  }

  /**
   * GitLab rollback: delete the tag from GitLab.
   * Requirement: 9.6
   */
  private async rollbackGitLab(version: string): Promise<ChannelRollbackResult> {
    const action = `delete GitLab tag v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete GitLab tag v${version}`);
      return { channel: 'gitlab', status: 'success', action };
    }

    await this.execCommand(
      `curl -s -X DELETE ` +
      `"https://gitlab.com/api/v4/projects/tealtiger%2Ftealtiger-ci/repository/tags/v${version}" ` +
      `-H "PRIVATE-TOKEN: $GITLAB_TOKEN"`,
    );
    return { channel: 'gitlab', status: 'success', action };
  }

  /**
   * CircleCI rollback: unpublish the orb version.
   * Requirement: 9.6
   */
  private async rollbackCircleCI(version: string): Promise<ChannelRollbackResult> {
    const action = `unpublish CircleCI orb tealtiger/tealtiger@${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would unpublish CircleCI orb v${version}`);
      return { channel: 'circleci', status: 'success', action };
    }

    await this.execCommand(
      `circleci orb unlist tealtiger/tealtiger@${version}`,
    );
    return { channel: 'circleci', status: 'success', action };
  }

  /**
   * Azure Pipelines rollback: unpublish the task extension.
   * Requirement: 9.6
   */
  private async rollbackAzurePipelines(version: string): Promise<ChannelRollbackResult> {
    const action = `unpublish Azure Pipelines task v${version}`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would unpublish Azure Pipelines task v${version}`);
      return { channel: 'azure_pipelines', status: 'success', action };
    }

    await this.execCommand(
      `tfx extension unpublish --publisher tealtiger --extension-id tealtiger-task ` +
      `--token $AZURE_DEVOPS_TOKEN`,
    );
    return { channel: 'azure_pipelines', status: 'success', action };
  }

  /**
   * Lambda rollback: delete layer versions from all 33 AWS regions.
   * Iterates over every region and every runtime, deleting the layer version.
   * Requirement: 9.7
   */
  private async rollbackLambdaLayers(version: string): Promise<ChannelRollbackResult> {
    const action = `delete Lambda layer versions from all ${AWS_REGIONS.length} regions`;

    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete Lambda layers v${version} from ${AWS_REGIONS.length} regions`);
      return { channel: 'lambda_layers', status: 'success', action };
    }

    const runtimes = [
      'python3.9', 'python3.10', 'python3.11', 'python3.12', 'python3.13',
      'nodejs18.x', 'nodejs20.x', 'nodejs22.x',
    ];

    const errors: string[] = [];

    // Delete layers from all regions in parallel for speed
    const regionPromises = AWS_REGIONS.map(async (region) => {
      for (const runtime of runtimes) {
        try {
          // List layer versions to find the one matching our version
          const { stdout } = await this.execCommand(
            `aws lambda list-layer-versions ` +
            `--region ${region} ` +
            `--layer-name tealtiger-${runtime} ` +
            `--query "LayerVersions[?Description=='TealTiger v${version} for ${runtime}'].Version" ` +
            `--output json`,
          );

          const versions: number[] = JSON.parse(stdout);
          for (const layerVersion of versions) {
            await this.execCommand(
              `aws lambda delete-layer-version ` +
              `--region ${region} ` +
              `--layer-name tealtiger-${runtime} ` +
              `--version-number ${layerVersion}`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${region}/${runtime}: ${msg}`);
        }
      }
    });

    await Promise.all(regionPromises);

    if (errors.length > 0) {
      return {
        channel: 'lambda_layers',
        status: 'failed',
        action,
        error: `Failed to delete some layers: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`,
      };
    }

    return { channel: 'lambda_layers', status: 'success', action };
  }

  // ── Report generation ───────────────────────────────────────────

  /**
   * Generate a rollback report summarising all channel actions.
   * Requirement: 9.8
   */
  generateReport(result: RollbackResult): RollbackReport {
    const successful = result.channels.filter((c) => c.status === 'success').length;
    const failed = result.channels.filter((c) => c.status === 'failed').length;
    const skipped = result.channels.filter((c) => c.status === 'not_applicable').length;
    const duration = result.endTime.getTime() - result.startTime.getTime();

    return {
      version: result.version,
      reason: result.reason,
      overallStatus: result.overallStatus,
      totalChannels: result.channels.length,
      successfulRollbacks: successful,
      failedRollbacks: failed,
      skippedChannels: skipped,
      channels: result.channels,
      duration,
      generatedAt: new Date(),
    };
  }
}
