/**
 * /src/utils/formatters.ts
 * TealTiger Observability Dashboard – Date, Number & Currency Formatting Utilities
 *
 * Production-grade helpers using the native `Intl` API.
 * All functions are locale-aware and accept optional override options.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Accepted value types for formatting operations */
type DateInput = Date | string | number;

/** Standard date/time style presets */
type DateStyle = 'full' | 'long' | 'medium' | 'short';

/** Options for `formatDate` */
interface DateFormatOptions {
  style?: DateStyle;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  locale?: string;
  /** Custom Intl options take precedence over `style` */
  intlOverrides?: Intl.DateTimeFormatOptions;
}

/** Options for `formatNumber` */
interface NumberFormatOptions {
  locale?: string;
  /** Number of decimal places (overrides Intl defaults) */
  decimals?: number;
  /** Use compact notation (e.g. 1.2K) */
  compact?: boolean;
  /** Include sign for positive values? */
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  intlOverrides?: Intl.NumberFormatOptions;
}

/** Supported currency codes (can extend as needed) */
type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';

/** Options for `formatCurrency` */
interface CurrencyFormatOptions {
  locale?: string;
  decimals?: number;
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  intlOverrides?: Intl.NumberFormatOptions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDate(value: DateInput): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`Invalid date input: ${value}`);
  }
  return d;
}

function mergeOptions<T extends Record<string, unknown>>(
  defaults: Required<Pick<T, keyof T>>,
  overrides?: Partial<T>
): Required<Pick<T, keyof T>> {
  if (!overrides) return defaults;
  const merged = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    if (overrides[key] !== undefined && overrides[key] !== null) {
      (merged as Record<string, unknown>)[key as string] = overrides[key];
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Date Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a date using the Intl.DateTimeFormat API.
 *
 * @example
 *   formatDate('2025-06-15')             // "Jun 15, 2025"
 *   formatDate(new Date(), { style: 'full' }) // "Monday, June 15, 2025"
 *   formatDate(Date.now(), { dateStyle: 'short', timeStyle: 'medium' })
 */
export function formatDate(
  value: DateInput,
  options: DateFormatOptions = {}
): string {
  const date = ensureDate(value);

  const defaults: DateFormatOptions = {
    locale: 'en-US',
    style: 'medium',
  };

  const { locale, style, dateStyle, timeStyle, intlOverrides } = mergeOptions(
    defaults,
    options
  );

  // Build base options from style presets
  let baseOptions: Intl.DateTimeFormatOptions = {};
  if (style) {
    const preset: Record<DateStyle, Intl.DateTimeFormatOptions> = {
      full: { dateStyle: 'full', timeStyle: 'long' },
      long: { dateStyle: 'long', timeStyle: 'short' },
      medium: { dateStyle: 'medium', timeStyle: 'short' },
      short: { dateStyle: 'short', timeStyle: 'short' },
    };
    baseOptions = preset[style];
  }
  if (dateStyle) baseOptions.dateStyle = dateStyle;
  if (timeStyle) baseOptions.timeStyle = timeStyle;

  const finalOptions = intlOverrides
    ? { ...baseOptions, ...intlOverrides }
    : baseOptions;

  return new Intl.DateTimeFormat(locale, finalOptions).format(date);
}

/**
 * Relative human-readable time (e.g. "2 hours ago", "in 3 days").
 * Falls back to `formatDate` if the difference is > 30 days.
 */
export function formatRelativeTime(
  value: DateInput,
  options: { locale?: string; numeric?: 'auto' | 'always' } = {}
): string {
  const date = ensureDate(value);
  const { locale = 'en-US', numeric = 'auto' } = options;
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric });

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, 'second');
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffSeconds / 3600);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffSeconds / 86400);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month');
  }
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, 'year');
}

// ---------------------------------------------------------------------------
// Number Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a numeric value (including large numbers) with locale-aware grouping.
 *
 * @example
 *   formatNumber(1234567.89)           // "1,234,567.89"
 *   formatNumber(12345, { compact: true }) // "12.3K"
 *   formatNumber(0.001, { decimals: 3 })   // "0.001"
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {}
): string {
  const defaults: NumberFormatOptions = {
    locale: 'en-US',
    compact: false,
    signDisplay: 'auto',
  };

  const { locale, decimals, compact, signDisplay, intlOverrides } =
    mergeOptions(defaults, options);

  const baseOptions: Intl.NumberFormatOptions = {
    signDisplay,
    ...(compact ? { notation: 'compact', compactDisplay: 'short' } : {}),
    ...(decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : {}),
  };

  const finalOptions = intlOverrides
    ? { ...baseOptions, ...intlOverrides }
    : baseOptions;

  if (finalOptions.minimumFractionDigits === undefined) {
    finalOptions.maximumFractionDigits = 2;
  }

  return new Intl.NumberFormat(locale, finalOptions).format(value);
}

/**
 * Shortcut for percentage formatting.
 *
 * @example
 *   formatPercent(0.1234)    // "12.34%"
 *   formatPercent(0.1234, { decimals: 1 }) // "12.3%"
 */
export function formatPercent(
  value: number,
  options: Omit<NumberFormatOptions, 'intlOverrides'> & {
    /** If true, input is already percentage (e.g. 12.34 → "12.34%") */
    alreadyPercent?: boolean;
  } = {}
): string {
  const num = options.alreadyPercent ? value / 100 : value;
  return formatNumber(num, {
    ...options,
    intlOverrides: { style: 'percent' },
  });
}

// ---------------------------------------------------------------------------
// Currency Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a numeric value as currency using Intl.NumberFormat.
 *
 * @example
 *   formatCurrency(1234.5, 'USD')       // "$1,234.50"
 *   formatCurrency(100, 'EUR', { locale: 'de-DE' }) // "100,00 €"
 */
export function formatCurrency(
  value: number,
  currency: CurrencyCode = 'USD',
  options: CurrencyFormatOptions = {}
): string {
  const defaults: CurrencyFormatOptions = {
    locale: 'en-US',
  };

  const { locale, decimals, signDisplay, intlOverrides } = mergeOptions(
    defaults,
    options
  );

  const baseOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    signDisplay: signDisplay ?? 'auto',
    ...(decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {}),
  };

  const finalOptions = intlOverrides
    ? { ...baseOptions, ...intlOverrides }
    : baseOptions;

  return new Intl.NumberFormat(locale, finalOptions).format(value);
}

// ---------------------------------------------------------------------------
// Convenience – compact formats for dashboards
// ---------------------------------------------------------------------------

/**
 * Like formatNumber but always compact (e.g. dashboard metric cards).
 */
export function formatCompact(value: number, options?: NumberFormatOptions): string {
  return formatNumber(value, { ...options, compact: true });
}

/**
 * Formats a duration in seconds to a human-readable string.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Default export (convenience object)
// ---------------------------------------------------------------------------

const formatters = {
  date: formatDate,
  relativeTime: formatRelativeTime,
  number: formatNumber,
  percent: formatPercent,
  currency: formatCurrency,
  compact: formatCompact,
  duration: formatDuration,
};

export default formatters;