import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentCostData {
  agentId: string;
  agentName: string;
  totalCost: number;
  averageCost: number;
  callCount: number;
  lastActive: string;
  costTrend: 'up' | 'down' | 'stable';
}

interface CostSummary {
  totalCost: number;
  averageCost: number;
  highestCost: number;
  activeAgents: number;
}

interface CostAnalyticsResponse {
  summary: CostSummary;
  agents: AgentCostData[];
  error?: string;
}

// ─── Theme Colors (from design system) ──────────────────────────────────────

const CHART_COLORS = {
  primary: '#0f766e',
  secondary: '#6366f1',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.accent, CHART_COLORS.success, '#8b5cf6', '#ec4899'];

// ─── Helpers ────────────────────────────────────────────────────────────────

// Placeholder for real API call – replace with your endpoint
async function fetchCostAnalytics(): Promise<CostAnalyticsResponse> {
  const response = await fetch('/api/analytics/costs');
  if (!response.ok) {
    throw new Error(`Failed to fetch cost analytics: ${response.statusText}`);
  }
  return response.json();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <Card className="border-l-4 border-l-teal-600">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
            {trend && (
              <span
                className={cn(
                  'ml-2 font-medium',
                  trend === 'up' && 'text-red-500',
                  trend === 'down' && 'text-green-500',
                  trend === 'stable' && 'text-muted-foreground'
                )}
              >
                {formatTrendIcon(trend)}
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CostBarChart({ data }: { data: AgentCostData[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No agent cost data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="agentName"
          tick={{ fontSize: 12, fill: CHART_COLORS.textSecondary }}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: CHART_COLORS.textSecondary }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickFormatter={(value) => `$${value.toFixed(0)}`}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
        <Bar
          dataKey="totalCost"
          fill={CHART_COLORS.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={60}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostPieChart({ data }: { data: AgentCostData[] }) {
  if (!data.length) {
    return null;
  }

  const pieData = data.map((agent) => ({
    name: agent.agentName,
    value: agent.totalCost,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={40}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={true}
        >
          {pieData.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AgentTable({ data }: { data: AgentCostData[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Agent
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Cost
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Avg Cost
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Calls
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trend
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last Active
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-background">
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                No agent cost data available.
              </td>
            </tr>
          ) : (
            data.map((agent) => (
              <tr key={agent.agentId} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap font-medium">{agent.agentName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(agent.totalCost)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(agent.averageCost)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{agent.callCount.toLocaleString()}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-sm font-medium',
                      agent.costTrend === 'up' && 'text-red-600',
                      agent.costTrend === 'down' && 'text-green-600',
                      agent.costTrend === 'stable' && 'text-muted-foreground'
                    )}
                  >
                    {formatTrendIcon(agent.costTrend)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
                  {new Date(agent.lastActive).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CostAnalytics() {
  const [data, setData] = useState<CostAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchCostAnalytics();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    // Optional: polling every 60s for live updates
    const interval = setInterval(() => {
      load();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load cost analytics: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No cost analytics available.
      </div>
    );
  }

  const { summary, agents } = data;

  return (
    <div className="space-y-6 p-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cost Analytics</h1>
        <p className="text-muted-foreground">
          Real-time agent cost breakdown and usage metrics.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Cost (All Agents)"
          value={formatCurrency(summary.totalCost)}
          icon={DollarSign}
          subtitle="Last 30 days"
          trend="up"
        />
        <SummaryCard
          title="Average Cost per Agent"
          value={formatCurrency(summary.averageCost)}
          icon={TrendingUp}
          subtitle={`Across ${summary.activeAgents} active agents`}
        />
        <SummaryCard
          title="Highest Cost Agent"
          value={formatCurrency(summary.highestCost)}
          icon={Activity}
          subtitle="Top spender"
        />
        <SummaryCard
          title="Active Agents"
          value={summary.activeAgents.toString()}
          icon={Activity}
          subtitle="Agents with activity"
        />
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost per Agent (Bar)</CardTitle>
          </CardHeader>
          <CardContent>
            <CostBarChart data={agents} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution (Pie)</CardTitle>
          </CardHeader>
          <CardContent>
            <CostPieChart data={agents} />
          </CardContent>
        </Card>
      </div>

      {/* Per‑agent table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Cost Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            Detailed cost data per agent, including call volume and trends.
          </p>
        </CardHeader>
        <CardContent>
          <AgentTable data={agents} />
        </CardContent>
      </Card>
    </div>
  );
}