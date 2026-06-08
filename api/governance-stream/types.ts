export interface TEECReceipt extends Record<string, unknown> {
  agent_id?: string;
  agentId?: string;
  action?: string;
  decision?: string;
  decision_action?: string;
  event_type?: string;
  eventType?: string;
  timestamp?: string | number;
}

export interface GovernanceEventMessage {
  type: 'governance_event';
  id: string;
  cursor: string;
  timestamp: string;
  data: TEECReceipt;
}

export interface StreamControlMessage {
  type: 'connection_ack' | 'subscription_updated' | 'replay_complete' | 'heartbeat';
  timestamp: string;
  data: Record<string, unknown>;
}

export type StreamMessage = GovernanceEventMessage | StreamControlMessage;

export interface SubscriptionFilter {
  agents?: string[];
  decisions?: string[];
  eventTypes?: string[];
}

export interface SubscribeMessage {
  type: 'subscribe';
  agent?: string;
  agents?: string[];
  decision?: string;
  decisions?: string[];
  event_type?: string;
  event_types?: string[];
  eventTypes?: string[];
  cursor?: string;
}

export interface StoredGovernanceEvent {
  sequence: number;
  message: GovernanceEventMessage;
  agentId: string | null;
  decision: string | null;
  eventType: string;
}

export interface PublishOptions {
  id?: string;
  timestamp?: string | number | Date;
  eventType?: string;
}

export interface StreamMetrics {
  published: number;
  retained: number;
  subscribers: number;
  dropped_for_backpressure: number;
}

