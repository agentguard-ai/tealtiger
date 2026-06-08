/**
 * TealTiger AI SDK — Configuration Validator
 *
 * Validates TealTigerMiddlewareConfig against schema constraints.
 * Throws TealConfigError with field path and constraint description
 * on the first validation failure encountered.
 *
 * @module config/validator
 */

import type { TealTigerMiddlewareConfig } from '../types/config';
import { TealConfigError } from '../errors';

/**
 * Validates the provided configuration and returns it (with defaults applied
 * for undefined/zero-config). Throws TealConfigError on the first invalid field.
 *
 * @param config - Optional middleware configuration to validate
 * @returns The validated configuration (passthrough if valid, default if undefined)
 * @throws TealConfigError with config_key set to the invalid field path
 */
export function validateConfig(
  config?: TealTigerMiddlewareConfig,
): TealTigerMiddlewareConfig {
  // Zero-config: return empty config (defaults applied elsewhere)
  if (config === undefined) {
    return {};
  }

  // Validate top-level fields
  validatePolicyPath(config);
  validateModuleTimeout(config);
  validateFailOpen(config);

  // Validate sub-configs
  validateCostTracking(config);
  validateSecrets(config);
  validateCircuitBreaker(config);
  validateRegistry(config);
  validateGuardrails(config);

  return config;
}

// ── Validators ───────────────────────────────────────────────────

function validateFailOpen(config: TealTigerMiddlewareConfig): void {
  if (config.failOpen !== undefined) {
    if (typeof config.failOpen !== 'boolean') {
      throw new TealConfigError(
        'failOpen must be a boolean',
        'failOpen',
      );
    }
  }
}

function validatePolicyPath(config: TealTigerMiddlewareConfig): void {
  if (config.policyPath !== undefined) {
    if (typeof config.policyPath !== 'string' || config.policyPath.trim() === '') {
      throw new TealConfigError(
        'policyPath must be a non-empty string',
        'policyPath',
      );
    }
  }
}

function validateModuleTimeout(config: TealTigerMiddlewareConfig): void {
  if (config.moduleTimeout !== undefined) {
    if (typeof config.moduleTimeout !== 'number' || !isPositiveNumber(config.moduleTimeout)) {
      throw new TealConfigError(
        'moduleTimeout must be a positive number',
        'moduleTimeout',
      );
    }
  }
}

function validateCostTracking(config: TealTigerMiddlewareConfig): void {
  const ct = config.costTracking;
  if (ct === undefined) return;

  if (ct.perRequestLimit !== undefined) {
    if (!isPositiveNumber(ct.perRequestLimit)) {
      throw new TealConfigError(
        'costTracking.perRequestLimit must be a positive number',
        'costTracking.perRequestLimit',
      );
    }
  }

  if (ct.perSessionLimit !== undefined) {
    if (!isPositiveNumber(ct.perSessionLimit)) {
      throw new TealConfigError(
        'costTracking.perSessionLimit must be a positive number',
        'costTracking.perSessionLimit',
      );
    }
  }

  if (ct.dailyLimit !== undefined) {
    if (!isPositiveNumber(ct.dailyLimit)) {
      throw new TealConfigError(
        'costTracking.dailyLimit must be a positive number',
        'costTracking.dailyLimit',
      );
    }
  }

  if (ct.anomalyThreshold !== undefined) {
    if (!isPositiveNumber(ct.anomalyThreshold)) {
      throw new TealConfigError(
        'costTracking.anomalyThreshold must be a positive number',
        'costTracking.anomalyThreshold',
      );
    }
  }

  if (ct.customPricing !== undefined) {
    for (const [modelId, pricing] of Object.entries(ct.customPricing)) {
      if (pricing.inputCostPer1K === undefined || !isNonNegativeNumber(pricing.inputCostPer1K)) {
        throw new TealConfigError(
          `costTracking.customPricing["${modelId}"].inputCostPer1K must be a non-negative number`,
          `costTracking.customPricing.${modelId}.inputCostPer1K`,
        );
      }
      if (pricing.outputCostPer1K === undefined || !isNonNegativeNumber(pricing.outputCostPer1K)) {
        throw new TealConfigError(
          `costTracking.customPricing["${modelId}"].outputCostPer1K must be a non-negative number`,
          `costTracking.customPricing.${modelId}.outputCostPer1K`,
        );
      }
    }
  }
}

