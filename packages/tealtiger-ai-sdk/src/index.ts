/**
 * tealtiger-ai-sdk
 *
 * TealTiger governance middleware for the Vercel AI SDK.
 * Provides deterministic policy evaluation, guardrails, cost tracking,
 * circuit breaking, and audit logging for all LLM calls.
 *
 * @example
 * ```typescript
 * import { wrapLanguageModel } from 'ai';
 * import tealtigerMiddleware from 'tealtiger-ai-sdk';
 *
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4'),
 *   middleware: tealtigerMiddleware(),
 * });
 * ```
 *
 * @packageDocumentation
 */

// Configuration types
export type {
  TealTigerMiddlewareConfig,
  GuardrailConfig,
  PiiConfig,
  PromptInjectionConfig,
  ContentModerationConfig,
  OutputGuardrailConfig,
  PolicyConfig,
  PolicyRule,
  CircuitBreakerConfig,
  CostTrackingConfig,
  ModelPricing,
  AuditConfig,
  AuditOutput,
  RedactionConfig,
  SecretsConfig,
  RegistryConfig,
} from './types/config';

// Decision and core types
export type { Decision, DecisionAction, ReasonCode, TokenUsage } from './types/decision';

// Error types
export {
  TealRuntimeError,
  TealConfigError,
  PolicyViolationError,
  GuardrailViolationError,
  CircuitOpenError,
  BudgetExceededError,
} from './errors';

export { FreezeRegistry } from './observe/FreezeRegistry';

// Factory function (default export)
import { tealtigerMiddleware } from './factory';
export { tealtigerMiddleware };
export default tealtigerMiddleware;
