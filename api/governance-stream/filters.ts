import type { StoredGovernanceEvent, SubscriptionFilter, TEECReceipt } from './types';

export function matchesFilter(event: StoredGovernanceEvent, filter: SubscriptionFilter): boolean {
  if (filter.agents?.length && (!event.agentId || !filter.agents.includes(event.agentId))) {
    return false;
  }

  if (filter.decisions?.length && (!event.decision || !filter.decisions.includes(event.decision))) {
    return false;
  }

  if (filter.eventTypes?.length && !filter.eventTypes.includes(event.eventType)) {
    return false;
  }

  return true;
}

export function normalizeFilter(input: SubscriptionFilter): SubscriptionFilter {
  return {
    agents: uniqueNonEmpty(input.agents),
    decisions: uniqueNonEmpty(input.decisions?.map((decision) => decision.toUpperCase())),
    eventTypes: uniqueNonEmpty(input.eventTypes),
  };
}

export function parseFilterParams(searchParams: URLSearchParams): { filter: SubscriptionFilter; cursor?: string } {
  return {
    filter: normalizeFilter({
      agents: splitParam(searchParams.get('agent') ?? searchParams.get('agents')),
      decisions: splitParam(searchParams.get('decision') ?? searchParams.get('decisions')),
      eventTypes: splitParam(searchParams.get('event_type') ?? searchParams.get('event_types') ?? searchParams.get('type')),
    }),
    cursor: searchParams.get('cursor') ?? undefined,
  };
}

export function filterFromSubscribeMessage(message: {
  agent?: string;
  agents?: string[];
  decision?: string;
  decisions?: string[];
  event_type?: string;
  event_types?: string[];
  eventTypes?: string[];
}): SubscriptionFilter {
  return normalizeFilter({
    agents: arrayFrom(message.agents, message.agent),
    decisions: arrayFrom(message.decisions, message.decision),
    eventTypes: arrayFrom(message.eventTypes ?? message.event_types, message.event_type),
  });
}

export function readAgentId(receipt: TEECReceipt): string | null {
  return stringValue(receipt.agent_id)
    ?? stringValue(receipt.agentId)
    ?? stringValue((receipt.agent as { id?: unknown } | undefined)?.id);
}

export function readDecision(receipt: TEECReceipt): string | null {
  const value = stringValue(receipt.decision)
    ?? stringValue(receipt.action)
    ?? stringValue(receipt.decision_action);
  return value?.toUpperCase() ?? null;
}

export function readEventType(receipt: TEECReceipt): string {
  return stringValue(receipt.event_type)
    ?? stringValue(receipt.eventType)
    ?? 'governance_event';
}

function splitParam(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return uniqueNonEmpty(value.split(',').map((item) => item.trim()));
}

function arrayFrom(values?: string[], single?: string): string[] | undefined {
  return uniqueNonEmpty([...(values ?? []), ...(single ? [single] : [])]);
}

function uniqueNonEmpty(values?: Array<string | undefined>): string[] | undefined {
  const result = Array.from(new Set((values ?? []).filter((value): value is string => Boolean(value && value.trim()))));
  return result.length > 0 ? result : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

