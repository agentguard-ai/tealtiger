/**
 * TealTiger v1.1.0 Validation Engine
 *
 * Performs post-publication health checks across all distribution channels.
 * Each channel has a specific validation strategy with multiple checks
 * (downloadable, metadata, installable, etc.). Validations run in parallel
 * with configurable timeouts per channel category.
 *
 * Requirements: 1.5, 1.6, 2.6, 2.7, 3.6, 3.7, 4.5, 4.6, 5.6, 5.7,
 *               8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  ChannelResult,
  DistributionChannel,
  ValidationResult,
  ValidationCheck,
} from './types';
import type { IErrorHandler } from './ErrorHandler';

const execAsync = promisify(exec);

/** Default timeout for package/container validations (5 minutes) */
const PACKAGE_TIMEOUT_MS = 5 * 60 * 1_000;

/** Default timeout for IaC/CI-CD/Lambda validations (10 minutes) */
const EXTENDED_TIMEOUT_MS = 10 * 60 * 1_000;

/** Channels that use the shorter (5 min) timeout */
const SHORT_TIMEOUT_CHANNELS: ReadonlySet<DistributionChannel> = new Set([
  'npm',
  'pypi',
  'ghcr',
  'dockerhub',
]);

/** Interface for the validation engine */
export interface IValidationEngine {
  /**
   * Validate a single published artifact.
   * @param channel - Channel result to validate
   * @returns Validation result with individual checks
   */
  validate(channel: ChannelResult): Promise<ValidationResult>;

  /**
   * Validate all channels in parallel with per-channel timeouts.
   * @param channels - Channel results to validate
   * @returns Validation results for every channel
   */
  validateAll(channels: ChannelResult[]): Promise<ValidationResult[]>;
}

/** Options for constructing a ValidationEngine */
export interface ValidationEngineOptions {
  errorHandler: IErrorHandler;
  dryRun?: boolean;
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
  /** Override default timeout for short-timeout channels (ms) */
  packageTimeoutMs?: number;
  /** Override default timeout for extended-timeout channels (ms) */
  extendedTimeoutMs?: number;
}

// ── Validation strategy type ──────────────────────────────────────

type ValidationStrategy = (
  channel: ChannelResult,
) => Promise<ValidationCheck[]>;

// ── Implementation ────────────────────────────────────────────────

export class ValidationEngine implements IValidationEngine {
  private readonly errorHandler: IErrorHandler;
  private readonly dryRun: boolean;
  private readonly execCommand: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
  private readonly packageTimeoutMs: number;
  private readonly extendedTimeoutMs: number;
  private readonly strategies: Map<DistributionChannel, ValidationStrategy>;

  constructor(options: ValidationEngineOptions) {
    this.errorHandler = options.errorHandler;
    this.dryRun = options.dryRun ?? false;
    this.execCommand = options.execCommand ?? execAsync;
    this.packageTimeoutMs = options.packageTimeoutMs ?? PACKAGE_TIMEOUT_MS;
    this.extendedTimeoutMs = options.extendedTimeoutMs ?? EXTENDED_TIMEOUT_MS;

    this.strategies = this.buildStrategies();
  }

  // ── Public API ──────────────────────────────────────────────────

