import type { ComplianceFramework, CoverageSummary, ReportRequest, ReportResult } from './types';

const DEFAULT_REPORT_ENDPOINT = import.meta.env.VITE_COMPLIANCE_REPORT_ENDPOINT ?? '/api/compliance/reports';

export async function requestComplianceReport(
  framework: ComplianceFramework,
  coverage: CoverageSummary,
  endpoint = DEFAULT_REPORT_ENDPOINT,
): Promise<ReportResult> {
  const payload: ReportRequest = {
    frameworkId: framework.id,
    frameworkName: framework.name,
    coverage: coverage.weightedCoverage,
    generatedAt: new Date().toISOString(),
    controls: framework.controls.map((control) => ({
      id: control.id,
      status: control.status,
      proofAvailable: control.evidence.hasCryptographicProof,
    })),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Report API returned ${response.status}`);
  }

  const body = await response.json() as Partial<ReportResult>;
  return {
    reportId: body.reportId ?? `report-${framework.id}-${Date.now()}`,
    status: body.status ?? 'queued',
    message: body.message ?? 'Compliance report generation request accepted.',
  };
}
