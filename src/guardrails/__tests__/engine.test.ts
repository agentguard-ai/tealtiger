/**
 * Tests for GuardrailEngine
 */

import { GuardrailEngine } from '../engine';
import { Guardrail, GuardrailResult } from '../base';

// Mock guardrails for testing
class PassingGuardrail extends Guardrail {
  async evaluate(_input: any): Promise<GuardrailResult> {
    return new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Passed',
      riskScore: 10,
    });
  }
}

class FailingGuardrail extends Guardrail {
  async evaluate(_input: any): Promise<GuardrailResult> {
    return new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'Failed',
      riskScore: 90,
    });
  }
}

class SlowGuardrail extends Guardrail {
  async evaluate(_input: any): Promise<GuardrailResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Slow but passed',
      riskScore: 0,
    });
  }
}

class ErrorGuardrail extends Guardrail {
  async evaluate(_input: any): Promise<GuardrailResult> {
    throw new Error('Evaluation error');
  }
}

describe('GuardrailEngine', () => {
  describe('Registration', () => {
    it('should register a guardrail', () => {
      const engine = new GuardrailEngine();
      const guardrail = new PassingGuardrail({ name: 'Test' });

      engine.registerGuardrail(guardrail);

      const registered = engine.getRegisteredGuardrails();
      expect(registered).toHaveLength(1);
      expect(registered[0].name).toBe('Test');
    });

    it('should throw error when registering invalid guardrail', () => {
      const engine = new GuardrailEngine();
      const invalidGuardrail = {} as Guardrail;

      expect(() => engine.registerGuardrail(invalidGuardrail)).toThrow(
        'Guardrail must implement evaluate() method'
      );
    });

    it('should unregister a guardrail by name', () => {
      const engine = new GuardrailEngine();
      const guardrail = new PassingGuardrail({ name: 'Test' });

      engine.registerGuardrail(guardrail);
      expect(engine.getRegisteredGuardrails()).toHaveLength(1);

      engine.unregisterGuardrail('Test');
      expect(engine.getRegisteredGuardrails()).toHaveLength(0);
    });

    it('should clear all guardrails', () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Test1' }));
      engine.registerGuardrail(new PassingGuardrail({ name: 'Test2' }));

      expect(engine.getRegisteredGuardrails()).toHaveLength(2);

      engine.clearGuardrails();
      expect(engine.getRegisteredGuardrails()).toHaveLength(0);
    });
  });

  describe('Execution', () => {
    it('should execute with no guardrails', async () => {
      const engine = new GuardrailEngine();
      const result = await engine.execute('test input');

      expect(result.passed).toBe(true);
      expect(result.guardrailsExecuted).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should execute passing guardrails', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Test1' }));
      engine.registerGuardrail(new PassingGuardrail({ name: 'Test2' }));

      const result = await engine.execute('test input');

      expect(result.passed).toBe(true);
      expect(result.guardrailsExecuted).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.maxRiskScore).toBe(10);
    });

    it('should detect failing guardrails', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Pass' }));
      engine.registerGuardrail(new FailingGuardrail({ name: 'Fail' }));

      const result = await engine.execute('test input');

      expect(result.passed).toBe(false);
      expect(result.guardrailsExecuted).toBe(2);
      expect(result.failedGuardrails).toContain('Fail');
      expect(result.maxRiskScore).toBe(90);
    });

    it('should skip disabled guardrails', async () => {
      const engine = new GuardrailEngine();
      const guardrail = new PassingGuardrail({ name: 'Test', enabled: false });
      engine.registerGuardrail(guardrail);

      const result = await engine.execute('test input');

      expect(result.passed).toBe(true);
      expect(result.guardrailsExecuted).toBe(0);
    });

    it('should execute in parallel by default', async () => {
      const engine = new GuardrailEngine({ parallelExecution: true });
      engine.registerGuardrail(new SlowGuardrail({ name: 'Slow1' }));
      engine.registerGuardrail(new SlowGuardrail({ name: 'Slow2' }));

      const startTime = Date.now();
      const result = await engine.execute('test input');
      const duration = Date.now() - startTime;

      expect(result.passed).toBe(true);
      expect(result.guardrailsExecuted).toBe(2);
      // Parallel execution should be faster than sequential (< 150ms vs 200ms)
      expect(duration).toBeLessThan(150);
    });

    it('should execute sequentially when configured', async () => {
      const engine = new GuardrailEngine({ parallelExecution: false });
      engine.registerGuardrail(new SlowGuardrail({ name: 'Slow1' }));
      engine.registerGuardrail(new SlowGuardrail({ name: 'Slow2' }));

      const startTime = Date.now();
      const result = await engine.execute('test input');
      const duration = Date.now() - startTime;

      expect(result.passed).toBe(true);
      expect(result.guardrailsExecuted).toBe(2);
      // Sequential execution should take longer (>= 200ms)
      expect(duration).toBeGreaterThanOrEqual(180);
    });

    it('should handle errors with continueOnError=true', async () => {
      const engine = new GuardrailEngine({ continueOnError: true });
      engine.registerGuardrail(new ErrorGuardrail({ name: 'Error' }));
      engine.registerGuardrail(new PassingGuardrail({ name: 'Pass' }));

      const result = await engine.execute('test input');

      expect(result.guardrailsExecuted).toBe(2);
      expect(result.passed).toBe(false);
      expect(result.failedGuardrails).toContain('Error');
    });

    it('should throw error with continueOnError=false', async () => {
      const engine = new GuardrailEngine({ continueOnError: false });
      engine.registerGuardrail(new ErrorGuardrail({ name: 'Error' }));

      await expect(engine.execute('test input')).rejects.toThrow('Evaluation error');
    });

    it('should handle timeout', async () => {
      const engine = new GuardrailEngine({ timeout: 50, continueOnError: true });
      engine.registerGuardrail(new SlowGuardrail({ name: 'Slow' }));

      const result = await engine.execute('test input');

      expect(result.passed).toBe(false);
      expect(result.failedGuardrails).toContain('Slow');
      expect(result.results[0].error).toBe('Guardrail execution timeout');
    });
  });

  describe('Result Methods', () => {
    it('should provide allPassed() method', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Pass' }));

      const result = await engine.execute('test input');
      expect(result.allPassed()).toBe(true);
    });

    it('should provide getFailedGuardrails() method', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new FailingGuardrail({ name: 'Fail1' }));
      engine.registerGuardrail(new FailingGuardrail({ name: 'Fail2' }));

      const result = await engine.execute('test input');
      const failed = result.getFailedGuardrails();

      expect(failed).toContain('Fail1');
      expect(failed).toContain('Fail2');
    });

    it('should provide getMaxRiskScore() method', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Low' })); // risk: 10
      engine.registerGuardrail(new FailingGuardrail({ name: 'High' })); // risk: 90

      const result = await engine.execute('test input');
      expect(result.getMaxRiskScore()).toBe(90);
    });

    it('should provide getSummary() method', async () => {
      const engine = new GuardrailEngine();
      engine.registerGuardrail(new PassingGuardrail({ name: 'Pass' }));
      engine.registerGuardrail(new FailingGuardrail({ name: 'Fail' }));

      const result = await engine.execute('test input');
      const summary = result.getSummary();

      expect(summary.passed).toBe(false);
      expect(summary.guardrailsExecuted).toBe(2);
      expect(summary.failedCount).toBe(1);
      expect(summary.maxRiskScore).toBe(90);
      expect(summary.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
