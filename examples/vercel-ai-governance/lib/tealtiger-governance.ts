import type { ModelMessage } from 'ai';
import { BudgetManager } from '../../../packages/tealtiger-sdk/src/cost/BudgetManager';
import { CostTracker } from '../../../packages/tealtiger-sdk/src/cost/CostTracker';
import { InMemoryCostStorage } from '../../../packages/tealtiger-sdk/src/cost/CostStorage';
import type { CostEstimate, CostRecord, TokenUsage } from '../../../packages/tealtiger-sdk/src/cost/types';
import { TealEngine } from '../../../packages/tealtiger-sdk/src/core/engine/TealEngine';
import type { PolicyEvaluationResult } from '../../../packages/tealtiger-sdk/src/core/engine/types';
import { PIIDetectionGuardrail } from '../../../packages/tealtiger-sdk/src/guardrails/pii-detection';
import type { GuardrailResult } from '../../../packages/tealtiger-sdk/src/guardrails/base';

type Operation = 'ai.generateText' | 'ai.streamText';

type EvaluateChatGovernanceInput = {
  userId: string;
  messages: ModelMessage[];
  model: string;
  operation: Operation;
  requestId: string;
};

export type ChatGovernanceDecision = {
  allowed: boolean;
  userId: string;
  model: string;
  operation: Operation;
  requestId: string;
  messages: ModelMessage[];
  reasons: string[];
  policy: PolicyEvaluationResult;
  pii: GuardrailResult;
  costEstimate: CostEstimate;
  budget: {
    allowed: boolean;
    remaining?: number;
    percentageUsed?: number;
    blockedBy?: string;
  };
};

type UsageLike = Partial<TokenUsage> & {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
};

const DEFAULT_DAILY_BUDGET_USD = readNumber('TEALTIGER_USER_DAILY_BUDGET_USD', 1);
const INPUT_COST_PER_1K = readNumber('TEALTIGER_INPUT_COST_PER_1K', 0.00125);
const OUTPUT_COST_PER_1K = readNumber('TEALTIGER_OUTPUT_COST_PER_1K', 0.01);
const ESTIMATED_OUTPUT_TOKENS = readNumber('TEALTIGER_ESTIMATED_OUTPUT_TOKENS', 500);
const PII_ACTION = process.env.TEALTIGER_PII_ACTION === 'redact' ? 'redact' : 'block';

const costStorage = new InMemoryCostStorage();
const budgetManager = new BudgetManager(costStorage);
const costTracker = new CostTracker({
  enabled: true,
  persistRecords: true,
  enableBudgets: true,
  enableAlerts: true,
});
const piiGuardrail = new PIIDetectionGuardrail({
  name: 'vercel-ai-pii',
  enabled: true,
  action: PII_ACTION,
  detectTypes: ['email', 'phone', 'ssn', 'creditCard'],
});
const userBudgets = new Set<string>();
const pricedModels = new Set<string>();

export async function evaluateChatGovernance(
  input: EvaluateChatGovernanceInput,
): Promise<ChatGovernanceDecision> {
  ensureModelPricing(input.model);
  ensureUserBudget(input.userId);

  const latestUserText = getLatestUserText(input.messages);
  const pii = await piiGuardrail.evaluate(latestUserText, {
    userId: input.userId,
    requestId: input.requestId,
  });
  const messages = buildGovernedMessages(input.messages, pii);
  const estimatedTokens = estimateTokens(messages);
  const costEstimate = costTracker.estimateCost(input.model, estimatedTokens, 'custom');
  const engine = createEngine(input.userId);
  const policy = engine.evaluate({
    agentId: input.userId,
    action: 'chat.completion',
    tool: input.operation,
    content: latestUserText,
    cost: costEstimate.estimatedCost,
    metadata: {
      model: input.model,
      requestId: input.requestId,
      piiAction: pii.action,
      piiRiskScore: pii.riskScore,
    },
  });
  const budget = await budgetManager.checkBudget(input.userId, costEstimate.estimatedCost);
  const status = budget.blockedBy
    ? budget.status
    : await getUserBudgetStatus(input.userId);
  const reasons = collectReasons(policy, pii, budget);

  return {
    allowed: reasons.length === 0,
    userId: input.userId,
    model: input.model,
    operation: input.operation,
    requestId: input.requestId,
    messages,
    reasons: reasons.length > 0 ? reasons : ['Policy compliant'],
    policy,
    pii,
    costEstimate,
    budget: {
      allowed: budget.allowed,
      remaining: status?.remaining,
      percentageUsed: status?.percentageUsed,
      blockedBy: budget.blockedBy?.name,
    },
  };
}

export async function recordModelUsage(input: {
  userId: string;
  model: string;
  requestId: string;
  operation: Operation;
  usage: UsageLike;
}): Promise<CostRecord> {
  ensureModelPricing(input.model);

  const tokens = normalizeUsage(input.usage);
  const record = costTracker.calculateActualCost(
    input.requestId,
    input.userId,
    input.model,
    tokens,
    'custom',
    {
      operation: input.operation,
      provider: 'vercel-ai-sdk',
    },
  );

  await costStorage.store(record);
  await budgetManager.recordCost(record);
  return record;
}

