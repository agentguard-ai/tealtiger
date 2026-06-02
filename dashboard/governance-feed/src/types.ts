export type Decision = 'ALLOW' | 'DENY' | 'REVISE' | 'REQUIRE_APPROVAL';

export interface StreamMessage {
  type: 'connection_ack' | 'governance_event' | 'heartbeat' | 'replay_complete' | 'subscription_updated';
  id?: string;
  cursor?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface FeedEvent {
  id: string;
  cursor: string;
  timestamp: string;
  agent: string;
  tool: string;
  decision: Decision;
  reason: string;
  latencyMs: number;
  receipt: Record<string, unknown>;
}

export interface EventFilters {
  agent: string;
  decision: string;
  tool: string;
  from: string;
  to: string;
  search: string;
}

export interface StreamState {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  lastMessageAt: number | null;
  reconnectAttempt: number;
}
