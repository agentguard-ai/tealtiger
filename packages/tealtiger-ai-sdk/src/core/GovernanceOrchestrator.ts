/**
 * TealTiger AI SDK — Governance Orchestrator
 *
 * Central coordinator that lazily initializes and manages all TealTiger
 * governance components (TealEngineV12, TealGuard, TealCircuit, CostTracker,
 * TealAudit, TealSecrets, TealRegistry) based on the provided configuration.
 *
 * The orchestrator follows a "synchronous factory, lazy initialization" pattern:
 * the constructor stores configuration, while actual async component setup
 * happens on the first hook invocation via `ensureInitialized()`.
 *
 * @module core/GovernanceOrchestrator
 */

import type { TealTigerMiddlewareConfig } from '../types/config';
import type { Decision, TokenUsage } from '../types/decision';
import { TealRuntimeError, PolicyViolationError, CircuitOpenError } from '../errors';
import { InternalCircuitBreaker } from './InternalCircuitBreaker';
import { logFailOpenError } from './fail-open';

// ── Internal Component Interfaces ────────────────────────────────
// Defined locally to decouple from tealtiger-sdk compile-time types.
// At runtime, the real SDK components satisfy these interfaces.

/**
 * Interface for TealGuard guardrail checks.
 */
export interface ITealGuard {
  check(input: string, context?: unknown): Promise<Decision>;
}

/**
 * Interface for TealEngineV12 policy evaluation.
 */
export interface ITealEngine {
  evaluateV12(
    request: Record<string, unknown>,
    ctx: { correlation_id: string },
  ): Promise<Decision>;
}

/**
 * Interface for TealCircuit circuit breaker.
 */
export interface ITealCircuit {
  evaluate(): Decision;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): string;
}

/**
 * Interface for CostTracker.
 */
export interface ICostTracker {
  estimateCost(
    model: string,
    tokens: TokenUsage,
  ): {
    estimatedCost: number;
    budgetExceeded?: boolean;
    exceededBudgetType?: string;
    remainingBudget?: number;
    pricingUnavailable?: boolean;
  };
  calculateActualCost(
    requestId: string,
    agentId: string,
    model: string,
    actualTokens: TokenUsage,
  ): { actualCost: number };
}

/**
 * Interface for TealAudit logging.
 */
export interface ITealAudit {
  log(entry: unknown): void;
}

/**
 * Interface for TealSecrets detection.
 */
export interface ITealSecrets {
  evaluate(
    request: { content?: string },
    ctx: unknown,
    policy: unknown,
  ): Promise<{ action: string; reason_codes: string[]; findings?: unknown[] }>;
  init(): Promise<void>;
}

/**
 * Interface for TealRegistry allowlisting.
 */
export interface ITealRegistry {
  evaluate(
    request: { model?: string; tool?: string },
    ctx: unknown,
    policy: unknown,
  ): Promise<{ action: string; reason_codes: string[] }>;
  init(): Promise<void>;
}

// ── Result Types ─────────────────────────────────────────────────

/**
 * Result from input evaluation (transformParams phase).
 */
export interface TransformResult {
  /** The (possibly modified) content after guardrails */
  content: string;
  /** The governance decision */
  decision: Decision;
  /** Whether content was modified (e.g., PII redacted) */
  modified: boolean;
}

/**
 * Result from cost budget check.
 */
export interface CostCheckResult {
  /** Whether the request is within budget */
  withinBudget: boolean;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Budget type that would be exceeded (if any) */
  exceededBudgetType?: string;
  /** Remaining budget in USD */
  remainingBudget?: number;
  /** Whether pricing data was unavailable */
  pricingUnavailable?: boolean;
}

/**
 * Cost record from recording actual usage.
 */
export interface CostRecord {
  /** Actual cost in USD */
  actualCost: number;
  /** Model used */
  model: string;
  /** Whether token usage was available */
  usageReported: boolean;
}

/**
 * Audit log entry structure.
 */
export interface AuditEntry {
  schema_version: '1.0.0';
  correlation_id: string;
  timestamp: string;
  action: string;
  reason_codes: string[];
  risk_score: number;
  model: string;
  tokens: { input: number; output: number; total: number };
  duration_ms: number;
  hook: 'transformParams' | 'wrapGenerate' | 'wrapStream';
  provider: string;
  trace_id?: string;
  cost?: { estimated: number; actual?: number; currency: 'USD' };
  failed_guardrails?: string[];
  error?: { message: string; code?: string };
}

// ── Module Result for fail-closed metadata ───────────────────────

/**
 * Result from a successfully-evaluated module, preserved in fail-closed metadata.
 */
export interface ModuleEvalResult {
  /** Module name */
  module: string;
  /** Whether the module passed (ALLOW) or modified content (REDACT) */
  action: string;
  /** Duration in milliseconds */
  duration_ms: number;
}

