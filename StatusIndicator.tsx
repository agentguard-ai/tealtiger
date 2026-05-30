// /src/components/ui/StatusIndicator.tsx
import React, { useMemo } from 'react';

interface StatusIndicatorProps {
  /** Current status of the agent */
  status: 'idle' | 'active' | 'busy' | 'warning' | 'error' | 'offline';
  /** Size of the indicator dot in pixels */
  size?: number;
  /** Whether to show a pulsing animation (overrides automatic for "active") */
  pulse?: boolean;
  /** Additional CSS classes (Tailwind or custom) */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

const defaultColorMap: Record<string, string> = {
  idle: '#94a3b8',     // slate-400
  active: '#10b981',   // emerald-500
  busy: '#0f766e',     // teal-700 (primary)
  warning: '#f59e0b',  // amber-500
  error: '#ef4444',    // red-500
  offline: '#64748b',  // slate-500
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 10,
  pulse,
  className = '',
  label = `${status} status`,
}) => {
  const color = defaultColorMap[status] || defaultColorMap.idle;
  const shouldPulse = pulse !== undefined ? pulse : status === 'active' || status === 'warning';

  const style = useMemo<React.CSSProperties>(() => ({
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: color,
    boxShadow: shouldPulse
      ? `0 0 0 0 ${color}`
      : 'none',
    animation: shouldPulse
      ? `status-pulse 1.5s ease-in-out infinite`
      : 'none',
    flexShrink: 0,
  }), [size, color, shouldPulse]);

  return (
    <>
      <style>{`
        @keyframes status-pulse {
          0%   { box-shadow: 0 0 0 0 ${color}; }
          50%  { box-shadow: 0 0 0 4px ${color}40; }
          100% { box-shadow: 0 0 0 0 ${color}; }
        }
      `}</style>
      <span
        role="status"
        aria-label={label}
        className={`status-indicator ${className}`.trim()}
        style={style}
      />
    </>
  );
};

export default StatusIndicator;