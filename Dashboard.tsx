// /src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Header } from '../components/organisms/Header';
import { Sidebar } from '../components/organisms/Sidebar';
import { EventFeed } from '../components/organisms/EventFeed';
import { CostAnalytics } from '../components/organisms/CostAnalytics';
import { SecurityAlerts } from '../components/organisms/SecurityAlerts';
import { ComplianceStatus } from '../components/organisms/ComplianceStatus';
import { AgentCostChart } from '../components/organisms/AgentCostChart';
import { RealtimeStream } from '../components/organisms/RealtimeStream';
import { TimeRangeSelector } from '../components/molecules/TimeRangeSelector';
import { Badge } from '../components/atoms/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLive, setIsLive] = useState(true);

  // Placeholder for real-time connection health
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate WebSocket heartbeats
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Dashboard"
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        >
          <div className="flex items-center gap-4">
            <Badge
              variant={isLive ? 'success' : 'warning'}
              className="gap-1.5"
            >
              <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
              {isLive ? 'Live' : 'Disconnected'}
            </Badge>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </Header>

        {/* Scrollable grid area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* Row 1: Real-time stream + Event Feed */}
            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle>Real-time Stream</CardTitle>
              </CardHeader>
              <CardContent>
                <RealtimeStream timeRange={timeRange} />
              </CardContent>
            </Card>

            <Card className="md:col-span-2 xl:col-span-2">
              <CardHeader>
                <CardTitle>Governance Events</CardTitle>
              </CardHeader>
              <CardContent>
                <EventFeed timeRange={timeRange} limit={6} />
              </CardContent>
            </Card>

            {/* Row 2: Cost + Security + Compliance */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CostAnalytics timeRange={timeRange} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <SecurityAlerts timeRange={timeRange} limit={5} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ComplianceStatus timeRange={timeRange} />
              </CardContent>
            </Card>

            {/* Row 3: Agent Cost Chart (spans full width on large) */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Agent Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <AgentCostChart timeRange={timeRange} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;