// ── GovernanceOrchestrator ───────────────────────────────────────

/**
 * Internal orchestrator that coordinates governance modules for requests.
 *
 * Lazily initializes all configured TealTiger components on first use.
 * Zero-config defaults enable PII detection, prompt injection detection,
 * and content moderation guardrails.
 */
export class GovernanceOrchestrator {
  private engine: ITealEngine | null = null;
  private guard: ITealGuard | null = null;
  private circuits: Map<string, InternalCircuitBreaker> = new Map();
  private costTracker: ICostTracker | null = null;
  private audit: ITealAudit | null = null;
  private secrets: ITealSecrets | null = null;
  private registry: ITealRegistry | null = null;
  private initialized = false;
  private readonly config: TealTigerMiddlewareConfig;

  // ── Cost Tracking Internal State ───────────────────────────────
  /** Accumulated session cost in USD */
  private sessionCost = 0;
  /** Accumulated daily cost in USD */
  private dailyCost = 0;
  /** Timestamp (ms) at which the daily cost should reset (midnight UTC) */
  private dailyResetAt = 0;
  /** Last estimated cost (for anomaly detection) */
  private lastEstimate = 0;

  constructor(config: TealTigerMiddlewareConfig) {
    this.config = config;
  }

  // ── Fail-Closed Helpers ──────────────────────────────────────────

  /**
   * Creates a structured fail-closed DENY Decision with full metadata.
   *
   * Includes the failed module name, error description, total evaluation time,
   * and results from successfully-evaluated modules (if any).
   *
   * @param failedModule - Name of the module that threw
   * @param error - The error that occurred
   * @param evaluationTimeMs - Total evaluation time in milliseconds
   * @param correlationId - Correlation ID for the request
   * @param previousResults - Results from modules that completed before the failure
   * @returns A structured DENY Decision
   */
  createFailClosedDecision(
    failedModule: string,
    error: unknown,
    evaluationTimeMs: number,
    correlationId: string,
    previousResults?: ModuleEvalResult[],
  ): Decision {
    const errorDescription = error instanceof Error ? error.message : String(error);

    const metadata: Record<string, unknown> = {
      failed_modules: [
        { name: failedModule, error: errorDescription },
      ],
      total_evaluation_time_ms: evaluationTimeMs,
    };

    if (previousResults && previousResults.length > 0) {
      metadata.previous_results = previousResults;
    }

    return {
      action: 'DENY',
      reason_codes: ['GOVERNANCE_MODULE_FAILURE'],
      risk_score: 100,
      correlation_id: correlationId,
      reason: `Governance module "${failedModule}" failed: ${errorDescription}`,
      metadata,
    };
  }

