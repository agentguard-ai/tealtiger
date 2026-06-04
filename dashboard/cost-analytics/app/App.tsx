import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  buildTimeline,
  calculateAnomalies,
  calculateBudgetUtilization,
  calculateExpensiveCalls,
  calculateProviderSplit,
  calculateToolRanking,
  filterByDateRange,
  formatCurrency,
  formatDateTime,
  formatPercent,
} from './analytics';
import { AGENT_COLORS, AGENTS, PROVIDER_COLORS, SAMPLE_COST_EVENTS, SAMPLE_RANGE } from './data';
import { exportCsv } from './csv';
import type { DateRange, ExportView, Granularity } from './types';

const GRANULARITIES: Granularity[] = ['hourly', 'daily', 'weekly'];

export default function App(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>(SAMPLE_RANGE);
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [exportView, setExportView] = useState<ExportView>('raw');
  const [isLoading, setIsLoading] = useState(false);

  const filteredEvents = useMemo(
    () => filterByDateRange(SAMPLE_COST_EVENTS, dateRange),
    [dateRange],
  );
  const timeline = useMemo(() => buildTimeline(filteredEvents, granularity), [filteredEvents, granularity]);
  const budgets = useMemo(() => calculateBudgetUtilization(filteredEvents), [filteredEvents]);
  const providers = useMemo(() => calculateProviderSplit(filteredEvents), [filteredEvents]);
  const tools = useMemo(() => calculateToolRanking(filteredEvents, 10), [filteredEvents]);
  const expensiveCalls = useMemo(() => calculateExpensiveCalls(filteredEvents, 5), [filteredEvents]);
  const anomalies = useMemo(() => calculateAnomalies(timeline), [timeline]);
  const timelineWithAnomalies = useMemo(() => {
    const rows = timeline.map((row) => ({ ...row }));
    for (const anomaly of anomalies) {
      const row = rows.find((item) => item.bucketKey === anomaly.bucketKey);
      if (row) {
        row[`anomaly_${anomaly.agent}`] = anomaly.costUsd;
      }
    }
    return rows;
  }, [anomalies, timeline]);
  const totals = useMemo(() => {
    const totalCost = filteredEvents.reduce((sum, event) => sum + event.costUsd, 0);
    const totalTokens = filteredEvents.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0);
    return {
      totalCost,
      totalTokens,
      avgCost: filteredEvents.length ? totalCost / filteredEvents.length : 0,
      calls: filteredEvents.length,
    };
  }, [filteredEvents]);

  const hasData = filteredEvents.length > 0;

  const refresh = (): void => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 650);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">TT</div>
          <div>
            <h1>Cost Analytics</h1>
            <p>Agent spend, budget utilization, provider split, and anomaly visibility.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={refresh} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spinning' : undefined} />
            Refresh
          </button>
          <label className="export-control">
            Export
            <select value={exportView} onChange={(event) => setExportView(event.target.value as ExportView)}>
              <option value="raw">Raw calls</option>
              <option value="timeline">Timeline</option>
              <option value="budgets">Budgets</option>
              <option value="providers">Providers</option>
              <option value="tools">Tool ranking</option>
              <option value="calls">Top calls</option>
            </select>
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={() => exportCsv(exportView, {
              raw: filteredEvents,
              timeline,
              budgets,
              providers,
              tools,
              calls: expensiveCalls,
            })}
            disabled={!hasData}
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </header>

      <section className="controls-band">
        <div className="date-control">
          <CalendarDays size={16} />
          <label>
            From
            <input
              type="date"
              value={dateRange.from}
              onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={dateRange.to}
              onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
        </div>
        <div className="segmented-control" aria-label="Timeline granularity">
          {GRANULARITIES.map((value) => (
            <button
              key={value}
              className={granularity === value ? 'active' : ''}
              type="button"
              onClick={() => setGranularity(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <main className="dashboard-grid">
          <MetricCard icon={<CircleDollarSign size={18} />} label="Total spend" value={formatCurrency(totals.totalCost)} detail={`${totals.calls.toLocaleString()} governed calls`} />
          <MetricCard icon={<WalletCards size={18} />} label="Average call cost" value={formatCurrency(totals.avgCost)} detail={`${totals.totalTokens.toLocaleString()} tokens sampled`} />
          <MetricCard icon={<AlertTriangle size={18} />} label="p95 anomalies" value={String(anomalies.length)} detail="Marked directly on the cost timeline" tone={anomalies.length > 0 ? 'warning' : 'normal'} />

          <section className="panel timeline-panel">
            <PanelHeader icon={<LineChartIcon size={17} />} title="Cost timeline" detail="Multi-series agent spend with p95 anomaly markers" />
            <div className="chart-frame large">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineWithAnomalies} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#e4e9e2" vertical={false} />
                  <XAxis dataKey="bucketKey" minTickGap={32} tickFormatter={(value) => timeline.find((row) => row.bucketKey === value)?.label ?? value} />
                  <YAxis tickFormatter={(value) => `$${value}`} width={58} />
                  <Tooltip content={<TimelineTooltip />} />
                  <Legend />
                  {AGENTS.map((agent) => (
                    <Line
                      key={agent}
                      type="monotone"
                      dataKey={agent}
                      stroke={AGENT_COLORS[agent]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  ))}
                  {AGENTS.map((agent) => (
                    <Line
                      key={`anomaly-${agent}`}
                      name="p95 anomaly"
                      type="monotone"
                      dataKey={`anomaly_${agent}`}
                      stroke="transparent"
                      dot={{ r: 5, fill: '#cf2f38', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#cf2f38', stroke: '#ffffff', strokeWidth: 2 }}
                      legendType="none"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel gauges-panel">
            <PanelHeader icon={<Gauge size={17} />} title="Budget utilization" detail="Turns red above 90% utilization" />
            <div className="gauge-grid">
              {budgets.map((budget) => (
                <BudgetGauge key={budget.agent} budget={budget} />
              ))}
            </div>
          </section>

          <section className="panel provider-panel">
            <PanelHeader icon={<BarChart3 size={17} />} title="Provider split" detail="Cost distribution by model provider" />
            <div className="chart-frame medium">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providers}
                    dataKey="costUsd"
                    nameKey="provider"
                    innerRadius={66}
                    outerRadius={96}
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {providers.map((item) => (
                      <Cell key={item.provider} fill={PROVIDER_COLORS[item.provider]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel tool-panel">
            <PanelHeader icon={<BarChart3 size={17} />} title="Tool cost ranking" detail="Top 10 tools by aggregate spend" />
            <div className="chart-frame medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tools} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 92 }}>
                  <CartesianGrid stroke="#e4e9e2" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                  <YAxis type="category" dataKey="tool" width={120} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="costUsd" fill="#147d64" radius={[0, 7, 7, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel calls-panel">
            <PanelHeader icon={<CircleDollarSign size={17} />} title="Top 5 expensive tool calls" detail="Individual calls ranked by cost" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Agent</th>
                    <th>Tool</th>
                    <th>Provider</th>
                    <th className="numeric">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {expensiveCalls.map((call) => (
                    <tr key={call.id}>
                      <td>{formatDateTime(call.timestamp)}</td>
                      <td>{call.agent}</td>
                      <td>{call.tool}</td>
                      <td>{call.provider}</td>
                      <td className="numeric">{formatCurrency(call.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = 'normal',
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  detail: string;
  tone?: 'normal' | 'warning';
}): JSX.Element {
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </section>
  );
}

function PanelHeader({ icon, title, detail }: { icon: JSX.Element; title: string; detail: string }): JSX.Element {
  return (
    <header className="panel-header">
      <div>
        <span>{icon}{title}</span>
        <p>{detail}</p>
      </div>
    </header>
  );
}

function BudgetGauge({ budget }: { budget: ReturnType<typeof calculateBudgetUtilization>[number] }): JSX.Element {
  const percent = Math.min(1, budget.utilization);
  const status = budget.utilization > 0.9 ? 'danger' : budget.utilization > 0.75 ? 'warning' : 'healthy';

  return (
    <article className={`gauge-card ${status}`}>
      <div
        className="gauge-ring"
        style={{ '--progress': `${percent * 360}deg` } as React.CSSProperties}
        aria-label={`${budget.agent} budget utilization ${formatPercent(budget.utilization)}`}
      >
        <span>{formatPercent(budget.utilization)}</span>
      </div>
      <div>
        <h3>{budget.agent}</h3>
        <p>{formatCurrency(budget.costUsd)} of {formatCurrency(budget.budgetUsd)}</p>
      </div>
    </article>
  );
}

function TimelineTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }): JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const visiblePayload = payload.filter((item) => !String(item.name).startsWith('anomaly_'));

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {visiblePayload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color ?? '#17201c' }} />
          {item.name}: {formatCurrency(Number(item.value))}
        </span>
      ))}
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <main className="state-view">
      <RefreshCw size={24} className="spinning" />
      <h2>Loading cost analytics</h2>
      <p>Refreshing sample governance cost data.</p>
    </main>
  );
}

function EmptyState(): JSX.Element {
  return (
    <main className="state-view">
      <CalendarDays size={24} />
      <h2>No cost data in this date range</h2>
      <p>Adjust the start or end date to bring sample events back into view.</p>
    </main>
  );
}
