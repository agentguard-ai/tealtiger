/**
 * TealTiger v1.1.0 Credential Manager
 *
 * Securely manages authentication credentials for all distribution channels.
 * Credentials are retrieved from environment variables (GitHub Secrets) and
 * are NEVER logged or printed to console.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.1-12.10
 */

import type {
  DistributionChannel,
  ChannelCredentials,
  CredentialRotationStatus,
} from './types';

/** Interface for the credential manager */
export interface ICredentialManager {
  getCredentials(channel: DistributionChannel): Promise<ChannelCredentials>;
  validateAllCredentials(): Promise<void>;
  checkRotationNeeded(): Promise<CredentialRotationStatus[]>;
  rotateCredentials(channel: DistributionChannel): Promise<void>;
}

/**
 * Required environment variable names for each distribution channel.
 * Maps channel → list of env var names that must be present.
 */
export const REQUIRED_CREDENTIALS: ReadonlyMap<DistributionChannel, readonly string[]> = new Map([
  ['npm', ['NPM_TOKEN']],
  ['pypi', ['PYPI_TOKEN']],
  ['dockerhub', ['DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN']],
  ['ghcr', ['GITHUB_TOKEN']],
  ['terraform', ['TERRAFORM_CLOUD_TOKEN']],
  ['pulumi', ['PULUMI_ACCESS_TOKEN']],
  ['helm', ['HELM_REPO_USERNAME', 'HELM_REPO_PASSWORD']],
  ['ansible', ['ANSIBLE_GALAXY_TOKEN']],
  ['github_marketplace', ['GITHUB_TOKEN']],
  ['gitlab', ['GITLAB_TOKEN']],
  ['circleci', ['CIRCLECI_TOKEN']],
  ['azure_pipelines', ['AZURE_DEVOPS_TOKEN']],
  ['lambda_layers', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']],
  ['lambda_registry_website', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']],
]);

/** Rotation interval in days */
const ROTATION_INTERVAL_DAYS = 90;

export class CredentialManager implements ICredentialManager {
  /**
   * Retrieve credentials for a specific distribution channel.
   * Reads values from environment variables (GitHub Secrets at runtime).
   * Credentials are NEVER logged.
   */
  async getCredentials(channel: DistributionChannel): Promise<ChannelCredentials> {
    const requiredSecrets = REQUIRED_CREDENTIALS.get(channel);

    if (!requiredSecrets) {
      throw new Error(`Unknown channel: ${channel}`);
    }

    const credentials: Record<string, string> = {};

    for (const secretName of requiredSecrets) {
      const value = process.env[secretName];

      if (!value) {
        throw new Error(
          `Missing credential: ${secretName} for channel ${channel}. ` +
          `Please add this secret to GitHub repository settings.`,
        );
      }

      credentials[secretName] = value;
    }

    const lastRotated = this.getRotationMetadata(channel);

    const result: ChannelCredentials = {
      channel,
      type: this.getCredentialType(channel),
      credentials,
    };

    if (lastRotated !== undefined) {
      result.lastRotated = lastRotated;
    }

    return result;
  }

  /**
   * Validate that ALL required credentials exist for every channel.
   * Throws with a descriptive message listing every missing credential.
   * Requirements: 6.4, 12.1-12.10
   */
  async validateAllCredentials(): Promise<void> {
    const missing: string[] = [];

    for (const [channel, secrets] of REQUIRED_CREDENTIALS.entries()) {
      for (const secretName of secrets) {
        if (!process.env[secretName]) {
          missing.push(`${channel}: ${secretName}`);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required credentials:\n${missing.map((c) => `  - ${c}`).join('\n')}\n\n` +
        `Please add these secrets to GitHub repository settings before launching.`,
      );
    }
  }

  /**
   * Check which credentials need rotation based on the 90-day interval.
   * Reads rotation metadata from environment variables.
   * Requirements: 6.6
   */
  async checkRotationNeeded(): Promise<CredentialRotationStatus[]> {
    const statuses: CredentialRotationStatus[] = [];

    for (const channel of REQUIRED_CREDENTIALS.keys()) {
      const lastRotated = this.getRotationMetadata(channel);

      if (lastRotated) {
        const daysSinceRotation = Math.floor(
          (Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24),
        );

        statuses.push({
          channel,
          lastRotated,
          needsRotation: daysSinceRotation >= ROTATION_INTERVAL_DAYS,
          daysUntilExpiry: Math.max(0, ROTATION_INTERVAL_DAYS - daysSinceRotation),
        });
      }
    }

    return statuses;
  }

  /**
   * Rotate credentials for a channel.
   * In practice this would call the GitHub API to update secrets.
   * Currently a placeholder that logs the intent (without credential values).
   */
  async rotateCredentials(channel: DistributionChannel): Promise<void> {
    const requiredSecrets = REQUIRED_CREDENTIALS.get(channel);
    if (!requiredSecrets) {
      throw new Error(`Unknown channel: ${channel}`);
    }
    // Rotation would be handled via GitHub API in production.
    // We intentionally do NOT log any credential values here.
    console.log(`Credential rotation requested for channel: ${channel}`);
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Determine the credential type for a channel.
   */
  private getCredentialType(channel: DistributionChannel): ChannelCredentials['type'] {
    if (channel === 'lambda_layers' || channel === 'lambda_registry_website') {
      return 'aws_credentials';
    }
    if (channel === 'dockerhub' || channel === 'helm') {
      return 'username_password';
    }
    return 'token';
  }

  /**
   * Read rotation metadata from an environment variable.
   * Convention: <CHANNEL_UPPER>_CREDENTIAL_ROTATED_AT = ISO timestamp
   */
  private getRotationMetadata(channel: DistributionChannel): Date | undefined {
    const metadataKey = `${channel.toUpperCase()}_CREDENTIAL_ROTATED_AT`;
    const timestamp = process.env[metadataKey];
    return timestamp ? new Date(timestamp) : undefined;
  }
}
