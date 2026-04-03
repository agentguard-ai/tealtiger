/**
 * TealTiger v1.1.0 Documentation Generator
 *
 * Generates installation documentation for README files and the website,
 * produces installation instructions for all 12+ distribution channels,
 * generates code examples for each installation method, and validates
 * documentation links.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** All distribution channels that need installation instructions */
export const DOCUMENTATION_CHANNELS = [
  'npm',
  'pip',
  'docker_ghcr',
  'docker_hub',
  'terraform',
  'pulumi',
  'helm',
  'ansible',
  'github_actions',
  'gitlab_ci',
  'circleci',
  'azure_pipelines',
  'lambda_layer',
] as const;

export type DocumentationChannel = (typeof DOCUMENTATION_CHANNELS)[number];

/** A single channel's installation instruction block */
export interface InstallInstruction {
  channel: DocumentationChannel;
  title: string;
  command: string;
  description: string;
}

/** A code example for a specific installation method */
export interface CodeExample {
  channel: DocumentationChannel;
  language: 'typescript' | 'python' | 'yaml' | 'hcl' | 'bash';
  title: string;
  code: string;
}

/** Result of validating a single URL */
export interface LinkValidationResult {
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

/** Interface for the documentation generator */
export interface IDocumentationGenerator {
  generateReadme(version: string): string;
  generateInstallInstructions(version: string): InstallInstruction[];
  generateCodeExamples(version: string): CodeExample[];
  validateLinks(urls: string[]): Promise<LinkValidationResult[]>;
}

/** Options for constructing a DocumentationGenerator */
export interface DocumentationGeneratorOptions {
  /** Override for shell execution (testing seam) */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
  dryRun?: boolean;
}

export class DocumentationGenerator implements IDocumentationGenerator {
  private readonly execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
  private readonly dryRun: boolean;

  constructor(options: DocumentationGeneratorOptions = {}) {
    this.execCommand = options.execCommand ?? execAsync;
    this.dryRun = options.dryRun ?? false;
  }

  // ── README generation (Requirements: 10.1, 10.2) ───────────────

  /**
   * Generate a complete README installation section for the given version.
   * Suitable for both the main README and the documentation website.
   */
  generateReadme(version: string): string {
    this.validateVersionFormat(version);

    const instructions = this.generateInstallInstructions(version);
    const sections = instructions.map(
      (inst) =>
        `### ${inst.title}\n\n${inst.description}\n\n\`\`\`bash\n${inst.command}\n\`\`\``,
    );

    return [
      `# TealTiger v${version} Installation`,
      '',
      `Install TealTiger v${version} from any of the supported distribution channels below.`,
      '',
      ...sections,
    ].join('\n\n');
  }

  // ── Installation instructions (Requirement: 10.3) ──────────────

