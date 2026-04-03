/**
 * TealTiger v1.1.0 Lambda Publisher
 *
 * Publishes Lambda layers for all 8 supported runtimes to all 33 AWS
 * commercial regions, and deploys the Lambda layer registry website to
 * layers.tealtiger.ai. Uses CredentialManager for AWS authentication,
 * ErrorHandler for retry logic with exponential backoff, and generates
 * regional reports showing success/failure per region.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 14.1, 14.2, 14.3, 14.4, 14.5, 15.7
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Publisher, ChannelResult } from './types';
import type { ICredentialManager } from './CredentialManager';
import type { IErrorHandler } from './ErrorHandler';

const execAsync = promisify(exec);

/** All 8 supported Lambda runtimes */
export const SUPPORTED_RUNTIMES = [
  'python3.9',
  'python3.10',
  'python3.11',
  'python3.12',
  'python3.13',
  'nodejs18.x',
  'nodejs20.x',
  'nodejs22.x',
] as const;

export type LambdaRuntime = (typeof SUPPORTED_RUNTIMES)[number];

/** All 33 AWS commercial regions (Requirements: 14.1) */
export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'af-south-1',
  'ap-east-1',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ca-central-1',
  'ca-west-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-south-1',
  'eu-south-2',
  'eu-north-1',
  'il-central-1',
  'me-south-1',
  'me-central-1',
  'sa-east-1',
  'us-gov-east-1',
  'us-gov-west-1',
  'cn-north-1',
  'cn-northwest-1',
] as const;

export type AwsRegion = (typeof AWS_REGIONS)[number];

/** Result of publishing layers to a single region */
export interface RegionPublishResult {
  region: AwsRegion;
  status: 'success' | 'failed';
  runtimes: RuntimePublishResult[];
  error?: string;
}

/** Result of publishing a single runtime layer in a region */
export interface RuntimePublishResult {
  runtime: LambdaRuntime;
  status: 'success' | 'failed';
  layerArn?: string;
  error?: string;
}

/** Regional report summarising success/failure per region (Requirement: 14.5) */
export interface RegionalReport {
  totalRegions: number;
  successfulRegions: number;
  failedRegions: number;
  regions: RegionPublishResult[];
  generatedAt: Date;
}

/** Interface for the Lambda publisher */
export interface ILambdaPublisher extends Publisher {
  publishLayers(version: string): Promise<ChannelResult>;
  publishRegistryWebsite(version: string): Promise<ChannelResult>;
}

/** Options for constructing a LambdaPublisher */
export interface LambdaPublisherOptions {
  credentialManager: ICredentialManager;
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

/** Maximum retry attempts for region failures (Requirement: 14.3) */
const MAX_REGION_RETRIES = 3;

/** Base delay in ms for exponential backoff */
const BASE_DELAY_MS = 1_000;

/** Maximum delay cap in ms */
const MAX_DELAY_MS = 30_000;

export class LambdaPublisher implements ILambdaPublisher {
  private readonly credentialManager: ICredentialManager;
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: LambdaPublisherOptions) {
    this.credentialManager = options.credentialManager;
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.execCommand = options.execCommand ?? execAsync;
  }

  // ── Publisher interface ─────────────────────────────────────────

  /**
   * Publish Lambda layers to all regions, then deploy the registry website.
   * Returns results for both channels.
   */
  async publish(version: string, dryRun?: boolean): Promise<ChannelResult[]> {
    const effectiveDryRun = dryRun ?? this.dryRun;
    const target = effectiveDryRun
      ? new LambdaPublisher({ ...this.toOptions(), dryRun: true })
      : this;

    const layerResult = await target.publishLayers(version);
    const websiteResult = await target.publishRegistryWebsite(version);

    return [layerResult, websiteResult];
  }

  // ── Layer publication ───────────────────────────────────────────

  /**
   * Build layers for all 8 runtimes and publish to all 33 AWS regions.
   * Retries failed regions up to 3 times with exponential backoff.
   * Continues to next region on final failure and reports the result.
   *
   * Requirements: 5.1, 5.3, 5.4, 14.1, 14.2, 14.3, 14.4, 14.5, 15.7
   */
  async publishLayers(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);
      await this.credentialManager.getCredentials('lambda_layers');

      // Build layers for all runtimes
      await this.buildAllLayers(version);

      // Publish to all regions with retry logic
      const regionResults: RegionPublishResult[] = [];

      for (const region of AWS_REGIONS) {
        const result = await this.publishToRegionWithRetry(version, region);
        regionResults.push(result);
      }

      // Generate regional report (Requirement: 14.5)
      const report = this.generateRegionalReport(regionResults);

      const failedRegions = report.regions.filter((r) => r.status === 'failed');
      const allSucceeded = failedRegions.length === 0;

