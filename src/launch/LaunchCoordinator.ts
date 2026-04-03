/**
 * TealTiger v1.1.0 Launch Coordinator
 *
 * Orchestrates sequential publication across all distribution channels
 * using a state-machine pattern. Halts on first stage failure.
 */

import {
  type PublicationStage,
  type DistributionChannel,
  type LaunchOptions,
  type LaunchResult,
  type StageResult,
  type Publisher,
  type LaunchReport,
  type LaunchSummary,
  type StageReport,
  type ChannelReport,
  type TimelineEvent,
  STAGE_CHANNELS,
  STAGE_ORDER,
} from './types';

/** Interface for the launch coordinator */
export interface ILaunchCoordinator {
  executeLaunch(version: string, options: LaunchOptions): Promise<LaunchResult>;
  executeStage(stage: PublicationStage, version: string, dryRun?: boolean): Promise<StageResult>;
  generateReport(result: LaunchResult): LaunchReport;
}

export class LaunchCoordinator implements ILaunchCoordinator {
  private readonly publishers: Map<PublicationStage, Publisher>;
  private readonly timeline: TimelineEvent[] = [];

  constructor(publishers: Map<PublicationStage, Publisher>) {
    this.publishers = publishers;
  }

  /**
   * Execute the complete launch sequence across all stages.
   * Stages run sequentially; execution halts on first stage failure.
   */
  async executeLaunch(
    version: string,
    options: LaunchOptions = {},
  ): Promise<LaunchResult> {
    this.timeline.length = 0;

    const result: LaunchResult = {
      version,
      startTime: new Date(),
      endTime: new Date(),
      stages: [],
      overallStatus: 'success',
      failedChannels: [],
    };

    this.log('info', `🚀 Starting TealTiger v${version} launch`);

    if (options.dryRun) {
      this.log('info', '🧪 Dry-run mode enabled — no artifacts will be published');
    }

    for (const stage of STAGE_ORDER) {
      // Skip stages that have no targeted channels (when targetChannels is set)
      if (
        options.targetChannels &&
        !this.stageHasTargetChannels(stage, options.targetChannels)
      ) {
        const skipped: StageResult = {
          stage,
          status: 'skipped',
          channels: [],
          duration: 0,
        };
        result.stages.push(skipped);
        this.log('info', `⏭️  Skipping stage: ${stage} (no targeted channels)`);
        continue;
      }

      this.log('info', `📦 Executing stage: ${stage}`);

      const stageResult = await this.executeStage(stage, version, options.dryRun);
      result.stages.push(stageResult);

      if (stageResult.status === 'failed') {
        result.overallStatus = 'failed';
        const failed = stageResult.channels
          .filter((c) => c.status === 'failed')
          .map((c) => c.channel);
        result.failedChannels.push(...failed);

        this.log(
          'error',
          `❌ Stage ${stage} failed — halting launch`,
          undefined,
          stageResult.error ?? failed.join(', '),
        );
        break; // Halt on first stage failure (Req 7.7)
      }

      this.log('success', `✅ Stage ${stage} completed successfully`);
    }

    result.endTime = new Date();

    // Determine overall status
    if (result.overallStatus !== 'failed') {
      const hasSkipped = result.stages.some((s) => s.status === 'skipped');
      result.overallStatus = hasSkipped ? 'partial' : 'success';
    }

    const emoji = result.overallStatus === 'success' ? '🎉' : '⚠️';
    this.log('info', `${emoji} Launch completed with status: ${result.overallStatus}`);

    return result;
  }

  /**
   * Execute a single publication stage.
   */
  async executeStage(
    stage: PublicationStage,
    version: string,
    dryRun?: boolean,
  ): Promise<StageResult> {
    const startTime = Date.now();
    const publisher = this.publishers.get(stage);

    if (!publisher) {
      return {
        stage,
        status: 'failed',
        channels: [],
        duration: Date.now() - startTime,
        error: `No publisher registered for stage: ${stage}`,
      };
    }

    try {
      const channels = await publisher.publish(version, dryRun);
      const hasFailures = channels.some((c) => c.status === 'failed');

      return {
        stage,
        status: hasFailures ? 'failed' : 'success',
        channels,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stage,
        status: 'failed',
        channels: [],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a formatted launch report from a LaunchResult.
   */
  generateReport(result: LaunchResult): LaunchReport {
    const allChannels = result.stages.flatMap((s) => s.channels);
    const successCount = allChannels.filter((c) => c.status === 'success').length;
    const failedCount = allChannels.filter((c) => c.status === 'failed').length;
    const totalDuration = result.endTime.getTime() - result.startTime.getTime();

    const summary: LaunchSummary = {
      totalChannels: allChannels.length,
      successfulChannels: successCount,
      failedChannels: failedCount,
      totalDuration,
      artifactsPublished: successCount,
    };

    const stages: StageReport[] = result.stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      duration: s.duration,
      channels: s.channels.map((c) => {
        const report: ChannelReport = {
          channel: c.channel,
          status: c.status,
        };
        if (c.artifactUrl !== undefined) {
          report.artifactUrl = c.artifactUrl;
        }
        if (c.error !== undefined) {
          report.error = c.error;
        }
        return report;
      }),
    }));

    const recommendations = this.buildRecommendations(result);

    return {
      version: result.version,
      status: result.overallStatus,
      summary,
      stages,
      timeline: [...this.timeline],
      recommendations,
      generatedAt: new Date(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Check whether a stage contains any of the targeted channels.
   */
  private stageHasTargetChannels(
    stage: PublicationStage,
    targets: DistributionChannel[],
  ): boolean {
    const stageChannels = STAGE_CHANNELS[stage];
    return targets.some((t) => stageChannels.includes(t));
  }

  /**
   * Append a timeline event and log to console.
   */
  private log(
    status: TimelineEvent['status'],
    event: string,
    channel?: DistributionChannel,
    details?: string,
  ): void {
    const entry: TimelineEvent = {
      timestamp: new Date(),
      event,
      status,
      ...(channel !== undefined ? { channel } : {}),
      ...(details !== undefined ? { details } : {}),
    };
    this.timeline.push(entry);
    console.log(`[${status.toUpperCase()}] ${event}${details ? ` — ${details}` : ''}`);
  }

  /**
   * Build actionable recommendations based on launch outcome.
   */
  private buildRecommendations(result: LaunchResult): string[] {
    const recs: string[] = [];

    if (result.overallStatus === 'failed') {
      recs.push('Investigate failed channels and re-run the launch after fixing issues.');
      const failedStage = result.stages.find((s) => s.status === 'failed');
      if (failedStage) {
        recs.push(
          `Stage "${failedStage.stage}" failed. Check error details and retry.`,
        );
      }
    }

    if (result.overallStatus === 'partial') {
      recs.push('Some stages were skipped. Run a full launch to publish to all channels.');
    }

    if (result.overallStatus === 'success') {
      recs.push('All channels published successfully. Run post-launch validation.');
    }

    return recs;
  }
}