  /**
   * Generate installation instructions for all 12+ distribution channels.
   */
  generateInstallInstructions(version: string): InstallInstruction[] {
    this.validateVersionFormat(version);

    return [
      {
        channel: 'npm',
        title: 'npm (TypeScript / JavaScript)',
        description: 'Install the TypeScript SDK via npm.',
        command: `npm install tealtiger@${version}`,
      },
      {
        channel: 'pip',
        title: 'pip (Python)',
        description: 'Install the Python SDK via pip.',
        command: `pip install tealtiger==${version}`,
      },
      {
        channel: 'docker_ghcr',
        title: 'Docker (GitHub Container Registry)',
        description: 'Pull the container image from GHCR.',
        command: `docker pull ghcr.io/tealtiger/tealtiger:${version}`,
      },
      {
        channel: 'docker_hub',
        title: 'Docker (Docker Hub)',
        description: 'Pull the container image from Docker Hub.',
        command: `docker pull tealtiger/tealtiger:${version}`,
      },
      {
        channel: 'terraform',
        title: 'Terraform',
        description: 'Add the TealTiger Terraform module.',
        command: [
          `module "tealtiger" {`,
          `  source  = "tealtiger/tealtiger/aws"`,
          `  version = "${version}"`,
          `}`,
          '',
          `terraform init`,
        ].join('\n'),
      },
      {
        channel: 'pulumi',
        title: 'Pulumi',
        description: 'Install the TealTiger Pulumi package and deploy.',
        command: [
          `# TypeScript`,
          `npm install @pulumi/tealtiger@${version}`,
          `# Python`,
          `pip install pulumi-tealtiger==${version}`,
          '',
          `pulumi up`,
        ].join('\n'),
      },
      {
        channel: 'helm',
        title: 'Helm',
        description: 'Install the TealTiger Helm chart.',
        command: [
          `helm repo add tealtiger https://charts.tealtiger.ai`,
          `helm repo update`,
          `helm install tealtiger tealtiger/tealtiger --version ${version}`,
        ].join('\n'),
      },
      {
        channel: 'ansible',
        title: 'Ansible',
        description: 'Install the TealTiger Ansible collection.',
        command: `ansible-galaxy collection install tealtiger.tealtiger:${version}`,
      },
      {
        channel: 'github_actions',
        title: 'GitHub Actions',
        description: 'Add TealTiger to your GitHub Actions workflow.',
        command: [
          `# .github/workflows/tealtiger.yml`,
          `steps:`,
          `  - uses: tealtiger/tealtiger-action@v${version}`,
          `    with:`,
          `      api-key: \${{ secrets.TEALTIGER_API_KEY }}`,
        ].join('\n'),
      },
      {
        channel: 'gitlab_ci',
        title: 'GitLab CI',
        description: 'Include TealTiger in your GitLab CI pipeline.',
        command: [
          `# .gitlab-ci.yml`,
          `include:`,
          `  - remote: "https://gitlab.com/tealtiger/tealtiger-ci/-/raw/v${version}/tealtiger.yml"`,
        ].join('\n'),
      },
      {
        channel: 'circleci',
        title: 'CircleCI',
        description: 'Use the TealTiger CircleCI orb.',
        command: [
          `# .circleci/config.yml`,
          `orbs:`,
          `  tealtiger: tealtiger/tealtiger@${version}`,
        ].join('\n'),
      },
      {
        channel: 'azure_pipelines',
        title: 'Azure Pipelines',
        description: 'Add the TealTiger task to your Azure Pipeline.',
        command: [
          `# azure-pipelines.yml`,
          `steps:`,
          `  - task: tealtiger@${version}`,
          `    inputs:`,
          `      apiKey: $(TEALTIGER_API_KEY)`,
        ].join('\n'),
      },
      {
        channel: 'lambda_layer',
        title: 'AWS Lambda Layer',
        description:
          'Attach the TealTiger Lambda layer to your function. ' +
          'Find your region-specific ARN at https://layers.tealtiger.ai.',
        command: [
          `# TealTiger v${version} Lambda Layer`,
          `aws lambda update-function-configuration \\`,
          `  --function-name my-function \\`,
          `  --layers arn:aws:lambda:us-east-1:123456789012:layer:tealtiger-python3.12:1`,
        ].join('\n'),
      },
    ];
  }

  // ── Code examples (Requirement: 10.4) ───────────────────────────

