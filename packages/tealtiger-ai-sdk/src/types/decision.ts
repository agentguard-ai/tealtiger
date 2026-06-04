/**
 * TealTiger AI SDK — Decision Type
 *
 * Local Decision interface compatible with TealTiger v1.2 Decision contract.
 * This enables the middleware package to be self-contained while remaining
 * structurally compatible with the base SDK's Decision type.
 *
 * When `tealtiger-sdk` is available as a peer dependency at runtime, the
 * Decision objects flowing through the middleware originate from TealEngineV12
 * and are fully compatible with this interface.
 *
 * @module types/decision
 */

/**
 * Decision action returned by governance evaluation.
 */
export type DecisionAction =
  | 'ALLOW'
  | 'DENY'
  | 'REDACT'
  | 'TRANSFORM'
  | 'REQUIRE_APPROVAL'
  | 'DEGRADE';

/**
 * Standardized reason codes explaining why a decision was made.
 * Uses string type for flexibility with custom reason codes from TealEngine.
 */
export type ReasonCode = string;

/**
 * Token usage information from a model response.
 */
export interface TokenUsage {
  /** Number of input/prompt tokens */
  inputTokens: number;

  /** Number of output/completion tokens */
  outputTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;
}

/**
 * Deterministic decision object returned by all policy-enforcing components.
 *
 * This is a structural subset of the full TealTiger v1.2 Decision interface,
 * containing the fields needed by the middleware error types and governance logic.
 */
export interface Decision {
  /** Action to take (ALLOW, DENY, REDACT, etc.) */
  action: DecisionAction;

  /** Non-empty array of reason codes explaining the decision */
  reason_codes: string[];

  /** Risk score between 0 and 100 (inclusive) */
  risk_score: number;

  /** Non-empty correlation ID for request tracing */
  correlation_id: string;

  /** Human-readable reason for the decision */
  reason: string;

  /** Policy ID that was evaluated */
  policy_id?: string;

  /** Policy version */
  policy_version?: string;

  /** Optional trace ID for distributed tracing */
  trace_id?: string;

  /** LLM provider (e.g., 'openai', 'anthropic') */
  provider?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
