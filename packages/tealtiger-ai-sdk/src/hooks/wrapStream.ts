/**
 * TealTiger AI SDK — wrapStream Hook
 *
 * Implements streaming call governance for the Vercel AI SDK middleware.
 * This hook intercepts streaming LLM calls to enforce:
 * - Circuit breaker state (reject if OPEN)
 * - Policy evaluation (deny before stream if DENY)
 * - Output guardrail evaluation on accumulated stream content
 * - Cost recording from stream usage metadata
 * - Audit logging on stream completion or error
 *
 * The stream is wrapped using a TransformStream that accumulates text chunks
 * and performs post-stream governance on completion.
 *
 * @module hooks/wrapStream
 */

import { GovernanceOrchestrator, type AuditEntry } from '../core/GovernanceOrchestrator';
import { PolicyViolationError, GuardrailViolationError } from '../errors';
import type { TokenUsage } from '../types/decision';

/**
 * Stream result shape returned by doStream() in the Vercel AI SDK.
 * This is a structural subset of the actual SDK stream result to avoid
 * hard runtime coupling.
 */
export interface StreamResult {
  stream: ReadableStream<StreamChunk>;
  rawCall?: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
  rawResponse?: { headers?: Record<string, string> };
  warnings?: unknown[];
  usage?: StreamUsage;
  /** Experimental provider metadata (may include token usage) */
  providerMetadata?: Record<string, unknown>;
  /** Response metadata */
  response?: {
    id?: string;
    timestamp?: Date;
    modelId?: string;
    headers?: Record<string, string>;
  };
}

/**
 * Individual stream chunk types from Vercel AI SDK.
 */
export type StreamChunk =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolCallType: string; toolCallId: string; toolName: string; args: string }
  | { type: 'tool-call-delta'; toolCallType: string; toolCallId: string; toolName: string; argsTextDelta: string }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'finish'; finishReason: string; usage: StreamUsage; providerMetadata?: Record<string, unknown> }
  | { type: 'error'; error: unknown }
  | { type: string; [key: string]: unknown };

/**
 * Token usage reported in the stream finish event.
 */
export interface StreamUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

/**
 * Options passed to the wrapStream hook by the Vercel AI SDK.
 */
export interface WrapStreamOptions {
  doStream: () => PromiseLike<StreamResult>;
  params: Record<string, unknown>;
  model?: { modelId?: string; provider?: string };
}

/**
 * Creates a wrapStream hook function bound to the given GovernanceOrchestrator.
 *
 * The returned function follows the Vercel AI SDK `wrapStream` signature:
 * receives `{ doStream, params, model }` and returns a stream result.
 *
 * Logic flow:
 * 1. Record start time
 * 2. Extract provider, get/generate correlation ID
 * 3. Call orchestrator.ensureInitialized()
 * 4. Check circuit: throw CircuitOpenError if OPEN
 * 5. Evaluate policy: if DENY, throw PolicyViolationError
 * 6. Call doStream() to get the stream
 * 7. Wrap the stream to accumulate text, evaluate guardrails on finish,
 *    record cost, report to circuit, and emit audit
 * 8. Return the wrapped stream result
 *
 * @param orchestrator - The GovernanceOrchestrator instance to delegate to
 * @returns A wrapStream hook function
 */
