/**
 * TealTiger v1.1.0 Announcement Generator
 *
 * Generates launch announcement content for multiple platforms:
 * GitHub Releases, Dev.to blog posts, Twitter/X, LinkedIn, and Reddit.
 * Each announcement includes release highlights, installation instructions,
 * documentation links, and migration guidance.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

/** Supported announcement platforms */
export type AnnouncementPlatform = 'github' | 'devto' | 'twitter' | 'linkedin' | 'reddit';

export const ANNOUNCEMENT_PLATFORMS: AnnouncementPlatform[] = [
  'github',
  'devto',
  'twitter',
  'linkedin',
  'reddit',
];

/** A generated announcement for a specific platform */
export interface Announcement {
  platform: AnnouncementPlatform;
  title: string;
  content: string;
  tags: string[];
}

/** Options for constructing an AnnouncementGenerator */
export interface AnnouncementGeneratorOptions {
  /** Base URL for documentation links (default: https://docs.tealtiger.ai) */
  docsBaseUrl?: string;
  /** Base URL for the Lambda layer registry (default: https://layers.tealtiger.ai) */
  layersBaseUrl?: string;
}

/** Interface for the announcement generator */
export interface IAnnouncementGenerator {
  generateAnnouncement(version: string, platform: AnnouncementPlatform): Announcement;
  generateAllAnnouncements(version: string): Announcement[];
}

export class AnnouncementGenerator implements IAnnouncementGenerator {
  private readonly docsBaseUrl: string;
  private readonly layersBaseUrl: string;

