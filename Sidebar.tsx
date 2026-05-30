import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  Shield,
  AlertTriangle,
  DollarSign,
  Settings,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Events', href: '/events', icon: Activity },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Compliance', href: '/compliance', icon: Shield },
  { label: 'Security', href: '/security', icon: AlertTriangle },
  { label: 'Costs', href: '/costs', icon: DollarSign },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6 dark:border-gray-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white font-bold text-lg">
          TT
        </div>
        <span className="text-lg font-semibold text-[#0f172a] dark:text-white">
          TealTiger
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href));

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#0f766e]/10 text-[#0f766e] dark:bg-[#0f766e]/20 dark:text-teal-300'
                  : 'text-[#64748b] hover:bg-gray-100 hover:text-[#0f172a] dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section: user or version */}
      <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#64748b] dark:text-gray-400">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-medium">
            O
          </div>
          <div className="text-left">
            <p className="font-medium text-[#0f172a] dark:text-white">Operator</p>
            <p className="text-xs">v1.4.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;