  /**
   * Wraps a module evaluation function with a per-module timeout using AbortController.
   *
   * If the function does not complete within `config.moduleTimeout` (default 5000ms),
   * the promise rejects with a timeout error. The AbortController's signal is NOT
   * passed into the function (modules don't support abort signals), but the wrapper
   * rejects once the timeout expires.
   *
   * @param moduleName - Name of the module (for error messaging)
   * @param fn - Async function to execute with timeout
   * @returns The result of fn() if it completes within the timeout
   * @throws Error with timeout message if the timeout expires
   */
  async withModuleTimeout<T>(moduleName: string, fn: () => Promise<T>): Promise<T> {
    const timeoutMs = this.config.moduleTimeout ?? 5000;

    const controller = new AbortController();
    const { signal } = controller;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(
          `Module "${moduleName}" timed out after ${timeoutMs}ms`,
        ));
      }, timeoutMs);

      fn().then(
        (result) => {
          if (!signal.aborted) {
            clearTimeout(timeoutId);
            resolve(result);
          }
        },
        (error) => {
          if (!signal.aborted) {
            clearTimeout(timeoutId);
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Lazily initializes all governance components based on configuration.
   * Called on first hook invocation. Subsequent calls return immediately.
   *
   * Zero-config defaults:
   * - TealGuard with PII detection, prompt injection, and content moderation enabled
   *
   * @throws TealRuntimeError if any module fails to initialize
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize TealGuard (always initialized — zero-config defaults apply)
    try {
      this.guard = await this.initializeGuard();
    } catch (error) {
      throw new TealRuntimeError(
        `Failed to initialize TealGuard: ${error instanceof Error ? error.message : String(error)}`,
        'MODULE_INIT_FAILED',
        { module: 'TealGuard', recoverable: false },
      );
    }

    // Initialize TealEngineV12 (only if policy config provided)
    if (this.config.policy) {
      try {
        this.engine = await this.initializeEngine();
      } catch (error) {
        throw new TealRuntimeError(
          `Failed to initialize TealEngineV12: ${error instanceof Error ? error.message : String(error)}`,
          'MODULE_INIT_FAILED',
          { module: 'TealEngineV12', recoverable: false },
        );
      }
    }

    // Initialize circuit breaker map (only if circuitBreaker config provided)
    // Individual per-provider circuits are created lazily on first use
    if (this.config.circuitBreaker) {
      this.circuits = new Map();
    }

    // Initialize CostTracker (only if costTracking enabled)
    if (this.config.costTracking?.enabled) {
      try {
        this.costTracker = await this.initializeCostTracker();
      } catch (error) {
        throw new TealRuntimeError(
          `Failed to initialize CostTracker: ${error instanceof Error ? error.message : String(error)}`,
          'MODULE_INIT_FAILED',
          { module: 'CostTracker', recoverable: false },
        );
      }
    }

    // Initialize TealAudit (only if audit enabled)
    if (this.config.audit?.enabled) {
      try {
        this.audit = await this.initializeAudit();
      } catch (error) {
        throw new TealRuntimeError(
          `Failed to initialize TealAudit: ${error instanceof Error ? error.message : String(error)}`,
          'MODULE_INIT_FAILED',
          { module: 'TealAudit', recoverable: false },
        );
      }
    }

    // Initialize TealSecrets (only if secrets enabled)
    if (this.config.secrets?.enabled) {
      try {
        this.secrets = await this.initializeSecrets();
      } catch (error) {
        throw new TealRuntimeError(
          `Failed to initialize TealSecrets: ${error instanceof Error ? error.message : String(error)}`,
          'MODULE_INIT_FAILED',
          { module: 'TealSecrets', recoverable: false },
        );
      }
    }

    // Initialize TealRegistry (only if registry enabled)
    if (this.config.registry?.enabled) {
      try {
        this.registry = await this.initializeRegistry();
      } catch (error) {
        throw new TealRuntimeError(
          `Failed to initialize TealRegistry: ${error instanceof Error ? error.message : String(error)}`,
          'MODULE_INIT_FAILED',
          { module: 'TealRegistry', recoverable: false },
        );
      }
    }

    this.initialized = true;
  }

  // ── Placeholder Method Signatures ────────────────────────────────
  // These will be fully implemented in tasks 3.2–3.7.

  /**
   * Pre-request governance: evaluate input content via guardrails.
   *
   * Evaluation order:
   * 1. Model allowlist check (TealRegistry, if configured)
   * 2. TealGuard check (PII detection, prompt injection, content moderation)
   * 3. TealSecrets scan (if configured)
   *
   * On module failure:
   * - fail-closed (default): throw PolicyViolationError with GOVERNANCE_EVALUATION_FAILED
   * - fail-open: log to stderr and continue
   */
  async evaluateInput(
    content: string,
    model: string,
    correlationId: string,
  ): Promise<TransformResult> {
    let currentContent = content;
    let modified = false;

    // Step 1: Model allowlist check via TealRegistry (if configured)
    if (this.registry) {
      try {
        const registryResult = await this.registry.evaluate(
          { model },
          {},
          {},
        );
        if (registryResult.action === 'DENY') {
          const decision: Decision = {
            action: 'DENY',
            reason_codes: registryResult.reason_codes.length > 0
              ? registryResult.reason_codes
              : ['MODEL_NOT_ALLOWLISTED'],
            risk_score: 100,
            correlation_id: correlationId,
            reason: `Model "${model}" is not in the allowlist`,
            metadata: { module: 'TealRegistry', model },
          };
          throw new PolicyViolationError(
            `Model "${model}" is not in the allowlist`,
            decision,
          );
        }
      } catch (error) {
        if (error instanceof PolicyViolationError) {
          throw error;
        }
        // Module failure
        if (!this.config.failOpen) {
          const decision: Decision = {
            action: 'DENY',
            reason_codes: ['GOVERNANCE_EVALUATION_FAILED'],
            risk_score: 100,
            correlation_id: correlationId,
            reason: `TealRegistry evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              failedModule: 'TealRegistry',
              error: error instanceof Error ? error.message : String(error),
            },
          };
          throw new PolicyViolationError(
            `Governance evaluation failed (TealRegistry): ${error instanceof Error ? error.message : String(error)}`,
            decision,
          );
        }
        // Fail-open: log and continue
        logFailOpenError(correlationId, 'TealRegistry', error);
      }
    }

    // Step 2: TealGuard check (PII, prompt injection, content moderation)
    if (this.guard) {
      try {
        const guardDecision = await this.guard.check(currentContent, {
          correlation_id: correlationId,
        });

        if (guardDecision.action === 'DENY') {
          // Prompt injection or content moderation block
          const reasonCodes = guardDecision.reason_codes.length > 0
            ? guardDecision.reason_codes
            : ['PROMPT_INJECTION_DETECTED'];
          const decision: Decision = {
            action: 'DENY',
            reason_codes: reasonCodes,
            risk_score: guardDecision.risk_score,
            correlation_id: correlationId,
            reason: guardDecision.reason || 'Request blocked by TealGuard',
            metadata: { module: 'TealGuard' },
          };
          throw new PolicyViolationError(
            guardDecision.reason || 'Request blocked by TealGuard',
            decision,
          );
        }

        if (guardDecision.action === 'REDACT') {
          // PII detected — use the redacted content from the guard decision
          // The guard returns the redacted content in its reason or we apply redaction
          // The Decision from TealGuard with REDACT action means content was redacted
          // and the redacted content is returned as part of the flow
          if (guardDecision.reason && guardDecision.reason !== currentContent) {
            currentContent = guardDecision.reason;
            modified = true;
          }
          // If guard provides metadata with redacted content, use it
          if (guardDecision.metadata?.redactedContent &&
              typeof guardDecision.metadata.redactedContent === 'string') {
            currentContent = guardDecision.metadata.redactedContent;
            modified = true;
          }
        }
        // ALLOW: pass through unchanged
      } catch (error) {
        if (error instanceof PolicyViolationError) {
          throw error;
        }
        // Module failure
        if (!this.config.failOpen) {
          const decision: Decision = {
            action: 'DENY',
            reason_codes: ['GOVERNANCE_EVALUATION_FAILED'],
            risk_score: 100,
            correlation_id: correlationId,
            reason: `TealGuard evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              failedModule: 'TealGuard',
              error: error instanceof Error ? error.message : String(error),
            },
          };
          throw new PolicyViolationError(
            `Governance evaluation failed (TealGuard): ${error instanceof Error ? error.message : String(error)}`,
            decision,
          );
        }
        // Fail-open: log and continue
        logFailOpenError(correlationId, 'TealGuard', error);
      }
    }

    // Step 3: TealSecrets scan (if configured)
    if (this.secrets) {
      try {
        const secretsResult = await this.secrets.evaluate(
          { content: currentContent },
          { correlation_id: correlationId },
          {},
        );

        if (secretsResult.action === 'REDACT' || (
          secretsResult.findings && secretsResult.findings.length > 0
        )) {
          // Secrets detected above threshold — redact them
          // Apply redaction from findings if available
          if (secretsResult.findings && Array.isArray(secretsResult.findings)) {
            let redactedContent = currentContent;
            for (const finding of secretsResult.findings) {
              const f = finding as { value?: string; type?: string; redacted?: string };
              if (f.value && typeof f.value === 'string') {
                const placeholder = f.redacted || `[REDACTED:${f.type || 'SECRET'}]`;
                redactedContent = redactedContent.replace(f.value, placeholder);
              }
            }
            if (redactedContent !== currentContent) {
              currentContent = redactedContent;
              modified = true;
            }
          }
        }
      } catch (error) {
        if (error instanceof PolicyViolationError) {
          throw error;
        }
        // Module failure
        if (!this.config.failOpen) {
          const decision: Decision = {
            action: 'DENY',
            reason_codes: ['GOVERNANCE_EVALUATION_FAILED'],
            risk_score: 100,
            correlation_id: correlationId,
            reason: `TealSecrets evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              failedModule: 'TealSecrets',
              error: error instanceof Error ? error.message : String(error),
            },
          };
          throw new PolicyViolationError(
            `Governance evaluation failed (TealSecrets): ${error instanceof Error ? error.message : String(error)}`,
            decision,
          );
        }
        // Fail-open: log and continue
        logFailOpenError(correlationId, 'TealSecrets', error);
      }
    }

    // Build the final decision
    const decision: Decision = {
      action: modified ? 'REDACT' : 'ALLOW',
      reason_codes: modified ? ['PII_DETECTED'] : ['POLICY_COMPLIANT'],
      risk_score: modified ? 30 : 0,
      correlation_id: correlationId,
      reason: modified ? 'Content modified by guardrails' : 'All governance checks passed',
    };

    return {
      content: currentContent,
      decision,
      modified,
    };
  }

  /**
   * Policy evaluation via TealEngineV12.
   *
   * If no engine is configured (no policy config), returns an ALLOW decision.
   * Otherwise delegates to TealEngineV12 for deterministic policy evaluation.
   *
   * On failure:
   * - fail-closed (default): re-throws the error so the caller denies the request
   * - fail-open: logs to stderr and returns an ALLOW decision
   */
  async evaluatePolicy(
    request: Record<string, unknown>,
    correlationId: string,
  ): Promise<Decision> {
    // No engine configured → no policy to evaluate → allow
    if (!this.engine) {
      return {
        action: 'ALLOW',
        reason_codes: ['NO_POLICY_CONFIGURED'],
        risk_score: 0,
        correlation_id: correlationId,
        reason: 'No policy evaluation configured',
      };
    }

    try {
      const decision = await this.engine.evaluateV12(request, {
        correlation_id: correlationId,
      });
      return decision;
    } catch (error) {
      // Fail-open: log and allow
      if (this.config.failOpen) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logFailOpenError(correlationId, 'TealEngineV12', error);
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_EVALUATION_FAILED', 'FAIL_OPEN'],
          risk_score: 0,
          correlation_id: correlationId,
          reason: `Policy evaluation failed (fail-open): ${errorMessage}`,
        };
      }

      // Fail-closed (default): re-throw so the caller handles as denial
      throw error;
    }
  }

  /**
   * Output governance: evaluate response content against output guardrails.
   *
   * If no output guardrails are configured, returns ALLOW immediately.
   * Otherwise, delegates to TealGuard with phase='output' context.
   * On failure, applies fail-closed (re-throw) or fail-open (log + ALLOW) behavior.
   *
   * @param content - The model response content to evaluate
   * @param correlationId - Correlation ID for tracing
   * @returns Decision from output guardrail evaluation
   */
  async evaluateOutput(
    content: string,
    correlationId: string,
  ): Promise<Decision> {
    // If no output guardrails are configured, return ALLOW immediately
    if (!this.config.guardrails?.output) {
      return {
        action: 'ALLOW',
        reason_codes: ['NO_OUTPUT_GUARDRAILS'],
        risk_score: 0,
        correlation_id: correlationId,
        reason: 'No output guardrails configured',
      };
    }

    // Output guardrails are configured — evaluate via TealGuard
    try {
      const decision = await this.guard!.check(content, {
        correlation_id: correlationId,
        phase: 'output',
      });
      return decision;
    } catch (error) {
      // Fail-closed (default): re-throw the error
      if (!this.config.failOpen) {
        throw error;
      }

      // Fail-open: log to stderr and return ALLOW
      logFailOpenError(correlationId, 'TealGuard (output)', error);
      return {
        action: 'ALLOW',
        reason_codes: ['OUTPUT_GUARDRAIL_FAILED_OPEN'],
        risk_score: 0,
        correlation_id: correlationId,
        reason: 'Output guardrail evaluation failed — fail-open mode active',
      };
    }
  }

  /**
   * Circuit breaker check for a provider.
   *
   * If no circuitBreaker is configured, returns an ALLOW decision (disabled).
   * Gets or creates the InternalCircuitBreaker for the given provider,
   * evaluates its state, and throws CircuitOpenError if OPEN.
   *
   * @param provider - The provider name (e.g., "openai")
   * @returns Decision with ALLOW action if circuit is closed/half-open
   * @throws CircuitOpenError if the circuit is in OPEN state
   */
  checkCircuit(provider: string): Decision {
    // If no circuitBreaker configured, circuit breaker is disabled
    if (!this.config.circuitBreaker) {
      return {
        action: 'ALLOW',
        reason_codes: ['POLICY_COMPLIANT'],
        risk_score: 0,
        correlation_id: '',
        reason: 'Circuit breaker disabled',
      };
    }

    // Get or create the circuit breaker for this provider
    const circuit = this.getOrCreateCircuit(provider);

    // Evaluate the circuit state
    const decision = circuit.evaluate();

    // If circuit is OPEN, throw CircuitOpenError
    if (decision.action === 'DENY' && decision.reason_codes.includes('CIRCUIT_OPEN')) {
      const retryAfterMs = this.config.circuitBreaker.timeout ?? 60_000;
      throw new CircuitOpenError(provider, retryAfterMs);
    }

    return decision;
  }

  /**
   * Report success/failure to the circuit breaker for a provider.
   *
   * If no circuitBreaker is configured, this is a no-op.
   * Gets or creates the InternalCircuitBreaker for the provider and
   * reports the outcome to update the state machine.
   *
   * @param provider - The provider name (e.g., "openai")
   * @param success - Whether the call was successful
   */
  reportOutcome(provider: string, success: boolean): void {
    // If no circuitBreaker configured, no-op
    if (!this.config.circuitBreaker) {
      return;
    }

    // Get or create the circuit breaker for this provider
    const circuit = this.getOrCreateCircuit(provider);

    if (success) {
      circuit.reportSuccess();
    } else {
      circuit.reportFailure();
    }
  }

  /**
   * Cost estimation and budget check.
   *
   * Estimates the cost based on the model and estimated token count, then checks
   * against per-request, per-session, and daily budget limits.
   *
   * If no costTracker is configured, returns withinBudget: true with zero cost
   * (cost tracking disabled).
   *
   * @param model - The model identifier (e.g., "openai/gpt-4")
   * @param estimatedTokens - Estimated number of input tokens for the request
   * @returns CostCheckResult indicating whether the request is within budget
   */
  async checkBudget(
    model: string,
    estimatedTokens: number,
  ): Promise<CostCheckResult> {
    // If no costTracker configured, cost tracking is disabled
    if (!this.costTracker) {
      return { withinBudget: true, estimatedCost: 0 };
    }

    // Create a TokenUsage estimate (only input tokens for pre-execution estimate)
    const tokenUsage: TokenUsage = {
      inputTokens: estimatedTokens,
      outputTokens: 0,
      totalTokens: estimatedTokens,
    };

    // Call the cost tracker to estimate cost
    const estimate = this.costTracker.estimateCost(model, tokenUsage);

    // Store last estimate for anomaly detection in recordCost
    this.lastEstimate = estimate.estimatedCost;

    // If pricing is unavailable, return within budget with zero cost flagged
    if (estimate.pricingUnavailable) {
      return {
        withinBudget: true,
        estimatedCost: 0,
        pricingUnavailable: true,
      };
    }

    const costConfig = this.config.costTracking;
    const estimatedCost = estimate.estimatedCost;

    // Reset daily cost if past midnight UTC
    this.resetDailyCostIfNeeded();

    // Check per-request limit
    if (costConfig?.perRequestLimit !== undefined && estimatedCost > costConfig.perRequestLimit) {
      return {
        withinBudget: false,
        estimatedCost,
        exceededBudgetType: 'per-request',
        remainingBudget: costConfig.perRequestLimit,
      };
    }

    // Check per-session limit
    if (costConfig?.perSessionLimit !== undefined &&
      this.sessionCost + estimatedCost > costConfig.perSessionLimit) {
      return {
        withinBudget: false,
        estimatedCost,
        exceededBudgetType: 'per-session',
        remainingBudget: Math.max(0, costConfig.perSessionLimit - this.sessionCost),
      };
    }

    // Check daily limit
    if (costConfig?.dailyLimit !== undefined &&
      this.dailyCost + estimatedCost > costConfig.dailyLimit) {
      return {
        withinBudget: false,
        estimatedCost,
        exceededBudgetType: 'daily',
        remainingBudget: Math.max(0, costConfig.dailyLimit - this.dailyCost),
      };
    }

    return {
      withinBudget: true,
      estimatedCost,
    };
  }

  /**
   * Record actual cost from token usage after a model call completes.
   *
   * Records the actual cost, accumulates session and daily totals, and
   * checks the anomaly threshold if configured.
   *
   * If no costTracker is configured, returns zero cost with usageReported: false.
   * If usage is null/undefined or all zeros, returns zero cost with usageReported: false.
   *
   * @param model - The model identifier (e.g., "openai/gpt-4")
   * @param usage - Token usage from the model response
   * @returns CostRecord with actual cost and reporting status
   */
  recordCost(model: string, usage: TokenUsage): CostRecord {
    // If no costTracker configured, cost tracking is disabled
    if (!this.costTracker) {
      return { actualCost: 0, model, usageReported: false };
    }

    // If usage is null/undefined or all zeros, skip recording
    if (!usage || (usage.inputTokens === 0 && usage.outputTokens === 0 && usage.totalTokens === 0)) {
      return { actualCost: 0, model, usageReported: false };
    }

    // Calculate actual cost
    const result = this.costTracker.calculateActualCost(
      'request-id',
      'middleware',
      model,
      usage,
    );

    const actualCost = result.actualCost;

    // Accumulate session and daily costs
    this.sessionCost += actualCost;
    this.resetDailyCostIfNeeded();
    this.dailyCost += actualCost;

    // Check anomaly threshold if configured
    const anomalyThreshold = this.config.costTracking?.anomalyThreshold;
    if (anomalyThreshold !== undefined && this.lastEstimate > 0) {
      const ratio = (actualCost / this.lastEstimate) * 100;
      if (ratio > anomalyThreshold) {
        // Anomaly detected — log warning (non-blocking)
        // In a full implementation this would emit an event or call an alert handler
        console.warn(
          `[TealTiger] Cost anomaly detected for model "${model}": ` +
          `actual $${actualCost.toFixed(6)} is ${ratio.toFixed(0)}% of estimated $${this.lastEstimate.toFixed(6)} ` +
          `(threshold: ${anomalyThreshold}%)`,
        );
      }
    }

    return { actualCost, model, usageReported: true };
  }

  /**
   * Emit structured audit log entry via TealAudit.
   *
   * Non-blocking: catches and swallows all audit failures, logging them
   * to stderr via console.error. Never throws — audit logging must not
   * block the response path.
   *
   * If no audit backend is configured (this.audit is null), this is a no-op.
   */
  emitAudit(entry: AuditEntry): void {
    if (!this.audit) {
      return;
    }

    try {
      this.audit.log(entry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[TealTiger] Audit logging failed: correlation_id=${entry.correlation_id}, error=${errorMessage}`,
      );
    }
  }

  // ── Circuit Breaker Helpers ────────────────────────────────────────

  /**
   * Extract provider prefix from a model identifier.
   *
   * Splits on the first '/' character:
   * - "openai/gpt-4" → "openai"
   * - "anthropic/claude-3" → "anthropic"
   * - "gpt-4" (no slash) → "unknown"
   *
   * @param modelId - The full model identifier string
   * @returns The provider prefix or "unknown" if no slash is present
   */
  static extractProvider(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > 0 ? modelId.substring(0, slashIndex) : 'unknown';
  }

  /**
   * Get or create an InternalCircuitBreaker for a provider.
   * Lazily creates circuit breakers as providers are encountered.
   */
  private getOrCreateCircuit(provider: string): InternalCircuitBreaker {
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = new InternalCircuitBreaker(this.config.circuitBreaker);
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }

  // ── Accessors (for testing) ──────────────────────────────────────

  /** Whether the orchestrator has been initialized */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Get the current config */
  getConfig(): TealTigerMiddlewareConfig {
    return this.config;
  }

  /** Get guard instance (for testing) */
  getGuard(): ITealGuard | null {
    return this.guard;
  }

  /** Get engine instance (for testing) */
  getEngine(): ITealEngine | null {
    return this.engine;
  }

  /** Get circuit map (for testing) */
  getCircuits(): Map<string, InternalCircuitBreaker> {
    return this.circuits;
  }

  /** Get cost tracker (for testing) */
  getCostTracker(): ICostTracker | null {
    return this.costTracker;
  }

  /** Get audit instance (for testing) */
  getAudit(): ITealAudit | null {
    return this.audit;
  }

  /** Get secrets instance (for testing) */
  getSecrets(): ITealSecrets | null {
    return this.secrets;
  }

  /** Get registry instance (for testing) */
  getRegistry(): ITealRegistry | null {
    return this.registry;
  }

  /** Get session cost (for testing) */
  getSessionCost(): number {
    return this.sessionCost;
  }

  /** Get daily cost (for testing) */
  getDailyCost(): number {
    return this.dailyCost;
  }

  /** Get last estimate (for testing) */
  getLastEstimate(): number {
    return this.lastEstimate;
  }

  // ── Private Initialization Helpers ───────────────────────────────

  /**
   * Reset daily cost if the current time has passed the daily reset timestamp.
   * Sets the next reset to the upcoming midnight UTC.
   */
  private resetDailyCostIfNeeded(): void {
    const now = Date.now();
    if (now >= this.dailyResetAt) {
      this.dailyCost = 0;
      // Calculate next midnight UTC
      const nextMidnight = new Date();
      nextMidnight.setUTCHours(24, 0, 0, 0);
      this.dailyResetAt = nextMidnight.getTime();
    }
  }

  /**
   * Initialize TealGuard with guardrail configuration.
   * Zero-config defaults: PII, prompt injection, content moderation enabled.
   */
  private async initializeGuard(): Promise<ITealGuard> {
    const guardrailConfig = this.config.guardrails ?? {};

    // Determine which guardrails to enable (zero-config defaults)
    const piiEnabled = guardrailConfig.pii !== false &&
      (guardrailConfig.pii === undefined ||
        guardrailConfig.pii === true ||
        (typeof guardrailConfig.pii === 'object' && guardrailConfig.pii.enabled !== false));

    const injectionEnabled = guardrailConfig.promptInjection !== false &&
      (guardrailConfig.promptInjection === undefined ||
        guardrailConfig.promptInjection === true ||
        (typeof guardrailConfig.promptInjection === 'object' && guardrailConfig.promptInjection.enabled !== false));

    const moderationEnabled = guardrailConfig.contentModeration !== false &&
      (guardrailConfig.contentModeration === undefined ||
        guardrailConfig.contentModeration === true ||
        (typeof guardrailConfig.contentModeration === 'object' && guardrailConfig.contentModeration.enabled !== false));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      // SDK not available — use fallback stub
      return createDefaultGuardStub(piiEnabled, injectionEnabled, moderationEnabled);
    }

    // SDK imported but TealGuard constructor may not be available
    if (!sdk.TealGuard || typeof sdk.TealGuard !== 'function') {
      return createDefaultGuardStub(piiEnabled, injectionEnabled, moderationEnabled);
    }

    // SDK available — constructor errors are real initialization failures
    const guard = new sdk.TealGuard({
      pii: piiEnabled,
      promptInjection: injectionEnabled,
      contentModeration: moderationEnabled,
    });
    return guard as ITealGuard;
  }

  /**
   * Initialize TealEngineV12 with policy configuration.
   */
  private async initializeEngine(): Promise<ITealEngine> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      return createDefaultEngineStub();
    }

    if (!sdk.TealEngineV12 || typeof sdk.TealEngineV12 !== 'function') {
      return createDefaultEngineStub();
    }

    const engine = new sdk.TealEngineV12(this.config.policy);
    return engine as ITealEngine;
  }

  /**
   * Initialize CostTracker with cost tracking configuration.
   */
  private async initializeCostTracker(): Promise<ICostTracker> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      return createDefaultCostTrackerStub();
    }

    if (!sdk.CostTracker || typeof sdk.CostTracker !== 'function') {
      return createDefaultCostTrackerStub();
    }

    const tracker = new sdk.CostTracker(this.config.costTracking);
    return tracker as ICostTracker;
  }

  /**
   * Initialize TealAudit with audit configuration.
   */
  private async initializeAudit(): Promise<ITealAudit> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      return createDefaultAuditStub();
    }

    if (!sdk.TealAudit || typeof sdk.TealAudit !== 'function') {
      return createDefaultAuditStub();
    }

    const audit = new sdk.TealAudit(this.config.audit);
    return audit as ITealAudit;
  }

  /**
   * Initialize TealSecrets with secrets configuration.
   */
  private async initializeSecrets(): Promise<ITealSecrets> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      return createDefaultSecretsStub();
    }

    if (!sdk.TealSecrets || typeof sdk.TealSecrets !== 'function') {
      return createDefaultSecretsStub();
    }

    const secrets = new sdk.TealSecrets(this.config.secrets);
    await (secrets as ITealSecrets).init();
    return secrets as ITealSecrets;
  }

  /**
   * Initialize TealRegistry with registry configuration.
   */
  private async initializeRegistry(): Promise<ITealRegistry> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sdk: any;
    try {
      sdk = await import('tealtiger-sdk');
    } catch {
      return createDefaultRegistryStub(this.config.registry?.allowedModels ?? []);
    }

    // SDK imported but TealRegistry constructor may not be available
    if (!sdk.TealRegistry || typeof sdk.TealRegistry !== 'function') {
      return createDefaultRegistryStub(this.config.registry?.allowedModels ?? []);
    }

    const registry = new sdk.TealRegistry(this.config.registry);
    await (registry as ITealRegistry).init();
    return registry as ITealRegistry;
  }
}

