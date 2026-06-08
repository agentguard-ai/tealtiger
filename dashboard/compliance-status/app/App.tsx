import { useMemo, useState } from 'react';

import { calculateCoverage, formatDate, formatPercent, listGaps, statusLabel } from './compliance';
import { FRAMEWORKS } from './frameworks';
import { requestComplianceReport } from './report-api';
import type { ComplianceControl, FrameworkId, ReportResult } from './types';

export default function App(): JSX.Element {
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<FrameworkId>('eu-ai-act');
  const [reportState, setReportState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [reportError, setReportError] = useState('');

  const framework = useMemo(
    () => FRAMEWORKS.find((item) => item.id === selectedFrameworkId) ?? FRAMEWORKS[0],
    [selectedFrameworkId],
  );
  const coverage = useMemo(() => calculateCoverage(framework.controls), [framework]);
  const gaps = useMemo(() => listGaps(framework), [framework]);

  const generateReport = async (): Promise<void> => {
    setReportState('loading');
    setReportResult(null);
    setReportError('');

    try {
      const result = await requestComplianceReport(framework, coverage);
      setReportResult(result);
      setReportState('success');
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Report API request failed.');
      setReportState('error');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">TT</div>
          <div>
            <h1>Compliance Status</h1>
            <p>Coverage, evidence readiness, and gap analysis for regulated AI governance.</p>
          </div>
        </div>
        <div className="report-actions">
          <button className="primary-button" type="button" onClick={generateReport} disabled={reportState === 'loading'}>
            {reportState === 'loading' ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </header>

      <section className="framework-tabs" aria-label="Compliance framework selector">
        {FRAMEWORKS.map((item) => (
          <button
            key={item.id}
            className={item.id === framework.id ? 'active' : ''}
            type="button"
            onClick={() => {
              setSelectedFrameworkId(item.id);
              setReportState('idle');
              setReportResult(null);
              setReportError('');
            }}
          >
            {item.shortName}
          </button>
        ))}
      </section>

      <main className="dashboard-grid">
        <section className="summary-card hero-card">
          <div>
            <span className="section-label">{framework.name}</span>
            <h2>{framework.description}</h2>
          </div>
          <CoverageRing coverage={coverage.weightedCoverage} />
        </section>

        <MetricCard label="Covered controls" value={`${coverage.covered}/${coverage.total}`} detail={`${coverage.partial} partial, ${coverage.gaps} open gaps`} />
        <MetricCard label="Evidence proof" value={formatPercent(coverage.proofCoverage)} detail="Controls with cryptographic proof attached" />
        <MetricCard label="Missing work" value={String(gaps.length)} detail="Controls needed to reach full coverage" tone={gaps.length > 0 ? 'warning' : 'normal'} />

        <section className="panel checklist-panel">
          <PanelHeader title="Article and control checklist" detail="Per-control status and evidence availability" />
          <div className="control-list">
            {framework.controls.map((control) => (
              <ControlRow key={control.id} control={control} />
            ))}
          </div>
        </section>

        <section className="panel timeline-panel">
          <PanelHeader title="Coverage timeline" detail="Historical compliance coverage trend" />
          <CoverageTimeline points={framework.history} />
        </section>

        <section className="panel gap-panel">
          <PanelHeader title="Gap analysis" detail="What remains to reach 100% coverage" />
          {gaps.length > 0 ? (
            <div className="gap-list">
              {gaps.map((gap) => (
                <article key={gap.controlId} className={`gap-item status-${gap.status}`}>
                  <div>
                    <strong>{gap.controlId} · {gap.title}</strong>
                    <span>{statusLabel(gap.status)} · Owner: {gap.owner}</span>
                  </div>
                  <ul>
                    {gap.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No gaps for this framework.</div>
          )}
        </section>

        <section className="panel report-panel">
          <PanelHeader title="Report generation" detail="POSTs the selected framework summary to the compliance report API" />
          <div className={`report-status ${reportState}`}>
            {reportState === 'idle' && <p>Generate a report to send the current coverage snapshot to `/api/compliance/reports`.</p>}
            {reportState === 'loading' && <p>Sending report generation request...</p>}
            {reportState === 'success' && reportResult && (
              <p><strong>{reportResult.reportId}</strong> · {reportResult.message}</p>
            )}
            {reportState === 'error' && (
              <p><strong>API request failed.</strong> {reportError}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'normal',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'normal' | 'warning';
}): JSX.Element {
  return (
    <section className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }): JSX.Element {
  return (
    <header className="panel-header">
      <h3>{title}</h3>
      <p>{detail}</p>
    </header>
  );
}

function CoverageRing({ coverage }: { coverage: number }): JSX.Element {
  return (
    <div
      className="coverage-ring"
      style={{ '--progress': `${Math.round(coverage * 360)}deg` } as React.CSSProperties}
      aria-label={`Coverage ${formatPercent(coverage)}`}
    >
      <span>{formatPercent(coverage)}</span>
      <small>weighted</small>
    </div>
  );
}

function ControlRow({ control }: { control: ComplianceControl }): JSX.Element {
  return (
    <article className={`control-row status-${control.status}`}>
      <div className="status-mark" aria-hidden="true">{statusSymbol(control.status)}</div>
      <div className="control-main">
        <div className="control-heading">
          <strong>{control.id} · {control.title}</strong>
          <span>{statusLabel(control.status)}</span>
        </div>
        <p>{control.requirement}</p>
        <div className="control-meta">
          <span>Owner: {control.owner}</span>
          <EvidenceBadge control={control} />
        </div>
      </div>
    </article>
  );
}

function EvidenceBadge({ control }: { control: ComplianceControl }): JSX.Element {
  if (control.evidence.hasCryptographicProof) {
    return <span className="evidence-badge proof">Cryptographic proof · {control.evidence.proofId}</span>;
  }
  return <span className="evidence-badge missing">No proof attached</span>;
}

function CoverageTimeline({ points }: { points: Array<{ date: string; coverage: number }> }): JSX.Element {
  const width = 680;
  const height = 210;
  const padding = 28;
  const maxX = Math.max(1, points.length - 1);
  const coordinates = points.map((point, index) => {
    const x = padding + (index / maxX) * (width - padding * 2);
    const y = padding + (1 - point.coverage) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="timeline-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Compliance coverage over time">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <path d={path} />
        {coordinates.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="5" />
            <text x={point.x} y={height - 6}>{formatDate(point.date)}</text>
            <text x={point.x} y={Math.max(16, point.y - 10)}>{formatPercent(point.coverage)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function statusSymbol(status: ComplianceControl['status']): string {
  if (status === 'covered') {
    return '✓';
  }
  if (status === 'partial') {
    return '!';
  }
  return '×';
}
