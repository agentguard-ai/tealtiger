/**
 * Shared TypeScript types for the TealTiger Governance Dashboard.
 *
 * This module exports all API response types, WebSocket message types,
 * filter interfaces, and panel props used by both the DashboardAPI (Fastify)
 * and the Dashboard frontend (Next.js).
 */

// ─── Time Range ──────────────────────────────────────────────────────────────

export interface TimeRange {
  start: number; // unix timestamp ms
  end: number;   // unix timestamp ms
  preset?: 'last_1h' | 'last_24h' | 'last_7d' | 'custom';
}

// ─── Decision Filters ────────────────────────────────────────────────────────

export interface DecisionFilters {
  action?: 'allowed' | 'blocked';
  blockedStage?: 'PRE_EXECUTION' | 'POST_EXECUTION' | null;
  correlationId?: string;
  dateRange?: { start: Date; end: Date };
  page: number;
  pageSize: 25 | 50 | 100;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Auth Config ─────────────────────────────────────────────────────────────

export interface AuthConfig {
  mode: 'none' | 'api-key' | 'oauth2';
  apiKeyHeader?: string;
  oauth2?: {
    issuer: string;
    clientId: string;
    scopes: string[];
  };
}

// ─── WebSocket Messages ──────────────────────────────────────────────────────

export interface SubscribeMessage {
  type: 'subscribe';
  channels: ('pipeline' | 'cost' | 'freeze' | 'alerts' | 'modules')[];
  filters?: {
    agentId?: string;
    timeRange?: { start: number; end: number };
  };
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  channels: string[];
}

export type StreamEventType =
  | 'pipeline_result'
  | 'cost_update'
  | 'freeze_change'
  | 'alert_triggered'
  | 'module_state'
  | 'state_sync';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  payload:
    | PipelineResultEvent
    | CostUpdateEvent
    | FreezeChangeEvent
    | AlertEvent
    | ModuleStateEvent
    | StateSyncPayload;
}


// ─── API Response Types ──────────────────────────────────────────────────────

export interface PipelineStatusResponse {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  failurePolicy: 'fail-closed' | 'fail-open';
  modules: {
    preExecution: ModuleStatusEntry[];
    postExecution: ModuleStatusEntry[];
  };
  recentDecisions: PipelineDecisionSummary[];
}

export interface ModuleStatusEntry {
  name: string;
  version: string;
  status: 'healthy' | 'degraded' | 'critical';
  timeoutCount: number;
  errorRate: number;
  timeoutRate: number;
}

export interface PipelineDecisionSummary {
  correlationId: string;
  timestamp: number;
  allowed: boolean;
  preLatencyMs: number;
  executionLatencyMs: number | null;
  postLatencyMs: number | null;
  totalLatencyMs: number;
}

export interface DecisionListResponse {
  results: PipelineDecisionRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    allowedCount: number;
    blockedCount: number;
    allowedPercent: number;
    blockedPercent: number;
  };
}

export interface PipelineDecisionRow {
  id: string;
  correlationId: string;
  agentId: string;
  timestamp: number;
  allowed: boolean;
  blockedStage: string | null;
  totalLatencyMs: number;
  preLatencyMs: number;
  executionLatencyMs: number | null;
  postLatencyMs: number | null;
  resampleCount: number;
  remediationAction: string | null;
  redacted: boolean;
  remediationExhausted: boolean;
  providerError: boolean;
}

export interface ModuleHealthResponse {
  modules: ModuleHealthEntry[];
}

export interface ModuleHealthEntry {
  name: string;
  version: string;
  evaluationCount: number;
  latency: { p50: number; p95: number; p99: number };
  errorRate: number;
  timeoutRate: number;
  actionDistribution: { ALLOW: number; DENY: number; MONITOR: number };
  trend: {
    latency: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
  };
  nearTimeout: boolean;
}

