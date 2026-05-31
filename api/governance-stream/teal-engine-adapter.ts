import type { GovernanceEventStream } from './event-stream';
import type { TEECReceipt } from './types';

type EngineLike = Record<string, unknown>;
type EngineMethod = (...args: unknown[]) => unknown;

export interface TealEngineStreamOptions {
  methods?: string[];
}

export function attachTealEngineStreaming(
  engine: EngineLike,
  stream: GovernanceEventStream,
  options: TealEngineStreamOptions = {},
): () => void {
  const methods = options.methods ?? ['evaluateV12', 'evaluateWithMode', 'evaluate'];
  const originals = new Map<string, EngineMethod>();

  for (const method of methods) {
    const current = engine[method];
    if (typeof current !== 'function') {
      continue;
    }

    const original = current as EngineMethod;
    originals.set(method, original);
    engine[method] = function streamedEvaluation(this: EngineLike, ...args: unknown[]): unknown {
      const result = original.apply(this, args);
      if (isPromiseLike(result)) {
        return result.then((decision) => {
          publishDecision(stream, decision, args[0]);
          return decision;
        });
      }
      publishDecision(stream, result, args[0]);
      return result;
    };
  }

  return () => {
    for (const [method, original] of originals) {
      engine[method] = original;
    }
  };
}

export function publishDecision(
  stream: GovernanceEventStream,
  decision: unknown,
  context?: unknown,
): void {
  const receipt = normalizeDecision(decision, context);
  stream.publish(receipt);
}

export function normalizeDecision(decision: unknown, context?: unknown): TEECReceipt {
  const decisionRecord = objectRecord(decision);
  const contextRecord = objectRecord(context);
  const metadata = objectRecord(decisionRecord.metadata);
  const nhiContext = objectRecord(decisionRecord.nhi_context);

  return {
    ...decisionRecord,
    event_type: 'governance_event',
    agent_id: stringValue(decisionRecord.agent_id)
      ?? stringValue(decisionRecord.agentId)
      ?? stringValue(nhiContext.agent_id)
      ?? stringValue(contextRecord.agentId)
      ?? stringValue(contextRecord.agent_id),
    decision: stringValue(decisionRecord.decision)
      ?? stringValue(decisionRecord.action)
      ?? stringValue(decisionRecord.decision_action),
    timestamp: stringValue(decisionRecord.timestamp) ?? new Date().toISOString(),
    reason: stringValue(decisionRecord.reason),
    reason_codes: decisionRecord.reason_codes,
    risk_score: decisionRecord.risk_score,
    policy_version: decisionRecord.policy_version,
    correlation_id: decisionRecord.correlation_id,
    metadata,
  };
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof (value as Promise<unknown>).then === 'function');
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