// ── Default Stubs (for test/standalone environments) ─────────────

function createDefaultGuardStub(
  _pii: boolean,
  _injection: boolean,
  _moderation: boolean,
): ITealGuard {
  return {
    async check(_input: string): Promise<Decision> {
      return {
        action: 'ALLOW',
        reason_codes: ['POLICY_COMPLIANT'],
        risk_score: 0,
        correlation_id: '',
        reason: 'Default guard stub — no detections',
      };
    },
  };
}

function createDefaultEngineStub(): ITealEngine {
  return {
    async evaluateV12(
      _request: Record<string, unknown>,
      ctx: { correlation_id: string },
    ): Promise<Decision> {
      return {
        action: 'ALLOW',
        reason_codes: ['POLICY_COMPLIANT'],
        risk_score: 0,
        correlation_id: ctx.correlation_id,
        reason: 'Default engine stub — policy allows',
      };
    },
  };
}

function createDefaultCostTrackerStub(): ICostTracker {
  return {
    estimateCost(_model: string, tokens: TokenUsage) {
      return {
        estimatedCost: 0,
        pricingUnavailable: true,
      };
    },
    calculateActualCost(
      _requestId: string,
      _agentId: string,
      _model: string,
      _actualTokens: TokenUsage,
    ) {
      return { actualCost: 0 };
    },
  };
}

function createDefaultAuditStub(): ITealAudit {
  return {
    log(_entry: unknown): void {
      // No-op stub
    },
  };
}

function createDefaultSecretsStub(): ITealSecrets {
  return {
    async evaluate() {
      return { action: 'ALLOW', reason_codes: [] };
    },
    async init() {},
  };
}

function createDefaultRegistryStub(allowedModels: string[]): ITealRegistry {
  return {
    async evaluate(request: { model?: string }) {
      if (request.model && allowedModels.length > 0) {
        if (!allowedModels.includes(request.model)) {
          return { action: 'DENY', reason_codes: ['MODEL_NOT_ALLOWLISTED'] };
        }
      }
      return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'] };
    },
    async init() {},
  };
}
