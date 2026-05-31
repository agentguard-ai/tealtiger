import { randomUUID } from 'node:crypto';

import type { NormalizedGovernanceEvent, TEECReceipt } from './types';

let generatedCorrelationSequence = 0;

export function normalizeGovernanceEvent(
  receipt: TEECReceipt,
  context: Record<string, unknown> = {},
): NormalizedGovernanceEvent {
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('TEEC receipt must be an object');
  }

  const decision = readDecision(receipt);
  if (!decision) {
    throw new Error('TEEC receipt must include a decision/action');
  }

  const correlationId = readString(receipt.correlation_id)
    ?? readString(receipt.correlationId)
    ?? readString(receipt.receipt_id)
    ?? readString(receipt.id)
    ?? readString(context.correlation_id)
    ?? readString(context.correlationId)
    ?? generatedCorrelationId();

  return {
    correlationId,
    timestamp: normalizeTimestamp(receipt.timestamp ?? Date.now()),
    agentId: readString(receipt.agent_id)
      ?? readString(receipt.agentId)
      ?? readString(context.agent_id)
      ?? readString(context.agentId)
      ?? null,
    decision,
    eventType: readString(receipt.event_type) ?? readString(receipt.eventType) ?? 'governance_event',
    receipt,
  };
}

export function decisionFromEvaluationResult(
  decision: unknown,
  context: unknown,
): TEECReceipt {
  const decisionRecord = toRecord(decision);
  const contextRecord = toRecord(context);
  const metadata = toRecord(decisionRecord.metadata);
  return {
    ...decisionRecord,
    correlation_id: readString(decisionRecord.correlation_id)
      ?? readString(decisionRecord.correlationId)
      ?? readString(contextRecord.correlation_id)
      ?? readString(contextRecord.correlationId),
    agent_id: readString(decisionRecord.agent_id)
      ?? readString(decisionRecord.agentId)
      ?? readString(contextRecord.agent_id)
      ?? readString(contextRecord.agentId),
    decision: readString(decisionRecord.decision)
      ?? readString(decisionRecord.action)
      ?? (typeof decisionRecord.allowed === 'boolean' ? decisionRecord.allowed ? 'ALLOW' : 'DENY' : undefined),
    event_type: readString(decisionRecord.event_type) ?? 'governance_event',
    timestamp: timestampValue(decisionRecord.timestamp),
    reason: decisionRecord.reason,
    reason_codes: decisionRecord.reason_codes,
    risk_score: decisionRecord.risk_score,
    policy_version: decisionRecord.policy_version,
    metadata,
  };
}

function readDecision(receipt: TEECReceipt): string | null {
  const value = readString(receipt.decision)
    ?? readString(receipt.action)
    ?? readString(receipt.decision_action);
  return value?.toUpperCase() ?? null;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function timestampValue(value: unknown): string | number {
  return typeof value === 'string' || typeof value === 'number' ? value : Date.now();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function generatedCorrelationId(): string {
  generatedCorrelationSequence++;
  return `generated_${Date.now()}_${generatedCorrelationSequence}_${randomUUID()}`;
}