export function createWrapStreamHook(
  orchestrator: GovernanceOrchestrator,
): (options: WrapStreamOptions) => Promise<StreamResult> {
  return async function wrapStream(options: WrapStreamOptions): Promise<StreamResult> {
    const { doStream, params, model } = options;
    const startTime = Date.now();

    // Extract model ID and provider
    const modelId = model?.modelId
      ?? (params.modelId as string | undefined)
      ?? (params.model as string | undefined)
      ?? 'unknown';
    const provider = model?.provider
      ?? GovernanceOrchestrator.extractProvider(modelId);

    // Generate or extract correlation ID
    const correlationId = (params.correlationId as string | undefined)
      ?? (params.headers as Record<string, string> | undefined)?.['x-correlation-id']
      ?? generateCorrelationId();

    // Step 1: Ensure orchestrator is initialized
    await orchestrator.ensureInitialized();

    // Step 2: Check circuit breaker state — throws CircuitOpenError if OPEN
    orchestrator.checkCircuit(provider);

    // Step 3: Evaluate policy — throws PolicyViolationError if DENY
    const policyDecision = await orchestrator.evaluatePolicy(
      { ...params, model: modelId, provider },
      correlationId,
    );

    if (policyDecision.action === 'DENY') {
      // Emit audit for denied request
      const duration = Date.now() - startTime;
      emitStreamAudit(orchestrator, {
        correlationId,
        modelId,
        provider,
        decision: policyDecision,
        duration,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      });

      throw new PolicyViolationError(
        policyDecision.reason || 'Policy denies streaming request',
        policyDecision,
      );
    }

    // Step 4: Call doStream() to get the underlying stream
    let streamResult: StreamResult;
    try {
      streamResult = await doStream();
    } catch (error) {
      // Provider error during stream initiation
      orchestrator.reportOutcome(provider, false);

      const duration = Date.now() - startTime;
      emitStreamAudit(orchestrator, {
        correlationId,
        modelId,
        provider,
        decision: policyDecision,
        duration,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    }

    // Step 5: Wrap the stream to accumulate text and perform post-stream governance
    const accumulatedText: string[] = [];
    let streamUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let streamError: Error | null = null;

    const transformStream = new TransformStream<StreamChunk, StreamChunk>({
      transform(chunk, controller) {
        // Accumulate text deltas for output guardrail evaluation
        if (chunk.type === 'text-delta' && 'textDelta' in chunk) {
          accumulatedText.push(chunk.textDelta);
        }

        // Capture usage from finish event
        if (chunk.type === 'finish' && 'usage' in chunk && chunk.usage) {
          const usage = chunk.usage as StreamUsage;
          streamUsage = {
            inputTokens: usage.promptTokens ?? 0,
            outputTokens: usage.completionTokens ?? 0,
            totalTokens: usage.totalTokens ?? ((usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)),
          };
        }

        // Capture errors
        if (chunk.type === 'error' && 'error' in chunk) {
          streamError = chunk.error instanceof Error
            ? chunk.error
            : new Error(String(chunk.error));
        }

        // Pass through all chunks unmodified
        controller.enqueue(chunk);
      },

      async flush(controller) {
        const duration = Date.now() - startTime;

        // Handle mid-stream errors
        if (streamError) {
          orchestrator.reportOutcome(provider, false);
          emitStreamAudit(orchestrator, {
            correlationId,
            modelId,
            provider,
            decision: policyDecision,
            duration,
            usage: streamUsage,
            error: streamError,
          });
          return;
        }

        // Stream completed successfully
        // Evaluate output guardrails on accumulated text
        const fullText = accumulatedText.join('');
        let outputDecision = policyDecision;
        let failedGuardrails: string[] | undefined;

        if (fullText.length > 0) {
          try {
            outputDecision = await orchestrator.evaluateOutput(fullText, correlationId);

            if (outputDecision.action === 'DENY') {
              failedGuardrails = outputDecision.reason_codes.filter(
                (code) => code !== 'POLICY_COMPLIANT',
              );

              // Emit audit entry indicating output guardrail violation
              emitStreamAudit(orchestrator, {
                correlationId,
                modelId,
                provider,
                decision: outputDecision,
                duration,
                usage: streamUsage,
                failedGuardrails,
              });

              // Report success to circuit (the provider worked, guardrail failed)
              orchestrator.reportOutcome(provider, true);

              // Record cost even when guardrails fail — the tokens were consumed
              orchestrator.recordCost(modelId, streamUsage);
              return;
            }
          } catch (error) {
            // Output guardrail evaluation failed — treat as governance error
            // Still report success to circuit (provider responded)
            orchestrator.reportOutcome(provider, true);
            orchestrator.recordCost(modelId, streamUsage);

            emitStreamAudit(orchestrator, {
              correlationId,
              modelId,
              provider,
              decision: policyDecision,
              duration,
              usage: streamUsage,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            return;
          }
        }

        // Success path: report to circuit, record cost, emit audit
        orchestrator.reportOutcome(provider, true);
        orchestrator.recordCost(modelId, streamUsage);

        emitStreamAudit(orchestrator, {
          correlationId,
          modelId,
          provider,
          decision: outputDecision,
          duration,
          usage: streamUsage,
        });
      },
    });

    // Pipe the original stream through the transform
    const wrappedStream = streamResult.stream.pipeThrough(transformStream);

    // Return the modified stream result
    return {
      ...streamResult,
      stream: wrappedStream,
    };
  };
}

// ── Internal Helpers ─────────────────────────────────────────────

/**
 * Generate a UUID v4 correlation ID.
 */
function generateCorrelationId(): string {
  // Use crypto.randomUUID if available (Node 19+, modern browsers)
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: simple UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Emit an audit entry for the wrapStream hook.
 */
function emitStreamAudit(
  orchestrator: GovernanceOrchestrator,
  context: {
    correlationId: string;
    modelId: string;
    provider: string;
    decision: { action: string; reason_codes: string[]; risk_score: number };
    duration: number;
    usage: TokenUsage;
    error?: Error;
    failedGuardrails?: string[];
  },
): void {
  const entry: AuditEntry = {
    schema_version: '1.0.0',
    correlation_id: context.correlationId,
    timestamp: new Date().toISOString(),
    action: context.decision.action,
    reason_codes: context.decision.reason_codes,
    risk_score: context.decision.risk_score,
    model: context.modelId,
    tokens: {
      input: context.usage.inputTokens,
      output: context.usage.outputTokens,
      total: context.usage.totalTokens,
    },
    duration_ms: context.duration,
    hook: 'wrapStream',
    provider: context.provider,
  };

  if (context.error) {
    entry.error = {
      message: context.error.message,
      code: (context.error as { code?: string }).code,
    };
  }

  if (context.failedGuardrails && context.failedGuardrails.length > 0) {
    entry.failed_guardrails = context.failedGuardrails;
  }

  orchestrator.emitAudit(entry);
}