function validateSecrets(config: TealTigerMiddlewareConfig): void {
  const s = config.secrets;
  if (s === undefined) return;

  if (s.confidenceThreshold !== undefined) {
    if (
      typeof s.confidenceThreshold !== 'number' ||
      !isFinite(s.confidenceThreshold) ||
      s.confidenceThreshold < 0.0 ||
      s.confidenceThreshold > 1.0
    ) {
      throw new TealConfigError(
        'secrets.confidenceThreshold must be a number between 0.0 and 1.0',
        'secrets.confidenceThreshold',
      );
    }
  }
}

function validateCircuitBreaker(config: TealTigerMiddlewareConfig): void {
  const cb = config.circuitBreaker;
  if (cb === undefined) return;

  if (cb.failureThreshold !== undefined) {
    if (!isPositiveInteger(cb.failureThreshold)) {
      throw new TealConfigError(
        'circuitBreaker.failureThreshold must be a positive integer',
        'circuitBreaker.failureThreshold',
      );
    }
  }

  if (cb.timeout !== undefined) {
    if (!isPositiveInteger(cb.timeout)) {
      throw new TealConfigError(
        'circuitBreaker.timeout must be a positive integer',
        'circuitBreaker.timeout',
      );
    }
  }

  if (cb.halfOpenRequests !== undefined) {
    if (!isPositiveInteger(cb.halfOpenRequests)) {
      throw new TealConfigError(
        'circuitBreaker.halfOpenRequests must be a positive integer',
        'circuitBreaker.halfOpenRequests',
      );
    }
  }
}

function validateRegistry(config: TealTigerMiddlewareConfig): void {
  const r = config.registry;
  if (r === undefined) return;

  if (r.allowedModels !== undefined) {
    if (!Array.isArray(r.allowedModels) || r.allowedModels.length === 0) {
      throw new TealConfigError(
        'registry.allowedModels must be a non-empty array of strings if provided',
        'registry.allowedModels',
      );
    }
    for (let i = 0; i < r.allowedModels.length; i++) {
      if (typeof r.allowedModels[i] !== 'string' || r.allowedModels[i].trim() === '') {
        throw new TealConfigError(
          `registry.allowedModels[${i}] must be a non-empty string`,
          `registry.allowedModels[${i}]`,
        );
      }
    }
  }
}

function validateGuardrails(config: TealTigerMiddlewareConfig): void {
  const g = config.guardrails;
  if (g === undefined) return;

  // Validate content moderation thresholds (input)
  if (g.contentModeration !== undefined && typeof g.contentModeration === 'object') {
    validateContentModerationThresholds(
      g.contentModeration.thresholds,
      'guardrails.contentModeration.thresholds',
    );
  }

  // Validate output content moderation thresholds
  if (g.output?.contentModeration !== undefined && typeof g.output.contentModeration === 'object') {
    validateContentModerationThresholds(
      g.output.contentModeration.thresholds,
      'guardrails.output.contentModeration.thresholds',
    );
  }
}

function validateContentModerationThresholds(
  thresholds: Record<string, number> | undefined,
  basePath: string,
): void {
  if (thresholds === undefined) return;

  for (const [category, value] of Object.entries(thresholds)) {
    if (
      typeof value !== 'number' ||
      !isFinite(value) ||
      value < 0.0 ||
      value > 1.0
    ) {
      throw new TealConfigError(
        `${basePath}["${category}"] must be a number between 0.0 and 1.0`,
        `${basePath}.${category}`,
      );
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
