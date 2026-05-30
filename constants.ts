// /src/utils/constants.ts
// TealTiger Observability Dashboard Constants

export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum EventType {
  GOVERNANCE = 'governance',
  COST = 'cost',
  TOOL_USAGE = 'tool_usage',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export const API_ENDPOINTS = {
  events: `${API_BASE_URL}/events`,
  analytics: `${API_BASE_URL}/analytics`,
  compliance: `${API_BASE_URL}/compliance`,
  cost: `${API_BASE_URL}/cost`,
  security: `${API_BASE_URL}/security`,
  agents: `${API_BASE_URL}/agents`,
  health: `${API_BASE_URL}/health`,
} as const;

export const COLORS = {
  primary: '#0f766e',
  secondary: '#6366f1',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
} as const;

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  [SeverityLevel.INFO]: COLORS.primary,
  [SeverityLevel.WARNING]: COLORS.warning,
  [SeverityLevel.ERROR]: COLORS.danger,
  [SeverityLevel.CRITICAL]: '#7f1d1d',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  [EventType.GOVERNANCE]: COLORS.primary,
  [EventType.COST]: COLORS.accent,
  [EventType.TOOL_USAGE]: COLORS.secondary,
  [EventType.SECURITY]: COLORS.danger,
  [EventType.COMPLIANCE]: COLORS.success,
};

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const SPACING = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64] as const;

export const TYPOGRAPHY = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  headingWeight: 600,
  bodyWeight: 400,
  scale: 1.25,
} as const;

export const TIME_RANGES = {
  last5Minutes: '5m',
  last15Minutes: '15m',
  last1Hour: '1h',
  last6Hours: '6h',
  last24Hours: '24h',
  last7Days: '7d',
  last30Days: '30d',
} as const;

export type TimeRange = (typeof TIME_RANGES)[keyof typeof TIME_RANGES];

export const DEFAULT_TIME_RANGE: TimeRange = TIME_RANGES.last24Hours;

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;