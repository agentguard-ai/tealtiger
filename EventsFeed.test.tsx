import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventsFeed } from '@/pages/EventsFeed';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import ws from 'jest-websocket-mock';

// -----------------------------------------------------------------------------
// 1. MSW server for REST API mocking
// -----------------------------------------------------------------------------
const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    const search = req.url.searchParams.get('search') || '';
    const type = req.url.searchParams.get('type') || '';
    const from = req.url.searchParams.get('from');
    const to = req.url.searchParams.get('to');

    // Return filtered mock events
    const allEvents = [
      {
        id: 'evt-001',
        type: 'governance',
        severity: 'info',
        title: 'Approval granted for tool execution',
        description: 'Agent "data-pipeline" was allowed to run SQL query.',
        timestamp: '2026-05-30T10:00:00Z',
        metadata: { agentId: 'agent-001', cost: 0.002 },
      },
      {
        id: 'evt-002',
        type: 'security',
        severity: 'warning',
        title: 'Suspicious token usage detected',
        description: 'High-frequency API calls from unknown IP.',
        timestamp: '2026-05-30T10:05:00Z',
        metadata: { agentId: 'agent-002', cost: 0 },
      },
      {
        id: 'evt-003',
        type: 'cost',
        severity: 'info',
        title: 'Budget threshold crossed',
        description: 'Daily spend exceeded $50.',
        timestamp: '2026-05-30T10:10:00Z',
        metadata: { agentId: 'agent-003', cost: 51.2 },
      },
    ];

    let filtered = allEvents;
    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.description.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (type) {
      filtered = filtered.filter((e) => e.type === type);
    }
    if (from) {
      filtered = filtered.filter((e) => new Date(e.timestamp) >= new Date(from));
    }
    if (to) {
      filtered = filtered.filter((e) => new Date(e.timestamp) <= new Date(to));
    }

    return res(ctx.json({ events: filtered, total: filtered.length }));
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// -----------------------------------------------------------------------------
// 2. Mock WebSocket server for real-time events
// -----------------------------------------------------------------------------
const WS_URL = 'ws://localhost:8080/events';
let mockWsServer: ws;

beforeEach(() => {
  mockWsServer = new ws(WS_URL, { jsonProtocol: true });
});

afterEach(() => {
  ws.clean();
});

// -----------------------------------------------------------------------------
// 3. Helper to render the component with necessary providers
// -----------------------------------------------------------------------------
function renderEventsFeed() {
  return render(
    <EventsFeed
      wsUrl={WS_URL}
      apiBaseUrl="http://localhost:3000"
    />,
  );
}

// -----------------------------------------------------------------------------
// 4. Tests
// -----------------------------------------------------------------------------
describe('EventsFeed – Integration', () => {
  test('shows loading indicator while fetching events', async () => {
    renderEventsFeed();

    // Wait briefly – by default MSW will respond instantly, but we can delay
    // We test that spinner appears before data
    expect(screen.getByTestId('events-feed-loading')).toBeInTheDocument();
  });

  test('renders empty state when no events exist', async () => {
    server.use(
      rest.get('/api/events', (_req, res, ctx) => {
        return res(ctx.json({ events: [], total: 0 }));
      }),
    );

    renderEventsFeed();

    await waitFor(() => {
      expect(screen.getByTestId('events-feed-empty')).toBeInTheDocument();
    });
  });

  test('displays a list of events', async () => {
    renderEventsFeed();

    await waitFor(() => {
      expect(screen.getByText('Approval granted for tool execution')).toBeInTheDocument();
      expect(screen.getByText('Suspicious token usage detected')).toBeInTheDocument();
      expect(screen.getByText('Budget threshold crossed')).toBeInTheDocument();
    });
  });

  test('adds real-time event from WebSocket', async () => {
    renderEventsFeed();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Approval granted for tool execution')).toBeInTheDocument();
    });

    // Send a new event via WebSocket
    const newEvent = {
      id: 'evt-004',
      type: 'governance',
      severity: 'info',
      title: 'New real-time event',
      description: 'This event came in via WS.',
      timestamp: new Date().toISOString(),
      metadata: {},
    };

    mockWsServer.send(newEvent);

    // The new event should appear in the feed
    await waitFor(() => {
      expect(screen.getByText('New real-time event')).toBeInTheDocument();
    });
  });

  test('filters events by type', async () => {
    const user = userEvent.setup();
    renderEventsFeed();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Approval granted for tool execution')).toBeInTheDocument();
    });

    // Open filter panel / select type
    const typeSelect = screen.getByTestId('filter-type');
    await user.selectOptions(typeSelect, 'security');

    // Only security events should remain
    await waitFor(() => {
      expect(screen.queryByText('Approval granted for tool execution')).not.toBeInTheDocument();
      expect(screen.getByText('Suspicious token usage detected')).toBeInTheDocument();
      expect(screen.queryByText('Budget threshold crossed')).not.toBeInTheDocument();
    });
  });

  test('filters events by search term', async () => {
    const user = userEvent.setup();
    renderEventsFeed();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Approval granted for tool execution')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'budget');

    await waitFor(() => {
      expect(screen.queryByText('Approval granted for tool execution')).not.toBeInTheDocument();
      expect(screen.queryByText('Suspicious token usage detected')).not.toBeInTheDocument();
      expect(screen.getByText('Budget threshold crossed')).toBeInTheDocument();
    });
  });

  test('shows error state on API failure', async () => {
    server.use(
      rest.get('/api/events', (_req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
      }),
    );

    renderEventsFeed();

    await waitFor(() => {
      expect(screen.getByTestId('events-feed-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
    });
  });

  test('clicking on event triggers callback', async () => {
    const handleEventClick = jest.fn();
    render(
      <EventsFeed
        wsUrl={WS_URL}
        apiBaseUrl="http://localhost:3000"
        onEventClick={handleEventClick}
      />,
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Approval granted for tool execution')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Approval granted for tool execution'));

    expect(handleEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-001' }),
    );
  });
});