/**
 * Unit tests for CredentialManager
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.1-12.10
 */
import { CredentialManager, REQUIRED_CREDENTIALS } from '../CredentialManager';
import type { DistributionChannel } from '../types';

/** All 14 distribution channels */
const ALL_CHANNELS: DistributionChannel[] = [
  'npm', 'pypi', 'dockerhub', 'ghcr',
  'terraform', 'pulumi', 'helm', 'ansible',
  'github_marketplace', 'gitlab', 'circleci', 'azure_pipelines',
  'lambda_layers', 'lambda_registry_website',
];

/**
 * Set every required env var so that validateAllCredentials() passes.
 * Returns a cleanup function that removes them.
 */
function setAllCredentials(): () => void {
  const originals: Record<string, string | undefined> = {};
  for (const secrets of REQUIRED_CREDENTIALS.values()) {
    for (const name of secrets) {
      originals[name] = process.env[name];
      process.env[name] = `test-value-${name}`;
    }
  }
  return () => {
    for (const [name, original] of Object.entries(originals)) {
      if (original === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = original;
      }
    }
  };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('CredentialManager', () => {
  // ── getCredentials ──────────────────────────────────────────────

  describe('getCredentials', () => {
    it('returns credentials from environment variables for a token-based channel', async () => {
      const cleanup = setAllCredentials();
      try {
        const cm = new CredentialManager();
        const creds = await cm.getCredentials('npm');
        expect(creds.channel).toBe('npm');
        expect(creds.type).toBe('token');
        expect(creds.credentials).toHaveProperty('NPM_TOKEN', 'test-value-NPM_TOKEN');
      } finally {
        cleanup();
      }
    });

    it('returns credentials for a username_password channel (dockerhub)', async () => {
      const cleanup = setAllCredentials();
      try {
        const cm = new CredentialManager();
        const creds = await cm.getCredentials('dockerhub');
        expect(creds.type).toBe('username_password');
        expect(Object.keys(creds.credentials)).toEqual(
          expect.arrayContaining(['DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN']),
        );
      } finally {
        cleanup();
      }
    });

    it('returns credentials for an aws_credentials channel (lambda_layers)', async () => {
      const cleanup = setAllCredentials();
      try {
        const cm = new CredentialManager();
        const creds = await cm.getCredentials('lambda_layers');
        expect(creds.type).toBe('aws_credentials');
        expect(Object.keys(creds.credentials)).toEqual(
          expect.arrayContaining(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']),
        );
      } finally {
        cleanup();
      }
    });

    it('throws when a required env var is missing (Req 6.4)', async () => {
      // Ensure NPM_TOKEN is not set
      const original = process.env.NPM_TOKEN;
      delete process.env.NPM_TOKEN;
      try {
        const cm = new CredentialManager();
        await expect(cm.getCredentials('npm')).rejects.toThrow(/Missing credential.*NPM_TOKEN/);
      } finally {
        if (original !== undefined) process.env.NPM_TOKEN = original;
      }
    });

    it('throws for an unknown channel', async () => {
      const cm = new CredentialManager();
      await expect(cm.getCredentials('unknown' as DistributionChannel)).rejects.toThrow(
        /Unknown channel/,
      );
    });

    it('includes lastRotated when rotation metadata env var is set', async () => {
      const cleanup = setAllCredentials();
      const rotatedAt = '2025-01-15T00:00:00.000Z';
      process.env.NPM_CREDENTIAL_ROTATED_AT = rotatedAt;
      try {
        const cm = new CredentialManager();
        const creds = await cm.getCredentials('npm');
        expect(creds.lastRotated).toEqual(new Date(rotatedAt));
      } finally {
        delete process.env.NPM_CREDENTIAL_ROTATED_AT;
        cleanup();
      }
    });

    it('omits lastRotated when rotation metadata env var is absent', async () => {
      const cleanup = setAllCredentials();
      delete process.env.NPM_CREDENTIAL_ROTATED_AT;
      try {
        const cm = new CredentialManager();
        const creds = await cm.getCredentials('npm');
        expect(creds.lastRotated).toBeUndefined();
      } finally {
        cleanup();
      }
    });
  });

  // ── validateAllCredentials ──────────────────────────────────────

  describe('validateAllCredentials', () => {
    it('succeeds when all credentials are present (Req 6.3)', async () => {
      const cleanup = setAllCredentials();
      try {
        const cm = new CredentialManager();
        await expect(cm.validateAllCredentials()).resolves.toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it('throws listing all missing credentials when some are absent (Req 6.4, 12.10)', async () => {
      // Remove specific credentials
      const origNpm = process.env.NPM_TOKEN;
      const origGitlab = process.env.GITLAB_TOKEN;
      delete process.env.NPM_TOKEN;
      delete process.env.GITLAB_TOKEN;
      try {
        const cm = new CredentialManager();
        await expect(cm.validateAllCredentials()).rejects.toThrow(/Missing required credentials/);
        await expect(cm.validateAllCredentials()).rejects.toThrow(/npm: NPM_TOKEN/);
        await expect(cm.validateAllCredentials()).rejects.toThrow(/gitlab: GITLAB_TOKEN/);
      } finally {
        if (origNpm !== undefined) process.env.NPM_TOKEN = origNpm;
        if (origGitlab !== undefined) process.env.GITLAB_TOKEN = origGitlab;
      }
    });
  });

  // ── checkRotationNeeded ─────────────────────────────────────────

  describe('checkRotationNeeded', () => {
    it('flags credentials older than 90 days as needing rotation (Req 6.6)', async () => {
      const cleanup = setAllCredentials();
      // Set npm rotation to 100 days ago
      const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      process.env.NPM_CREDENTIAL_ROTATED_AT = hundredDaysAgo.toISOString();
      try {
        const cm = new CredentialManager();
        const statuses = await cm.checkRotationNeeded();
        const npmStatus = statuses.find((s) => s.channel === 'npm');
        expect(npmStatus).toBeDefined();
        expect(npmStatus!.needsRotation).toBe(true);
        expect(npmStatus!.daysUntilExpiry).toBe(0);
      } finally {
        delete process.env.NPM_CREDENTIAL_ROTATED_AT;
        cleanup();
      }
    });

    it('does not flag credentials younger than 90 days', async () => {
      const cleanup = setAllCredentials();
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      process.env.NPM_CREDENTIAL_ROTATED_AT = tenDaysAgo.toISOString();
      try {
        const cm = new CredentialManager();
        const statuses = await cm.checkRotationNeeded();
        const npmStatus = statuses.find((s) => s.channel === 'npm');
        expect(npmStatus).toBeDefined();
        expect(npmStatus!.needsRotation).toBe(false);
        expect(npmStatus!.daysUntilExpiry).toBe(80);
      } finally {
        delete process.env.NPM_CREDENTIAL_ROTATED_AT;
        cleanup();
      }
    });

    it('returns empty array when no rotation metadata exists', async () => {
      const cm = new CredentialManager();
      const statuses = await cm.checkRotationNeeded();
      expect(statuses).toEqual([]);
    });

    it('flags credentials at exactly 90 days as needing rotation', async () => {
      const cleanup = setAllCredentials();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      process.env.PYPI_CREDENTIAL_ROTATED_AT = ninetyDaysAgo.toISOString();
      try {
        const cm = new CredentialManager();
        const statuses = await cm.checkRotationNeeded();
        const pypiStatus = statuses.find((s) => s.channel === 'pypi');
        expect(pypiStatus).toBeDefined();
        expect(pypiStatus!.needsRotation).toBe(true);
        expect(pypiStatus!.daysUntilExpiry).toBe(0);
      } finally {
        delete process.env.PYPI_CREDENTIAL_ROTATED_AT;
        cleanup();
      }
    });
  });

  // ── rotateCredentials ───────────────────────────────────────────

  describe('rotateCredentials', () => {
    it('does not throw for a known channel', async () => {
      const cm = new CredentialManager();
      await expect(cm.rotateCredentials('npm')).resolves.toBeUndefined();
    });

    it('throws for an unknown channel', async () => {
      const cm = new CredentialManager();
      await expect(cm.rotateCredentials('unknown' as DistributionChannel)).rejects.toThrow(
        /Unknown channel/,
      );
    });
  });

  // ── Credential security (Req 6.2) ──────────────────────────────

  describe('credential security', () => {
    it('never logs credential values', async () => {
      const cleanup = setAllCredentials();
      const logSpy = jest.spyOn(console, 'log');
      try {
        const cm = new CredentialManager();
        // Exercise all public methods
        for (const channel of ALL_CHANNELS) {
          await cm.getCredentials(channel);
        }
        await cm.validateAllCredentials();
        await cm.checkRotationNeeded();
        await cm.rotateCredentials('npm');

        // Inspect every console.log call for credential values
        const allLogArgs = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
        for (const secrets of REQUIRED_CREDENTIALS.values()) {
          for (const secretName of secrets) {
            const secretValue = process.env[secretName]!;
            expect(allLogArgs).not.toContain(secretValue);
          }
        }
      } finally {
        cleanup();
      }
    });
  });

  // ── Credential completeness (Req 6.3) ──────────────────────────

  describe('credential completeness', () => {
    it('manages credentials for all 14 channels', () => {
      for (const channel of ALL_CHANNELS) {
        expect(REQUIRED_CREDENTIALS.has(channel)).toBe(true);
        expect(REQUIRED_CREDENTIALS.get(channel)!.length).toBeGreaterThan(0);
      }
      expect(REQUIRED_CREDENTIALS.size).toBe(14);
    });
  });
});
