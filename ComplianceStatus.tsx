// /src/pages/ComplianceStatus.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// Types
type RuleStatus = 'passed' | 'failed' | 'pending';

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  status: RuleStatus;
  lastChecked: string; // ISO date string
}

interface ComplianceSummary {
  totalRules: number;
  passed: number;
  failed: number;
  pending: number;
  rules: ComplianceRule[];
}

// Mock data – replace with real API call
const MOCK_SUMMARY: ComplianceSummary = {
  totalRules: 24,
  passed: 18,
  failed: 4,
  pending: 2,
  rules: [
    { id: '1', name: 'PII Data Masking', description: 'Ensure all PII fields are masked in logs', status: 'passed', lastChecked: '2026-05-29T14:00:00Z' },
    { id: '2', name: 'Budget Caps (Agent Spend)', description: 'Verify per-agent cost does not exceed configured budget', status: 'failed', lastChecked: '2026-05-29T13:55:00Z' },
    { id: '3', name: 'Model Access Control', description: 'Only approved models are allowed for inference', status: 'passed', lastChecked: '2026-05-29T13:50:00Z' },
    { id: '4', name: 'Tool Permissions Audit', description: 'All tools have correct allow/deny scopes', status: 'passed', lastChecked: '2026-05-29T13:45:00Z' },
    { id: '5', name: 'Data Retention Policy', description: 'Conversation logs older than 90 days are archived', status: 'failed', lastChecked: '2026-05-29T13:40:00Z' },
    { id: '6', name: 'API Key Rotation', description: 'Service API keys rotated within 30 days', status: 'pending', lastChecked: '2026-05-29T13:35:00Z' },
    { id: '7', name: 'Sensitive Output Filtering', description: 'Responses containing credit card numbers are blocked', status: 'passed', lastChecked: '2026-05-29T13:30:00Z' },
    { id: '8', name: 'Rate Limiting Configuration', description: 'Per-user rate limits are applied correctly', status: 'failed', lastChecked: '2026-05-29T13:25:00Z' },
    { id: '9', name: 'Audit Trail Completeness', description: 'All governance events are recorded with full context', status: 'passed', lastChecked: '2026-05-29T13:20:00Z' },
    { id: '10', name: 'Model Version Pinning', description: 'Production models use pinned version hashes', status: 'pending', lastChecked: '2026-05-29T13:15:00Z' },
    { id: '11', name: 'Cross‑Tenant Isolation', description: 'Verify tenant data separation in multi‑tenant mode', status: 'passed', lastChecked: '2026-05-29T13:10:00Z' },
    { id: '12', name: 'Prompt Injection Guards', description: 'Input validation against injection patterns', status: 'failed', lastChecked: '2026-05-29T13:05:00Z' },
  ],
};

// Utility functions
const statusIcon = (status: RuleStatus) => {
  switch (status) {
    case 'passed':
      return <CheckCircle className="h-4 w-4 text-[#10b981]" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-[#ef4444]" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-[#f59e0b]" />;
  }
};

const statusBadgeVariant = (status: RuleStatus): 'success' | 'destructive' | 'warning' | 'secondary' => {
  switch (status) {
    case 'passed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'pending':
      return 'warning';
  }
};

const exportData = (summary: ComplianceSummary) => {
  const csvRows = [
    ['ID', 'Name', 'Description', 'Status', 'Last Checked'],
    ...summary.rules.map((r) => [r.id, r.name, r.description, r.status, r.lastChecked]),
  ];
  const csvContent = csvRows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `compliance-report-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Main component
export default function ComplianceStatus() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompliance = async () => {
      try {
        // Replace with real API call:
        // const response = await fetch('/api/compliance/status');
        // if (!response.ok) throw new Error('Failed to load compliance data');
        // const data = await response.json();
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 600));
        setSummary(MOCK_SUMMARY);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchCompliance();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-[#f8fafc] p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0f766e] border-t-transparent" />
          <p className="text-[#64748b] text-sm font-medium">Checking compliance rules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-[#f8fafc] p-8">
        <Card className="max-w-md w-full border-[#ef4444]/30 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#ef4444]" />
              <CardTitle className="text-[#ef4444] text-lg">Compliance Check Failed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#64748b]">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 space-y-6" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Compliance Status</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Real‑time governance rule checks and security posture
          </p>
        </div>
        <Button
          onClick={() => exportData(summary)}
          className="bg-[#0f766e] text-white hover:bg-[#0f766e]/90 flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#64748b] text-sm">Total Rules</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-semibold text-[#0f172a]">{summary.totalRules}</CardTitle>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#64748b] text-sm">Passed</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <CardTitle className="text-3xl font-semibold text-[#10b981]">{summary.passed}</CardTitle>
            <span className="text-sm text-[#10b981] font-medium">
              {Math.round((summary.passed / summary.totalRules) * 100)}%
            </span>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#64748b] text-sm">Failed</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <CardTitle className="text-3xl font-semibold text-[#ef4444]">{summary.failed}</CardTitle>
            <span className="text-sm text-[#ef4444] font-medium">
              {Math.round((summary.failed / summary.totalRules) * 100)}%
            </span>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#64748b] text-sm">Pending</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-semibold text-[#f59e0b]">{summary.pending}</CardTitle>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-[#0f172a]">Compliance Rules</CardTitle>
          <CardDescription className="text-[#64748b] text-sm">
            Detailed view of all governance rules and their current status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 hover:bg-transparent">
                <TableHead className="text-[#64748b] font-medium">Rule</TableHead>
                <TableHead className="text-[#64748b] font-medium hidden md:table-cell">Description</TableHead>
                <TableHead className="text-[#64748b] font-medium">Status</TableHead>
                <TableHead className="text-[#64748b] font-medium hidden lg:table-cell">Last Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rules.map((rule) => (
                <TableRow key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <TableCell className="font-medium text-[#0f172a]">{rule.name}</TableCell>
                  <TableCell className="text-[#64748b] text-sm hidden md:table-cell max-w-xs truncate">
                    {rule.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(rule.status)} className="flex items-center gap-1.5 w-fit">
                      {statusIcon(rule.status)}
                      <span className="capitalize">{rule.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#64748b] text-sm hidden lg:table-cell">
                    {new Date(rule.lastChecked).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}