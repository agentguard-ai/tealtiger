import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Home,
  ListFilter,
  LockKeyhole,
  Settings,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

export type DashboardRouteId =
  | 'overview'
  | 'agents'
  | 'events'
  | 'cost'
  | 'security'
  | 'compliance'
  | 'settings';

export interface DashboardRoute {
  id: DashboardRouteId;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
}

export const dashboardRoutes: DashboardRoute[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/',
    description: 'Fleet health, spend, and policy posture',
    icon: Home,
  },
  {
    id: 'agents',
    label: 'Agents',
    path: '/agents',
    description: 'Registered agents and runtime details',
    icon: Bot,
  },
  {
    id: 'events',
    label: 'Events',
    path: '/events',
    description: 'Governance decision feed',
    icon: ListFilter,
  },
  {
    id: 'cost',
    label: 'Cost',
    path: '/cost',
    description: 'Budget and provider analytics',
    icon: CircleDollarSign,
  },
  {
    id: 'security',
    label: 'Security',
    path: '/security',
    description: 'PII, secrets, injections, and alerts',
    icon: ShieldAlert,
  },
  {
    id: 'compliance',
    label: 'Compliance',
    path: '/compliance',
    description: 'Control status and evidence',
    icon: CheckCircle2,
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    description: 'Workspace, policy, and notification setup',
    icon: Settings,
  },
];

export const routeByPath = new Map(dashboardRoutes.map((route) => [route.path, route]));

export const headerActions = [
  { label: 'Notifications', icon: Bell },
  { label: 'Agent health', icon: Activity },
  { label: 'Policy locked', icon: LockKeyhole },
];

export const agentStatuses = [
  { label: 'Online agents', value: '42', tone: 'success' },
  { label: 'Degraded', value: '3', tone: 'warning' },
  { label: 'Policy blocks', value: '18', tone: 'destructive' },
] as const;

export function getRouteForPath(pathname: string): DashboardRoute {
  return routeByPath.get(pathname) ?? dashboardRoutes[0];
}
