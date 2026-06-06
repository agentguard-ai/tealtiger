import { type ReactElement } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Database, LockKeyhole, type LucideIcon } from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { dashboardRoutes } from './navigation';

const overviewMetrics = [
  { label: 'Governed decisions', value: '1.84M', trend: '+12.6%', tone: 'success' },
  { label: 'Policy blocks', value: '18', trend: '-4.1%', tone: 'warning' },
  { label: 'Monthly spend', value: '$42.8K', trend: '+2.3%', tone: 'secondary' },
  { label: 'Compliance drift', value: '3 controls', trend: 'review', tone: 'destructive' },
] as const;

const recentDecisions = [
  ['12:48:11', 'support-agent', 'ALLOW', 'crm.lookup_customer', 'OpenAI'],
  ['12:46:03', 'code-agent', 'DENY', 'github.create_issue', 'Anthropic'],
  ['12:42:55', 'finance-agent', 'REQUIRE_APPROVAL', 'stripe.refund', 'OpenAI'],
  ['12:39:24', 'research-agent', 'REVISE', 'web.fetch', 'Gemini'],
];

export function OverviewPage(): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Overview metrics">
        {overviewMetrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-border bg-card p-4 text-card-foreground">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <Badge variant={metric.tone}>{metric.trend}</Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-normal">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-md border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h1 className="text-lg font-semibold">Governance decision feed</h1>
              <p className="mt-1 text-sm text-muted-foreground">Latest runtime decisions across agents and tools.</p>
            </div>
            <Button variant="outline" size="sm">View events</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Decision</th>
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {recentDecisions.map(([time, agent, decision, tool, provider]) => (
                  <tr key={`${time}-${agent}`} className="border-b border-border/70 last:border-b-0">
                    <td className="px-4 py-3 text-muted-foreground">{time}</td>
                    <td className="px-4 py-3 font-medium">{agent}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={decision === 'DENY' ? 'destructive' : decision === 'REQUIRE_APPROVAL' ? 'warning' : 'success'}
                      >
                        {decision}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tool}</td>
                    <td className="px-4 py-3 text-muted-foreground">{provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <StatusPanel icon={Activity} label="Agent status" value="42 online" detail="3 degraded agents need review." />
          <StatusPanel icon={LockKeyhole} label="Policy version" value="v1.3 active" detail="All production routes use signed policies." />
          <StatusPanel icon={Database} label="Audit retention" value="90 days" detail="Receipt ledger append-only mode is enabled." />
        </div>
      </section>
    </div>
  );
}

export function PlaceholderPage({
  title,
  description,
  variant = 'default',
}: {
  title: string;
  description: string;
  variant?: 'default' | 'cost' | 'compliance' | 'settings' | 'agents' | 'events';
}): ReactElement {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Badge variant={variant === 'compliance' ? 'warning' : 'secondary'}>Ready</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusTile label="Route" value={title} />
          <StatusTile label="State" value="Placeholder" />
          <StatusTile label="Access" value="Workspace" />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Expected workspace</h2>
        <div className="mt-4 grid gap-3">
          {dashboardRoutes.slice(0, 4).map((route, index) => (
            <RoutePreview route={route} index={index} key={route.id} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatusPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function RoutePreview({
  route,
  index,
}: {
  route: { icon: LucideIcon; label: string; description: string };
  index: number;
}): ReactElement {
  const Icon = route.icon;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{route.label}</p>
          <p className="text-xs text-muted-foreground">{route.description}</p>
        </div>
      </div>
      {index % 2 === 0 ? (
        <ArrowUpRight aria-hidden="true" className="text-success" />
      ) : (
        <ArrowDownRight aria-hidden="true" className="text-warning" />
      )}
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