  /**
   * Generate code examples for each installation method.
   * Includes TypeScript and Python quick-start snippets where applicable.
   */
  generateCodeExamples(version: string): CodeExample[] {
    this.validateVersionFormat(version);

    return [
      {
        channel: 'npm',
        language: 'typescript',
        title: 'TypeScript Quick Start (npm)',
        code: [
          `import { TealTiger } from 'tealtiger';`,
          ``,
          `const tt = new TealTiger({ apiKey: process.env.TEALTIGER_API_KEY });`,
          ``,
          `const result = await tt.guard({`,
          `  prompt: 'Hello, world!',`,
          `  provider: 'openai',`,
          `});`,
          `console.log(result);`,
        ].join('\n'),
      },
      {
        channel: 'pip',
        language: 'python',
        title: 'Python Quick Start (pip)',
        code: [
          `from tealtiger import TealTiger`,
          ``,
          `tt = TealTiger(api_key=os.environ["TEALTIGER_API_KEY"])`,
          ``,
          `result = tt.guard(`,
          `    prompt="Hello, world!",`,
          `    provider="openai",`,
          `)`,
          `print(result)`,
        ].join('\n'),
      },
      {
        channel: 'docker_ghcr',
        language: 'bash',
        title: 'Docker Quick Start (GHCR)',
        code: [
          `docker run --rm \\`,
          `  -e TEALTIGER_API_KEY=\${TEALTIGER_API_KEY} \\`,
          `  ghcr.io/tealtiger/tealtiger:${version}`,
        ].join('\n'),
      },
      {
        channel: 'docker_hub',
        language: 'bash',
        title: 'Docker Quick Start (Docker Hub)',
        code: [
          `docker run --rm \\`,
          `  -e TEALTIGER_API_KEY=\${TEALTIGER_API_KEY} \\`,
          `  tealtiger/tealtiger:${version}`,
        ].join('\n'),
      },
      {
        channel: 'terraform',
        language: 'hcl',
        title: 'Terraform Example',
        code: [
          `module "tealtiger" {`,
          `  source  = "tealtiger/tealtiger/aws"`,
          `  version = "${version}"`,
          ``,
          `  api_key        = var.tealtiger_api_key`,
          `  enable_guardrails = true`,
          `}`,
        ].join('\n'),
      },
      {
        channel: 'pulumi',
        language: 'typescript',
        title: 'Pulumi Example (TypeScript)',
        code: [
          `import * as tealtiger from '@pulumi/tealtiger';`,
          ``,
          `const guard = new tealtiger.Guard('my-guard', {`,
          `  apiKey: config.requireSecret('tealtigerApiKey'),`,
          `  enableGuardrails: true,`,
          `});`,
        ].join('\n'),
      },
      {
        channel: 'helm',
        language: 'bash',
        title: 'Helm Example',
        code: [
          `helm repo add tealtiger https://charts.tealtiger.ai`,
          `helm install tealtiger tealtiger/tealtiger \\`,
          `  --version ${version} \\`,
          `  --set apiKey=\${TEALTIGER_API_KEY}`,
        ].join('\n'),
      },
      {
        channel: 'ansible',
        language: 'yaml',
        title: 'Ansible Playbook Example',
        code: [
          `- hosts: all`,
          `  collections:`,
          `    - tealtiger.tealtiger`,
          `  tasks:`,
          `    - name: Configure TealTiger`,
          `      tealtiger_config:`,
          `        api_key: "{{ tealtiger_api_key }}"`,
          `        version: "${version}"`,
        ].join('\n'),
      },
      {
        channel: 'github_actions',
        language: 'yaml',
        title: 'GitHub Actions Example',
        code: [
          `name: TealTiger Scan`,
          `on: [push]`,
          `jobs:`,
          `  scan:`,
          `    runs-on: ubuntu-latest`,
          `    steps:`,
          `      - uses: actions/checkout@v4`,
          `      - uses: tealtiger/tealtiger-action@v${version}`,
          `        with:`,
          `          api-key: \${{ secrets.TEALTIGER_API_KEY }}`,
        ].join('\n'),
      },
      {
        channel: 'gitlab_ci',
        language: 'yaml',
        title: 'GitLab CI Example',
        code: [
          `include:`,
          `  - remote: "https://gitlab.com/tealtiger/tealtiger-ci/-/raw/v${version}/tealtiger.yml"`,
          ``,
          `tealtiger_scan:`,
          `  stage: test`,
          `  variables:`,
          `    TEALTIGER_API_KEY: $TEALTIGER_API_KEY`,
        ].join('\n'),
      },
      {
        channel: 'circleci',
        language: 'yaml',
        title: 'CircleCI Orb Example',
        code: [
          `version: 2.1`,
          `orbs:`,
          `  tealtiger: tealtiger/tealtiger@${version}`,
          `workflows:`,
          `  scan:`,
          `    jobs:`,
          `      - tealtiger/scan`,
        ].join('\n'),
      },
      {
        channel: 'azure_pipelines',
        language: 'yaml',
        title: 'Azure Pipelines Example',
        code: [
          `trigger:`,
          `  - main`,
          `pool:`,
          `  vmImage: ubuntu-latest`,
          `steps:`,
          `  - task: tealtiger@${version}`,
          `    inputs:`,
          `      apiKey: $(TEALTIGER_API_KEY)`,
        ].join('\n'),
      },
      {
        channel: 'lambda_layer',
        language: 'python',
        title: 'Lambda Layer Example (Python)',
        code: [
          `# Lambda function using TealTiger layer`,
          `import tealtiger`,
          ``,
          `def handler(event, context):`,
          `    tt = tealtiger.TealTiger()`,
          `    result = tt.guard(`,
          `        prompt=event.get("prompt", ""),`,
          `        provider="bedrock",`,
          `    )`,
          `    return {"statusCode": 200, "body": result}`,
        ].join('\n'),
      },
    ];
  }

  // ── Link validation (Requirements: 10.5, 10.6) ─────────────────

  /**
   * Validate that the given URLs are accessible (HTTP 200).
   * Uses curl under the hood so it works in CI environments.
   */
  async validateLinks(urls: string[]): Promise<LinkValidationResult[]> {
    return Promise.all(urls.map((url) => this.checkLink(url)));
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async checkLink(url: string): Promise<LinkValidationResult> {
    if (this.dryRun) {
      return { url, status: 200, ok: true };
    }

    try {
      const { stdout } = await this.execCommand(
        `curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}"`,
      );
      const status = parseInt(stdout.trim(), 10);
      return { url, status, ok: status === 200 };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { url, status: null, ok: false, error: err.message };
    }
  }

  private validateVersionFormat(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(
        `Invalid version format: "${version}". Expected semver (e.g., "1.1.0")`,
      );
    }
  }
}
