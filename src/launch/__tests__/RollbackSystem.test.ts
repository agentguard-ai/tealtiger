/**
 * Unit tests for RollbackSystem
 *
 * Tests channel-specific rollback strategies, selective rollback of
 * only successful publications, and rollback report generation.
 */

import { RollbackSystem } from '../RollbackSystem';
import type { ChannelResult, DistributionChannel } from '../types';
import type { IErrorHandler } from '../ErrorHandler';

// ── Test helpers ──────────────────────────────────────────────────

function createMockErrorHandler(): IErrorHandler {
  return {
    handleError: jest.fn().mockReturnValue({
      action: 'report',
      message: 'Error during rollback',
      retryable: false,
      category: 'rollback',
    }),
    isRetryable: jest.fn().mockReturnValue(false),
  };
}

function createMockExec(): jest.Mock {
  return jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });
}

function makeChannelResult(
  channel: DistributionChannel,
  status: 'success' | 'failed' = 'success',
): ChannelResult {
  return { channel, status, artifactUrl: `https://example.com/${channel}` };
}

function createSystem(
  execCommand?: jest.Mock,
  opts?: { dryRun?: boolean },
) {
  const errorHandler = createMockErrorHandler();
  const exec = execCommand ?? createMockExec();
  const system = new RollbackSystem({
    errorHandler,
    dryRun: opts?.dryRun ?? false,
    execCommand: exec,
  });
  return { system, errorHandler, exec };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('RollbackSystem', () => {
  describe('executeRollback', () => {
    it('should only rollback channels with status success', async () => {
      const { system } = createSystem();

      const results: ChannelResult[] = [
        makeChannelResult('npm', 'success'),
        makeChannelResult('pypi', 'failed'),
        makeChannelResult('ghcr', 'success'),
      ];

      const rollback = await system.executeRollback(results, '1.1.0', 'critical bug');

      expect(rollback.channels).toHaveLength(3);

      const npmResult = rollback.channels.find((c) => c.channel === 'npm');
      expect(npmResult?.status).toBe('success');

      const pypiResult = rollback.channels.find((c) => c.channel === 'pypi');
      expect(pypiResult?.status).toBe('not_applicable');

      const ghcrResult = rollback.channels.find((c) => c.channel === 'ghcr');
      expect(ghcrResult?.status).toBe('success');
    });

    it('should set overallStatus to success when all rollbacks succeed', async () => {
      const { system } = createSystem();

      const results: ChannelResult[] = [
        makeChannelResult('npm', 'success'),
        makeChannelResult('pypi', 'success'),
      ];

      const rollback = await system.executeRollback(results, '1.1.0', 'test');
      expect(rollback.overallStatus).toBe('success');
    });

    it('should set overallStatus to partial when some rollbacks fail', async () => {
      const mockExec = jest.fn()
        .mockResolvedValueOnce({ stdout: '', stderr: '' })   // npm succeeds
        .mockRejectedValueOnce(new Error('network error'));   // pypi fails

      const { system } = createSystem(mockExec);

      const results: ChannelResult[] = [
        makeChannelResult('npm', 'success'),
        makeChannelResult('pypi', 'success'),
      ];

      const rollback = await system.executeRollback(results, '1.1.0', 'test');
      expect(rollback.overallStatus).toBe('partial');
    });

    it('should include version and reason in result', async () => {
      const { system } = createSystem();

      const rollback = await system.executeRollback(
        [makeChannelResult('npm', 'success')],
        '1.1.0',
        'security vulnerability',
      );

      expect(rollback.version).toBe('1.1.0');
      expect(rollback.reason).toBe('security vulnerability');
    });

    it('should record start and end times', async () => {
      const { system } = createSystem();

      const rollback = await system.executeRollback([], '1.1.0', 'test');

      expect(rollback.startTime).toBeInstanceOf(Date);
      expect(rollback.endTime).toBeInstanceOf(Date);
      expect(rollback.endTime.getTime()).toBeGreaterThanOrEqual(rollback.startTime.getTime());
    });
  });

  describe('rollbackChannel — npm', () => {
    it('should execute npm deprecate command', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('npm', '1.1.0');

      expect(result.status).toBe('success');
      expect(result.channel).toBe('npm');
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('npm deprecate tealtiger@1.1.0'),
      );
    });
  });

  describe('rollbackChannel — pypi', () => {
    it('should execute twine yank command', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('pypi', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('twine yank tealtiger 1.1.0'),
      );
    });
  });

  describe('rollbackChannel — containers', () => {
    it('should delete GHCR tag', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('ghcr', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('tealtiger/packages/container'));
    });

    it('should delete Docker Hub tag', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('dockerhub', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('hub.docker.com'));
    });
  });

  describe('rollbackChannel — IaC platforms', () => {
    it('should unpublish Terraform module', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('terraform', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('terraform.io'));
    });

    it('should unpublish Pulumi package', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('pulumi', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('pulumi.com'));
    });

    it('should remove Helm chart version', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('helm', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('charts.tealtiger.ai'));
    });

    it('should delete Ansible Galaxy version', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('ansible', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('galaxy.ansible.com'));
    });
  });

  describe('rollbackChannel — CI/CD marketplaces', () => {
    it('should unpublish GitHub Marketplace release', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('github_marketplace', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('gh release delete'));
    });

    it('should delete GitLab tag', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('gitlab', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('gitlab.com'));
    });

    it('should unpublish CircleCI orb', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('circleci', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('circleci orb unlist'));
    });

    it('should unpublish Azure Pipelines task', async () => {
      const { system, exec } = createSystem();

      const result = await system.rollbackChannel('azure_pipelines', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('tfx extension unpublish'));
    });
  });

  describe('rollbackChannel — Lambda layers', () => {
    it('should delete layer versions from all 33 regions', async () => {
      const exec = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });
      const { system } = createSystem(exec);

      const result = await system.rollbackChannel('lambda_layers', '1.1.0');

      expect(result.status).toBe('success');
      expect(result.action).toContain('33 regions');

      // Should have called exec for each region (list-layer-versions for each runtime)
      // 33 regions × 8 runtimes = 264 list calls minimum
      expect(exec.mock.calls.length).toBeGreaterThanOrEqual(33);
    });

    it('should report partial failure when some regions fail', async () => {
      let callCount = 0;
      const exec = jest.fn().mockImplementation(() => {
        callCount++;
        // Fail the first call to simulate a region error
        if (callCount === 1) {
          return Promise.reject(new Error('region unavailable'));
        }
        return Promise.resolve({ stdout: '[]', stderr: '' });
      });

      const { system } = createSystem(exec);

      const result = await system.rollbackChannel('lambda_layers', '1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Failed to delete some layers');
    });
  });

  describe('rollbackChannel — lambda_registry_website', () => {
    it('should return not_applicable for static website', async () => {
      const { system } = createSystem();

      const result = await system.rollbackChannel('lambda_registry_website', '1.1.0');

      expect(result.status).toBe('not_applicable');
    });
  });

  describe('rollbackChannel — error handling', () => {
    it('should return failed status when command throws', async () => {
      const exec = jest.fn().mockRejectedValue(new Error('auth failed'));
      const { system } = createSystem(exec);

      const result = await system.rollbackChannel('npm', '1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('auth failed');
    });
  });

  describe('dry-run mode', () => {
    it('should not execute real commands in dry-run mode', async () => {
      const exec = createMockExec();
      const { system } = createSystem(exec, { dryRun: true });

      const result = await system.rollbackChannel('npm', '1.1.0');

      expect(result.status).toBe('success');
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should generate a report with correct counts', async () => {
      const { system } = createSystem();

      const results: ChannelResult[] = [
        makeChannelResult('npm', 'success'),
        makeChannelResult('pypi', 'success'),
        makeChannelResult('ghcr', 'failed'),
      ];

      const rollback = await system.executeRollback(results, '1.1.0', 'test');
      const report = system.generateReport(rollback);

      expect(report.version).toBe('1.1.0');
      expect(report.reason).toBe('test');
      expect(report.totalChannels).toBe(3);
      expect(report.successfulRollbacks).toBe(2);
      expect(report.skippedChannels).toBe(1); // ghcr was failed, so not_applicable
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
