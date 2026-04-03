/**
 * Unit tests for LaunchCoordinator
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 15.1
 */
import { LaunchCoordinator } from '../LaunchCoordinator';
import type { PublicationStage, Publisher, ChannelResult, LaunchOptions } from '../types';
import { STAGE_ORDER } from '../types';

function createMockPublisher(channels: ChannelResult[], delay = 0): Publisher {
  return {
    publish: jest.fn(async (_v: string, _d?: boolean) => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      return channels;
    }),
  };
}

function createThrowingPublisher(error: string): Publisher {
  return { publish: jest.fn(async () => { throw new Error(error); }) };
}

function buildAllSuccessPublishers(): Map<PublicationStage, Publisher> {
  const m = new Map<PublicationStage, Publisher>();
  m.set('package_managers', createMockPublisher([
    { channel: 'npm', status: 'success', artifactUrl: 'https://npmjs.com/tealtiger' },
    { channel: 'pypi', status: 'success', artifactUrl: 'https://pypi.org/tealtiger' },
  ]));
  m.set('container_registries', createMockPublisher([
    { channel: 'ghcr', status: 'success' },
    { channel: 'dockerhub', status: 'success' },
  ]));
  m.set('iac_platforms', createMockPublisher([
    { channel: 'terraform', status: 'success' },
    { channel: 'pulumi', status: 'success' },
    { channel: 'helm', status: 'success' },
    { channel: 'ansible', status: 'success' },
  ]));
  m.set('cicd_marketplaces', createMockPublisher([
    { channel: 'github_marketplace', status: 'success' },
    { channel: 'gitlab', status: 'success' },
    { channel: 'circleci', status: 'success' },
    { channel: 'azure_pipelines', status: 'success' },
  ]));
  m.set('lambda_registry', createMockPublisher([
    { channel: 'lambda_layers', status: 'success' },
    { channel: 'lambda_registry_website', status: 'success' },
  ]));
  return m;
}

beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });
describe('LaunchCoordinator', () => {
  describe('executeLaunch', () => {
    it('runs stages in the correct sequential order', async () => {
      const executionOrder: PublicationStage[] = [];
      const publishers = new Map<PublicationStage, Publisher>();
      for (const stage of STAGE_ORDER) {
        publishers.set(stage, {
          publish: jest.fn(async () => {
            executionOrder.push(stage);
            return [{ channel: 'npm' as const, status: 'success' as const }];
          }),
        });
      }
      const coordinator = new LaunchCoordinator(publishers);
      await coordinator.executeLaunch('1.1.0');
      expect(executionOrder).toEqual(STAGE_ORDER);
    });

    it('halts on first stage failure and skips subsequent stages', async () => {
      const publishers = buildAllSuccessPublishers();
      publishers.set('iac_platforms', createMockPublisher([
        { channel: 'terraform', status: 'failed', error: 'Auth failed' },
      ]));
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeLaunch('1.1.0');

      expect(result.overallStatus).toBe('failed');
      expect(result.failedChannels).toContain('terraform');
      const executedStages = result.stages.map((s) => s.stage);
      expect(executedStages).toContain('package_managers');
      expect(executedStages).toContain('container_registries');
      expect(executedStages).toContain('iac_platforms');
      expect(executedStages).not.toContain('cicd_marketplaces');
      expect(executedStages).not.toContain('lambda_registry');
      expect(publishers.get('cicd_marketplaces')!.publish).not.toHaveBeenCalled();
      expect(publishers.get('lambda_registry')!.publish).not.toHaveBeenCalled();
    });

    it('skips stages with no targeted channels', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const options: LaunchOptions = { targetChannels: ['npm', 'pypi', 'lambda_layers'] };
      const result = await coordinator.executeLaunch('1.1.0', options);

      const stageMap = new Map(result.stages.map((s) => [s.stage, s]));
      expect(stageMap.get('package_managers')!.status).toBe('success');
      expect(stageMap.get('lambda_registry')!.status).toBe('success');
      expect(stageMap.get('container_registries')!.status).toBe('skipped');
      expect(stageMap.get('iac_platforms')!.status).toBe('skipped');
      expect(stageMap.get('cicd_marketplaces')!.status).toBe('skipped');
      expect(publishers.get('container_registries')!.publish).not.toHaveBeenCalled();
    });

    it('returns success when all stages succeed', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeLaunch('1.1.0');

      expect(result.overallStatus).toBe('success');
      expect(result.version).toBe('1.1.0');
      expect(result.failedChannels).toHaveLength(0);
      expect(result.stages).toHaveLength(STAGE_ORDER.length);
      expect(result.endTime.getTime()).toBeGreaterThanOrEqual(result.startTime.getTime());
    });

    it('returns partial when some stages are skipped', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeLaunch('1.1.0', { targetChannels: ['npm'] });
      expect(result.overallStatus).toBe('partial');
    });

    it('passes dry-run flag through to publishers', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      await coordinator.executeLaunch('1.1.0', { dryRun: true });
      for (const publisher of publishers.values()) {
        expect(publisher.publish).toHaveBeenCalledWith('1.1.0', true);
      }
    });
  });

  describe('executeStage', () => {
    it('delegates to the correct publisher for the given stage', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeStage('package_managers', '1.1.0');

      expect(result.stage).toBe('package_managers');
      expect(result.status).toBe('success');
      expect(publishers.get('package_managers')!.publish).toHaveBeenCalledWith('1.1.0', undefined);
      expect(publishers.get('container_registries')!.publish).not.toHaveBeenCalled();
    });

    it('returns failed when publisher throws an error', async () => {
      const publishers = new Map<PublicationStage, Publisher>();
      publishers.set('package_managers', createThrowingPublisher('Network timeout'));
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeStage('package_managers', '1.1.0');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network timeout');
      expect(result.channels).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('returns failed when no publisher is registered', async () => {
      const coordinator = new LaunchCoordinator(new Map());
      const result = await coordinator.executeStage('package_managers', '1.1.0');
      expect(result.status).toBe('failed');
      expect(result.error).toContain('No publisher registered for stage');
    });

    it('returns failed when any channel in the stage fails', async () => {
      const publishers = new Map<PublicationStage, Publisher>();
      publishers.set('container_registries', createMockPublisher([
        { channel: 'ghcr', status: 'success' },
        { channel: 'dockerhub', status: 'failed', error: 'Push rejected' },
      ]));
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeStage('container_registries', '1.1.0');
      expect(result.status).toBe('failed');
      expect(result.channels).toHaveLength(2);
    });

    it('tracks duration of stage execution', async () => {
      const publishers = new Map<PublicationStage, Publisher>();
      publishers.set('package_managers', createMockPublisher(
        [{ channel: 'npm', status: 'success' }], 50,
      ));
      const coordinator = new LaunchCoordinator(publishers);
      const result = await coordinator.executeStage('package_managers', '1.1.0');
      expect(result.duration).toBeGreaterThanOrEqual(40);
    });

    it('passes dry-run flag to publisher', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      await coordinator.executeStage('package_managers', '1.1.0', true);
      expect(publishers.get('package_managers')!.publish).toHaveBeenCalledWith('1.1.0', true);
    });
  });
  describe('generateReport', () => {
    it('produces correct summary statistics', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      expect(report.version).toBe('1.1.0');
      expect(report.status).toBe('success');
      expect(report.summary.totalChannels).toBe(14);
      expect(report.summary.successfulChannels).toBe(14);
      expect(report.summary.failedChannels).toBe(0);
      expect(report.summary.artifactsPublished).toBe(14);
      expect(report.summary.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('includes all channel statuses in stage reports', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      const reportedChannels = report.stages.flatMap((s) => s.channels.map((c) => c.channel));
      const expectedChannels = [
        'npm', 'pypi', 'ghcr', 'dockerhub',
        'terraform', 'pulumi', 'helm', 'ansible',
        'github_marketplace', 'gitlab', 'circleci', 'azure_pipelines',
        'lambda_layers', 'lambda_registry_website',
      ];
      for (const ch of expectedChannels) {
        expect(reportedChannels).toContain(ch);
      }
      expect(reportedChannels).toHaveLength(14);
    });

    it('includes artifact URLs and errors in channel reports', async () => {
      const publishers = new Map<PublicationStage, Publisher>();
      publishers.set('package_managers', createMockPublisher([
        { channel: 'npm', status: 'success', artifactUrl: 'https://npmjs.com/tealtiger' },
        { channel: 'pypi', status: 'failed', error: 'Upload rejected' },
      ]));
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      const npmReport = report.stages[0].channels.find((c) => c.channel === 'npm');
      expect(npmReport?.artifactUrl).toBe('https://npmjs.com/tealtiger');
      const pypiReport = report.stages[0].channels.find((c) => c.channel === 'pypi');
      expect(pypiReport?.error).toBe('Upload rejected');
    });

    it('includes recommendations for successful launches', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((r) => r.toLowerCase().includes('success'))).toBe(true);
    });

    it('includes recommendations for failed launches', async () => {
      const publishers = buildAllSuccessPublishers();
      publishers.set('package_managers', createMockPublisher([
        { channel: 'npm', status: 'failed', error: 'Auth error' },
      ]));
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      expect(report.status).toBe('failed');
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((r) => r.toLowerCase().includes('failed'))).toBe(true);
    });

    it('includes recommendations for partial launches', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0', { targetChannels: ['npm'] });
      const report = coordinator.generateReport(launchResult);

      expect(report.status).toBe('partial');
      expect(report.recommendations.some((r) => r.toLowerCase().includes('skip'))).toBe(true);
    });

    it('includes timeline events', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      expect(report.timeline.length).toBeGreaterThan(0);
      expect(report.timeline[0].timestamp).toBeInstanceOf(Date);
      expect(report.timeline[0].event).toBeDefined();
    });

    it('includes generatedAt timestamp', async () => {
      const publishers = buildAllSuccessPublishers();
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('correctly counts failed channels in summary', async () => {
      const publishers = new Map<PublicationStage, Publisher>();
      publishers.set('package_managers', createMockPublisher([
        { channel: 'npm', status: 'success' },
        { channel: 'pypi', status: 'failed', error: 'Upload error' },
      ]));
      const coordinator = new LaunchCoordinator(publishers);
      const launchResult = await coordinator.executeLaunch('1.1.0');
      const report = coordinator.generateReport(launchResult);

      expect(report.summary.totalChannels).toBe(2);
      expect(report.summary.successfulChannels).toBe(1);
      expect(report.summary.failedChannels).toBe(1);
      expect(report.summary.artifactsPublished).toBe(1);
    });
  });
});