/**
 * TealTiger AI SDK — transformParams Hook
 *
 * Pre-request governance hook that intercepts and transforms LLM request
 * parameters before they reach the model provider. Implements the
 * `transformParams` function of the LanguageModelV3Middleware interface.
 *
 * Responsibilities:
 * - Generate UUID v4 correlation ID for request lifecycle tracking
 * - Ensure orchestrator is lazily initialized
 * - Evaluate input content via GovernanceOrchestrator (TealGuard, TealSecrets, TealRegistry)
 * - Return modified params with redacted content on ALLOW/REDACT
 * - Throw PolicyViolationError on DENY
 * - Emit audit entry for the transformParams phase
 *
 * @module hooks/transformParams
 */

import { GovernanceOrchestrator } from '../core/GovernanceOrchestrator';
import type { AuditEntry } from '../core/GovernanceOrchestrator';
import { PolicyViolationError } from '../errors';

/**
 * Message shape within the Vercel AI SDK params.
 * Messages have a `role` and `content` (string or array of parts).
 */
interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface Message {
  role: string;
  content: string | MessagePart[];
  [key: string]: unknown;
}

/**
 * Extract text content from a message's content field.
 * Handles both string content and structured content parts.
 */
function extractTextFromContent(content: string | MessagePart[] | unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n');
  }
  return '';
}

/**
 * Extract all evaluable text content from request params.
 * Combines system messages and user messages for governance evaluation.
 */
function extractContent(params: Record<string, unknown>): string {
  const parts: string[] = [];

  // Extract system message(s)
  if (params.system && typeof params.system === 'string') {
    parts.push(params.system);
  }

  // Extract from prompt/messages array
  const messages = params.prompt as Message[] | undefined;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'user') {
        const text = extractTextFromContent(msg.content);
        if (text) {
          parts.push(text);
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Extract the model identifier from request params.
 * The model ID is typically available as `params.modelId` or derived from the model.
 */
function extractModelId(params: Record<string, unknown>): string {
  if (typeof params.modelId === 'string') {
    return params.modelId;
  }
  if (typeof params.model === 'string') {
    return params.model;
  }
  return 'unknown';
}

/**
 * Replace content in messages with redacted version.
 * Returns a new params object with modified messages.
 */
function replaceContent(
  params: Record<string, unknown>,
  originalContent: string,
  redactedContent: string,
): Record<string, unknown> {
  const newParams = { ...params };

  // Replace in system field if it was part of the content
  if (typeof newParams.system === 'string' && originalContent.includes(newParams.system)) {
    // If the original system text is part of what was evaluated, try to replace
    // We need to figure out which parts were redacted
    // Simple approach: if there's only a system message, replace entirely
    const messages = params.prompt as Message[] | undefined;
    const hasUserMessages = Array.isArray(messages) && messages.some((m) => m.role === 'user');
    if (!hasUserMessages) {
      newParams.system = redactedContent;
      return newParams;
    }
  }

  // Replace content in messages
  if (Array.isArray(newParams.prompt)) {
    const messages = newParams.prompt as Message[];
    const newMessages = messages.map((msg) => {
      if (msg.role === 'system' || msg.role === 'user') {
        if (typeof msg.content === 'string') {
          // For simple string content, check if it appears in original and replace
          const msgText = msg.content;
          if (originalContent.includes(msgText)) {
            // Find the corresponding section in redacted content
            const startIdx = originalContent.indexOf(msgText);
            const endIdx = startIdx + msgText.length;
            const redactedSection = redactedContent.substring(startIdx, endIdx);
            if (redactedSection && redactedSection !== msgText) {
              return { ...msg, content: redactedSection };
            }
          }
        }
      }
      return msg;
    });
    newParams.prompt = newMessages;
  }

  return newParams;
}

/**
 * Creates the transformParams hook function bound to a GovernanceOrchestrator.
 *
 * The returned function follows the LanguageModelV3Middleware `transformParams` signature:
 * receives `{ params }` and returns modified params.
 *
 * @param orchestrator - The GovernanceOrchestrator instance to delegate governance to
 * @returns The transformParams hook function
 */
export function createTransformParamsHook(
  orchestrator: GovernanceOrchestrator,
): (options: { params: Record<string, unknown> }) => Promise<Record<string, unknown>> {
  return async ({ params }: { params: Record<string, unknown> }): Promise<Record<string, unknown>> => {
    const startTime = Date.now();

    // Generate UUID v4 correlation ID for this request lifecycle
    const correlationId = crypto.randomUUID();

    // Ensure governance components are lazily initialized
    await orchestrator.ensureInitialized();

    // Extract content and model from params
    const content = extractContent(params);
    const modelId = extractModelId(params);
    const provider = GovernanceOrchestrator.extractProvider(modelId);

    try {
      // Evaluate input through governance modules
      const result = await orchestrator.evaluateInput(content, modelId, correlationId);

      // Build the output params
      let outputParams: Record<string, unknown>;
      if (result.modified) {
        // Content was modified (PII/secrets redacted) — update params
        outputParams = replaceContent(params, content, result.content);
      } else {
        outputParams = { ...params };
      }

      // Store correlation ID in params metadata for downstream hooks
      outputParams = {
        ...outputParams,
        providerMetadata: {
          ...(outputParams.providerMetadata as Record<string, unknown> | undefined),
          tealtiger: {
            correlationId,
            governanceApplied: true,
            contentModified: result.modified,
          },
        },
      };

      // Emit audit entry for the transformParams phase
      const duration = Date.now() - startTime;
      const auditEntry: AuditEntry = {
        schema_version: '1.0.0',
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        action: result.decision.action,
        reason_codes: result.decision.reason_codes,
        risk_score: result.decision.risk_score,
        model: modelId,
        tokens: { input: 0, output: 0, total: 0 },
        duration_ms: duration,
        hook: 'transformParams',
        provider,
      };
      orchestrator.emitAudit(auditEntry);

      return outputParams;
    } catch (error) {
      // Emit audit entry for the denial
      const duration = Date.now() - startTime;

      if (error instanceof PolicyViolationError) {
        const auditEntry: AuditEntry = {
          schema_version: '1.0.0',
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          action: error.decision.action,
          reason_codes: error.decision.reason_codes,
          risk_score: error.decision.risk_score,
          model: modelId,
          tokens: { input: 0, output: 0, total: 0 },
          duration_ms: duration,
          hook: 'transformParams',
          provider,
          error: {
            message: error.message,
            code: error.code,
          },
        };
        orchestrator.emitAudit(auditEntry);
        throw error;
      }

      // Unexpected error — emit generic audit entry and re-throw
      const auditEntry: AuditEntry = {
        schema_version: '1.0.0',
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        action: 'DENY',
        reason_codes: ['GOVERNANCE_EVALUATION_FAILED'],
        risk_score: 100,
        model: modelId,
        tokens: { input: 0, output: 0, total: 0 },
        duration_ms: duration,
        hook: 'transformParams',
        provider,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'UNEXPECTED_ERROR',
        },
      };
      orchestrator.emitAudit(auditEntry);
      throw error;
    }
  };
}
