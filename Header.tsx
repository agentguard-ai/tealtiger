import React, { useEffect, useState } from 'react';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface HeaderProps {
  title?: string;
  /** Override connection status for testing. Default: auto-detect via navigator.onLine */
  connected?: boolean;
  /** Called when the user avatar area is clicked */
  onAvatarClick?: () => void;
  /** Show/hide connection indicator */
  showConnectionIndicator?: boolean;
}

// ------------------------------------------------------------------
// Constants – design tokens from TealTiger design system
// ------------------------------------------------------------------
const TEAL_TIGER_COLORS = {
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

const TEAL_TIGER_FONT = "'Inter', system-ui, -apple-system, sans-serif";

// ------------------------------------------------------------------
// Connection indicator dot component
// ------------------------------------------------------------------
interface ConnectionDotProps {
  connected: boolean;
}

const ConnectionDot: React.FC<ConnectionDotProps> = ({ connected }) => (
  <div className="relative flex items-center">
    <span
      className={`absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-75 ${
        connected ? 'bg-green-400' : 'bg-red-400'
      }`}
    />
    <span
      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
        connected ? 'bg-green-500' : 'bg-red-500'
      }`}
    />
    <span className="ml-1.5 text-xs font-medium opacity-70">
      {connected ? 'Connected' : 'Offline'}
    </span>
  </div>
);

// ------------------------------------------------------------------
// Avatar placeholder
// ------------------------------------------------------------------
interface AvatarPlaceholderProps {
  initials: string;
  onClick?: () => void;
}

const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({
  initials,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold shadow-sm transition duration-150 ease-in-out hover:opacity-80 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    aria-label="User avatar"
    style={{
      backgroundColor: TEAL_TIGER_COLORS.primary,
      fontFamily: TEAL_TIGER_FONT,
    }}
  >
    {initials}
  </button>
);

// ------------------------------------------------------------------
// Header component
// ------------------------------------------------------------------
const Header: React.FC<HeaderProps> = ({
  title = 'TealTiger Dashboard',
  connected,
  onAvatarClick,
  showConnectionIndicator = true,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    connected ?? navigator.onLine,
  );

  // If no explicit connected prop, monitor navigator.onLine
  useEffect(() => {
    if (connected !== undefined) {
      setIsOnline(connected);
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connected]);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b shadow-sm"
      style={{
        backgroundColor: TEAL_TIGER_COLORS.surface,
        borderColor: `${TEAL_TIGER_COLORS.textSecondary}15`,
        fontFamily: TEAL_TIGER_FONT,
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: App title */}
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-white font-bold text-xs"
            style={{ backgroundColor: TEAL_TIGER_COLORS.primary }}
          >
            TT
          </span>
          <h1
            className="text-base font-semibold leading-6 tracking-tight"
            style={{ color: TEAL_TIGER_COLORS.text }}
          >
            {title}
          </h1>
        </div>

        {/* Right: Connection indicator + Avatar */}
        <div className="flex items-center gap-4">
          {showConnectionIndicator && (
            <ConnectionDot connected={isOnline} />
          )}
          <AvatarPlaceholder
            initials="TU"
            onClick={onAvatarClick}
          />
        </div>
      </div>
    </header>
  );
};

Header.displayName = 'Header';

export default Header;