export interface TEECReceipt extends Record<string, unknown> {
  correlation_id?: string;
  correlationId?: string;
  receipt_id?: string;
  agent_id?: string;
  agentId?: string;
  action?: string;
  decision?: string;
  decision_action?: string;
  event_type?: string;
  eventType?: string;
  timestamp?: string | number;
}

export interface NormalizedGovernanceEvent {
  correlationId: string;
  timestamp: string;
  agentId: string | null;
  decision: string;
  eventType: string;
  receipt: TEECReceipt;
}

export interface BatchWriteResult {
  inserted: number;
  duplicates: number;
}

export interface GovernanceEventWriter {
  initialize?(): Promise<void>;
  writeBatch(events: NormalizedGovernanceEvent[]): Promise<BatchWriteResult>;
  close?(): Promise<void>;
}

export interface WriteAheadLog {
  initialize?(): Promise<void>;
  append(event: NormalizedGovernanceEvent): Promise<void>;
  remove(correlationIds: string[]): Promise<void>;
  recover(): Promise<NormalizedGovernanceEvent[]>;
  close?(): Promise<void>;
}

export interface IngestionWarning {
  code: 'invalid_event' | 'buffer_overflow' | 'wal_error' | 'writer_error';
  message: string;
  correlationId?: string;
  error?: unknown;
}

export interface IngestionMetrics {
  accepted: number;
  invalid: number;
  queued: number;
  written: number;
  duplicates: number;
  dropped: number;
  batches: number;
  writer_errors: number;
  wal_errors: number;
  buffer_size: number;
  last_flush_duration_ms: number | null;
}

export interface IngestionResult {
  accepted: boolean;
  correlationId?: string;
  reason?: string;
  latencyMs: number;
}

export interface GovernanceIngestionPipelineOptions {
  writer: GovernanceEventWriter;
  wal?: WriteAheadLog;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
  onWarning?: (warning: IngestionWarning) => void;
  broadcast?: (event: NormalizedGovernanceEvent) => void;
}

