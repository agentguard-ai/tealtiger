/**
 * TealTiger AI SDK — Middleware Factory
 *
 * Creates a LanguageModelV3Middleware-compliant object that can be passed
 * to `wrapLanguageModel` from the Vercel AI SDK.
 *
 * Responsibilities:
 * - Validate configuration synchronously (throw TealConfigError on failure)
 * - Load and parse policy file if `policyPath` is provided
 * - Instantiate GovernanceOrchestrator with validated config
 * - Return middleware object with transformParams, wrapGenerate, wrapStream hooks
 *
 * @module factory
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TealTigerMiddlewareConfig, PolicyConfig, PolicyRule } from './types/config';
import { TealConfigError } from './errors';
import { validateConfig } from './config/validator';
import { GovernanceOrchestrator } from './core/GovernanceOrchestrator';
import { createTransformParamsHook } from './hooks/transformParams';
import { createWrapGenerateHook } from './hooks/wrapGenerate';
import { createWrapStreamHook } from './hooks/wrapStream';

/**
 * The LanguageModelV3Middleware interface shape from @ai-sdk/provider.
 * Defined locally to avoid hard runtime coupling to the types package
 * while maintaining structural compatibility.
 */
export interface LanguageModelV3Middleware {
  transformParams?: (options: {
    params: Record<string, unknown>;
  }) => PromiseLike<Record<string, unknown>> | Record<string, unknown>;
  wrapGenerate?: (options: {
    doGenerate: () => PromiseLike<unknown>;
    params: Record<string, unknown>;
    model?: { modelId?: string };
  }) => PromiseLike<unknown>;
  wrapStream?: (options: {
    doStream: () => PromiseLike<unknown>;
    params: Record<string, unknown>;
    model?: { modelId?: string; provider?: string };
  }) => PromiseLike<unknown>;
}

/**
 * Loads and parses a policy file from the given path.
 *
 * @param policyPath - Path to the policy JSON file
 * @returns The parsed PolicyConfig object
 * @throws TealConfigError if the file is not found, unreadable, or has invalid syntax
 */
function loadPolicyFile(policyPath: string): PolicyConfig {
  const resolvedPath = resolve(policyPath);

  // Attempt to read the file
  let fileContent: string;
  try {
    fileContent = readFileSync(resolvedPath, 'utf-8');
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new TealConfigError(
        `Policy file not found: ${resolvedPath}`,
        'policyPath',
      );
    }
    throw new TealConfigError(
      `Policy file unreadable: ${resolvedPath} (${err.message})`,
      'policyPath',
    );
  }

  // Attempt to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (error: unknown) {
    const err = error as SyntaxError;
    throw new TealConfigError(
      `Invalid policy syntax in ${resolvedPath}: ${err.message}`,
      'policyPath',
    );
  }

  // Basic structure validation
  if (parsed === null || typeof parsed !== 'object') {
    throw new TealConfigError(
      `Invalid policy syntax in ${resolvedPath}: policy must be a JSON object`,
      'policyPath',
    );
  }

  const policyObj = parsed as Record<string, unknown>;

  // Validate rules array structure if present
  if (policyObj.rules !== undefined) {
    if (!Array.isArray(policyObj.rules)) {
      throw new TealConfigError(
        `Invalid policy syntax in ${resolvedPath}: 'rules' must be an array`,
        'policyPath',
      );
    }

    for (let i = 0; i < policyObj.rules.length; i++) {
      const rule = policyObj.rules[i] as Record<string, unknown>;
      if (rule === null || typeof rule !== 'object') {
        throw new TealConfigError(
          `Invalid policy syntax in ${resolvedPath}: rules[${i}] must be an object`,
          'policyPath',
        );
      }
      if (typeof rule.id !== 'string' || rule.id.trim() === '') {
        throw new TealConfigError(
          `Invalid policy syntax in ${resolvedPath}: rules[${i}].id must be a non-empty string`,
          'policyPath',
        );
      }
      if (typeof rule.name !== 'string' || rule.name.trim() === '') {
        throw new TealConfigError(
          `Invalid policy syntax in ${resolvedPath}: rules[${i}].name must be a non-empty string`,
          'policyPath',
        );
      }
      if (typeof rule.condition !== 'string') {
        throw new TealConfigError(
          `Invalid policy syntax in ${resolvedPath}: rules[${i}].condition must be a string`,
          'policyPath',
        );
      }
      const validActions = ['ALLOW', 'DENY', 'REDACT', 'TRANSFORM', 'REQUIRE_APPROVAL', 'DEGRADE'];
      if (typeof rule.action !== 'string' || !validActions.includes(rule.action)) {
        throw new TealConfigError(
          `Invalid policy syntax in ${resolvedPath}: rules[${i}].action must be one of ${validActions.join(', ')}`,
          'policyPath',
        );
      }
    }
  }

  // Build the PolicyConfig from the parsed file
  const policyConfig: PolicyConfig = {};

  if (typeof policyObj.mode === 'string') {
    policyConfig.mode = policyObj.mode as PolicyConfig['mode'];
  }
  if (typeof policyObj.policyId === 'string') {
    policyConfig.policyId = policyObj.policyId;
  }
  if (typeof policyObj.policyVersion === 'string') {
    policyConfig.policyVersion = policyObj.policyVersion;
  }
  if (typeof policyObj.environment === 'string') {
    policyConfig.environment = policyObj.environment;
  }
  if (Array.isArray(policyObj.rules)) {
    policyConfig.rules = policyObj.rules as PolicyRule[];
  }

  return policyConfig;
}