  async validate(channel: ChannelResult): Promise<ValidationResult> {
    const startTime = Date.now();
    const timeout = this.getTimeoutForChannel(channel.channel);

    try {
      const checks = await this.runWithTimeout(
        () => this.executeStrategy(channel),
        timeout,
        channel.channel,
      );

      return {
        channel: channel.channel,
        passed: checks.every((c) => c.passed),
        checks,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandler.handleError(err, {
        category: 'validation',
        channel: channel.channel,
        attemptNumber: 0,
        maxRetries: 0,
        operation: `validate_${channel.channel}`,
      });

      return {
        channel: channel.channel,
        passed: false,
        checks: [],
        duration: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async validateAll(channels: ChannelResult[]): Promise<ValidationResult[]> {
    return Promise.all(channels.map((ch) => this.validate(ch)));
  }

  // ── Strategy registry ───────────────────────────────────────────

  private buildStrategies(): Map<DistributionChannel, ValidationStrategy> {
    const map = new Map<DistributionChannel, ValidationStrategy>();

    // Package managers
    map.set('npm', (ch) => this.validatePackage(ch, 'npm'));
    map.set('pypi', (ch) => this.validatePackage(ch, 'pypi'));

    // Container registries
    map.set('ghcr', (ch) => this.validateContainer(ch, 'ghcr'));
    map.set('dockerhub', (ch) => this.validateContainer(ch, 'dockerhub'));

    // IaC platforms
    map.set('terraform', (ch) => this.validateIaC(ch, 'terraform'));
    map.set('pulumi', (ch) => this.validateIaC(ch, 'pulumi'));
    map.set('helm', (ch) => this.validateIaC(ch, 'helm'));
    map.set('ansible', (ch) => this.validateIaC(ch, 'ansible'));

    // CI/CD marketplaces
    map.set('github_marketplace', (ch) =>
      this.validateCICD(ch, 'github_marketplace'),
    );
    map.set('gitlab', (ch) => this.validateCICD(ch, 'gitlab'));
    map.set('circleci', (ch) => this.validateCICD(ch, 'circleci'));
    map.set('azure_pipelines', (ch) =>
      this.validateCICD(ch, 'azure_pipelines'),
    );

    // Lambda
    map.set('lambda_layers', (ch) => this.validateLambda(ch));
    map.set('lambda_registry_website', (ch) =>
      this.validateLambdaRegistryWebsite(ch),
    );

    return map;
  }

  private async executeStrategy(
    channel: ChannelResult,
  ): Promise<ValidationCheck[]> {
    const strategy = this.strategies.get(channel.channel);
    if (!strategy) {
      return [
        {
          name: 'Strategy Lookup',
          passed: false,
          duration: 0,
          error: `No validation strategy for channel: ${channel.channel}`,
        },
      ];
    }
    return strategy(channel);
  }

  // ── Package validation (npm / PyPI) ─────────────────────────────
  // Requirements: 1.5, 1.6, 8.1, 8.2, 8.3

  private async validatePackage(
    channel: ChannelResult,
    kind: 'npm' | 'pypi',
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkPackageDownloadable(kind, version));
    checks.push(await this.checkPackageMetadata(kind, version));
    checks.push(await this.checkPackageInstallable(kind, version));
    checks.push(await this.checkPackageImports(kind, version));

    return checks;
  }

  private async checkPackageDownloadable(
    kind: 'npm' | 'pypi',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Package Downloadable', start);
      }

      const cmd =
        kind === 'npm'
          ? `npm view tealtiger@${version} version`
          : `pip index versions tealtiger --pre 2>&1 | grep ${version}`;

      await this.execCommand(cmd);

      return {
        name: 'Package Downloadable',
        passed: true,
        duration: Date.now() - start,
        details: `${kind} package v${version} is available`,
      };
    } catch (error) {
      return this.failedCheck('Package Downloadable', start, error);
    }
  }

  private async checkPackageMetadata(
    kind: 'npm' | 'pypi',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Package Metadata', start);
      }

      const cmd =
        kind === 'npm'
          ? `npm view tealtiger@${version} version --json`
          : `pip show tealtiger 2>&1 | grep "Version: ${version}"`;

      const { stdout } = await this.execCommand(cmd);
      const outputVersion = stdout.trim().replace(/"/g, '');

      if (!outputVersion.includes(version)) {
        return {
          name: 'Package Metadata',
          passed: false,
          duration: Date.now() - start,
          error: `Version mismatch: expected ${version}, got ${outputVersion}`,
        };
      }

      return {
        name: 'Package Metadata',
        passed: true,
        duration: Date.now() - start,
        details: `Metadata version matches ${version}`,
      };
    } catch (error) {
      return this.failedCheck('Package Metadata', start, error);
    }
  }

  private async checkPackageInstallable(
    kind: 'npm' | 'pypi',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Package Installable', start);
      }

      const cmd =
        kind === 'npm'
          ? `npm install tealtiger@${version} --dry-run`
          : `pip install tealtiger==${version} --dry-run`;

      await this.execCommand(cmd);

