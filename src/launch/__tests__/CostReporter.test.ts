/**
 * Unit tests for CostReporter
 *
 * Tests cost estimation for AWS S3, Lambda, CloudFront, and Docker Hub,
 * alert triggering at the $20/month threshold, and monthly report generation.
 */

import {
  CostReporter,
  type UsageMetrics,
  type CostEstimate,
} from '../CostReporter';

// ── Helpers ───────────────────────────────────────────────────────

/** Minimal usage that stays well under the $20 threshold */
const LOW_USAGE: UsageMetrics = {
  s3StorageGB: 1,
  s3GetRequests: 10_000,
  lambdaInvocations: 100_000,
  lambdaGBSeconds: 5_000,
  cloudfrontBandwidthGB: 5,
  dockerHubBandwidthGB: 2,
};

/** High usage that pushes past the $20 threshold */
const HIGH_USAGE: UsageMetrics = {
  s3StorageGB: 50,
  s3GetRequests: 5_000_000,
  lambdaInvocations: 50_000_000,
  lambdaGBSeconds: 500_000,
  cloudfrontBandwidthGB: 200,
  dockerHubBandwidthGB: 100,
};

/** Zero usage */
const ZERO_USAGE: UsageMetrics = {
  s3StorageGB: 0,
  s3GetRequests: 0,
  lambdaInvocations: 0,
  lambdaGBSeconds: 0,
  cloudfrontBandwidthGB: 0,
  dockerHubBandwidthGB: 0,
};

function totalCost(estimates: CostEstimate[]): number {
  return estimates.reduce((sum, e) => sum + e.estimatedMonthlyCost, 0);
}

// ── Tests ─────────────────────────────────────────────────────────

describe('CostReporter', () => {
  const reporter = new CostReporter();

  // ── estimateMonthlyCost ─────────────────────────────────────────

  describe('estimateMonthlyCost', () => {
    it('should return estimates for all four services', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const services = estimates.map((e) => e.service);

      expect(services).toContain('AWS S3');
      expect(services).toContain('AWS Lambda');
      expect(services).toContain('AWS CloudFront');
      expect(services).toContain('Docker Hub');
      expect(estimates).toHaveLength(4);
    });

    it('should return zero costs for zero usage', () => {
      const estimates = reporter.estimateMonthlyCost(ZERO_USAGE);
      expect(totalCost(estimates)).toBe(0);
      for (const est of estimates) {
        expect(est.estimatedMonthlyCost).toBe(0);
      }
    });

    it('should calculate S3 storage cost correctly', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const s3 = estimates.find((e) => e.service === 'AWS S3')!;

      // 1 GB * $0.023 + 10,000 / 1000 * $0.0004 = $0.023 + $0.004 = $0.027
      expect(s3.estimatedMonthlyCost).toBeCloseTo(0.027, 4);
      expect(s3.category).toBe('storage');
      expect(s3.currency).toBe('USD');
      expect(s3.breakdown).toHaveLength(2);
    });

    it('should calculate Lambda cost correctly', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const lambda = estimates.find((e) => e.service === 'AWS Lambda')!;

      // 100,000 / 1M * $0.20 = $0.02
      // 5,000 * $0.0000166667 ≈ $0.0833
      expect(lambda.estimatedMonthlyCost).toBeCloseTo(0.02 + 0.0833, 3);
      expect(lambda.category).toBe('compute');
    });

    it('should calculate CloudFront cost correctly', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const cf = estimates.find((e) => e.service === 'AWS CloudFront')!;

      // 5 GB * $0.085 = $0.425
      expect(cf.estimatedMonthlyCost).toBeCloseTo(0.425, 4);
      expect(cf.category).toBe('bandwidth');
    });

    it('should calculate Docker Hub cost correctly', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const dh = estimates.find((e) => e.service === 'Docker Hub')!;

      // 2 GB * $0.11 = $0.22
      expect(dh.estimatedMonthlyCost).toBeCloseTo(0.22, 4);
      expect(dh.category).toBe('bandwidth');
    });
  });

  // ── checkAlerts ─────────────────────────────────────────────────

  describe('checkAlerts', () => {
    it('should return no alerts when costs are below threshold', () => {
      const estimates = reporter.estimateMonthlyCost(LOW_USAGE);
      const alerts = reporter.checkAlerts(estimates);
      expect(alerts).toHaveLength(0);
    });

    it('should return an alert when costs exceed $20/month', () => {
      const estimates = reporter.estimateMonthlyCost(HIGH_USAGE);
      const alerts = reporter.checkAlerts(estimates);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(['warning', 'critical']).toContain(alerts[0].severity);
      expect(alerts[0].threshold).toBe(20);
      expect(alerts[0].actual).toBeGreaterThan(20);
      expect(alerts[0].message).toContain('exceeds');
    });

    it('should return warning severity when cost is between 1x and 2x threshold', () => {
      // Use a threshold where HIGH_USAGE total falls between 1x and 2x
      const total = totalCost(reporter.estimateMonthlyCost(HIGH_USAGE));
      const customReporter = new CostReporter({ alertThreshold: total - 1 });
      const estimates = customReporter.estimateMonthlyCost(HIGH_USAGE);
      const alerts = customReporter.checkAlerts(estimates);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('warning');
    });

    it('should return critical severity when cost exceeds 2x threshold', () => {
      const customReporter = new CostReporter({ alertThreshold: 5 });
      const estimates = customReporter.estimateMonthlyCost(HIGH_USAGE);
      const alerts = customReporter.checkAlerts(estimates);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should respect custom alert threshold', () => {
      const customReporter = new CostReporter({ alertThreshold: 0.01 });
      const estimates = customReporter.estimateMonthlyCost(LOW_USAGE);
      const alerts = customReporter.checkAlerts(estimates);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── generateReport ──────────────────────────────────────────────

  describe('generateReport', () => {
    it('should generate a report with all services', () => {
      const report = reporter.generateReport('1.1.0', LOW_USAGE);

      expect(report.version).toBe('1.1.0');
      expect(report.estimates).toHaveLength(4);
      expect(report.reportDate).toBeInstanceOf(Date);
      expect(report.totalEstimatedMonthlyCost).toBeGreaterThan(0);
    });

    it('should include alerts in the report when costs exceed threshold', () => {
      const report = reporter.generateReport('1.1.0', HIGH_USAGE);

      expect(report.alerts.length).toBeGreaterThanOrEqual(1);
      expect(report.totalEstimatedMonthlyCost).toBeGreaterThan(20);
    });

    it('should have no alerts for low usage', () => {
      const report = reporter.generateReport('1.1.0', LOW_USAGE);
      expect(report.alerts).toHaveLength(0);
    });

    it('should sum total cost correctly', () => {
      const report = reporter.generateReport('1.1.0', LOW_USAGE);
      const manualTotal = report.estimates.reduce(
        (sum, e) => sum + e.estimatedMonthlyCost,
        0,
      );
      expect(report.totalEstimatedMonthlyCost).toBeCloseTo(manualTotal, 10);
    });
  });
});
