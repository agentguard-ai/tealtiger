/**
 * Unit tests for GovernanceOrchestrator — Task 3.1
 *
 * Tests lazy initialization, zero-config defaults, conditional module
 * initialization based on config, and TealRuntimeError on module failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GovernanceOrchestrator } from '../GovernanceOrchestrator';
import { TealRuntimeError } from '../../errors';
import type { TealTigerMiddlewareConfig } from '../../types/config';

// Track whether constructors should throw
let shouldGuardThrow = false;
let shouldEngineThrow = false;
let shouldCostTrackerThrow = false;
let shouldAuditThrow = false;
let shouldSecretsThrow = false;
let shouldRegistryThrow = false;

// Mock the dynamic import of tealtiger-sdk so tests don't need the real SDK
vi.mock('tealtiger-sdk', () => {
  return {
    TealGuard: class MockTealGuard {
      config: unknown;
      constructor(config: unknown) {
        if (shouldGuardThrow) throw new Error('TealGuard init failed');
        this.config = config;
      }
      async check(_input: string) {
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: '',
          reason: 'Mock guard — all clear',
        };
      }
    },
    TealEngineV12: class MockTealEngineV12 {
      config: unknown;
      constructor(config: unknown) {
        if (shouldEngineThrow) throw new Error('TealEngineV12 init failed');
        this.config = config;
      }
      async evaluateV12(_request: Record<string, unknown>, ctx: { correlation_id: string }) {
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: ctx.correlation_id,
          reason: 'Mock engine — policy allows',
        };
      }
    },
    CostTracker: class MockCostTracker {
      config: unknown;
      constructor(config: unknown) {
        if (shouldCostTrackerThrow) throw new Error('CostTracker init failed');
        this.config = config;
      }
      estimateCost() {
        return { estimatedCost: 0 };
      }
      calculateActualCost() {
        return { actualCost: 0 };
      }
    },
    TealAudit: class MockTealAudit {
      config: unknown;
      constructor(config: unknown) {
        if (shouldAuditThrow) throw new Error('TealAudit init failed');
        this.config = config;
      }
      log() {}
    },
    TealSecrets: class MockTealSecrets {
      config: unknown;
      constructor(config: unknown) {
        if (shouldSecretsThrow) throw new Error('TealSecrets init failed');
        this.config = config;
      }
      async init() {}
      async evaluate() {
        return { action: 'ALLOW', reason_codes: [] };
      }
    },
    TealRegistry: class MockTealRegistry {
      config: unknown;
      constructor(config: unknown) {
        if (shouldRegistryThrow) throw new Error('TealRegistry init failed');
        this.config = config;
      }
      async init() {}
      async evaluate() {
        return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'] };
      }
    },
  };
});

describe('GovernanceOrchestrator', () => {
  describe('constructor', () => {
    it('stores config and sets initialized to false', () => {
      const config: TealTigerMiddlewareConfig = {
        guardrails: { pii: true },
      };
      const orchestrator = new GovernanceOrchestrator(config);

      expect(orchestrator.isInitialized).toBe(false);
      expect(orchestrator.getConfig()).toBe(config);
    });

    it('accepts empty config for zero-config mode', () => {
      const orchestrator = new GovernanceOrchestrator({});

      expect(orchestrator.isInitialized).toBe(false);
      expect(orchestrator.getConfig()).toEqual({});
    });
  });

  describe('ensureInitialized()', () => {
    it('initializes TealGuard with zero-config defaults (no config)', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.isInitialized).toBe(true);
      expect(orchestrator.getGuard()).not.toBeNull();
    });

    it('returns immediately on subsequent calls (idempotent)', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();
      const guard = orchestrator.getGuard();

      // Call again — should be a no-op
      await orchestrator.ensureInitialized();
      expect(orchestrator.getGuard()).toBe(guard);
    });

    it('does not initialize TealEngineV12 when no policy config', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.getEngine()).toBeNull();
    });

    it('initializes TealEngineV12 when policy config is provided', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getEngine()).not.toBeNull();
    });

    it('does not initialize CostTracker when not configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.getCostTracker()).toBeNull();
    });

    it('initializes CostTracker when costTracking.enabled is true', async () => {
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, dailyLimit: 10 },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getCostTracker()).not.toBeNull();
    });

    it('does not initialize TealAudit when not configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.getAudit()).toBeNull();
    });

    it('initializes TealAudit when audit.enabled is true', async () => {
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getAudit()).not.toBeNull();
    });

    it('does not initialize TealSecrets when not configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.getSecrets()).toBeNull();
    });

    it('initializes TealSecrets when secrets.enabled is true', async () => {
      const orchestrator = new GovernanceOrchestrator({
        secrets: { enabled: true },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getSecrets()).not.toBeNull();
    });

    it('does not initialize TealRegistry when not configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});

      await orchestrator.ensureInitialized();

      expect(orchestrator.getRegistry()).toBeNull();
    });

    it('initializes TealRegistry when registry.enabled is true', async () => {
      const orchestrator = new GovernanceOrchestrator({
        registry: { enabled: true, allowedModels: ['openai/gpt-4'] },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getRegistry()).not.toBeNull();
    });

    it('creates empty circuit breaker map when circuitBreaker is configured', async () => {
      const orchestrator = new GovernanceOrchestrator({
        circuitBreaker: { failureThreshold: 3, timeout: 30000 },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.getCircuits()).toBeInstanceOf(Map);
      expect(orchestrator.getCircuits().size).toBe(0); // lazily populated per provider
    });

    it('initializes all modules when fully configured', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { pii: true, promptInjection: true, contentModeration: true },
        policy: { mode: 'ENFORCE' },
        circuitBreaker: { failureThreshold: 5, timeout: 60000, halfOpenRequests: 3 },
        costTracking: { enabled: true, dailyLimit: 50 },
        audit: { enabled: true },
        secrets: { enabled: true, confidenceThreshold: 0.9 },
        registry: { enabled: true, allowedModels: ['openai/gpt-4', 'anthropic/claude-3'] },
      });

      await orchestrator.ensureInitialized();

      expect(orchestrator.isInitialized).toBe(true);
      expect(orchestrator.getGuard()).not.toBeNull();
      expect(orchestrator.getEngine()).not.toBeNull();
      expect(orchestrator.getCostTracker()).not.toBeNull();
      expect(orchestrator.getAudit()).not.toBeNull();
      expect(orchestrator.getSecrets()).not.toBeNull();
      expect(orchestrator.getRegistry()).not.toBeNull();
    });
  });

  describe('zero-config defaults', () => {
    it('enables PII detection by default (no guardrails config)', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      // Guard should be initialized (zero-config enables it)
      expect(orchestrator.getGuard()).not.toBeNull();
    });

    it('enables PII detection when guardrails.pii is undefined', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: {},
      });
      await orchestrator.ensureInitialized();

      expect(orchestrator.getGuard()).not.toBeNull();
    });

    it('respects explicit disable of PII detection', async () => {
      // PII disabled but guard still initialized (for other guardrails)
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { pii: false },
      });
      await orchestrator.ensureInitialized();

      // Guard is always initialized, but config passed reflects the setting
      expect(orchestrator.getGuard()).not.toBeNull();
    });
  });

  describe('module initialization failure handling', () => {
    afterEach(() => {
      // Reset all failure flags
      shouldGuardThrow = false;
      shouldEngineThrow = false;
      shouldCostTrackerThrow = false;
      shouldAuditThrow = false;
      shouldSecretsThrow = false;
      shouldRegistryThrow = false;
    });

    it('throws TealRuntimeError with module name when TealGuard fails', async () => {
      shouldGuardThrow = true;
      const orchestrator = new GovernanceOrchestrator({});

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('TealGuard');
      }
    });

    it('throws TealRuntimeError with module name when TealEngineV12 fails', async () => {
      shouldEngineThrow = true;
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('TealEngineV12');
      }
    });

    it('throws TealRuntimeError with module name when CostTracker fails', async () => {
      shouldCostTrackerThrow = true;
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('CostTracker');
      }
    });

    it('throws TealRuntimeError with module name when TealAudit fails', async () => {
      shouldAuditThrow = true;
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('TealAudit');
      }
    });

    it('throws TealRuntimeError with module name when TealSecrets fails', async () => {
      shouldSecretsThrow = true;
      const orchestrator = new GovernanceOrchestrator({
        secrets: { enabled: true },
      });

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('TealSecrets');
      }
    });

    it('throws TealRuntimeError with module name when TealRegistry fails', async () => {
      shouldRegistryThrow = true;
      const orchestrator = new GovernanceOrchestrator({
        registry: { enabled: true, allowedModels: ['openai/gpt-4'] },
      });

      await expect(orchestrator.ensureInitialized()).rejects.toThrow(TealRuntimeError);

      try {
        await orchestrator.ensureInitialized();
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).code).toBe('MODULE_INIT_FAILED');
        expect((err as TealRuntimeError).module).toBe('TealRegistry');
      }
    });

    it('TealRuntimeError has recoverable set to false for init failures', async () => {
      shouldGuardThrow = true;
      const orchestrator = new GovernanceOrchestrator({});

      try {
        await orchestrator.ensureInitialized();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TealRuntimeError);
        expect((err as TealRuntimeError).recoverable).toBe(false);
      }
    });
  });

  describe('placeholder methods', () => {
    it('evaluateInput is implemented (task 3.2)', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      const result = await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-123');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('modified');
    });

    it('evaluatePolicy is implemented (task 3.3)', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      // No engine configured → returns ALLOW
      const decision = await orchestrator.evaluatePolicy({}, 'corr-123');
      expect(decision.action).toBe('ALLOW');
    });

    it('evaluateOutput is implemented (task 3.4)', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      // No output guardrails configured → returns ALLOW with NO_OUTPUT_GUARDRAILS
      const decision = await orchestrator.evaluateOutput('response text', 'corr-123');
      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('NO_OUTPUT_GUARDRAILS');
      expect(decision.correlation_id).toBe('corr-123');
    });

    it('checkCircuit is implemented (task 3.5)', () => {
      const orchestrator = new GovernanceOrchestrator({});

      // No circuit breaker configured → returns ALLOW
      const decision = orchestrator.checkCircuit('openai');
      expect(decision).toHaveProperty('action');
    });

    it('reportOutcome is implemented (task 3.5)', () => {
      const orchestrator = new GovernanceOrchestrator({});

      // Should not throw (no-op when no circuit breaker configured)
      expect(() => orchestrator.reportOutcome('openai', true)).not.toThrow();
    });

    it('checkBudget is implemented (task 3.6)', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('openai/gpt-4', 1000);
      expect(result).toHaveProperty('withinBudget');
      expect(result).toHaveProperty('estimatedCost');
    });

    it('recordCost is implemented (task 3.6)', () => {
      const orchestrator = new GovernanceOrchestrator({});

      const result = orchestrator.recordCost('openai/gpt-4', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
      expect(result).toHaveProperty('actualCost');
      expect(result).toHaveProperty('model');
    });

    it('emitAudit is a no-op when audit is not configured', () => {
      const orchestrator = new GovernanceOrchestrator({});

      // Should not throw even though audit is null (not initialized)
      expect(() =>
        orchestrator.emitAudit({
          schema_version: '1.0.0',
          correlation_id: 'abc-123',
          timestamp: new Date().toISOString(),
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          model: 'openai/gpt-4',
          tokens: { input: 100, output: 50, total: 150 },
          duration_ms: 42,
          hook: 'wrapGenerate',
          provider: 'openai',
        }),
      ).not.toThrow();
    });
  });

  describe('evaluatePolicy (task 3.3)', () => {
    it('returns ALLOW with NO_POLICY_CONFIGURED when no engine is configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluatePolicy(
        { prompt: 'hello' },
        'corr-456',
      );

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('NO_POLICY_CONFIGURED');
      expect(decision.risk_score).toBe(0);
      expect(decision.correlation_id).toBe('corr-456');
      expect(decision.reason).toBe('No policy evaluation configured');
    });

    it('delegates to TealEngineV12 when policy is configured', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluatePolicy(
        { prompt: 'test request' },
        'corr-789',
      );

      // Mock engine returns ALLOW with POLICY_COMPLIANT
      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('POLICY_COMPLIANT');
      expect(decision.correlation_id).toBe('corr-789');
    });

    it('returns the Decision directly from TealEngineV12 (DENY case)', async () => {
      // We need to manipulate the engine to return DENY
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });
      await orchestrator.ensureInitialized();

      // Replace the engine with one that returns DENY
      const mockDenyEngine = {
        async evaluateV12(
          _request: Record<string, unknown>,
          ctx: { correlation_id: string },
        ) {
          return {
            action: 'DENY' as const,
            reason_codes: ['SENSITIVE_DATA_ACCESS'],
            risk_score: 85,
            correlation_id: ctx.correlation_id,
            reason: 'Access to sensitive data denied by policy',
          };
        },
      };
      // Use the internal setter pattern via type assertion for testing
      (orchestrator as unknown as { engine: typeof mockDenyEngine }).engine = mockDenyEngine;

      const decision = await orchestrator.evaluatePolicy(
        { prompt: 'access secrets' },
        'corr-deny-1',
      );

      expect(decision.action).toBe('DENY');
      expect(decision.reason_codes).toContain('SENSITIVE_DATA_ACCESS');
      expect(decision.risk_score).toBe(85);
      expect(decision.correlation_id).toBe('corr-deny-1');
    });

    it('re-throws error when engine fails and failOpen is false (default)', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });
      await orchestrator.ensureInitialized();

      // Replace engine with one that throws
      const mockFailingEngine = {
        async evaluateV12() {
          throw new Error('Engine evaluation timeout');
        },
      };
      (orchestrator as unknown as { engine: typeof mockFailingEngine }).engine = mockFailingEngine;

      await expect(
        orchestrator.evaluatePolicy({ prompt: 'test' }, 'corr-fail-1'),
      ).rejects.toThrow('Engine evaluation timeout');
    });

    it('returns ALLOW when engine fails and failOpen is true', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      // Replace engine with one that throws
      const mockFailingEngine = {
        async evaluateV12() {
          throw new Error('Network timeout');
        },
      };
      (orchestrator as unknown as { engine: typeof mockFailingEngine }).engine = mockFailingEngine;

      const decision = await orchestrator.evaluatePolicy(
        { prompt: 'test' },
        'corr-failopen-1',
      );

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('POLICY_EVALUATION_FAILED');
      expect(decision.reason_codes).toContain('FAIL_OPEN');
      expect(decision.risk_score).toBe(0);
      expect(decision.correlation_id).toBe('corr-failopen-1');
      expect(decision.reason).toContain('Network timeout');

      // Verify stderr logging
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('corr-failopen-1'),
      );

      stderrSpy.mockRestore();
    });

    it('logs to stderr with correlation_id and error message on fail-open', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      const mockFailingEngine = {
        async evaluateV12() {
          throw new Error('Connection refused');
        },
      };
      (orchestrator as unknown as { engine: typeof mockFailingEngine }).engine = mockFailingEngine;

      await orchestrator.evaluatePolicy({ prompt: 'test' }, 'corr-log-1');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const logMessage = stderrSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('corr-log-1');
      expect(logMessage).toContain('Connection refused');
      expect(logMessage).toContain('[TealTiger]');

      stderrSpy.mockRestore();
    });

    it('handles non-Error thrown values in fail-open mode', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      const mockFailingEngine = {
        async evaluateV12() {
          throw 'string error value';
        },
      };
      (orchestrator as unknown as { engine: typeof mockFailingEngine }).engine = mockFailingEngine;

      const decision = await orchestrator.evaluatePolicy(
        { prompt: 'test' },
        'corr-nonerror-1',
      );

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason).toContain('string error value');

      stderrSpy.mockRestore();
    });

    it('handles non-Error thrown values in fail-closed mode', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });
      await orchestrator.ensureInitialized();

      const mockFailingEngine = {
        async evaluateV12() {
          throw 'raw string error';
        },
      };
      (orchestrator as unknown as { engine: typeof mockFailingEngine }).engine = mockFailingEngine;

      await expect(
        orchestrator.evaluatePolicy({ prompt: 'test' }, 'corr-raw-1'),
      ).rejects.toBe('raw string error');
    });

    it('passes the request and correlationId to TealEngineV12', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
      });
      await orchestrator.ensureInitialized();

      let capturedRequest: Record<string, unknown> | undefined;
      let capturedCtx: { correlation_id: string } | undefined;

      const spyEngine = {
        async evaluateV12(
          request: Record<string, unknown>,
          ctx: { correlation_id: string },
        ) {
          capturedRequest = request;
          capturedCtx = ctx;
          return {
            action: 'ALLOW' as const,
            reason_codes: ['POLICY_COMPLIANT'],
            risk_score: 0,
            correlation_id: ctx.correlation_id,
            reason: 'Spy engine',
          };
        },
      };
      (orchestrator as unknown as { engine: typeof spyEngine }).engine = spyEngine;

      const testRequest = { prompt: 'hello world', model: 'gpt-4' };
      await orchestrator.evaluatePolicy(testRequest, 'corr-spy-1');

      expect(capturedRequest).toEqual(testRequest);
      expect(capturedCtx).toEqual({ correlation_id: 'corr-spy-1' });
    });
  });

  describe('emitAudit (task 3.7)', () => {
    const sampleEntry = {
      schema_version: '1.0.0' as const,
      correlation_id: 'audit-corr-001',
      timestamp: '2026-04-15T10:30:00.000Z',
      action: 'ALLOW',
      reason_codes: ['POLICY_COMPLIANT'],
      risk_score: 0.1,
      model: 'openai/gpt-4',
      tokens: { input: 200, output: 100, total: 300 },
      duration_ms: 150,
      hook: 'wrapGenerate' as const,
      provider: 'openai',
    };

    it('calls this.audit.log with the entry when audit is configured', async () => {
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const mockAudit = orchestrator.getAudit()!;
      const logSpy = vi.spyOn(mockAudit, 'log');

      orchestrator.emitAudit(sampleEntry);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(sampleEntry);
    });

    it('is a no-op when audit is null (not configured)', () => {
      const orchestrator = new GovernanceOrchestrator({});
      // Not initialized — audit is null

      expect(() => orchestrator.emitAudit(sampleEntry)).not.toThrow();
    });

    it('is a no-op after initialization when audit is not enabled', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      // audit remains null since audit config was not provided
      expect(orchestrator.getAudit()).toBeNull();
      expect(() => orchestrator.emitAudit(sampleEntry)).not.toThrow();
    });

    it('does not throw even if audit.log throws', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      // Replace audit with one that throws
      const throwingAudit = {
        log() {
          throw new Error('Disk full — audit write failed');
        },
      };
      (orchestrator as unknown as { audit: typeof throwingAudit }).audit = throwingAudit;

      expect(() => orchestrator.emitAudit(sampleEntry)).not.toThrow();

      stderrSpy.mockRestore();
    });

    it('logs to stderr with correlation_id when audit.log throws', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const throwingAudit = {
        log() {
          throw new Error('Network unreachable');
        },
      };
      (orchestrator as unknown as { audit: typeof throwingAudit }).audit = throwingAudit;

      orchestrator.emitAudit(sampleEntry);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const logMessage = stderrSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('audit-corr-001');
      expect(logMessage).toContain('Network unreachable');
      expect(logMessage).toContain('[TealTiger]');

      stderrSpy.mockRestore();
    });

    it('handles non-Error thrown values from audit.log', async () => {
      const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const throwingAudit = {
        log() {
          throw 'raw string failure';
        },
      };
      (orchestrator as unknown as { audit: typeof throwingAudit }).audit = throwingAudit;

      expect(() => orchestrator.emitAudit(sampleEntry)).not.toThrow();

      const logMessage = stderrSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('raw string failure');
      expect(logMessage).toContain('audit-corr-001');

      stderrSpy.mockRestore();
    });

    it('forwards entry with trace_id when present', async () => {
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const mockAudit = orchestrator.getAudit()!;
      const logSpy = vi.spyOn(mockAudit, 'log');

      const entryWithTrace = {
        ...sampleEntry,
        trace_id: 'otel-trace-abc123def456',
      };

      orchestrator.emitAudit(entryWithTrace);

      expect(logSpy).toHaveBeenCalledWith(entryWithTrace);
      expect((logSpy.mock.calls[0][0] as typeof entryWithTrace).trace_id).toBe(
        'otel-trace-abc123def456',
      );
    });

    it('forwards entry with cost information when present', async () => {
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const mockAudit = orchestrator.getAudit()!;
      const logSpy = vi.spyOn(mockAudit, 'log');

      const entryWithCost = {
        ...sampleEntry,
        cost: { estimated: 0.005, actual: 0.0048, currency: 'USD' as const },
      };

      orchestrator.emitAudit(entryWithCost);

      expect(logSpy).toHaveBeenCalledWith(entryWithCost);
      expect((logSpy.mock.calls[0][0] as typeof entryWithCost).cost).toEqual({
        estimated: 0.005,
        actual: 0.0048,
        currency: 'USD',
      });
    });

    it('returns void and never returns a value', async () => {
      const orchestrator = new GovernanceOrchestrator({
        audit: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const result = orchestrator.emitAudit(sampleEntry);
      expect(result).toBeUndefined();
    });
  });

  describe('evaluateOutput (task 3.4)', () => {
    it('returns ALLOW with NO_OUTPUT_GUARDRAILS when no output guardrails configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluateOutput('Some response content', 'corr-out-1');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('NO_OUTPUT_GUARDRAILS');
      expect(decision.risk_score).toBe(0);
      expect(decision.correlation_id).toBe('corr-out-1');
      expect(decision.reason).toBe('No output guardrails configured');
    });

    it('returns ALLOW when guardrails config exists but output is undefined', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { pii: true, promptInjection: true },
      });
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluateOutput('Some content', 'corr-out-2');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('NO_OUTPUT_GUARDRAILS');
    });

    it('calls TealGuard.check with content and output phase context when output guardrails configured', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      const checkSpy = vi.spyOn(guard, 'check');

      await orchestrator.evaluateOutput('Hello world', 'corr-out-3');

      expect(checkSpy).toHaveBeenCalledWith('Hello world', {
        correlation_id: 'corr-out-3',
        phase: 'output',
      });
    });

    it('returns the Decision from TealGuard when output guardrails configured and check succeeds', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluateOutput('Safe content', 'corr-out-4');

      // Default mock guard returns ALLOW with POLICY_COMPLIANT
      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('POLICY_COMPLIANT');
    });

    it('returns DENY Decision from TealGuard when output content is flagged', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      await orchestrator.ensureInitialized();

      // Override the guard's check to return DENY
      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockResolvedValueOnce({
        action: 'DENY',
        reason_codes: ['CONTENT_MODERATION_VIOLATION'],
        risk_score: 85,
        correlation_id: 'corr-out-5',
        reason: 'Content moderation violation detected in output',
      });

      const decision = await orchestrator.evaluateOutput('Harmful content', 'corr-out-5');

      expect(decision.action).toBe('DENY');
      expect(decision.reason_codes).toContain('CONTENT_MODERATION_VIOLATION');
      expect(decision.risk_score).toBe(85);
      expect(decision.correlation_id).toBe('corr-out-5');
    });

    it('re-throws error when guard.check fails and failOpen is false (default)', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockRejectedValueOnce(new Error('Guard evaluation error'));

      await expect(
        orchestrator.evaluateOutput('Some content', 'corr-out-6'),
      ).rejects.toThrow('Guard evaluation error');
    });

    it('returns ALLOW and logs to stderr when guard.check fails and failOpen is true', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockRejectedValueOnce(new Error('Network timeout'));

      const decision = await orchestrator.evaluateOutput('Some content', 'corr-out-7');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('OUTPUT_GUARDRAIL_FAILED_OPEN');
      expect(decision.correlation_id).toBe('corr-out-7');
      expect(decision.risk_score).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('TealGuard (output)'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('correlation_id=corr-out-7'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network timeout'),
      );

      consoleErrorSpy.mockRestore();
    });

    it('preserves correlation_id in ALLOW decision for fail-open path', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { pii: true } },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockRejectedValueOnce(new Error('Unexpected'));

      const decision = await orchestrator.evaluateOutput('content', 'unique-corr-id');

      expect(decision.correlation_id).toBe('unique-corr-id');
      expect(decision.risk_score).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error thrown values in fail-open mode', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
        failOpen: true,
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockRejectedValueOnce('raw string error');

      const decision = await orchestrator.evaluateOutput('content', 'corr-out-8');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('OUTPUT_GUARDRAIL_FAILED_OPEN');

      // Verify the string error is included in the log
      const logMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('raw string error');

      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error thrown values in fail-closed mode', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
      });
      await orchestrator.ensureInitialized();

      const guard = orchestrator.getGuard()!;
      vi.spyOn(guard, 'check').mockRejectedValueOnce('raw string error');

      await expect(
        orchestrator.evaluateOutput('content', 'corr-out-9'),
      ).rejects.toBe('raw string error');
    });

    it('returns ALLOW with output guardrails configured as pii only', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { pii: true } },
      });
      await orchestrator.ensureInitialized();

      const decision = await orchestrator.evaluateOutput('Normal response text', 'corr-out-10');

      // Mock guard returns ALLOW
      expect(decision.action).toBe('ALLOW');
    });
  });
});