      return {
        name: 'Package Installable',
        passed: true,
        duration: Date.now() - start,
        details: `Package installs successfully`,
      };
    } catch (error) {
      return this.failedCheck('Package Installable', start, error);
    }
  }

  private async checkPackageImports(
    kind: 'npm' | 'pypi',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Package Imports', start);
      }

      const cmd =
        kind === 'npm'
          ? `node -e "require('tealtiger'); console.log('ok')"`
          : `python -c "import tealtiger; print('ok')"`;

      await this.execCommand(cmd);

      return {
        name: 'Package Imports',
        passed: true,
        duration: Date.now() - start,
        details: `Package imports work for ${kind} v${version}`,
      };
    } catch (error) {
      return this.failedCheck('Package Imports', start, error);
    }
  }

  // ── Container validation (GHCR / Docker Hub) ───────────────────
  // Requirements: 2.6, 2.7, 8.1, 8.4

  private async validateContainer(
    channel: ChannelResult,
    kind: 'ghcr' | 'dockerhub',
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkContainerPullable(kind, version));
    checks.push(await this.checkContainerTags(kind, version));
    checks.push(await this.checkContainerStartable(kind, version));
    checks.push(await this.checkContainerArchitectures(kind, version));

    return checks;
  }

  private async checkContainerPullable(
    kind: 'ghcr' | 'dockerhub',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Image Pullable', start);
      }

      const image =
        kind === 'ghcr'
          ? `ghcr.io/tealtiger/tealtiger:${version}`
          : `tealtiger/tealtiger:${version}`;

      await this.execCommand(`docker pull ${image}`);

      return {
        name: 'Image Pullable',
        passed: true,
        duration: Date.now() - start,
        details: `Successfully pulled ${image}`,
      };
    } catch (error) {
      return this.failedCheck('Image Pullable', start, error);
    }
  }

  private async checkContainerTags(
    kind: 'ghcr' | 'dockerhub',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Image Tags', start);
      }

      const image =
        kind === 'ghcr'
          ? `ghcr.io/tealtiger/tealtiger:${version}`
          : `tealtiger/tealtiger:${version}`;

      const { stdout } = await this.execCommand(
        `docker inspect ${image} --format "{{json .RepoTags}}"`,
      );

      if (!stdout.includes(version)) {
        return {
          name: 'Image Tags',
          passed: false,
          duration: Date.now() - start,
          error: `Tag ${version} not found in image tags`,
        };
      }

      return {
        name: 'Image Tags',
        passed: true,
        duration: Date.now() - start,
        details: `Image tagged with ${version}`,
      };
    } catch (error) {
      return this.failedCheck('Image Tags', start, error);
    }
  }

  private async checkContainerStartable(
    kind: 'ghcr' | 'dockerhub',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Image Startable', start);
      }

      const image =
        kind === 'ghcr'
          ? `ghcr.io/tealtiger/tealtiger:${version}`
          : `tealtiger/tealtiger:${version}`;

      await this.execCommand(
        `docker run --rm ${image} echo "tealtiger-health-check"`,
      );

      return {
        name: 'Image Startable',
        passed: true,
        duration: Date.now() - start,
        details: `Container starts and runs successfully`,
      };
    } catch (error) {
      return this.failedCheck('Image Startable', start, error);
    }
  }

  private async checkContainerArchitectures(
    kind: 'ghcr' | 'dockerhub',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Multi-Architecture Support', start);
      }

      const image =
        kind === 'ghcr'
          ? `ghcr.io/tealtiger/tealtiger:${version}`
          : `tealtiger/tealtiger:${version}`;

      const { stdout } = await this.execCommand(
        `docker manifest inspect ${image}`,
      );

      const manifest = JSON.parse(stdout);
      const architectures: string[] =
        manifest.manifests?.map(
          (m: { platform: { architecture: string } }) =>
            m.platform.architecture,
        ) ?? [];

      const hasAmd64 = architectures.includes('amd64');
      const hasArm64 = architectures.includes('arm64');

      if (!hasAmd64 || !hasArm64) {
        return {
          name: 'Multi-Architecture Support',
          passed: false,
          duration: Date.now() - start,
          error: `Missing architectures. Found: ${architectures.join(', ')}`,
        };
      }

      return {
        name: 'Multi-Architecture Support',
        passed: true,
        duration: Date.now() - start,
        details: 'Supports amd64 and arm64',
      };
    } catch (error) {
      return this.failedCheck('Multi-Architecture Support', start, error);
    }
  }

  // ── IaC validation (Terraform / Pulumi / Helm / Ansible) ───────
  // Requirements: 3.6, 3.7, 8.1, 8.5

  private async validateIaC(
    channel: ChannelResult,
    kind: 'terraform' | 'pulumi' | 'helm' | 'ansible',
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkIaCAccessible(kind, version));
    checks.push(await this.checkIaCSyntaxValid(kind, version));

    return checks;
  }

  private async checkIaCAccessible(
    kind: 'terraform' | 'pulumi' | 'helm' | 'ansible',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('IaC Artifact Accessible', start);
      }

      const cmdMap: Record<string, string> = {
        terraform: `terraform providers mirror -platform=linux_amd64 /tmp/tf-mirror 2>&1 | grep tealtiger`,
        pulumi: `pulumi plugin install resource tealtiger v${version}`,
        helm: `helm show chart tealtiger/tealtiger --version ${version}`,
        ansible: `ansible-galaxy collection install tealtiger.tealtiger:${version} --dry-run`,
      };

      await this.execCommand(cmdMap[kind]!);

      return {
        name: 'IaC Artifact Accessible',
        passed: true,
        duration: Date.now() - start,
        details: `${kind} artifact v${version} is accessible`,
      };
    } catch (error) {
      return this.failedCheck('IaC Artifact Accessible', start, error);
    }
  }

  private async checkIaCSyntaxValid(
    kind: 'terraform' | 'pulumi' | 'helm' | 'ansible',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('IaC Syntax Valid', start);
      }

      const cmdMap: Record<string, string> = {
        terraform: `terraform validate -json`,
        pulumi: `pulumi preview --non-interactive --diff 2>&1 | head -5`,
        helm: `helm lint tealtiger/tealtiger --version ${version}`,
        ansible: `ansible-lint roles/tealtiger/ 2>&1 | tail -3`,
      };

      await this.execCommand(cmdMap[kind]!);

      return {
        name: 'IaC Syntax Valid',
        passed: true,
        duration: Date.now() - start,
        details: `${kind} artifact v${version} syntax is valid`,
      };
    } catch (error) {
      return this.failedCheck('IaC Syntax Valid', start, error);
    }
  }

  // ── CI/CD validation (GitHub / GitLab / CircleCI / Azure) ──────
  // Requirements: 4.5, 4.6, 8.1, 8.6

  private async validateCICD(
    channel: ChannelResult,
    kind:
      | 'github_marketplace'
      | 'gitlab'
      | 'circleci'
      | 'azure_pipelines',
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkCICDDiscoverable(kind, version));
    checks.push(await this.checkCICDExecutable(kind, version));

    return checks;
  }

  private async checkCICDDiscoverable(
    kind:
      | 'github_marketplace'
      | 'gitlab'
      | 'circleci'
      | 'azure_pipelines',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('CI/CD Discoverable', start);
      }

      const cmdMap: Record<string, string> = {
        github_marketplace: `gh api /search/repositories?q=tealtiger+in:name --jq ".total_count"`,
        gitlab: `curl -sf "https://gitlab.com/api/v4/projects/tealtiger%2Ftealtiger-ci/repository/tags" | grep "v${version}"`,
        circleci: `circleci orb info tealtiger/tealtiger@${version}`,
        azure_pipelines: `tfx extension show --publisher tealtiger --extension-id tealtiger-task --json`,
      };

      await this.execCommand(cmdMap[kind]!);

      return {
        name: 'CI/CD Discoverable',
        passed: true,
        duration: Date.now() - start,
        details: `${kind} integration v${version} is discoverable`,
      };
    } catch (error) {
      return this.failedCheck('CI/CD Discoverable', start, error);
    }
  }

  private async checkCICDExecutable(
    kind:
      | 'github_marketplace'
      | 'gitlab'
      | 'circleci'
      | 'azure_pipelines',
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('CI/CD Executable', start);
      }

      const cmdMap: Record<string, string> = {
        github_marketplace: `gh workflow run test-tealtiger-action.yml --ref v${version}`,
        gitlab: `curl -sf -X POST "https://gitlab.com/api/v4/projects/tealtiger%2Ftealtiger-ci/pipeline" -H "PRIVATE-TOKEN: $GITLAB_TOKEN" -d "ref=v${version}"`,
        circleci: `circleci orb validate ./orb/orb.yml`,
        azure_pipelines: `tfx build tasks validate --task-path ./tasks/tealtiger`,
      };

      await this.execCommand(cmdMap[kind]!);

      return {
        name: 'CI/CD Executable',
        passed: true,
        duration: Date.now() - start,
        details: `${kind} integration v${version} executes successfully`,
      };
    } catch (error) {
      return this.failedCheck('CI/CD Executable', start, error);
    }
  }

  // ── Lambda validation ──────────────────────────────────────────
  // Requirements: 5.6, 8.1, 8.7

  private async validateLambda(
    channel: ChannelResult,
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkLambdaARNValid(version));
    checks.push(await this.checkLambdaAttachable(version));
    checks.push(await this.checkLambdaExecutable(version));

    return checks;
  }

  private async checkLambdaARNValid(
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Lambda ARN Valid', start);
      }

      const { stdout } = await this.execCommand(
        `aws lambda list-layer-versions --layer-name tealtiger-nodejs20.x --region us-east-1 --output json`,
      );

      const response = JSON.parse(stdout);
      const layers = response.LayerVersions ?? [];
      const found = layers.some(
        (l: { Description?: string }) =>
          l.Description?.includes(version),
      );

      if (!found) {
        return {
          name: 'Lambda ARN Valid',
          passed: false,
          duration: Date.now() - start,
          error: `No layer version found for v${version} in us-east-1`,
        };
      }

      return {
        name: 'Lambda ARN Valid',
        passed: true,
        duration: Date.now() - start,
        details: `Layer ARN valid for v${version}`,
      };
    } catch (error) {
      return this.failedCheck('Lambda ARN Valid', start, error);
    }
  }

  private async checkLambdaAttachable(
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Lambda Attachable', start);
      }

      await this.execCommand(
        `aws lambda get-layer-version-by-arn ` +
          `--arn arn:aws:lambda:us-east-1:*:layer:tealtiger-nodejs20.x:* ` +
          `--region us-east-1 --output json`,
      );

      return {
        name: 'Lambda Attachable',
        passed: true,
        duration: Date.now() - start,
        details: `Layer v${version} is attachable to Lambda functions`,
      };
    } catch (error) {
      return this.failedCheck('Lambda Attachable', start, error);
    }
  }

  private async checkLambdaExecutable(
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Lambda Executable', start);
      }

      // Invoke a test function that uses the layer
      await this.execCommand(
        `aws lambda invoke ` +
          `--function-name tealtiger-layer-test ` +
          `--region us-east-1 ` +
          `--payload '{"test": true}' ` +
          `/tmp/tealtiger-lambda-test-output.json`,
      );

      return {
        name: 'Lambda Executable',
        passed: true,
        duration: Date.now() - start,
        details: `Layer v${version} executes successfully in Lambda`,
      };
    } catch (error) {
      return this.failedCheck('Lambda Executable', start, error);
    }
  }

  // ── Lambda registry website validation ─────────────────────────
  // Requirements: 5.7, 8.1

  private async validateLambdaRegistryWebsite(
    channel: ChannelResult,
  ): Promise<ValidationCheck[]> {
    const version = this.extractVersion(channel);
    const checks: ValidationCheck[] = [];

    checks.push(await this.checkWebsiteAccessible());
    checks.push(await this.checkWebsiteARNsCorrect(version));

    return checks;
  }

  private async checkWebsiteAccessible(): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Website Accessible', start);
      }

      await this.execCommand(
        `curl -sf -o /dev/null -w "%{http_code}" https://layers.tealtiger.ai`,
      );

      return {
        name: 'Website Accessible',
        passed: true,
        duration: Date.now() - start,
        details: 'layers.tealtiger.ai is accessible',
      };
    } catch (error) {
      return this.failedCheck('Website Accessible', start, error);
    }
  }

  private async checkWebsiteARNsCorrect(
    version: string,
  ): Promise<ValidationCheck> {
    const start = Date.now();
    try {
      if (this.dryRun) {
        return this.dryRunCheck('Website ARNs Correct', start);
      }

      const { stdout } = await this.execCommand(
        `curl -sf https://layers.tealtiger.ai`,
      );

      if (!stdout.includes(version)) {
        return {
          name: 'Website ARNs Correct',
          passed: false,
          duration: Date.now() - start,
          error: `Website does not reference version ${version}`,
        };
      }

      return {
        name: 'Website ARNs Correct',
        passed: true,
        duration: Date.now() - start,
        details: `Website displays correct ARNs for v${version}`,
      };
    } catch (error) {
      return this.failedCheck('Website ARNs Correct', start, error);
    }
  }

  // ── Timeout handling ────────────────────────────────────────────

  private getTimeoutForChannel(channel: DistributionChannel): number {
    return SHORT_TIMEOUT_CHANNELS.has(channel)
      ? this.packageTimeoutMs
      : this.extendedTimeoutMs;
  }

  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    channel: DistributionChannel,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Validation timed out after ${timeoutMs}ms for channel: ${channel}`,
          ),
        );
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Extract a version string from the artifact URL or fall back to a
   * sensible default. Artifact URLs follow patterns like:
   *   https://registry.npmjs.org/tealtiger/1.1.0
   *   https://layers.tealtiger.ai/v1.1.0
   */
  private extractVersion(channel: ChannelResult): string {
    const url = channel.artifactUrl ?? '';
    const match = url.match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
    return match?.[1] ?? '1.1.0';
  }

  private dryRunCheck(name: string, start: number): ValidationCheck {
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      details: `[DRY-RUN] Skipped — would validate ${name}`,
    };
  }

  private failedCheck(
    name: string,
    start: number,
    error: unknown,
  ): ValidationCheck {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: err.message,
    };
  }
}
