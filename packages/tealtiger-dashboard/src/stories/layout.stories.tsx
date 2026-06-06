import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppShell, BreadcrumbTrail, DashboardHeader, SidebarNavigation, ThemeToggle } from '../dashboard/AppShell';
import { OverviewPage, PlaceholderPage } from '../dashboard/pages';

const meta = {
  title: 'Dashboard/Layout',
  parameters: {
    docs: {
      description: {
        component: 'Core dashboard shell components for navigation, header, breadcrumbs, theme switching, and responsive content.',
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Shell: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/']}>
      <AppShell theme="dark" onThemeToggle={() => undefined}>
        <OverviewPage />
      </AppShell>
    </MemoryRouter>
  ),
};

export const Sidebar: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/events']}>
      <div className="min-h-screen bg-background text-foreground">
        <SidebarNavigation className="flex min-h-screen" />
      </div>
    </MemoryRouter>
  ),
};

export const Header: Story = {
  render: () => (
    <div className="min-h-[160px] bg-background text-foreground">
      <DashboardHeader theme="dark" onThemeToggle={() => undefined} onOpenNavigation={() => undefined} />
    </div>
  ),
};

export const Breadcrumbs: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/compliance']}>
      <div className="bg-background p-6 text-foreground">
        <BreadcrumbTrail />
      </div>
    </MemoryRouter>
  ),
};

export const ThemeControl: Story = {
  render: () => (
    <div className="flex min-h-[120px] items-center gap-4 bg-background p-6 text-foreground">
      <ThemeToggle theme="dark" onToggle={() => undefined} />
      <ThemeToggle theme="light" onToggle={() => undefined} />
    </div>
  ),
};

export const PlaceholderRoute: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/agents']}>
      <AppShell theme="dark" onThemeToggle={() => undefined}>
        <Routes>
          <Route
            path="/agents"
            element={<PlaceholderPage title="Agents" description="Story fixture for section placeholder layout." variant="agents" />}
          />
        </Routes>
      </AppShell>
    </MemoryRouter>
  ),
};