/**
 * Creates a TealTiger governance middleware for the Vercel AI SDK.
 *
 * @param config - Optional configuration. Omit for zero-config defaults
 *   (PII detection, prompt injection detection, content moderation enabled).
 * @returns A LanguageModelV3Middleware-compliant object.
 * @throws TealConfigError if configuration validation fails.
 * @throws TealConfigError if policyPath is specified but the file cannot be loaded.
 *
 * @example
 * ```typescript
 * import { wrapLanguageModel } from 'ai';
 * import tealtigerMiddleware from 'tealtiger-ai-sdk';
 *
 * // Zero-config: default guardrails enabled
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4'),
 *   middleware: tealtigerMiddleware(),
 * });
 *
 * // With custom configuration
 * const governedModel = wrapLanguageModel({
 *   model: openai('gpt-4'),
 *   middleware: tealtigerMiddleware({
 *     guardrails: { pii: true, promptInjection: true },
 *     costTracking: { enabled: true, dailyLimit: 10.0 },
 *     audit: { enabled: true },
 *   }),
 * });
 * ```
 */
export function tealtigerMiddleware(
  config?: TealTigerMiddlewareConfig,
): LanguageModelV3Middleware {
  // Step 1: Validate configuration synchronously (throws TealConfigError on failure)
  const validatedConfig = validateConfig(config);

  // Step 2: Load policy file if policyPath is provided
  if (validatedConfig.policyPath) {
    const filePolicy = loadPolicyFile(validatedConfig.policyPath);

    // Merge file policy into config (file policy provides defaults, inline overrides)
    validatedConfig.policy = {
      ...filePolicy,
      ...validatedConfig.policy,
      // If both have rules, combine them (inline rules take priority by appearing last)
      rules: [
        ...(filePolicy.rules ?? []),
        ...(validatedConfig.policy?.rules ?? []),
      ].length > 0
        ? [...(filePolicy.rules ?? []), ...(validatedConfig.policy?.rules ?? [])]
        : undefined,
    };
  }

  // Step 3: Instantiate GovernanceOrchestrator with validated config
  const orchestrator = new GovernanceOrchestrator(validatedConfig);

  // Step 4: Return LanguageModelV3Middleware-compliant object
  return {
    transformParams: createTransformParamsHook(orchestrator),
    wrapGenerate: createWrapGenerateHook(orchestrator) as LanguageModelV3Middleware['wrapGenerate'],
    wrapStream: createWrapStreamHook(orchestrator) as LanguageModelV3Middleware['wrapStream'],
  };
}