      if (allSucceeded) {
        return {
          channel: 'lambda_layers',
          status: 'success',
          artifactUrl: `https://layers.tealtiger.ai/v${version}`,
        };
      }

      // Partial success — some regions failed after retries (Requirement: 14.4)
      return {
        channel: 'lambda_layers',
        status: 'failed',
        error:
          `Publication failed in ${failedRegions.length}/${report.totalRegions} regions: ` +
          failedRegions.map((r) => r.region).join(', '),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'lambda_layers',
        stage: 'lambda_registry',
        attemptNumber: 0,
        maxRetries: MAX_REGION_RETRIES,
        operation: 'publishLayers',
      });

      return {
        channel: 'lambda_layers',
        status: 'failed',
        error: response.message,
      };
    }
  }

  // ── Registry website deployment ─────────────────────────────────

  /**
   * Deploy the Lambda layer registry website to layers.tealtiger.ai.
   * Generates installation instructions and ARN display for all regions/runtimes.
   *
   * Requirements: 5.2, 5.5, 5.7
   */
  async publishRegistryWebsite(version: string): Promise<ChannelResult> {
    try {
      this.validateVersionFormat(version);
      await this.credentialManager.getCredentials('lambda_registry_website');

      if (this.dryRun) {
        console.log(
          `[DRY-RUN] Would deploy registry website for v${version} to layers.tealtiger.ai`,
        );
        return {
          channel: 'lambda_registry_website',
          status: 'success',
          artifactUrl: 'https://layers.tealtiger.ai',
        };
      }

      // Build the static registry website
      await this.execCommand(
        `node scripts/build-registry-site.js --version ${version} ` +
        `--runtimes ${SUPPORTED_RUNTIMES.join(',')} ` +
        `--regions ${AWS_REGIONS.join(',')}`,
      );

      // Deploy to S3
      await this.execCommand(
        `aws s3 sync ./dist/registry-site s3://layers.tealtiger.ai --delete`,
      );

      // Invalidate CloudFront cache
      await this.execCommand(
        `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"`,
      );

      return {
        channel: 'lambda_registry_website',
        status: 'success',
        artifactUrl: 'https://layers.tealtiger.ai',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response = this.errorHandler.handleError(err, {
        category: 'publication',
        channel: 'lambda_registry_website',
        stage: 'lambda_registry',
        attemptNumber: 0,
        maxRetries: MAX_REGION_RETRIES,
        operation: 'publishRegistryWebsite',
      });

      return {
        channel: 'lambda_registry_website',
        status: 'failed',
        error: response.message,
      };
    }
  }

  // ── Layer building ──────────────────────────────────────────────

  /**
   * Build Lambda layer packages for all 8 runtimes.
   * Requirements: 5.3, 5.4
   */
  private async buildAllLayers(version: string): Promise<void> {
    if (this.dryRun) {
      console.log(`[DRY-RUN] Would build layers for ${SUPPORTED_RUNTIMES.length} runtimes`);
      return;
    }

    for (const runtime of SUPPORTED_RUNTIMES) {
      await this.buildLayerForRuntime(runtime, version);
    }
  }

  /**
   * Build a single Lambda layer package for a specific runtime.
   */
  private async buildLayerForRuntime(runtime: LambdaRuntime, version: string): Promise<void> {
    if (runtime.startsWith('python')) {
      await this.execCommand(
        `pip install tealtiger==${version} -t layers/${runtime}/python --no-deps`,
      );
    } else {
      // Node.js runtimes
      await this.execCommand(
        `npm pack tealtiger@${version} && ` +
        `mkdir -p layers/${runtime}/nodejs && ` +
        `tar -xzf tealtiger-${version}.tgz -C layers/${runtime}/nodejs`,
      );
    }

    // Package the layer as a zip
    await this.execCommand(
      `cd layers/${runtime} && zip -r ../tealtiger-${runtime}.zip .`,
    );
  }

  // ── Region publication with retry ───────────────────────────────

  /**
   * Publish layers to a single region with retry logic.
   * Retries up to MAX_REGION_RETRIES times with exponential backoff.
   *
   * Requirements: 14.2, 14.3, 14.4
   */
  private async publishToRegionWithRetry(
    version: string,
    region: AwsRegion,
  ): Promise<RegionPublishResult> {
    for (let attempt = 1; attempt <= MAX_REGION_RETRIES; attempt++) {
      try {
        const runtimeResults = await this.publishAllRuntimesToRegion(version, region);

        const hasFailures = runtimeResults.some((r) => r.status === 'failed');
        if (hasFailures && attempt < MAX_REGION_RETRIES) {
          const delay = this.calculateBackoff(attempt);
          await this.sleep(delay);
          continue;
        }

        const result: RegionPublishResult = {
          region,
          status: hasFailures ? 'failed' : 'success',
          runtimes: runtimeResults,
        };
        if (hasFailures) {
          result.error = `Some runtimes failed in ${region}`;
        }
        return result;
      } catch (error) {
        if (attempt === MAX_REGION_RETRIES) {
          const err = error instanceof Error ? error : new Error(String(error));
          return {
            region,
            status: 'failed',
            runtimes: [],
            error: `Failed after ${MAX_REGION_RETRIES} attempts: ${err.message}`,
          };
        }

        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    // Should never reach here, but satisfy TypeScript
    return {
      region,
      status: 'failed',
      runtimes: [],
      error: `Failed after ${MAX_REGION_RETRIES} attempts`,
    };
  }

  /**
   * Publish all runtime layers to a single region.
   * Uses the region-specific AWS endpoint (Requirement: 14.2).
   */
  private async publishAllRuntimesToRegion(
    version: string,
    region: AwsRegion,
  ): Promise<RuntimePublishResult[]> {
    const results: RuntimePublishResult[] = [];

    for (const runtime of SUPPORTED_RUNTIMES) {
      const result = await this.publishRuntimeToRegion(version, runtime, region);
      results.push(result);
    }

    return results;
  }

  /**
   * Publish a single runtime layer to a single region.
   * Uses region-specific endpoint via --region flag.
   *
   * Requirements: 14.2, 15.7
   */
  private async publishRuntimeToRegion(
    version: string,
    runtime: LambdaRuntime,
    region: AwsRegion,
  ): Promise<RuntimePublishResult> {
    if (this.dryRun) {
      return {
        runtime,
        status: 'success',
        layerArn: `arn:aws:lambda:${region}:123456789012:layer:tealtiger-${runtime}:1`,
      };
    }

    try {
      const compatibleRuntime = this.toAwsRuntimeIdentifier(runtime);
      const { stdout } = await this.execCommand(
        `aws lambda publish-layer-version ` +
        `--region ${region} ` +
        `--layer-name tealtiger-${runtime} ` +
        `--description "TealTiger v${version} for ${runtime}" ` +
        `--compatible-runtimes ${compatibleRuntime} ` +
        `--zip-file fileb://layers/tealtiger-${runtime}.zip ` +
        `--output json`,
      );

      const response = JSON.parse(stdout);
      const layerArn = response.LayerVersionArn as string;

      // Make the layer publicly accessible
      await this.execCommand(
        `aws lambda add-layer-version-permission ` +
        `--region ${region} ` +
        `--layer-name tealtiger-${runtime} ` +
        `--version-number ${response.Version} ` +
        `--statement-id public-access ` +
        `--action lambda:GetLayerVersion ` +
        `--principal "*" ` +
        `--output json`,
      );

      return {
        runtime,
        status: 'success',
        layerArn,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        runtime,
        status: 'failed',
        error: err.message,
      };
    }
  }

  // ── Regional report generation ──────────────────────────────────

  /**
   * Generate a regional report showing success/failure per region.
   * Requirement: 14.5
   */
  generateRegionalReport(regionResults: RegionPublishResult[]): RegionalReport {
    const successfulRegions = regionResults.filter((r) => r.status === 'success').length;
    const failedRegions = regionResults.filter((r) => r.status === 'failed').length;

    return {
      totalRegions: regionResults.length,
      successfulRegions,
      failedRegions,
      regions: regionResults,
      generatedAt: new Date(),
    };
  }

  // ── Validation helpers ──────────────────────────────────────────

  /**
   * Validate that a version string is a valid semver format.
   * Requirement: 15.7
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

  /**
   * Map our runtime identifier to the AWS-compatible runtime string.
   */
  private toAwsRuntimeIdentifier(runtime: LambdaRuntime): string {
    // AWS uses the same identifiers we use
    return runtime;
  }

  /**
   * Calculate exponential backoff delay with jitter.
   *
   *   delay = min(baseDelay × 2^(attempt-1), maxDelay) × jitter
   *
   * where jitter ∈ [0.5, 1.0)
   */
  private calculateBackoff(attempt: number): number {
    const exponential = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    const capped = Math.min(exponential, MAX_DELAY_MS);
    const jitter = 0.5 + Math.random() * 0.5;
    return Math.floor(capped * jitter);
  }

  /** Sleep for the given number of milliseconds. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Reconstruct options for creating a modified copy (e.g. dry-run override). */
  private toOptions(): LambdaPublisherOptions {
    return {
      credentialManager: this.credentialManager,
      errorHandler: this.errorHandler,
      dryRun: this.dryRun,
      execCommand: this.execCommand,
    };
  }
}
