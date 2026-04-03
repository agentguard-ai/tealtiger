/**
 * TealTiger v1.1.0 Lambda Registry Website Generator
 *
 * Generates the static website content for layers.tealtiger.ai.
 * Produces HTML pages with installation instructions, ARN lookup
 * tables for all 33 regions × 8 runtimes, CloudFormation/Terraform
 * snippets for layer attachment, and Route 53 DNS configuration.
 *
 * The LambdaPublisher handles S3 sync and CloudFront invalidation —
 * this class focuses solely on content generation.
 *
 * Requirements: 5.2, 5.5, 5.7
 */

import { SUPPORTED_RUNTIMES, AWS_REGIONS } from './LambdaPublisher';
import type { LambdaRuntime, AwsRegion } from './LambdaPublisher';

/** ARN entry for a single runtime in a single region */
export interface LayerArnEntry {
  region: AwsRegion;
  runtime: LambdaRuntime;
  arn: string;
}

/** Generated page content */
export interface GeneratedPage {
  path: string;
  content: string;
}

/** Route 53 DNS configuration for the custom domain */
export interface Route53Config {
  domainName: string;
  hostedZoneId: string;
  aliasTarget: string;
  recordType: 'A' | 'AAAA';
}

/** Full output of the website generation */
export interface WebsiteGenerationResult {
  pages: GeneratedPage[];
  arnTable: LayerArnEntry[];
  route53Configs: Route53Config[];
}

/** AWS account ID placeholder used in ARN generation */
const AWS_ACCOUNT_ID = '123456789012';

/** CloudFront distribution domain for the registry site */
const CLOUDFRONT_DOMAIN = 'd1234567890.cloudfront.net';

/** Hosted zone ID for CloudFront (fixed AWS value) */
const CLOUDFRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

export class LambdaRegistryWebsite {
  /**
   * Generate the complete static website content for layers.tealtiger.ai.
   *
   * @param version - The TealTiger version (e.g. "1.1.0")
   * @returns Generated pages, ARN table, and Route 53 configs
   *
   * Requirements: 5.2, 5.5, 5.7
   */
  generate(version: string): WebsiteGenerationResult {
    this.validateVersionFormat(version);

    const arnTable = this.generateArnTable();
    const pages = this.generatePages(version, arnTable);
    const route53Configs = this.generateRoute53Configs();

    return { pages, arnTable, route53Configs };
  }

  // ── ARN table generation ────────────────────────────────────────

  /**
   * Build the full ARN lookup table for every region × runtime combination.
   * Produces 33 × 8 = 264 entries.
   *
   * Requirement: 5.5
   */
  generateArnTable(): LayerArnEntry[] {
    const entries: LayerArnEntry[] = [];

    for (const region of AWS_REGIONS) {
      for (const runtime of SUPPORTED_RUNTIMES) {
        entries.push({
          region,
          runtime,
          arn: this.buildLayerArn(region, runtime),
        });
      }
    }

    return entries;
  }

  // ── Page generation ─────────────────────────────────────────────

  /**
   * Generate all HTML pages for the registry website.
   *
   * Requirements: 5.2, 5.5, 5.7
   */
  generatePages(version: string, arnTable: LayerArnEntry[]): GeneratedPage[] {
    const pages: GeneratedPage[] = [];

    // Index page
    pages.push(this.generateIndexPage(version));

    // Per-runtime pages with installation instructions
    for (const runtime of SUPPORTED_RUNTIMES) {
      pages.push(this.generateRuntimePage(version, runtime, arnTable));
    }

    // Per-region pages
    for (const region of AWS_REGIONS) {
      pages.push(this.generateRegionPage(version, region, arnTable));
    }

    return pages;
  }

  // ── Index page ──────────────────────────────────────────────────

  generateIndexPage(version: string): GeneratedPage {
    const runtimeLinks = SUPPORTED_RUNTIMES.map(
      (r) => `<li><a href="/runtimes/${r}.html">${r}</a></li>`,
    ).join('\n        ');

    const regionLinks = AWS_REGIONS.map(
      (r) => `<li><a href="/regions/${r}.html">${r}</a></li>`,
    ).join('\n        ');

    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TealTiger Lambda Layers v${version}</title>
</head>
<body>
  <h1>TealTiger Lambda Layers v${version}</h1>
  <p>Lambda layers for TealTiger v${version} across ${AWS_REGIONS.length} AWS regions and ${SUPPORTED_RUNTIMES.length} runtimes.</p>

  <h2>Runtimes</h2>
  <ul>
    ${runtimeLinks}
  </ul>

  <h2>Regions</h2>
  <ul>
    ${regionLinks}
  </ul>
</body>
</html>`;

    return { path: 'index.html', content };
  }

  // ── Runtime pages ───────────────────────────────────────────────

  /**
   * Generate a page for a single runtime showing ARNs for all regions
   * plus installation instructions and IaC snippets.
   *
   * Requirement: 5.5
   */
  generateRuntimePage(
    version: string,
    runtime: LambdaRuntime,
    arnTable: LayerArnEntry[],
  ): GeneratedPage {
    const runtimeEntries = arnTable.filter((e) => e.runtime === runtime);

    const arnRows = runtimeEntries
      .map(
        (e) =>
          `      <tr><td>${e.region}</td><td><code>${e.arn}</code></td></tr>`,
      )
      .join('\n');

    const installSnippet = this.generateInstallSnippet(runtime, version);
    const cfnSnippet = this.generateCloudFormationSnippet(runtime);
    const tfSnippet = this.generateTerraformSnippet(runtime);

    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TealTiger Lambda Layer - ${runtime}</title>
</head>
<body>
  <h1>TealTiger Lambda Layer for ${runtime}</h1>
  <p>Version: ${version}</p>

  <h2>Installation</h2>
  <pre><code>${installSnippet}</code></pre>

  <h2>ARNs by Region</h2>
  <table>
    <thead><tr><th>Region</th><th>Layer ARN</th></tr></thead>
    <tbody>
${arnRows}
    </tbody>
  </table>

  <h2>CloudFormation</h2>
  <pre><code>${cfnSnippet}</code></pre>

  <h2>Terraform</h2>
  <pre><code>${tfSnippet}</code></pre>
</body>
</html>`;

    return { path: `runtimes/${runtime}.html`, content };
  }

