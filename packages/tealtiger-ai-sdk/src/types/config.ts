/**
 * TealTiger AI SDK — Configuration Types
 *
 * All configuration interfaces are JSON-serializable (no functions, no class instances).
 * This enables configuration stored in JSON files (via `policyPath`), environment-loaded
 * objects, and round-trip serialization: JSON.parse(JSON.stringify(config)) produces
 * an equivalent config.
 *
 * @module types/config
 */

// ── Top-Level Configuration ──────────────────────────────────────

/**
 * Root configuration for the TealTiger middleware factory.
 *
 * All fields are optional — omitting config entirely activates zero-config mode
 * with PII detection, prompt injection detection, and content moderation enabled.
 */
export interface TealTigerMiddlewareConfig {
  /** TealGuard guardrail configuration */
  guardrails?: GuardrailConfig;

  /** TealEngine policy evaluation configuration */
  policy?: PolicyConfig;

  /** TealCircuit circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Cost tracking and budget configuration */
  costTracking?: CostTrackingConfig;

  /** TealAudit audit logging configuration */
  audit?: AuditConfig;

  /** TealSecrets secret detection configuration */
  secrets?: SecretsConfig;

  /** TealRegistry model/tool allowlisting */
  registry?: RegistryConfig;

  /** Fail-open mode (default: false = fail-closed) */
  failOpen?: boolean;

  /** Path to external policy file */
  policyPath?: string;

  /** Per-module timeout in milliseconds (default: 5000) */
  moduleTimeout?: number;
}

// ── Guardrail Configuration ──────────────────────────────────────

/**
 * Configuration for TealGuard guardrails (input and output).
 */
export interface GuardrailConfig {
  /** Enable PII detection (default: true in zero-config) */
  pii?: boolean | PiiConfig;

  /** Enable prompt injection detection (default: true in zero-config) */
  promptInjection?: boolean | PromptInjectionConfig;

  /** Enable content moderation (default: true in zero-config) */
  contentModeration?: boolean | ContentModerationConfig;

  /** Output guardrail configuration */
  output?: OutputGuardrailConfig;
}

/**
 * Detailed PII detection configuration.
 */
export interface PiiConfig {
  /** Enable PII detection (default: true) */
  enabled?: boolean;

  /** Types of PII to detect (e.g., 'email', 'ssn', 'credit_card', 'phone', 'name') */
  detectTypes?: string[];

  /** Action to take on PII detection: 'redact' replaces with placeholder, 'block' denies request */
  action?: 'block' | 'redact' | 'mask' | 'allow';

  /** Custom risk scores per PII type (0-100) */
  riskScores?: Record<string, number>;
}

/**
 * Detailed prompt injection detection configuration.
 */
export interface PromptInjectionConfig {
  /** Enable prompt injection detection (default: true) */
  enabled?: boolean;

  /** Action to take on detection */
  action?: 'block' | 'transform' | 'allow';

  /** Detection sensitivity level */
  sensitivity?: 'low' | 'medium' | 'high';
}

/**
 * Detailed content moderation configuration.
 */
export interface ContentModerationConfig {
  /** Enable content moderation (default: true) */
  enabled?: boolean;

  /** Action to take on detection */
  action?: 'block' | 'transform' | 'allow';

  /** Per-category detection thresholds (0.0-1.0) */
  thresholds?: Record<string, number>;

  /** Custom risk scores per category (0-100) */
  riskScores?: Record<string, number>;
}

/**
 * Configuration for output guardrails applied to model responses.
 */
export interface OutputGuardrailConfig {
  /** Enable content moderation on output */
  contentModeration?: boolean | ContentModerationConfig;

  /** Enable PII detection on output */
  pii?: boolean | PiiConfig;

  /** Custom output guardrail names to enable */
  customGuardrails?: string[];
}

// ── Policy Configuration ─────────────────────────────────────────

/**
 * TealEngine policy evaluation settings.
 * Controls how the governance engine evaluates requests against policies.
 */
export interface PolicyConfig {
  /** Policy evaluation mode */
  mode?: 'ENFORCE' | 'MONITOR' | 'REPORT_ONLY';

  /** Policy identifier */
  policyId?: string;

  /** Policy version string */
  policyVersion?: string;

  /** Inline policy rules (JSON-serializable) */
  rules?: PolicyRule[];

