import React, { useState, useMemo } from 'react';

// Shadcn/ui components (assumed installed)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityAlert {
  id: string;
  timestamp: string; // ISO 8601
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
  description: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
}

type SeverityFilter = 'all' | SecurityAlert['severity'];
type StatusFilter = 'all' | SecurityAlert['status'];

// ---------------------------------------------------------------------------
// Mock data (would be replaced with API integration)
// ---------------------------------------------------------------------------

const mockAlerts: SecurityAlert[] = [
  {
    id: 'sec-001',
    timestamp: '2026-05-29T14:32:00Z',
    severity: 'critical',
    source: 'Auth Service',
    description: 'Multiple failed login attempts from IP 192.168.1.100',
    status: 'open',
  },
  {
    id: 'sec-002',
    timestamp: '2026-05-29T14:15:00Z',
    severity: 'high',
    source: 'API Gateway',
    description: 'Suspicious SQL injection pattern detected in /search endpoint',
    status: 'acknowledged',
  },
  {
    id: 'sec-003',
    timestamp: '2026-05-29T13:45:00Z',
    severity: 'medium',
    source: 'Agent Controller',
    description: 'Unusual tool usage frequency by agent prod-02',
    status: 'open',
  },
  {
    id: 'sec-004',
    timestamp: '2026-05-29T12:30:00Z',
    severity: 'low',
    source: 'Audit Log',
    description: 'Configuration change detected: rate limit threshold updated',
    status: 'resolved',
  },
  {
    id: 'sec-005',
    timestamp: '2026-05-29T11:00:00Z',
    severity: 'info',
    source: 'Compliance',
    description: 'Routine governance policy check completed – no violations',
    status: 'dismissed',
  },
  {
    id: 'sec-006',
    timestamp: '2026-05-29T10:20:00Z',
    severity: 'high',
    source: 'Data Layer',
    description: 'Potential data exfiltration attempt from external IP range',
    status: 'open',
  },
  {
    id: 'sec-007',
    timestamp: '2026-05-29T09:05:00Z',
    severity: 'critical',
    source: 'Identity Provider',
    description: 'Compromised API key detected: key rotated automatically',
    status: 'resolved',
  },
];

// ---------------------------------------------------------------------------
// Helper: severity → color map (TealTiger design tokens)
// ---------------------------------------------------------------------------

const severityColor: Record<SecurityAlert['severity'], 'destructive' | 'warning' | 'secondary' | 'default' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'default',
  info: 'outline',
};

const severityLabel: Record<SecurityAlert['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const SecurityAlerts: React.FC = () => {
  // ── State ──────────────────────────────────────────────────────────────
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');

  // ── Filtering ──────────────────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    return mockAlerts.filter((alert) => {
      // Severity filter
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      // Search (case‑insensitive)
      if (searchText && !alert.description.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [severityFilter, statusFilter, searchText]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Card className="shadow-sm border border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold text-slate-900">
          Security Alerts
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search alerts…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Severity:</span>
            <Select
              value={severityFilter}
              onValueChange={(val: SeverityFilter) => setSeverityFilter(val)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Status:</span>
            <Select
              value={statusFilter}
              onValueChange={(val: StatusFilter) => setStatusFilter(val)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="rounded-md border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[160px]">Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                    No security alerts matching the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {new Date(alert.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColor[alert.severity]}>
                        {severityLabel[alert.severity]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">{alert.source}</TableCell>
                    <TableCell className="max-w-md truncate" title={alert.description}>
                      {alert.description}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          alert.status === 'open'
                            ? 'bg-red-100 text-red-700'
                            : alert.status === 'acknowledged'
                            ? 'bg-yellow-100 text-yellow-700'
                            : alert.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityAlerts;