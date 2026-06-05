/**
 * TealTiger AI SDK — wrapGenerate Hook
 *
 * Implements the `wrapGenerate` middleware hook for non-streaming LLM calls.
 * Applies the full governance lifecycle: circuit breaker → policy evaluation →
 * budget check → model call → output guardrails → cost recording → audit logging.
 *
 * @module hooks/wrapGenerate
 */

import { randomUUID } from 'node:crypto';
import { GovernanceOrchestrator } from '../core/GovernanceOrchestrator';
import type { AuditEntry } from '../core/GovernanceOrchestrator';
import type { Decision, TokenUsage } from '../types/decision';
import {
  PolicyViolationError,
  GuardrailViolationError,
  BudgetExceededError,
} from '../errors';

/**
 * Options passed to the wrapGenerate hook by the Vercel AI SDK.
 */
export interface WrapGenerateOptions {
  doGenerate: () => PromiseLike<WrapGenerateResult>;
  params: Record<string, unknown>;
  model?: { modelId?: string };
}

/**
 * Result returned by doGenerate (subset of Vercel AI SDK response).
 */
export interface WrapGenerateResult {
  text?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  [key: string]: unknown;
}

/**
 * Creates a wrapGenerate hook function bound to the given GovernanceOrchestrator.
 *
 * The hook enforces the following governance flow:
 * 1. Record start time
 * 2. Extract provider from model ID
 * 3. Get or generate correlation ID
 * 4. Initialize orchestrator (lazy)
 * 5. Check circuit breaker state → throw CircuitOpenError if OPEN
 * 6. Evaluate policy → throw PolicyViolationError if DENY
 * 7. Check budget → throw BudgetExceededError if exceeded
 * 8. Call doGenerate()
 * 9. On success: evaluate output guardrails, record cost, report success, emit audit
 * 10. On failure: report failure to circuit breaker, emit audit with error, re-throw
 *
 * @param orchestrator - The GovernanceOrchestrator instance managing governance modules
 * @returns A wrapGenerate hook function compatible with LanguageModelV3Middleware
 */
export function createWrapGenerateHook(
  orchestrator: GovernanceOrchestrator,
) {
  return async function wrapGenerate(
    options: WrapGenerateOptions,
  ): Promise<WrapGenerateResult> {
    const { doGenerate, params, model } = options;

    // 1. Record start time
    const startTime = Date.now();

    // 2. Extract provider from model ID
    const modelId = model?.modelId
      ?? (params.modelId as string | undefined)
      ?? (params.model as string | undefined)
      ?? 'unknown/unknown';
    const provider = GovernanceOrchestrator.extractProvider(modelId);

    // 3. Get correlation ID (from params metadata set by transformParams, or generate new one)
    const correlationId =
      (params.metadata as Record<string, unknown> | undefined)?.correlationId as string
      ?? (params.metadata as Record<string, unknown> | undefined)?.correlation_id as string
      ?? randomUUID();

    // 4. Initialize orchestrator
    await orchestrator.ensureInitialized();

    // 5. Check circuit breaker state → throws CircuitOpenError if OPEN
    orchestrator.checkCircuit(provider);

    // 6. Evaluate policy → throws PolicyViolationError if DENY
    const request: Record<string, unknown> = {
      ...params,
      model: modelId,
      provider,
    };
    const policyDecision = await orchestrator.evaluatePolicy(request, correlationId);

    if (policyDecision.action === 'DENY') {
      const duration = Date.now() - startTime;
      emitAuditEntry(orchestrator, {
        correlationId,
        decision: policyDecision,
        modelId,
        provider,
        duration,
        hook: 'wrapGenerate',
        tokens: { input: 0, output: 0, total: 0 },
      });
      throw new PolicyViolationError(
        policyDecision.reason || 'Policy evaluation denied request',
        policyDecision,
      );
    }

    // 7. Check budget if cost tracking configured
    const estimatedTokens = extractEstimatedTokens(params);
    const budgetResult = await orchestrator.checkBudget(modelId, estimatedTokens);

    if (!budgetResult.withinBudget) {
      const budgetDecision: Decision = {
        action: 'DENY',
        reason_codes: ['COST_BUDGET_EXCEEDED'],
        risk_score: 80,
        correlation_id: correlationId,
        reason: `Cost budget exceeded: ${budgetResult.exceededBudgetType} limit reached`,
      };
      const duration = Date.now() - startTime;
      emitAuditEntry(orchestrator, {
        correlationId,
        decision: budgetDecision,
        modelId,
        provider,
        duration,
        hook: 'wrapGenerate',
        tokens: { input: 0, output: 0, total: 0 },
        cost: { estimated: budgetResult.estimatedCost },
      });
      throw new BudgetExceededError(
        budgetResult.exceededBudgetType as 'per-request' | 'per-session' | 'daily',
        budgetResult.remainingBudget ?? 0,
        budgetDecision,
      );
    }

    // 8. Call doGenerate() — wrapped in try/catch for provider errors
    let result: WrapGenerateResult;
    try {
      result = await doGenerate();
    } catch (error) {
      // 10. On provider error: report failure to circuit breaker, emit audit, re-throw
      orchestrator.reportOutcome(provider, false);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

      const errorDecision: Decision = {
        action: 'DENY',
        reason_codes: ['PROVIDER_ERROR'],
        risk_score: 0,
        correlation_id: correlationId,
        reason: `Provider error: ${errorMessage}`,
      };

      emitAuditEntry(orchestrator, {
        correlationId,
        decision: errorDecision,
        modelId,
        provider,
        duration,
        hook: 'wrapGenerate',
        tokens: { input: 0, output: 0, total: 0 },
        error: { message: errorMessage, code: errorCode },
      });

      throw error;
    }

    // 9. On success: evaluate output guardrails, record cost, report success, emit audit
    const usage = extractTokenUsage(result);

    // Evaluate output guardrails
    const responseContent = extractResponseContent(result);
    if (responseContent) {
      const outputDecision = await orchestrator.evaluateOutput(responseContent, correlationId);

      if (outputDecision.action === 'DENY') {
        const duration = Date.now() - startTime;
        const failedGuardrails = outputDecision.reason_codes.length > 0
          ? outputDecision.reason_codes
          : ['OUTPUT_CONTENT_VIOLATION'];

        emitAuditEntry(orchestrator, {
          correlationId,
          decision: outputDecision,
          modelId,
          provider,
          duration,
          hook: 'wrapGenerate',
          tokens: { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens },
          failedGuardrails,
        });

        throw new GuardrailViolationError(
          outputDecision.reason || 'Output guardrail violation detected',
          failedGuardrails,
          outputDecision,
        );
      }
    }

    // Record actual cost
    const costRecord = orchestrator.recordCost(modelId, usage);

    // Report success to circuit breaker
    orchestrator.reportOutcome(provider, true);

    // Emit audit entry
    const duration = Date.now() - startTime;
    emitAuditEntry(orchestrator, {
      correlationId,
      decision: policyDecision,
      modelId,
      provider,
      duration,
      hook: 'wrapGenerate',
      tokens: { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens },
      cost: costRecord.usageReported
        ? { estimated: budgetResult.estimatedCost, actual: costRecord.actualCost }
        : { estimated: budgetResult.estimatedCost },
    });

    return result;
  };
}

// ── Helper Functions ─────────────────────────────────────────────

/**
 * Extract estimated token count from request params for budget estimation.
 */
function extractEstimatedTokens(params: Record<string, unknown>): number {
  // Check for explicit token count in params
  if (typeof params.maxTokens === 'number') {
    return params.maxTokens;
  }

  // Estimate from prompt content length (rough: ~4 chars per token)
  const prompt = params.prompt as string | undefined;
  const messages = params.messages as unknown[] | undefined;

  if (prompt) {
    return Math.ceil(prompt.length / 4);
  }

  if (messages && Array.isArray(messages)) {
    const totalChars = messages.reduce((acc: number, msg: unknown) => {
      if (typeof msg === 'object' && msg !== null && 'content' in msg) {
        const content = (msg as { content?: string }).content;
        return acc + (typeof content === 'string' ? content.length : 0);
      }
      return acc;
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  // Default estimate if no content available
  return 100;
}

/**
 * Extract token usage from the model response.
 */
function extractTokenUsage(result: WrapGenerateResult): TokenUsage {
  if (result.usage) {
    return {
      inputTokens: result.usage.promptTokens ?? 0,
      outputTokens: result.usage.completionTokens ?? 0,
      totalTokens: result.usage.totalTokens
        ?? (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0),
    };
  }

  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Extract text content from the model response for output guardrail evaluation.
 */
function extractResponseContent(result: WrapGenerateResult): string | null {
  if (typeof result.text === 'string' && result.text.length > 0) {
    return result.text;
  }
  return null;
}

/**
 * Emit a structured audit entry via the orchestrator.
 */
interface AuditEmitOptions {
  correlationId: string;
  decision: Decision;
  modelId: string;
  provider: string;
  duration: number;
  hook: 'wrapGenerate';
  tokens: { input: number; output: number; total: number };
  cost?: { estimated: number; actual?: number };
  error?: { message: string; code?: string };
  failedGuardrails?: string[];
}

function emitAuditEntry(
  orchestrator: GovernanceOrchestrator,
  opts: AuditEmitOptions,
): void {
  const entry: AuditEntry = {
    schema_version: '1.0.0',
    correlation_id: opts.correlationId,
    timestamp: new Date().toISOString(),
    action: opts.decision.action,
    reason_codes: opts.decision.reason_codes,
    risk_score: opts.decision.risk_score,
    model: opts.modelId,
    tokens: opts.tokens,
    duration_ms: opts.duration,
    hook: opts.hook,
    provider: opts.provider,
    ...(opts.cost && { cost: { ...opts.cost, currency: 'USD' as const } }),
    ...(opts.error && { error: opts.error }),
    ...(opts.failedGuardrails && { failed_guardrails: opts.failedGuardrails }),
  };

  orchestrator.emitAudit(entry);
}