  // ── Region pages ────────────────────────────────────────────────

  /**
   * Generate a page for a single region showing ARNs for all runtimes.
   *
   * Requirement: 5.5
   */
  generateRegionPage(
    version: string,
    region: AwsRegion,
    arnTable: LayerArnEntry[],
  ): GeneratedPage {
    const regionEntries = arnTable.filter((e) => e.region === region);

    const arnRows = regionEntries
      .map(
        (e) =>
          `      <tr><td>${e.runtime}</td><td><code>${e.arn}</code></td></tr>`,
      )
      .join('\n');

    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TealTiger Lambda Layers - ${region}</title>
</head>
<body>
  <h1>TealTiger Lambda Layers in ${region}</h1>
  <p>Version: ${version}</p>

  <h2>Available Layers</h2>
  <table>
    <thead><tr><th>Runtime</th><th>Layer ARN</th></tr></thead>
    <tbody>
${arnRows}
    </tbody>
  </table>
</body>
</html>`;

    return { path: `regions/${region}.html`, content };
  }

  // ── IaC snippet generation ──────────────────────────────────────

  /**
   * Generate a CloudFormation snippet for attaching the TealTiger layer.
   */
  generateCloudFormationSnippet(runtime: LambdaRuntime): string {
    const exampleRegion: AwsRegion = 'us-east-1';
    const arn = this.buildLayerArn(exampleRegion, runtime);

    return [
      'Resources:',
      '  MyFunction:',
      '    Type: AWS::Lambda::Function',
      '    Properties:',
      `      Runtime: ${runtime}`,
      '      Layers:',
      `        - ${arn}`,
    ].join('\n');
  }

  /**
   * Generate a Terraform snippet for attaching the TealTiger layer.
   */
  generateTerraformSnippet(runtime: LambdaRuntime): string {
    const exampleRegion: AwsRegion = 'us-east-1';
    const arn = this.buildLayerArn(exampleRegion, runtime);

    return [
      'resource "aws_lambda_function" "my_function" {',
      `  runtime = "${runtime}"`,
      '  layers  = [',
      `    "${arn}"`,
      '  ]',
      '}',
    ].join('\n');
  }

  // ── Installation snippet generation ─────────────────────────────

  /**
   * Generate a CLI installation snippet for a given runtime.
   *
   * Requirement: 5.5
   */
  generateInstallSnippet(runtime: LambdaRuntime, version: string): string {
    const exampleRegion: AwsRegion = 'us-east-1';
    const arn = this.buildLayerArn(exampleRegion, runtime);

    return [
      `# Attach TealTiger v${version} layer for ${runtime}`,
      `aws lambda update-function-configuration \\`,
      `  --function-name my-function \\`,
      `  --layers ${arn}`,
    ].join('\n');
  }

  // ── Route 53 DNS configuration ──────────────────────────────────

  /**
   * Generate Route 53 DNS configuration for layers.tealtiger.ai.
   * Creates alias records pointing to the CloudFront distribution.
   *
   * Requirement: 5.2
   */
  generateRoute53Configs(): Route53Config[] {
    return [
      {
        domainName: 'layers.tealtiger.ai',
        hostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
        aliasTarget: CLOUDFRONT_DOMAIN,
        recordType: 'A',
      },
      {
        domainName: 'layers.tealtiger.ai',
        hostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
        aliasTarget: CLOUDFRONT_DOMAIN,
        recordType: 'AAAA',
      },
    ];
  }

  // ── Private helpers ─────────────────────────────────────────────

  /**
   * Build a layer ARN for a given region and runtime.
   */
  private buildLayerArn(region: AwsRegion, runtime: LambdaRuntime): string {
    return `arn:aws:lambda:${region}:${AWS_ACCOUNT_ID}:layer:tealtiger-${runtime}:1`;
  }

  /**
   * Validate that a version string is a valid semver format.
   */
  private validateVersionFormat(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(
        `Invalid version format: "${version}". Expected semver (e.g., "1.1.0")`,
      );
    }
  }
}