  /** Environment override for mode selection */
  environment?: string;
}

/**
 * A single policy rule definition (JSON-serializable).
 */
export interface PolicyRule {
  /** Rule identifier */
  id: string;

  /** Rule name */
  name: string;

  /** Condition expression (evaluated by TealEngine) */
  condition: string;

  /** Action to take when condition matches */
  action: 'ALLOW' | 'DENY' | 'REDACT' | 'TRANSFORM' | 'REQUIRE_APPROVAL' | 'DEGRADE';

  /** Priority (lower number = higher priority) */
  priority?: number;

  /** Reason code to include in Decision */
  reasonCode?: string;

  /** Additional rule metadata */
  metadata?: Record<string, unknown>;
}

// ── Circuit Breaker Configuration ────────────────────────────────

/**
 * TealCircuit circuit breaker configuration for per-provider failure isolation.
 */
export interface CircuitBreakerConfig {
  /** Consecutive failures before opening (default: 5) */
  failureThreshold?: number;

  /** Time in ms before attempting recovery (default: 60000) */
  timeout?: number;

  /** Successful probes before closing (default: 3) */
  halfOpenRequests?: number;
}

// ── Cost Tracking Configuration ──────────────────────────────────

/**
 * Cost tracking and budget enforcement configuration.
 */
export interface CostTrackingConfig {
  /** Enable cost tracking */
  enabled: boolean;

  /** Per-request budget limit in USD */
  perRequestLimit?: number;

  /** Per-session budget limit in USD */
  perSessionLimit?: number;

  /** Daily budget limit in USD */
  dailyLimit?: number;

  /** Anomaly threshold percentage (e.g., 200 = 2x estimated cost triggers alert) */
  anomalyThreshold?: number;

  /** Custom pricing overrides keyed by model identifier */
  customPricing?: Record<string, ModelPricing>;
}

/**
 * Pricing information for a specific model.
 */
export interface ModelPricing {
  /** Cost per 1,000 input tokens in USD */
  inputCostPer1K: number;

  /** Cost per 1,000 output tokens in USD */
  outputCostPer1K: number;
}

// ── Audit Configuration ──────────────────────────────────────────

/**
 * TealAudit audit logging configuration.
 */
export interface AuditConfig {
  /** Enable audit logging */
  enabled: boolean;

  /** Audit output targets (JSON-serializable descriptors) */
  outputs?: AuditOutput[];

  /** PII redaction strategy for audit logs */
  redaction?: RedactionConfig;

  /** Include OpenTelemetry trace IDs in audit entries */
  includeTraceIds?: boolean;
}

/**
 * JSON-serializable descriptor for an audit output target.
 * Actual output handlers are instantiated internally based on this descriptor.
 */
export interface AuditOutput {
  /** Output type */
  type: 'console' | 'file' | 'webhook' | 'custom';

  /** File path (required for 'file' type) */
  path?: string;

  /** Webhook URL (required for 'webhook' type) */
  url?: string;

  /** Custom output identifier (required for 'custom' type) */
  name?: string;

  /** Additional output-specific options */
  options?: Record<string, unknown>;
}

/**
 * PII redaction strategy for audit logs.
 */
export interface RedactionConfig {
  /** Redaction level for input content */
  inputRedaction?: 'none' | 'hash' | 'mask' | 'remove';

  /** Redaction level for output content */
  outputRedaction?: 'none' | 'hash' | 'mask' | 'remove';

  /** PII categories to always redact */
  alwaysRedactCategories?: string[];

  /** Whether to detect PII before logging (default: true) */
  detectPii?: boolean;
}

// ── Secrets Configuration ────────────────────────────────────────

/**
 * TealSecrets secret detection configuration.
 */
export interface SecretsConfig {
  /** Enable secret detection */
  enabled: boolean;

  /** Confidence threshold (0.0-1.0, default: 0.8) */
  confidenceThreshold?: number;
}

// ── Registry Configuration ───────────────────────────────────────

/**
 * TealRegistry model and tool allowlisting configuration.
 */
export interface RegistryConfig {
  /** Enable model allowlisting */
  enabled: boolean;

  /** Allowed model identifiers (e.g., 'openai/gpt-4', 'anthropic/claude-3') */
  allowedModels?: string[];
}
