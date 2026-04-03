/**
 * TealTiger v1.1.0 Cost Reporter
 *
 * Monitors and reports infrastructure costs for the launch system.
 * Estimates monthly costs for AWS S3 storage, AWS Lambda invocations,
 * AWS CloudFront traffic, and Docker Hub bandwidth. Generates alerts
 * when costs exceed the $20/month threshold and produces monthly
 * cost reports broken down by service.
 *
 * Pure calculation — no actual AWS API calls.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

// ── AWS Pricing Constants ─────────────────────────────────────────

/** S3 Standard storage: ~$0.023 per GB/month */
const S3_STORAGE_PER_GB = 0.023;

/** S3 GET requests: ~$0.0004 per 1,000 requests */
const S3_GET_PER_1000 = 0.0004;

/** Lambda invocations: ~$0.20 per 1M invocations */
const LAMBDA_PER_MILLION_INVOCATIONS = 0.20;

/** Lambda compute: ~$0.0000166667 per GB-second */
const LAMBDA_PER_GB_SECOND = 0.0000166667;

/** CloudFront data transfer: ~$0.085 per GB (first 10 TB) */
const CLOUDFRONT_PER_GB = 0.085;

/** Docker Hub bandwidth: ~$0.11 per GB (non-free tier) */
const DOCKERHUB_BANDWIDTH_PER_GB = 0.11;

/** Monthly cost alert threshold in USD */
const COST_ALERT_THRESHOLD = 20;

// ── Types ─────────────────────────────────────────────────────────

/** Breakdown of a single cost line item */
export interface CostBreakdown {
  item: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

/** Cost estimate for a single service */
export interface CostEstimate {
  service: string;
  category: 'storage' | 'bandwidth' | 'compute' | 'api_calls';
  estimatedMonthlyCost: number;
  currency: 'USD';
  breakdown: CostBreakdown[];
}

/** Monthly cost report across all services */
export interface CostReport {
  version: string;
  reportDate: Date;
  estimates: CostEstimate[];
  totalEstimatedMonthlyCost: number;
  alerts: CostAlert[];
}

/** Alert raised when costs exceed a threshold */
export interface CostAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  actual: number;
}

/** Usage metrics fed into the cost reporter */
export interface UsageMetrics {
  /** S3 storage in GB for Lambda layer hosting */
  s3StorageGB: number;
  /** S3 GET requests per month */
  s3GetRequests: number;
  /** Lambda invocations per month (layer downloads) */
  lambdaInvocations: number;
  /** Lambda compute in GB-seconds per month */
  lambdaGBSeconds: number;
  /** CloudFront data transfer in GB per month */
  cloudfrontBandwidthGB: number;
  /** Docker Hub image pull bandwidth in GB per month */
  dockerHubBandwidthGB: number;
}

/** Interface for the cost reporter */
export interface ICostReporter {
  estimateMonthlyCost(metrics: UsageMetrics): CostEstimate[];
  generateReport(version: string, metrics: UsageMetrics): CostReport;
  checkAlerts(estimates: CostEstimate[]): CostAlert[];
}

/** Options for constructing a CostReporter */
export interface CostReporterOptions {
  /** Override the monthly alert threshold in USD (default: $20) */
  alertThreshold?: number;
}

// ── Implementation ────────────────────────────────────────────────

export class CostReporter implements ICostReporter {
  private readonly alertThreshold: number;

  constructor(options: CostReporterOptions = {}) {
    this.alertThreshold = options.alertThreshold ?? COST_ALERT_THRESHOLD;
  }

  /**
   * Estimate monthly costs for all tracked services.
   *
   * Requirements: 13.1, 13.2, 13.3, 13.4
   */
  estimateMonthlyCost(metrics: UsageMetrics): CostEstimate[] {
    return [
      this.estimateS3Cost(metrics),
      this.estimateLambdaCost(metrics),
      this.estimateCloudFrontCost(metrics),
      this.estimateDockerHubCost(metrics),
    ];
  }

  /**
   * Generate a monthly cost report broken down by service.
   *
   * Requirement: 13.6
   */
  generateReport(version: string, metrics: UsageMetrics): CostReport {
    const estimates = this.estimateMonthlyCost(metrics);
    const totalEstimatedMonthlyCost = estimates.reduce(
      (sum, e) => sum + e.estimatedMonthlyCost,
      0,
    );
    const alerts = this.checkAlerts(estimates);

    return {
      version,
      reportDate: new Date(),
      estimates,
      totalEstimatedMonthlyCost,
      alerts,
    };
  }

