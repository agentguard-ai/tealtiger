import React from 'react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  sparklineData?: number[];
  className?: string;
  formatter?: (value: number) => string;
}

const TrendArrow: React.FC<{ direction: 'up' | 'down' | 'neutral' }> = ({ direction }) => {
  const color =
    direction === 'up'
      ? 'text-success'
      : direction === 'down'
        ? 'text-danger'
        : 'text-text-secondary';

  const path =
    direction === 'neutral'
      ? 'M4 12 L8 12 L12 12'
      : direction === 'up'
        ? 'M4 16 L8 8 L12 16'
        : 'M4 8 L8 16 L12 8';

  return (
    <svg
      className={`inline-block w-4 h-4 ml-1 ${color}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={path} />
    </svg>
  );
};

const Sparkline: React.FC<{ data: number[]; color?: string }> = ({
  data,
  color = 'var(--primary, #0f766e)',
}) => {
  if (!data || data.length < 2) return null;

  const width = 80;
  const height = 28;
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className="inline-block ml-2 align-middle"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
      {/* subtle gradient fill */}
      <defs>
        <linearGradient id={`spark-fill-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#spark-fill-${label})`}
        points={`${padding},${height - padding} ${points.join(' ')} ${padding + chartWidth},${height - padding}`}
      />
    </svg>
  );
};

const MetricsCard: React.FC<MetricsCardProps> = ({
  label,
  value,
  trend,
  trendLabel,
  sparklineData,
  className = '',
  formatter,
}) => {
  const displayValue =
    formatter && typeof value === 'number' ? formatter(value) : value;

  return (
    <div
      className={`
        relative bg-surface rounded-lg border border-gray-100 shadow-sm
        px-4 py-3 flex flex-col gap-1
        hover:shadow-md transition-shadow duration-150
        ${className}
      `}
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* Label */}
      <span
        className="text-xs font-medium text-text-secondary uppercase tracking-wider"
      >
        {label}
      </span>

      {/* Value row */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-text">
          {displayValue}
        </span>

        {/* Trend arrow */}
        {trend && <TrendArrow direction={trend} />}

        {/* Optional trend label */}
        {trendLabel && (
          <span
            className={`text-xs ml-1 ${
              trend === 'up'
                ? 'text-success'
                : trend === 'down'
                  ? 'text-danger'
                  : 'text-text-secondary'
            }`}
          >
            {trendLabel}
          </span>
        )}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-1 -mb-1">
          <Sparkline data={sparklineData} />
        </div>
      )}
    </div>
  );
};

export default MetricsCard;