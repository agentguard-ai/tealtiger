// /src/components/layout/AppShell.tsx
import React, { useState, type ReactNode } from 'react';

// ─── Icons (from lucide-react) ─────────────────────────────
import {
  LayoutDashboard,
  Cpu,
  Activity,
  DollarSign,
  Shield,
  CheckSquare,
  Menu,
  X,
  Search,
  Bell,
  User,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────
interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/' },
  { label: 'Agents', icon: <Cpu size={20} />, href: '/agents' },
  { label: 'Events', icon: <Activity size={20} />, href: '/events', badge: 'Live' },
  { label: 'Cost Analytics', icon: <DollarSign size={20} />, href: '/costs' },
  { label: 'Security', icon: <Shield size={20} />, href: '/security' },
  { label: 'Compliance', icon: <CheckSquare size={20} />, href: '/compliance' },
];

// ─── AppShell Props ────────────────────────────────────────
interface AppShellProps {
  children: ReactNode;
}

// ─── Component ─────────────────────────────────────────────
export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-['Inter',system-ui,-apple-system,sans-serif]">
      {/* ─── Mobile overlay ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e]">
              <span className="text-sm font-bold text-white">TT</span>
            </div>
            <span className="text-lg font-semibold text-[#0f172a]">TealTiger</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-[#0f766e]/10 hover:text-[#0f766e]"
                >
                  <span className="flex-shrink-0 text-slate-400 group-hover:text-[#0f766e]">
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-[#0f766e]/10 px-2 py-0.5 text-xs font-medium text-[#0f766e]">
                      {item.badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10b981]" />
            System healthy
          </div>
        </div>
      </aside>

      {/* ─── Main area ─────────────────────────────────────── */}
      <div className="md:pl-64">
        {/* ─── Top Header ──────────────────────────────────── */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 shadow-sm">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Search bar (desktop placeholder) */}
          <div className="hidden flex-1 max-w-md sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search governance events, agents..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
          </div>

          <div className="flex-1 sm:hidden" />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100">
              <Bell size={20} />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white">
                3
              </span>
            </button>
            <button className="flex items-center gap-2 rounded-md p-1.5 text-sm text-slate-700 hover:bg-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1]/10 text-[#6366f1]">
                <User size={16} />
              </div>
              <span className="hidden sm:inline">Operator</span>
            </button>
          </div>
        </header>

        {/* ─── Page content ────────────────────────────────── */}
        <main className="overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}