export interface CostSummaryResponse {
  session: { total: number; budget: number | null; utilization: number | null };
  daily: { total: number; budget: number | null; utilization: number | null };
  agent: { total: number; budget: number | null; utilization: number | null };
  reconciliationAlerts: ReconciliationAlert[];
}

export interface ReconciliationAlert {
  correlationId: string;
  estimatedCost: number;
  actualCost: number;
  tolerance: number;
  timestamp: number;
}

export interface FreezeStateResponse {
  wildcardActive: boolean;
  frozenAgents: string[];
}

export interface ChainVerificationResponse {
  valid: boolean;
  decisions: ChainDecisionView[];
  breakIndex?: number;
  expectedReceiptRef?: string;
  actualReceiptRef?: string;
}

export interface ChainDecisionView {
  index: number;
  stage: string;
  action: string;
  seq: number;
  intentRef: string;
  receiptRef: string;
  sealValid: boolean;
  governanceSeal?: { hmac: string; timestamp: number; agentId: string };
}


// ─── Event Payload Types ─────────────────────────────────────────────────────

export interface PipelineResultEvent {
  correlationId: string;
  agentId: string;
  allowed: boolean;
  blockedStage: string | null;
  totalLatencyMs: number;
  timestamp: number;
}

export interface CostUpdateEvent {
  correlationId: string;
  agentId: string;
  amount: number;
  runningTotal: number;
  provider: string;
  model: string;
  timestamp: number;
}

export interface FreezeChangeEvent {
  action: 'freeze' | 'unfreeze';
  targetAgentId: string;
  actor: string;
  timestamp: number;
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: number;
}

export interface ModuleStateEvent {
  moduleName: string;
  status: 'healthy' | 'degraded' | 'critical';
  errorRate: number;
  timeoutRate: number;
  timestamp: number;
}

export interface StateSyncPayload {
  pipelineStatus: PipelineStatusResponse;
  freezeState: FreezeStateResponse;
  triggeredAlerts: AlertEvent[];
  lastTimestamp: number;
}

// ─── Panel Props ─────────────────────────────────────────────────────────────

export interface PipelineStatusProps {
  timeRange: TimeRange;
}

export interface DecisionExplorerProps {
  timeRange: TimeRange;
  initialFilters?: DecisionFilters;
}

export interface CostTrackerProps {
  timeRange: TimeRange;
}

export interface KillSwitchProps {
  onFreezeConfirm: (agentId: string) => Promise<void>;
  onUnfreezeConfirm: (agentId: string) => Promise<void>;
}


// ─── Cost Breakdown ──────────────────────────────────────────────────────────

export interface CostBreakdownResponse {
  breakdown: CostBreakdownEntry[];
}

export interface CostBreakdownEntry {
  provider: string;
  model: string;
  totalCost: number;
  requestCount: number;
}

// ─── Cost Sparkline ──────────────────────────────────────────────────────────

export interface CostSparklineResponse {
  dataPoints: { timestamp: number; cost: number }[];
  resolution: 'minute' | 'hour';
}

// ─── Audit Types ─────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  timestamp: number;
  eventType: string;
  correlationId: string;
  agentId: string;
  description: string;
  metadata: Record<string, unknown>;
  chainStatus?: 'intact' | 'broken' | 'not-applicable';
}

export interface AuditEventListResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Alert Configuration Types ───────────────────────────────────────────────

export interface AlertConfiguration {
  id: string;
  name: string;
  ruleType: 'budget' | 'error_rate' | 'timeout_rate' | 'remediation_exhaustion' | 'contiguity_break';
  threshold: number;
  windowSeconds: number;
  enabled: boolean;
  configJson: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  timestamp: number;
  currentValue: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: boolean;
  metadata: Record<string, unknown>;
}

// ─── Freeze Audit Log ────────────────────────────────────────────────────────

export interface FreezeAuditEntry {
  id: string;
  timestamp: number;
  actor: string;
  targetAgentId: string;
  actionType: 'freeze' | 'unfreeze';
}
