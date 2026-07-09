import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // TealTiger brand colors
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Sidebar colors (from CSS custom properties)
        sidebar: {
          bg: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
        },
        // KPI trend colors
        kpi: {
          'trend-up': 'var(--kpi-trend-up)',
          'trend-down': 'var(--kpi-trend-down)',
        },
      },
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
      },
      minWidth: {
        dashboard: '1280px',
      },
      maxWidth: {
        dashboard: '2560px',
      },
      borderRadius: {
        panel: 'var(--panel-border-radius)',
      },
      padding: {
        panel: 'var(--panel-padding)',
        content: 'var(--content-padding)',
      },
      gap: {
        row: 'var(--row-gap)',
      },
      spacing: {
        'sidebar-width': 'var(--sidebar-width)',
        'sidebar-collapsed-width': 'var(--sidebar-collapsed-width)',
        'row-gap': 'var(--row-gap)',
        'content-padding': 'var(--content-padding)',
        'panel-padding': 'var(--panel-padding)',
      },
      borderOpacity: {
        panel: 'var(--panel-border-opacity)',
      },
    },
  },
  plugins: [],
};

export default config;