  constructor(options: AnnouncementGeneratorOptions = {}) {
    this.docsBaseUrl = options.docsBaseUrl ?? 'https://docs.tealtiger.ai';
    this.layersBaseUrl = options.layersBaseUrl ?? 'https://layers.tealtiger.ai';
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Generate an announcement for a specific platform.
   */
  generateAnnouncement(version: string, platform: AnnouncementPlatform): Announcement {
    this.validateVersionFormat(version);

    switch (platform) {
      case 'github':
        return this.generateGitHub(version);
      case 'devto':
        return this.generateDevTo(version);
      case 'twitter':
        return this.generateTwitter(version);
      case 'linkedin':
        return this.generateLinkedIn(version);
      case 'reddit':
        return this.generateReddit(version);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Generate announcements for all supported platforms.
   */
  generateAllAnnouncements(version: string): Announcement[] {
    this.validateVersionFormat(version);
    return ANNOUNCEMENT_PLATFORMS.map((p) => this.generateAnnouncement(version, p));
  }

  // ── Platform generators ─────────────────────────────────────────

  private generateGitHub(version: string): Announcement {
    const content = [
      this.releaseHighlights(version),
      '',
      this.installationInstructions(version),
      '',
      this.documentationLinks(version),
      '',
      this.migrationGuidance(version),
    ].join('\n');

    return {
      platform: 'github',
      title: `TealTiger v${version}`,
      content,
      tags: ['release', 'tealtiger', `v${version}`],
    };
  }

  private generateDevTo(version: string): Announcement {
    const frontmatter = [
      '---',
      `title: "TealTiger v${version}: 7 Providers, 95%+ Coverage, 12+ Channels"`,
      'published: false',
      'tags: tealtiger, ai, security, opensource',
      '---',
    ].join('\n');

    const body = [
      `# TealTiger v${version} is here!`,
      '',
      this.releaseHighlights(version),
      '',
      '## Getting Started',
      '',
      this.installationInstructions(version),
      '',
      '## Documentation',
      '',
      this.documentationLinks(version),
      '',
      '## Migrating from v1.0.x',
      '',
      this.migrationGuidance(version),
    ].join('\n');

    return {
      platform: 'devto',
      title: `TealTiger v${version}: 7 Providers, 95%+ Coverage, 12+ Channels`,
      content: `${frontmatter}\n\n${body}`,
      tags: ['tealtiger', 'ai', 'security', 'opensource'],
    };
  }

  private generateTwitter(version: string): Announcement {
    // Twitter has a 280-character limit
    const tweet =
      `🚀 TealTiger v${version} is live! ` +
      `7 LLM providers, 95%+ market coverage, 12+ install channels. ` +
      `npm i tealtiger@${version} | pip install tealtiger==${version} ` +
      `${this.docsBaseUrl}`;

    // Ensure we stay within 280 chars; truncate gracefully if needed
    const trimmed = tweet.length > 280 ? tweet.slice(0, 277) + '...' : tweet;

    return {
      platform: 'twitter',
      title: `TealTiger v${version} Release`,
      content: trimmed,
      tags: ['TealTiger', 'AI', 'Security', 'OpenSource'],
    };
  }

  private generateLinkedIn(version: string): Announcement {
    const content = [
      `We're excited to announce TealTiger v${version}!`,
      '',
      this.releaseHighlights(version),
      '',
      'Quick install:',
      `  npm install tealtiger@${version}`,
      `  pip install tealtiger==${version}`,
      '',
      this.documentationLinks(version),
      '',
      this.migrationGuidance(version),
      '',
      '#TealTiger #AISecurity #OpenSource #DevTools',
    ].join('\n');

    return {
      platform: 'linkedin',
      title: `TealTiger v${version} — AI Security for Every Provider`,
      content,
      tags: ['TealTiger', 'AISecurity', 'OpenSource', 'DevTools'],
    };
  }

  private generateReddit(version: string): Announcement {
    const content = [
      `**TealTiger v${version}** — AI agent security platform with guardrails, cost tracking, and policy management.`,
      '',
      this.releaseHighlights(version),
      '',
      this.installationInstructions(version),
      '',
      this.documentationLinks(version),
      '',
      this.migrationGuidance(version),
    ].join('\n');

    return {
      platform: 'reddit',
      title: `TealTiger v${version}: AI Security with 7 Providers, 95%+ Coverage, 12+ Channels`,
      content,
      tags: ['programming', 'ai', 'security', 'opensource'],
    };
  }

  // ── Shared content blocks ───────────────────────────────────────

  private releaseHighlights(version: string): string {
    return [
      `## Release Highlights`,
      '',
      `TealTiger v${version} delivers:`,
      '',
      '- **7 LLM Providers**: OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral',
      '- **95%+ Market Coverage**: Support for the vast majority of production LLM traffic',
      '- **12+ Distribution Channels**: npm, PyPI, Docker (GHCR & Hub), Terraform, Pulumi, Helm, Ansible, GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, AWS Lambda Layers',
      '- **Multi-Architecture Containers**: amd64 and arm64 images',
      '- **33 AWS Regions**: Lambda layers available in every commercial region',
    ].join('\n');
  }

  private installationInstructions(version: string): string {
    return [
      '## Installation',
      '',
      '```bash',
      '# npm (TypeScript / JavaScript)',
      `npm install tealtiger@${version}`,
      '',
      '# pip (Python)',
      `pip install tealtiger==${version}`,
      '',
      '# Docker',
      `docker pull ghcr.io/tealtiger/tealtiger:${version}`,
      '',
      '# Terraform',
      `module "tealtiger" {`,
      `  source  = "tealtiger/tealtiger/aws"`,
      `  version = "${version}"`,
      `}`,
      '',
      '# Helm',
      `helm repo add tealtiger https://charts.tealtiger.ai`,
      `helm install tealtiger tealtiger/tealtiger --version ${version}`,
      '```',
    ].join('\n');
  }

  private documentationLinks(_version: string): string {
    return [
      '## Documentation',
      '',
      `- [Getting Started](${this.docsBaseUrl}/getting-started)`,
      `- [API Reference](${this.docsBaseUrl}/api)`,
      `- [Provider Guides](${this.docsBaseUrl}/providers)`,
      `- [Lambda Layer Registry](${this.layersBaseUrl})`,
      `- [GitHub Repository](https://github.com/tealtiger/tealtiger)`,
      `- [Changelog](https://github.com/tealtiger/tealtiger/blob/main/CHANGELOG.md)`,
    ].join('\n');
  }

  private migrationGuidance(version: string): string {
    return [
      '## Migrating from v1.0.x',
      '',
      `Upgrading to v${version} is straightforward:`,
      '',
      '1. Update your package version (`npm install tealtiger@' + version + '` or `pip install tealtiger==' + version + '`)',
      '2. No breaking API changes — existing code works as-is',
      '3. New providers (Gemini, Bedrock, Azure OpenAI, Cohere, Mistral) are opt-in',
      '4. Review the [Changelog](https://github.com/tealtiger/tealtiger/blob/main/CHANGELOG.md) for full details',
    ].join('\n');
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private validateVersionFormat(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(
        `Invalid version format: "${version}". Expected semver (e.g., "1.1.0")`,
      );
    }
  }
}
