/**
 * Unit tests for DocumentationGenerator
 *
 * Tests README generation, installation instruction completeness for all
 * 12+ channels, code example generation, and link validation.
 */

import {
  DocumentationGenerator,
  DOCUMENTATION_CHANNELS,
} from '../DocumentationGenerator';

// ── Test helpers ──────────────────────────────────────────────────

function createMockExec(
  stdout = '200',
): jest.Mock {
  return jest.fn().mockResolvedValue({ stdout, stderr: '' });
}

function createGenerator(
  execCommand?: jest.Mock,
  opts?: { dryRun?: boolean },
) {
  const exec = execCommand ?? createMockExec();
  const gen = new DocumentationGenerator({
    execCommand: exec,
    dryRun: opts?.dryRun ?? false,
  });
  return { gen, exec };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('DocumentationGenerator', () => {
  const VERSION = '1.1.0';

  // ── generateReadme ──────────────────────────────────────────────

  describe('generateReadme', () => {
    it('should include the version in the heading', () => {
      const { gen } = createGenerator();
      const readme = gen.generateReadme(VERSION);
      expect(readme).toContain(`# TealTiger v${VERSION} Installation`);
    });

    it('should include a section for every channel', () => {
      const { gen } = createGenerator();
      const readme = gen.generateReadme(VERSION);

      const instructions = gen.generateInstallInstructions(VERSION);
      for (const inst of instructions) {
        expect(readme).toContain(inst.title);
      }
    });

    it('should reject invalid version format', () => {
      const { gen } = createGenerator();
      expect(() => gen.generateReadme('bad')).toThrow('Invalid version format');
    });
  });

  // ── generateInstallInstructions ─────────────────────────────────

  describe('generateInstallInstructions', () => {
    it('should return instructions for all documented channels', () => {
      const { gen } = createGenerator();
      const instructions = gen.generateInstallInstructions(VERSION);
      const channels = instructions.map((i) => i.channel);

      for (const ch of DOCUMENTATION_CHANNELS) {
        expect(channels).toContain(ch);
      }
    });

    it('should have at least 12 channels', () => {
      const { gen } = createGenerator();
      const instructions = gen.generateInstallInstructions(VERSION);
      expect(instructions.length).toBeGreaterThanOrEqual(12);
    });

    it('should embed the version in every command', () => {
      const { gen } = createGenerator();
      const instructions = gen.generateInstallInstructions(VERSION);

      for (const inst of instructions) {
        expect(inst.command).toContain(VERSION);
      }
    });

    it('should include npm install command', () => {
      const { gen } = createGenerator();
      const npm = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'npm');
      expect(npm?.command).toContain(`npm install tealtiger@${VERSION}`);
    });

    it('should include pip install command', () => {
      const { gen } = createGenerator();
      const pip = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'pip');
      expect(pip?.command).toContain(`pip install tealtiger==${VERSION}`);
    });

    it('should include docker pull for GHCR', () => {
      const { gen } = createGenerator();
      const ghcr = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'docker_ghcr');
      expect(ghcr?.command).toContain('ghcr.io/tealtiger/tealtiger');
    });

    it('should include docker pull for Docker Hub', () => {
      const { gen } = createGenerator();
      const dh = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'docker_hub');
      expect(dh?.command).toContain('tealtiger/tealtiger');
    });

    it('should include terraform init', () => {
      const { gen } = createGenerator();
      const tf = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'terraform');
      expect(tf?.command).toContain('terraform init');
    });

    it('should include pulumi up', () => {
      const { gen } = createGenerator();
      const pu = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'pulumi');
      expect(pu?.command).toContain('pulumi up');
    });

    it('should include helm install', () => {
      const { gen } = createGenerator();
      const helm = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'helm');
      expect(helm?.command).toContain('helm install');
    });

    it('should include ansible-galaxy', () => {
      const { gen } = createGenerator();
      const ans = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'ansible');
      expect(ans?.command).toContain('ansible-galaxy');
    });

    it('should include Lambda layer attachment', () => {
      const { gen } = createGenerator();
      const lambda = gen
        .generateInstallInstructions(VERSION)
        .find((i) => i.channel === 'lambda_layer');
      expect(lambda?.command).toContain('aws lambda');
    });

    it('should reject invalid version format', () => {
      const { gen } = createGenerator();
      expect(() => gen.generateInstallInstructions('nope')).toThrow(
        'Invalid version format',
      );
    });
  });

  // ── generateCodeExamples ────────────────────────────────────────

  describe('generateCodeExamples', () => {
    it('should return a code example for every channel', () => {
      const { gen } = createGenerator();
      const examples = gen.generateCodeExamples(VERSION);
      const channels = examples.map((e) => e.channel);

      for (const ch of DOCUMENTATION_CHANNELS) {
        expect(channels).toContain(ch);
      }
    });

    it('should include TypeScript quick-start for npm', () => {
      const { gen } = createGenerator();
      const npm = gen
        .generateCodeExamples(VERSION)
        .find((e) => e.channel === 'npm');
      expect(npm?.language).toBe('typescript');
      expect(npm?.code).toContain("import { TealTiger }");
    });

    it('should include Python quick-start for pip', () => {
      const { gen } = createGenerator();
      const pip = gen
        .generateCodeExamples(VERSION)
        .find((e) => e.channel === 'pip');
      expect(pip?.language).toBe('python');
      expect(pip?.code).toContain('from tealtiger import');
    });

    it('should embed the version in docker examples', () => {
      const { gen } = createGenerator();
      const docker = gen
        .generateCodeExamples(VERSION)
        .find((e) => e.channel === 'docker_ghcr');
      expect(docker?.code).toContain(VERSION);
    });

    it('should reject invalid version format', () => {
      const { gen } = createGenerator();
      expect(() => gen.generateCodeExamples('x')).toThrow(
        'Invalid version format',
      );
    });
  });

  // ── validateLinks ───────────────────────────────────────────────

  describe('validateLinks', () => {
    it('should return ok:true for HTTP 200 responses', async () => {
      const exec = createMockExec('200');
      const { gen } = createGenerator(exec);

      const results = await gen.validateLinks(['https://example.com']);
      expect(results).toHaveLength(1);
      expect(results[0].ok).toBe(true);
      expect(results[0].status).toBe(200);
    });

    it('should return ok:false for non-200 responses', async () => {
      const exec = createMockExec('404');
      const { gen } = createGenerator(exec);

      const results = await gen.validateLinks(['https://example.com/missing']);
      expect(results[0].ok).toBe(false);
      expect(results[0].status).toBe(404);
    });

    it('should handle curl failures gracefully', async () => {
      const exec = jest.fn().mockRejectedValue(new Error('network error'));
      const { gen } = createGenerator(exec);

      const results = await gen.validateLinks(['https://bad.example']);
      expect(results[0].ok).toBe(false);
      expect(results[0].error).toContain('network error');
    });

    it('should validate multiple URLs in parallel', async () => {
      const exec = createMockExec('200');
      const { gen } = createGenerator(exec);

      const urls = [
        'https://npmjs.com/package/tealtiger',
        'https://pypi.org/project/tealtiger',
        'https://hub.docker.com/r/tealtiger/tealtiger',
      ];

      const results = await gen.validateLinks(urls);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.ok)).toBe(true);
    });

    it('should skip actual HTTP calls in dry-run mode', async () => {
      const exec = createMockExec();
      const { gen } = createGenerator(exec, { dryRun: true });

      const results = await gen.validateLinks(['https://example.com']);
      expect(results[0].ok).toBe(true);
      expect(exec).not.toHaveBeenCalled();
    });
  });
});