  /**
   * Check whether estimated costs exceed the alert threshold.
   *
   * Requirement: 13.5
   */
  checkAlerts(estimates: CostEstimate[]): CostAlert[] {
    const total = estimates.reduce((sum, e) => sum + e.estimatedMonthlyCost, 0);
    const alerts: CostAlert[] = [];

    if (total > this.alertThreshold) {
      alerts.push({
        severity: total > this.alertThreshold * 2 ? 'critical' : 'warning',
        message:
          `Estimated monthly cost ($${total.toFixed(2)}) exceeds ` +
          `threshold ($${this.alertThreshold.toFixed(2)}/month)`,
        threshold: this.alertThreshold,
        actual: total,
      });
    }

    return alerts;
  }

  // ── Per-service estimators ──────────────────────────────────────

  /**
   * AWS S3 storage cost for Lambda layer hosting.
   * Requirement: 13.1
   */
  private estimateS3Cost(metrics: UsageMetrics): CostEstimate {
    const storageCost = metrics.s3StorageGB * S3_STORAGE_PER_GB;
    const requestCost = (metrics.s3GetRequests / 1000) * S3_GET_PER_1000;

    return {
      service: 'AWS S3',
      category: 'storage',
      estimatedMonthlyCost: storageCost + requestCost,
      currency: 'USD',
      breakdown: [
        {
          item: 'Standard storage',
          quantity: metrics.s3StorageGB,
          unit: 'GB',
          unitCost: S3_STORAGE_PER_GB,
          totalCost: storageCost,
        },
        {
          item: 'GET requests',
          quantity: metrics.s3GetRequests,
          unit: 'requests',
          unitCost: S3_GET_PER_1000 / 1000,
          totalCost: requestCost,
        },
      ],
    };
  }

  /**
   * AWS Lambda invocation cost for layer downloads.
   * Requirement: 13.2
   */
  private estimateLambdaCost(metrics: UsageMetrics): CostEstimate {
    const invocationCost =
      (metrics.lambdaInvocations / 1_000_000) * LAMBDA_PER_MILLION_INVOCATIONS;
    const computeCost = metrics.lambdaGBSeconds * LAMBDA_PER_GB_SECOND;

    return {
      service: 'AWS Lambda',
      category: 'compute',
      estimatedMonthlyCost: invocationCost + computeCost,
      currency: 'USD',
      breakdown: [
        {
          item: 'Invocations',
          quantity: metrics.lambdaInvocations,
          unit: 'invocations',
          unitCost: LAMBDA_PER_MILLION_INVOCATIONS / 1_000_000,
          totalCost: invocationCost,
        },
        {
          item: 'Compute (GB-seconds)',
          quantity: metrics.lambdaGBSeconds,
          unit: 'GB-seconds',
          unitCost: LAMBDA_PER_GB_SECOND,
          totalCost: computeCost,
        },
      ],
    };
  }

  /**
   * AWS CloudFront cost for registry website traffic.
   * Requirement: 13.3
   */
  private estimateCloudFrontCost(metrics: UsageMetrics): CostEstimate {
    const bandwidthCost = metrics.cloudfrontBandwidthGB * CLOUDFRONT_PER_GB;

    return {
      service: 'AWS CloudFront',
      category: 'bandwidth',
      estimatedMonthlyCost: bandwidthCost,
      currency: 'USD',
      breakdown: [
        {
          item: 'Data transfer (first 10 TB)',
          quantity: metrics.cloudfrontBandwidthGB,
          unit: 'GB',
          unitCost: CLOUDFRONT_PER_GB,
          totalCost: bandwidthCost,
        },
      ],
    };
  }

  /**
   * Docker Hub bandwidth cost for container image pulls.
   * Requirement: 13.4
   */
  private estimateDockerHubCost(metrics: UsageMetrics): CostEstimate {
    const bandwidthCost = metrics.dockerHubBandwidthGB * DOCKERHUB_BANDWIDTH_PER_GB;

    return {
      service: 'Docker Hub',
      category: 'bandwidth',
      estimatedMonthlyCost: bandwidthCost,
      currency: 'USD',
      breakdown: [
        {
          item: 'Image pull bandwidth',
          quantity: metrics.dockerHubBandwidthGB,
          unit: 'GB',
          unitCost: DOCKERHUB_BANDWIDTH_PER_GB,
          totalCost: bandwidthCost,
        },
      ],
    };
  }
}
