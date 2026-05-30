import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ----------------------------------------------------------------------------
// WebSocket context and provider
// ----------------------------------------------------------------------------

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketContextValue {
  status: WebSocketStatus;
  lastMessage: unknown | null;
  send: (data: unknown) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  url?: string;
  children: ReactNode;
}

function WebSocketProvider({
  url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
  children,
}: WebSocketProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setLastMessage(parsed);
      } catch {
        setLastMessage(event.data);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setStatus('error');
      ws.close();
    };
  };

  const scheduleReconnect = () => {
    if (!reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const send = (data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  };

  const reconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  };

  return (
    <WebSocketContext.Provider value={{ status, lastMessage, send, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error('useWebSocket must be used within a <WebSocketProvider>');
  }
  return ctx;
}

// ----------------------------------------------------------------------------
// Query client setup
// ----------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

// ----------------------------------------------------------------------------
// Layout with header and sidebar (simplified, assumes shadcn/ui classes)
// ----------------------------------------------------------------------------

function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background text-text">
      {/* Sidebar placeholder – would be imported from components */}
      <aside className="w-64 border-r border-border bg-surface p-4 flex flex-col gap-4">
        <div className="text-lg font-semibold text-primary">TealTiger</div>
        <nav className="flex flex-col gap-2">
          <a href="/" className="text-sm hover:text-primary transition-colors">Dashboard</a>
          <a href="/events" className="text-sm hover:text-primary transition-colors">Events</a>
          <a href="/costs" className="text-sm hover:text-primary transition-colors">Cost Analytics</a>
          <a href="/security" className="text-sm hover:text-primary transition-colors">Security & Compliance</a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Placeholder pages (would be lazy-loaded via React.lazy in production)
// ----------------------------------------------------------------------------

function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Governance Overview</h1>
      {/* Metrics cards and event feed would be rendered here */}
    </div>
  );
}

function EventsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Event Stream</h1>
      {/* Real-time event feed */}
    </div>
  );
}

function CostAnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Cost Analytics</h1>
      {/* Charts and cost breakdown */}
    </div>
  );
}

function SecurityPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Security & Compliance</h1>
      {/* Security alerts and compliance status */}
    </div>
  );
}

// ----------------------------------------------------------------------------
// App root
// ----------------------------------------------------------------------------

export default function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<DashboardLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="costs" element={<CostAnalyticsPage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="*" element={<div className="text-text-secondary">404 – Page not found</div>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WebSocketProvider>
        {/* Enable React Query devtools only in development */}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </React.StrictMode>
  );
}