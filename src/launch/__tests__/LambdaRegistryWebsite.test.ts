/**
 * Tests for LambdaRegistryWebsite
 *
 * Validates website generation, ARN table completeness,
 * IaC snippet generation, and Route 53 DNS configuration.
 */

import { LambdaRegistryWebsite } from '../LambdaRegistryWebsite';
import { SUPPORTED_RUNTIMES, AWS_REGIONS } from '../LambdaPublisher';

describe('LambdaRegistryWebsite', () => {
  let website: LambdaRegistryWebsite;

  beforeEach(() => {
    website = new LambdaRegistryWebsite();
  });

  // ── generate() ──────────────────────────────────────────────────

  describe('generate()', () => {
    it('returns pages, arnTable, and route53Configs', () => {
      const result = website.generate('1.1.0');

      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.arnTable.length).toBe(AWS_REGIONS.length * SUPPORTED_RUNTIMES.length);
      expect(result.route53Configs.length).toBe(2);
    });

    it('throws on invalid version format', () => {
      expect(() => website.generate('bad')).toThrow('Invalid version format');
      expect(() => website.generate('v1.1.0')).toThrow('Invalid version format');
    });
  });

  // ── ARN table ───────────────────────────────────────────────────

  describe('generateArnTable()', () => {
    it('produces 33 × 8 = 264 entries', () => {
      const table = website.generateArnTable();
      expect(table).toHaveLength(264);
    });

    it('covers every region', () => {
      const table = website.generateArnTable();
      const regions = new Set(table.map((e) => e.region));
      expect(regions.size).toBe(AWS_REGIONS.length);
      for (const region of AWS_REGIONS) {
        expect(regions.has(region)).toBe(true);
      }
    });

    it('covers every runtime', () => {
      const table = website.generateArnTable();
      const runtimes = new Set(table.map((e) => e.runtime));
      expect(runtimes.size).toBe(SUPPORTED_RUNTIMES.length);
      for (const runtime of SUPPORTED_RUNTIMES) {
        expect(runtimes.has(runtime)).toBe(true);
      }
    });

    it('generates valid ARN format', () => {
      const table = website.generateArnTable();
      for (const entry of table) {
        expect(entry.arn).toMatch(
          /^arn:aws:lambda:[a-z0-9-]+:\d+:layer:tealtiger-[a-z0-9.]+:\d+$/,
        );
        expect(entry.arn).toContain(entry.region);
        expect(entry.arn).toContain(entry.runtime);
      }
    });
  });

  // ── Page generation ─────────────────────────────────────────────

  describe('generatePages()', () => {
    it('generates index + runtime pages + region pages', () => {
      const arnTable = website.generateArnTable();
      const pages = website.generatePages('1.1.0', arnTable);

      // 1 index + 8 runtimes + 33 regions = 42
      expect(pages).toHaveLength(1 + SUPPORTED_RUNTIMES.length + AWS_REGIONS.length);
    });

    it('index page lists all runtimes and regions', () => {
      const page = website.generateIndexPage('1.1.0');
      expect(page.path).toBe('index.html');
      for (const runtime of SUPPORTED_RUNTIMES) {
        expect(page.content).toContain(runtime);
      }
      for (const region of AWS_REGIONS) {
        expect(page.content).toContain(region);
      }
    });

    it('runtime page contains ARNs for all regions', () => {
      const arnTable = website.generateArnTable();
      const page = website.generateRuntimePage('1.1.0', 'python3.12', arnTable);

      expect(page.path).toBe('runtimes/python3.12.html');
      for (const region of AWS_REGIONS) {
        expect(page.content).toContain(region);
      }
    });

    it('region page contains ARNs for all runtimes', () => {
      const arnTable = website.generateArnTable();
      const page = website.generateRegionPage('1.1.0', 'us-east-1', arnTable);

      expect(page.path).toBe('regions/us-east-1.html');
      for (const runtime of SUPPORTED_RUNTIMES) {
        expect(page.content).toContain(runtime);
      }
    });
  });

  // ── IaC snippets ────────────────────────────────────────────────

  describe('IaC snippets', () => {
    it('CloudFormation snippet references the runtime', () => {
      const snippet = website.generateCloudFormationSnippet('nodejs20.x');
      expect(snippet).toContain('Runtime: nodejs20.x');
      expect(snippet).toContain('arn:aws:lambda:us-east-1');
      expect(snippet).toContain('AWS::Lambda::Function');
    });

    it('Terraform snippet references the runtime', () => {
      const snippet = website.generateTerraformSnippet('python3.11');
      expect(snippet).toContain('runtime = "python3.11"');
      expect(snippet).toContain('arn:aws:lambda:us-east-1');
      expect(snippet).toContain('aws_lambda_function');
    });
  });

  // ── Installation snippet ────────────────────────────────────────

  describe('generateInstallSnippet()', () => {
    it('includes version and runtime', () => {
      const snippet = website.generateInstallSnippet('python3.13', '1.1.0');
      expect(snippet).toContain('v1.1.0');
      expect(snippet).toContain('python3.13');
      expect(snippet).toContain('aws lambda update-function-configuration');
    });
  });

  // ── Route 53 DNS ────────────────────────────────────────────────

  describe('generateRoute53Configs()', () => {
    it('returns A and AAAA records for layers.tealtiger.ai', () => {
      const configs = website.generateRoute53Configs();
      expect(configs).toHaveLength(2);

      const types = configs.map((c) => c.recordType);
      expect(types).toContain('A');
      expect(types).toContain('AAAA');

      for (const config of configs) {
        expect(config.domainName).toBe('layers.tealtiger.ai');
        expect(config.hostedZoneId).toBeTruthy();
        expect(config.aliasTarget).toBeTruthy();
      }
    });
  });
});
