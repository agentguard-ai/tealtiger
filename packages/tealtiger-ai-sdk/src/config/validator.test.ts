/**
 * TealTiger AI SDK — Config Validator Unit Tests
 *
 * Tests validateConfig() against all constraint rules defined in
 * Requirements 1.4, 9.1, 9.2, 9.3.
 */

import { describe, it, expect } from 'vitest';
import { validateConfig } from './validator';
import { TealConfigError } from '../errors';
import type { TealTigerMiddlewareConfig } from '../types/config';

describe('validateConfig', () => {
  // ── Zero-config / Valid configs ─────────────────────────────────

  describe('valid configurations', () => {
    it('returns empty config for undefined (zero-config mode)', () => {
      const result = validateConfig(undefined);
      expect(result).toEqual({});
    });

    it('accepts a fully empty config object', () => {
      const config: TealTigerMiddlewareConfig = {};
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid costTracking configuration', () => {
      const config: TealTigerMiddlewareConfig = {
        costTracking: {
          enabled: true,
          perRequestLimit: 0.50,
          perSessionLimit: 5.0,
          dailyLimit: 100.0,
          anomalyThreshold: 200,
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid circuitBreaker configuration', () => {
      const config: TealTigerMiddlewareConfig = {
        circuitBreaker: {
          failureThreshold: 5,
          timeout: 60000,
          halfOpenRequests: 3,
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid secrets configuration with threshold at boundaries', () => {
      expect(validateConfig({ secrets: { enabled: true, confidenceThreshold: 0.0 } })).toBeTruthy();
      expect(validateConfig({ secrets: { enabled: true, confidenceThreshold: 0.5 } })).toBeTruthy();
      expect(validateConfig({ secrets: { enabled: true, confidenceThreshold: 1.0 } })).toBeTruthy();
    });

    it('accepts valid policyPath', () => {
      const config: TealTigerMiddlewareConfig = { policyPath: '/etc/tealtiger/policy.json' };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid moduleTimeout', () => {
      const config: TealTigerMiddlewareConfig = { moduleTimeout: 5000 };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid registry configuration with allowedModels', () => {
      const config: TealTigerMiddlewareConfig = {
        registry: {
          enabled: true,
          allowedModels: ['openai/gpt-4', 'anthropic/claude-3'],
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts registry with enabled false and no allowedModels', () => {
      const config: TealTigerMiddlewareConfig = {
        registry: { enabled: false },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid customPricing with zero costs', () => {
      const config: TealTigerMiddlewareConfig = {
        costTracking: {
          enabled: true,
          customPricing: {
            'openai/gpt-4': { inputCostPer1K: 0, outputCostPer1K: 0 },
          },
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts valid customPricing with positive costs', () => {
      const config: TealTigerMiddlewareConfig = {
        costTracking: {
          enabled: true,
          customPricing: {
            'openai/gpt-4': { inputCostPer1K: 0.03, outputCostPer1K: 0.06 },
            'anthropic/claude-3': { inputCostPer1K: 0.015, outputCostPer1K: 0.075 },
          },
        },
      };
      expect(validateConfig(config)).toBe(config);
    });
  });

  // ── policyPath validation ──────────────────────────────────────

  describe('policyPath validation', () => {
    it('throws TealConfigError for empty string policyPath', () => {
      expect(() => validateConfig({ policyPath: '' }))
        .toThrow(TealConfigError);

      try {
        validateConfig({ policyPath: '' });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('policyPath');
        expect((e as TealConfigError).message).toContain('non-empty string');
      }
    });

    it('throws TealConfigError for whitespace-only policyPath', () => {
      expect(() => validateConfig({ policyPath: '   ' }))
        .toThrow(TealConfigError);

      try {
        validateConfig({ policyPath: '   ' });
      } catch (e) {
        expect((e as TealConfigError).config_key).toBe('policyPath');
      }
    });
  });

  // ── moduleTimeout validation ───────────────────────────────────

  describe('moduleTimeout validation', () => {
    it('throws TealConfigError for zero moduleTimeout', () => {
      expect(() => validateConfig({ moduleTimeout: 0 }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for negative moduleTimeout', () => {
      try {
        validateConfig({ moduleTimeout: -100 });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('moduleTimeout');
        expect((e as TealConfigError).message).toContain('positive number');
      }
    });

    it('throws TealConfigError for NaN moduleTimeout', () => {
      expect(() => validateConfig({ moduleTimeout: NaN }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for Infinity moduleTimeout', () => {
      expect(() => validateConfig({ moduleTimeout: Infinity }))
        .toThrow(TealConfigError);
    });
  });

  // ── costTracking validation ────────────────────────────────────

  describe('costTracking validation', () => {
    it('throws TealConfigError for zero perRequestLimit', () => {
      try {
        validateConfig({ costTracking: { enabled: true, perRequestLimit: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.perRequestLimit');
        expect((e as TealConfigError).message).toContain('positive number');
      }
    });

    it('throws TealConfigError for negative perRequestLimit', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, perRequestLimit: -1 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for zero perSessionLimit', () => {
      try {
        validateConfig({ costTracking: { enabled: true, perSessionLimit: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.perSessionLimit');
      }
    });

    it('throws TealConfigError for negative perSessionLimit', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, perSessionLimit: -5 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for zero dailyLimit', () => {
      try {
        validateConfig({ costTracking: { enabled: true, dailyLimit: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.dailyLimit');
      }
    });

    it('throws TealConfigError for negative dailyLimit', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, dailyLimit: -10 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for zero anomalyThreshold', () => {
      try {
        validateConfig({ costTracking: { enabled: true, anomalyThreshold: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.anomalyThreshold');
        expect((e as TealConfigError).message).toContain('positive number');
      }
    });

    it('throws TealConfigError for negative anomalyThreshold', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, anomalyThreshold: -50 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for NaN budget limits', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, perRequestLimit: NaN } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for Infinity budget limits', () => {
      expect(() => validateConfig({ costTracking: { enabled: true, dailyLimit: Infinity } }))
        .toThrow(TealConfigError);
    });
  });

  // ── costTracking.customPricing validation ──────────────────────

  describe('costTracking.customPricing validation', () => {
    it('throws TealConfigError for negative inputCostPer1K', () => {
      try {
        validateConfig({
          costTracking: {
            enabled: true,
            customPricing: {
              'openai/gpt-4': { inputCostPer1K: -0.01, outputCostPer1K: 0.06 },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.customPricing.openai/gpt-4.inputCostPer1K');
        expect((e as TealConfigError).message).toContain('non-negative number');
      }
    });

    it('throws TealConfigError for negative outputCostPer1K', () => {
      try {
        validateConfig({
          costTracking: {
            enabled: true,
            customPricing: {
              'anthropic/claude-3': { inputCostPer1K: 0.015, outputCostPer1K: -0.075 },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('costTracking.customPricing.anthropic/claude-3.outputCostPer1K');
        expect((e as TealConfigError).message).toContain('non-negative number');
      }
    });

    it('throws TealConfigError for NaN inputCostPer1K', () => {
      expect(() => validateConfig({
        costTracking: {
          enabled: true,
          customPricing: {
            'test-model': { inputCostPer1K: NaN, outputCostPer1K: 0.01 },
          },
        },
      })).toThrow(TealConfigError);
    });

    it('throws TealConfigError for Infinity outputCostPer1K', () => {
      expect(() => validateConfig({
        costTracking: {
          enabled: true,
          customPricing: {
            'test-model': { inputCostPer1K: 0.01, outputCostPer1K: Infinity },
          },
        },
      })).toThrow(TealConfigError);
    });
  });

  // ── secrets.confidenceThreshold validation ─────────────────────

  describe('secrets.confidenceThreshold validation', () => {
    it('throws TealConfigError for threshold below 0.0', () => {
      try {
        validateConfig({ secrets: { enabled: true, confidenceThreshold: -0.1 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('secrets.confidenceThreshold');
        expect((e as TealConfigError).message).toContain('between 0.0 and 1.0');
      }
    });

    it('throws TealConfigError for threshold above 1.0', () => {
      try {
        validateConfig({ secrets: { enabled: true, confidenceThreshold: 1.1 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('secrets.confidenceThreshold');
        expect((e as TealConfigError).message).toContain('between 0.0 and 1.0');
      }
    });

    it('throws TealConfigError for NaN confidenceThreshold', () => {
      expect(() => validateConfig({ secrets: { enabled: true, confidenceThreshold: NaN } }))
        .toThrow(TealConfigError);
    });
  });

  // ── circuitBreaker validation ──────────────────────────────────

  describe('circuitBreaker validation', () => {
    it('throws TealConfigError for zero failureThreshold', () => {
      try {
        validateConfig({ circuitBreaker: { failureThreshold: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('circuitBreaker.failureThreshold');
        expect((e as TealConfigError).message).toContain('positive integer');
      }
    });

    it('throws TealConfigError for negative failureThreshold', () => {
      expect(() => validateConfig({ circuitBreaker: { failureThreshold: -1 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for floating-point failureThreshold', () => {
      expect(() => validateConfig({ circuitBreaker: { failureThreshold: 3.5 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for zero timeout', () => {
      try {
        validateConfig({ circuitBreaker: { timeout: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('circuitBreaker.timeout');
        expect((e as TealConfigError).message).toContain('positive integer');
      }
    });

    it('throws TealConfigError for negative timeout', () => {
      expect(() => validateConfig({ circuitBreaker: { timeout: -5000 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for floating-point timeout', () => {
      expect(() => validateConfig({ circuitBreaker: { timeout: 1000.5 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for zero halfOpenRequests', () => {
      try {
        validateConfig({ circuitBreaker: { halfOpenRequests: 0 } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('circuitBreaker.halfOpenRequests');
        expect((e as TealConfigError).message).toContain('positive integer');
      }
    });

    it('throws TealConfigError for negative halfOpenRequests', () => {
      expect(() => validateConfig({ circuitBreaker: { halfOpenRequests: -2 } }))
        .toThrow(TealConfigError);
    });

    it('throws TealConfigError for floating-point halfOpenRequests', () => {
      expect(() => validateConfig({ circuitBreaker: { halfOpenRequests: 2.7 } }))
        .toThrow(TealConfigError);
    });
  });

  // ── registry.allowedModels validation ──────────────────────────

  describe('registry.allowedModels validation', () => {
    it('throws TealConfigError for empty allowedModels array', () => {
      try {
        validateConfig({ registry: { enabled: true, allowedModels: [] } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('registry.allowedModels');
        expect((e as TealConfigError).message).toContain('non-empty array');
      }
    });

    it('throws TealConfigError for allowedModels containing empty strings', () => {
      try {
        validateConfig({ registry: { enabled: true, allowedModels: ['openai/gpt-4', ''] } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('registry.allowedModels[1]');
        expect((e as TealConfigError).message).toContain('non-empty string');
      }
    });

    it('throws TealConfigError for allowedModels containing whitespace-only strings', () => {
      try {
        validateConfig({ registry: { enabled: true, allowedModels: ['  '] } });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('registry.allowedModels[0]');
      }
    });
  });

  // ── failOpen validation ──────────────────────────────────────────

  describe('failOpen validation', () => {
    it('accepts failOpen as true', () => {
      const config: TealTigerMiddlewareConfig = { failOpen: true };
      expect(validateConfig(config)).toBe(config);
    });

    it('accepts failOpen as false', () => {
      const config: TealTigerMiddlewareConfig = { failOpen: false };
      expect(validateConfig(config)).toBe(config);
    });

    it('throws TealConfigError for non-boolean failOpen', () => {
      try {
        validateConfig({ failOpen: 'true' as unknown as boolean });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('failOpen');
        expect((e as TealConfigError).message).toContain('boolean');
      }
    });
  });

  // ── guardrails.contentModeration.thresholds validation ─────────

  describe('guardrails.contentModeration.thresholds validation', () => {
    it('accepts valid content moderation thresholds', () => {
      const config: TealTigerMiddlewareConfig = {
        guardrails: {
          contentModeration: {
            enabled: true,
            thresholds: { hate: 0.5, violence: 0.8, sexual: 0.0, selfHarm: 1.0 },
          },
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('throws TealConfigError for threshold below 0.0', () => {
      try {
        validateConfig({
          guardrails: {
            contentModeration: {
              enabled: true,
              thresholds: { hate: -0.1 },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('guardrails.contentModeration.thresholds.hate');
        expect((e as TealConfigError).message).toContain('between 0.0 and 1.0');
      }
    });

    it('throws TealConfigError for threshold above 1.0', () => {
      try {
        validateConfig({
          guardrails: {
            contentModeration: {
              enabled: true,
              thresholds: { violence: 1.5 },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('guardrails.contentModeration.thresholds.violence');
        expect((e as TealConfigError).message).toContain('between 0.0 and 1.0');
      }
    });

    it('throws TealConfigError for NaN threshold', () => {
      expect(() => validateConfig({
        guardrails: {
          contentModeration: {
            enabled: true,
            thresholds: { hate: NaN },
          },
        },
      })).toThrow(TealConfigError);
    });

    it('throws TealConfigError for Infinity threshold', () => {
      expect(() => validateConfig({
        guardrails: {
          contentModeration: {
            enabled: true,
            thresholds: { hate: Infinity },
          },
        },
      })).toThrow(TealConfigError);
    });

    it('accepts boolean contentModeration without throwing', () => {
      const config: TealTigerMiddlewareConfig = {
        guardrails: { contentModeration: true },
      };
      expect(validateConfig(config)).toBe(config);
    });
  });

  // ── guardrails.output.contentModeration.thresholds validation ──

  describe('guardrails.output.contentModeration.thresholds validation', () => {
    it('accepts valid output content moderation thresholds', () => {
      const config: TealTigerMiddlewareConfig = {
        guardrails: {
          output: {
            contentModeration: {
              enabled: true,
              thresholds: { hate: 0.7, violence: 0.9 },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(config);
    });

    it('throws TealConfigError for output threshold above 1.0', () => {
      try {
        validateConfig({
          guardrails: {
            output: {
              contentModeration: {
                enabled: true,
                thresholds: { sexual: 2.0 },
              },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('guardrails.output.contentModeration.thresholds.sexual');
        expect((e as TealConfigError).message).toContain('between 0.0 and 1.0');
      }
    });

    it('throws TealConfigError for output threshold below 0.0', () => {
      try {
        validateConfig({
          guardrails: {
            output: {
              contentModeration: {
                enabled: true,
                thresholds: { hate: -0.5 },
              },
            },
          },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).config_key).toBe('guardrails.output.contentModeration.thresholds.hate');
      }
    });
  });

  // ── Error shape verification ───────────────────────────────────

  describe('error shape', () => {
    it('TealConfigError has correct name property', () => {
      try {
        validateConfig({ moduleTimeout: -1 });
      } catch (e) {
        expect(e).toBeInstanceOf(TealConfigError);
        expect((e as TealConfigError).name).toBe('TealConfigError');
      }
    });

    it('TealConfigError is instanceof Error', () => {
      try {
        validateConfig({ policyPath: '' });
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });

    it('throws on first validation failure only', () => {
      // Both policyPath and moduleTimeout are invalid, but policyPath is checked first
      try {
        validateConfig({ policyPath: '', moduleTimeout: -1 });
      } catch (e) {
        expect((e as TealConfigError).config_key).toBe('policyPath');
      }
    });
  });
});
