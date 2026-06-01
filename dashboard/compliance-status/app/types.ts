export type FrameworkId = 'eu-ai-act' | 'soc2' | 'hipaa' | 'nist-ai-rmf' | 'iso-27001';

export type ControlStatus = 'covered' | 'partial' | 'gap';

export interface EvidenceReference {
  hasCryptographicProof: boolean;
  proofId?: string;
  receiptHash?: string;
  updatedAt?: string;
}

export interface ComplianceControl {
  id: string;
  title: string;
  requirement: string;
  owner: string;
  status: ControlStatus;
  evidence: EvidenceReference;
  missing: string[];
}

export interface ComplianceHistoryPoint {
  date: string;
  coverage: number;
}

export interface ComplianceFramework {
  id: FrameworkId;
  name: string;
  shortName: string;
  description: string;
  controls: ComplianceControl[];
  history: ComplianceHistoryPoint[];
}

export interface CoverageSummary {
  covered: number;
  partial: number;
  gaps: number;
  total: number;
  weightedCoverage: number;
  proofCoverage: number;
}

export interface GapItem {
  controlId: string;
  title: string;
  status: ControlStatus;
  owner: string;
  missing: string[];
}

export interface ReportRequest {
  frameworkId: FrameworkId;
  frameworkName: string;
  coverage: number;
  generatedAt: string;
  controls: Array<{
    id: string;
    status: ControlStatus;
    proofAvailable: boolean;
  }>;
}

export interface ReportResult {
  reportId: string;
  status: 'queued' | 'generated' | 'fallback';
  message: string;
}
