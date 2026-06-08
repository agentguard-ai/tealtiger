import type { ComplianceControl, ComplianceFramework, CoverageSummary, GapItem } from './types';

export function calculateCoverage(controls: ComplianceControl[]): CoverageSummary {
  const total = controls.length;
  const covered = controls.filter((control) => control.status === 'covered').length;
  const partial = controls.filter((control) => control.status === 'partial').length;
  const gaps = controls.filter((control) => control.status === 'gap').length;
  const weighted = controls.reduce((score, control) => {
    if (control.status === 'covered') {
      return score + 1;
    }
    if (control.status === 'partial') {
      return score + 0.5;
    }
    return score;
  }, 0);
  const proofCount = controls.filter((control) => control.evidence.hasCryptographicProof).length;

  return {
    covered,
    partial,
    gaps,
    total,
    weightedCoverage: total === 0 ? 0 : weighted / total,
    proofCoverage: total === 0 ? 0 : proofCount / total,
  };
}

export function listGaps(framework: ComplianceFramework): GapItem[] {
  return framework.controls
    .filter((control) => control.status !== 'covered')
    .map((control) => ({
      controlId: control.id,
      title: control.title,
      status: control.status,
      owner: control.owner,
      missing: control.missing,
    }));
}

export function statusLabel(status: ComplianceControl['status']): string {
  switch (status) {
    case 'covered':
      return 'Covered';
    case 'partial':
      return 'Partial';
    case 'gap':
      return 'Gap';
  }
}

export function statusWeight(status: ComplianceControl['status']): number {
  if (status === 'covered') {
    return 1;
  }
  if (status === 'partial') {
    return 0.5;
  }
  return 0;
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
