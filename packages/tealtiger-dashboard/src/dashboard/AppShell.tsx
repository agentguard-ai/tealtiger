import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { agentStatuses, dashboardRoutes, getRouteForPath } from './navigation';

export type ThemeMode = 'dark' | 'light';

interface AppShellProps {
  children: ReactNode;
  theme: ThemeMode;
  onThemeToggle: () => void;
}

export function AppShell({ children, theme, onThemeToggle }: AppShellProps): ReactElement {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to dashboard content
      </a>

      <div className="flex min-h-screen">
        <SidebarNavigation className="hidden lg:flex" />

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden" aria-modal="true" role="dialog" aria-label="Dashboard navigation">
            <button
              type="button"
              className="absolute inset-0 bg-background/80"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <SidebarNavigation
              className="absolute left-0 top-0 flex h-full w-[min(88vw,320px)]"
              onClose={() => setMobileOpen(false)}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            theme={theme}
            onThemeToggle={onThemeToggle}
            onOpenNavigation={() => setMobileOpen(true)}
          />
          <main id="dashboard-content" className="min-w-0 flex-1 px-4 py-4 md:px-6 lg:px-8">
            <BreadcrumbTrail />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function SidebarNavigation({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}): ReactElement {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5">TealTiger</p>
            <p className="text-xs text-sidebar-muted">Governance Console</p>
          </div>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close navigation" onClick={onClose}>
            <X />
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Dashboard sections">
        {dashboardRoutes.map((route) => {
          const Icon = route.icon;
          const isActive = location.pathname === route.path;
          return (
            <Link
              key={route.id}
              to={route.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn('dashboard-nav-link', isActive && 'dashboard-nav-link-active')}
            >
              <Icon aria-hidden="true" />
              <span className="min-w-0 truncate">{route.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-md border border-sidebar-border bg-sidebar-panel p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-sidebar-muted">Runtime policy</p>
              <p className="text-sm font-semibold">Production active</p>
            </div>
            <Badge variant="success">Live</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-sidebar-muted">
            1.8M governed decisions retained across 12 providers.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function DashboardHeader({
  theme,
  onThemeToggle,
  onOpenNavigation,
}: {
  theme: ThemeMode;
  onThemeToggle: () => void;
  onOpenNavigation: () => void;
}): ReactElement {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
        >
          <Menu />
        </Button>

        <div className="relative min-w-0 flex-1 md:max-w-xl">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search agents, events, and policies"
            placeholder="Search agents, events, policies"
            className="pl-9"
          />
        </div>

        <div className="hidden items-center gap-2 xl:flex" aria-label="Agent status summary">
          {agentStatuses.map((status) => (
            <Badge
              key={status.label}
              variant={status.tone}
              className="h-8"
              aria-label={`${status.label}: ${status.value}`}
            >
              {status.value} {status.label}
            </Badge>
          ))}
        </div>

        <Button type="button" variant="ghost" size="icon" aria-label="View notifications">
          <Bell />
        </Button>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
    </header>
  );
}

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}): ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-pressed={theme === 'light'}
      onClick={onToggle}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

export function BreadcrumbTrail(): ReactElement {
  const location = useLocation();
  const route = getRouteForPath(location.pathname);

  return (
    <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <NavLink to="/" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        Dashboard
      </NavLink>
      <ChevronRight aria-hidden="true" className="size-4" />
      <span aria-current="page" className="font-medium text-foreground">
        {route.label}
      </span>
    </nav>
  );
}
