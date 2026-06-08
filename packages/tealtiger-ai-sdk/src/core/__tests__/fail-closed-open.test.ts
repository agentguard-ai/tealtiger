/**
 * Unit Tests — Fail-Closed and Fail-Open Logic (Tasks 6.1 & 6.2)
 *
 * Task 6.1: Fail-closed behavior
 * - When any module throws and failOpen is false (default):
 *   - Deny with Decision: action DENY, risk_score 100, reason code GOVERNANCE_MODULE_FAILURE
 *   - Include metadata: failed module names with error descriptions, total evaluation time
 *   - Preserve results from successfully-evaluated modules in metadata
 *   - Handle per-module timeout via AbortController (default 5000ms)
 *
 * Task 6.2: Fail-open behavior
 * - When failOpen: true and a module fails:
 *   - Allow request to proceed
 *   - Record failure in structured ERROR-level log with correlation_id, module name, error description
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GovernanceOrchestrator } from '../GovernanceOrchestrator';
import type { ModuleEvalResult } from '../GovernanceOrchestrator';
import { PolicyViolationError } from '../../errors';

// ── Test Helpers ─────────────────────────────────────────────────

function createOrchestratorWithMocks(options: {
  failOpen?: boolean;
  moduleTimeout?: number;
  guard?: unknown;
  registry?: unknown;
  secrets?: unknown;
}) {
  const orchestrator = new GovernanceOrchestrator({
    failOpen: options.failOpen ?? false,
    moduleTimeout: options.moduleTimeout,
    registry: options.registry ? { enabled: true, allowedModels: [] } : undefined,
    secrets: options.secrets ? { enabled: true } : undefined,
  });

  const o = orchestrator as unknown as {
    initialized: boolean;
    guard: unknown;
    registry: unknown;
    secrets: unknown;
  };
  o.initialized = true;
  o.guard = options.guard ?? {
    async check() {
      return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'], risk_score: 0, correlation_id: '', reason: '' };
    },
  };
  if (options.registry) o.registry = options.registry;
  if (options.secrets) o.secrets = options.secrets;

  return orchestrator;
}

// ── Task 6.1: Fail-Closed Logic ─────────────────────────────────

describe('Task 6.1: Fail-closed logic', () => {
  describe('createFailClosedDecision', () => {
    it('creates DENY decision with risk_score 100 and GOVERNANCE_MODULE_FAILURE reason code', () => {
      const orchestrator = new GovernanceOrchestrator({});
      const decision = orchestrator.createFailClosedDecision(
        'TealGuard',
        new Error('Network timeout'),
        42,
        'test-correlation-id',
      );

      expect(decision.action).toBe('DENY');
      expect(decision.risk_score).toBe(100);
      expect(decision.reason_codes).toContain('GOVERNANCE_MODULE_FAILURE');
      expect(decision.correlation_id).toBe('test-correlation-id');
    });

    it('includes failed module name and error description in metadata', () => {
      const orchestrator = new GovernanceOrchestrator({});
      const error = new Error('Service unavailable');
      const decision = orchestrator.createFailClosedDecision(
        'TealSecrets',
        error,
        120,
        'corr-001',
      );

      const metadata = decision.metadata!;
      expect(metadata.failed_modules).toEqual([
        { name: 'TealSecrets', error: 'Service unavailable' },
      ]);
    });

    it('includes total evaluation time in metadata', () => {
      const orchestrator = new GovernanceOrchestrator({});
      const decision = orchestrator.createFailClosedDecision(
        'TealRegistry',
        new Error('Timeout'),
        1500,
        'corr-002',
      );

      expect(decision.metadata!.total_evaluation_time_ms).toBe(1500);
    });

    it('preserves results from successfully-evaluated modules in metadata', () => {
      const orchestrator = new GovernanceOrchestrator({});
      const previousResults: ModuleEvalResult[] = [
        { module: 'TealGuard', action: 'ALLOW', duration_ms: 15 },
        { module: 'TealRegistry', action: 'ALLOW', duration_ms: 8 },
      ];

      const decision = orchestrator.createFailClosedDecision(
        'TealSecrets',
        new Error('Crash'),
        100,
        'corr-003',
        previousResults,
      );

      expect(decision.metadata!.previous_results).toEqual(previousResults);
    });

    it('handles non-Error thrown values gracefully', () => {
      const orchestrator = new GovernanceOrchestrator({});
      const decision = orchestrator.createFailClosedDecision(
        'TealGuard',
        'string error',
        10,
        'corr-004',
      );

      const metadata = decision.metadata!;
      expect((metadata.failed_modules as any[])[0].error).toBe('string error');
    });
  });

  describe('withModuleTimeout', () => {
    it('resolves when function completes within timeout', async () => {
      const orchestrator = new GovernanceOrchestrator({ moduleTimeout: 5000 });
      const result = await orchestrator.withModuleTimeout('TestModule', async () => 'done');
      expect(result).toBe('done');
    });

    it('rejects with timeout error when function exceeds timeout', async () => {
      const orchestrator = new GovernanceOrchestrator({ moduleTimeout: 50 });

      await expect(
        orchestrator.withModuleTimeout('SlowModule', () => new Promise((resolve) => setTimeout(resolve, 200))),
      ).rejects.toThrow('Module "SlowModule" timed out after 50ms');
    });

    it('uses default timeout of 5000ms when not configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      // This should complete well within 5000ms
      const result = await orchestrator.withModuleTimeout('FastModule', async () => 42);
      expect(result).toBe(42);
    });

    it('propagates function errors without masking them', async () => {
      const orchestrator = new GovernanceOrchestrator({ moduleTimeout: 5000 });
      const expectedError = new Error('Module crashed');

      await expect(
        orchestrator.withModuleTimeout('CrashModule', async () => { throw expectedError; }),
      ).rejects.toThrow('Module crashed');
    });
  });

  describe('evaluateInput — fail-closed behavior', () => {
    it('throws PolicyViolationError with GOVERNANCE_EVALUATION_FAILED when guard throws', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: false,
        guard: {
          async check() { throw new Error('Guard crashed'); },
        },
      });

      try {
        await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fc-1');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyViolationError);
        const err = e as PolicyViolationError;
        expect(err.decision.action).toBe('DENY');
        expect(err.decision.reason_codes).toContain('GOVERNANCE_EVALUATION_FAILED');
        expect(err.decision.risk_score).toBe(100);
        expect(err.decision.metadata?.failedModule).toBe('TealGuard');
      }
    });

    it('throws PolicyViolationError when registry throws in fail-closed mode', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: false,
        registry: {
          async evaluate() { throw new Error('Registry unavailable'); },
          async init() {},
        },
      });

      try {
        await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fc-2');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyViolationError);
        const err = e as PolicyViolationError;
        expect(err.decision.reason_codes).toContain('GOVERNANCE_EVALUATION_FAILED');
        expect(err.decision.metadata?.failedModule).toBe('TealRegistry');
      }
    });

    it('throws PolicyViolationError when secrets module throws in fail-closed mode', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: false,
        secrets: {
          async evaluate() { throw new Error('Secrets scan failed'); },
          async init() {},
        },
      });

      try {
        await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fc-3');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyViolationError);
        const err = e as PolicyViolationError;
        expect(err.decision.reason_codes).toContain('GOVERNANCE_EVALUATION_FAILED');
        expect(err.decision.metadata?.failedModule).toBe('TealSecrets');
      }
    });
  });
});

// ── Task 6.2: Fail-Open Logic ────────────────────────────────────

describe('Task 6.2: Fail-open logic', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('evaluateInput — fail-open behavior', () => {
    it('allows request to proceed when guard throws and failOpen is true', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        guard: {
          async check() { throw new Error('Guard failure'); },
        },
      });

      const result = await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-1');

      expect(result.decision.action).not.toBe('DENY');
      expect(result.content).toBe('test');
    });

    it('records failure in structured ERROR-level log with correlation_id', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        guard: {
          async check() { throw new Error('Guard crash'); },
        },
      });

      await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-2');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('correlation_id=corr-fo-2'),
      );
    });

    it('records module name in the error log', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        guard: {
          async check() { throw new Error('Guard crash'); },
        },
      });

      await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-3');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('module=TealGuard'),
      );
    });

    it('records error description in the error log', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        guard: {
          async check() { throw new Error('Unexpected network error'); },
        },
      });

      await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-4');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected network error'),
      );
    });

    it('allows request when registry throws in fail-open mode', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        registry: {
          async evaluate() { throw new Error('Registry down'); },
          async init() {},
        },
      });

      const result = await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-5');

      expect(result.decision.action).not.toBe('DENY');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('module=TealRegistry'),
      );
    });

    it('allows request when secrets module throws in fail-open mode', async () => {
      const orchestrator = createOrchestratorWithMocks({
        failOpen: true,
        secrets: {
          async evaluate() { throw new Error('Secrets engine down'); },
          async init() {},
        },
      });

      const result = await orchestrator.evaluateInput('test', 'openai/gpt-4', 'corr-fo-6');

      expect(result.decision.action).not.toBe('DENY');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('module=TealSecrets'),
      );
    });
  });

  describe('evaluatePolicy — fail-open behavior', () => {
    it('returns ALLOW when engine throws and failOpen is true', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
        failOpen: true,
      });
      const o = orchestrator as unknown as {
        initialized: boolean;
        guard: unknown;
        engine: unknown;
      };
      o.initialized = true;
      o.guard = { async check() { return { action: 'ALLOW', reason_codes: [], risk_score: 0, correlation_id: '', reason: '' }; } };
      o.engine = {
        async evaluateV12() { throw new Error('Engine crash'); },
      };

      const decision = await orchestrator.evaluatePolicy({}, 'corr-fo-policy-1');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('POLICY_EVALUATION_FAILED');
      expect(decision.reason_codes).toContain('FAIL_OPEN');
    });

    it('logs error to stderr with correlation_id when engine fails in fail-open', async () => {
      const orchestrator = new GovernanceOrchestrator({
        policy: { mode: 'ENFORCE' },
        failOpen: true,
      });
      const o = orchestrator as unknown as {
        initialized: boolean;
        guard: unknown;
        engine: unknown;
      };
      o.initialized = true;
      o.guard = { async check() { return { action: 'ALLOW', reason_codes: [], risk_score: 0, correlation_id: '', reason: '' }; } };
      o.engine = {
        async evaluateV12() { throw new Error('Timeout'); },
      };

      await orchestrator.evaluatePolicy({}, 'corr-fo-policy-2');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('correlation_id=corr-fo-policy-2'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('module=TealEngineV12'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timeout'),
      );
    });
  });

  describe('evaluateOutput — fail-open behavior', () => {
    it('returns ALLOW when guard fails in fail-open mode for output eval', async () => {
      const orchestrator = new GovernanceOrchestrator({
        guardrails: { output: { contentModeration: true } },
        failOpen: true,
      });

      // Bypass lazy initialization to avoid dynamic import timeout
      const o = orchestrator as unknown as {
        initialized: boolean;
        guard: { check: (...args: unknown[]) => Promise<never> };
      };
      o.initialized = true;
      o.guard = {
        async check(): Promise<never> {
          throw new Error('Output eval failed');
        },
      };

      const decision = await orchestrator.evaluateOutput('test response', 'corr-fo-output-1');

      expect(decision.action).toBe('ALLOW');
      expect(decision.reason_codes).toContain('OUTPUT_GUARDRAIL_FAILED_OPEN');
    });
  });
});