export function createGovernanceHeaders(decision: ChatGovernanceDecision): Headers {
  const headers = new Headers();

  headers.set('x-tealtiger-action', decision.allowed ? 'ALLOW' : 'DENY');
  headers.set('x-tealtiger-request-id', decision.requestId);
  headers.set('x-tealtiger-user-id', decision.userId);
  headers.set('x-tealtiger-policy-allowed', String(decision.policy.allowed));
  headers.set('x-tealtiger-pii-action', decision.pii.action);
  headers.set('x-tealtiger-pii-risk', String(decision.pii.riskScore));
  headers.set('x-tealtiger-estimated-cost-usd', decision.costEstimate.estimatedCost.toFixed(6));

  if (decision.budget.remaining != null) {
    headers.set('x-tealtiger-budget-remaining-usd', decision.budget.remaining.toFixed(6));
  }

  return headers;
}

export function summarizeGovernance(decision: ChatGovernanceDecision) {
  return {
    action: decision.allowed ? 'ALLOW' : 'DENY',
    requestId: decision.requestId,
    userId: decision.userId,
    operation: decision.operation,
    reasons: decision.reasons,
    policy: {
      allowed: decision.policy.allowed,
      triggeredPolicies: decision.policy.triggeredPolicies,
      reason: decision.policy.reason,
    },
    pii: {
      action: decision.pii.action,
      passed: decision.pii.passed,
      reason: decision.pii.reason,
      riskScore: decision.pii.riskScore,
    },
    cost: {
      estimatedUsd: decision.costEstimate.estimatedCost,
      estimatedTokens: decision.costEstimate.estimatedTokens,
    },
    budget: decision.budget,
  };
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureModelPricing(model: string): void {
  if (pricedModels.has(model)) {
    return;
  }

  costTracker.addCustomPricing(model, {
    model,
    provider: 'custom',
    inputCostPer1K: INPUT_COST_PER_1K,
    outputCostPer1K: OUTPUT_COST_PER_1K,
    lastUpdated: '2026-05-27',
  });
  pricedModels.add(model);
}

function ensureUserBudget(userId: string): void {
  if (userBudgets.has(userId)) {
    return;
  }

  budgetManager.createBudget({
    name: `Vercel AI daily budget for ${userId}`,
    limit: DEFAULT_DAILY_BUDGET_USD,
    period: 'daily',
    alertThresholds: [50, 75, 90, 100],
    action: 'block',
    scope: {
      type: 'agent',
      id: userId,
    },
    enabled: true,
  });
  userBudgets.add(userId);
}

function createEngine(userId: string): TealEngine {
  return new TealEngine({
    identity: {
      agentId: userId,
      role: 'web-user',
      permissions: ['chat:generate'],
    },
    tools: {
      'ai.generateText': { allowed: true },
      'ai.streamText': { allowed: true },
    },
    behavioral: {
      costLimit: {
        daily: DEFAULT_DAILY_BUDGET_USD,
      },
      rateLimit: {
        requests: 60,
        window: '1h',
      },
    },
    content: {
      pii: {
        enabled: true,
        blockedTypes: ['email', 'phone', 'ssn', 'creditCard'],
        redactInLogs: true,
      },
    },
  });
}

function collectReasons(
  policy: PolicyEvaluationResult,
  pii: GuardrailResult,
  budget: Awaited<ReturnType<BudgetManager['checkBudget']>>,
): string[] {
  const reasons: string[] = [];

  if (!policy.allowed) {
    reasons.push(policy.reason ?? 'TealEngine policy denied the request');
  }

  if (pii.shouldBlock()) {
    reasons.push(pii.reason);
  }

  if (!budget.allowed) {
    reasons.push(`Budget "${budget.blockedBy?.name ?? 'unknown'}" would be exceeded`);
  }

  return reasons;
}

function getLatestUserText(messages: ModelMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  return latestUserMessage ? messageContentToText(latestUserMessage.content) : '';
}

function buildGovernedMessages(messages: ModelMessage[], pii: GuardrailResult): ModelMessage[] {
  const redactedText = typeof pii.metadata.redactedText === 'string'
    ? pii.metadata.redactedText
    : undefined;

  if (!redactedText || pii.action !== 'redact') {
    return messages;
  }

  const next = [...messages];
  const latestUserIndex = findLatestUserIndex(next);

  if (latestUserIndex === -1) {
    return messages;
  }

  next[latestUserIndex] = {
    ...next[latestUserIndex],
    content: redactedText,
  } as ModelMessage;

  return next;
}

function findLatestUserIndex(messages: ModelMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') {
      return index;
    }
  }

  return -1;
}

function estimateTokens(messages: ModelMessage[]): TokenUsage {
  const text = messages.map((message) => messageContentToText(message.content)).join('\n');
  const inputTokens = Math.max(1, Math.ceil(text.length / 4));
  const outputTokens = ESTIMATED_OUTPUT_TOKENS;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function normalizeUsage(usage: UsageLike): TokenUsage {
  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        return part.text;
      }

      return '';
    }).join(' ');
  }

  return '';
}

async function getUserBudgetStatus(userId: string) {
  const budget = budgetManager.getBudgetsByScope('agent', userId)[0];
  return budget ? budgetManager.getBudgetStatus(budget.id) : undefined;
}
