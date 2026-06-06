import { type ReactElement, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { SecurityEventsView } from './security-events-view';
import { AppShell, type ThemeMode } from './dashboard/AppShell';
import { OverviewPage, PlaceholderPage } from './dashboard/pages';

export function App(): ReactElement {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('tealtiger-dashboard-theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('tealtiger-dashboard-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <AppShell theme={theme} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route
            path="/agents"
            element={<PlaceholderPage title="Agents" description="Browse registered agent identities, runtime ownership, default model routing, and detail panels." variant="agents" />}
          />
          <Route
            path="/events"
            element={<PlaceholderPage title="Events" description="Review the governance decision feed with policy outcomes, receipts, tools, providers, and timelines." variant="events" />}
          />
          <Route
            path="/cost"
            element={<PlaceholderPage title="Cost" description="Analyze model spend, budget burn, provider distribution, and daily rollups." variant="cost" />}
          />
          <Route path="/security" element={<SecurityEventsView />} />
          <Route
            path="/compliance"
            element={<PlaceholderPage title="Compliance" description="Track framework status, control evidence, review dates, and open remediation work." variant="compliance" />}
          />
          <Route
            path="/settings"
            element={<PlaceholderPage title="Settings" description="Configure workspace preferences, alert channels, policy scopes, and dashboard defaults." variant="settings" />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
