/**
 * Tests for base guardrail classes
 */

import { Guardrail, GuardrailResult } from '../base';

// Mock guardrail for testing
class MockGuardrail extends Guardrail {
  async evaluate(_input: any, _context?: Record<string, any>): Promise<GuardrailResult> {
    return new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Mock evaluation',
      riskScore: 0,
    });
  }
}

describe('GuardrailResult', () => {
  it('should create a result with all properties', () => {
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Test passed',
      metadata: { test: 'data' },
      riskScore: 25,
    });

    expect(result.passed).toBe(true);
    expect(result.action).toBe('allow');
    expect(result.reason).toBe('Test passed');
    expect(result.metadata).toEqual({ test: 'data' });
    expect(result.riskScore).toBe(25);
    expect(result.timestamp).toBeDefined();
  });

  it('should have default values for optional properties', () => {
    const result = new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'Test failed',
    });

    expect(result.metadata).toEqual({});
    expect(result.riskScore).toBe(0);
  });

  it('should have isPassed() method', () => {
    const passedResult = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'OK',
    });

    const failedResult = new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'Not OK',
    });

    expect(passedResult.isPassed()).toBe(true);
    expect(failedResult.isPassed()).toBe(false);
  });

  it('should have shouldBlock() method', () => {
    const blockResult = new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'Blocked',
    });

    const allowResult = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Allowed',
    });

    expect(blockResult.shouldBlock()).toBe(true);
    expect(allowResult.shouldBlock()).toBe(false);
  });

  it('should have getRiskScore() method', () => {
    const result = new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'High risk',
      riskScore: 85,
    });

    expect(result.getRiskScore()).toBe(85);
  });
});

describe('Guardrail', () => {
  it('should create a guardrail with default config', () => {
    const guardrail = new MockGuardrail();

    expect(guardrail.name).toBe('MockGuardrail');
    expect(guardrail.enabled).toBe(true);
  });

  it('should create a guardrail with custom config', () => {
    const guardrail = new MockGuardrail({
      name: 'CustomGuardrail',
      enabled: false,
      version: '2.0.0',
    });

    expect(guardrail.name).toBe('CustomGuardrail');
    expect(guardrail.enabled).toBe(false);
  });

  it('should configure guardrail settings', () => {
    const guardrail = new MockGuardrail();

    guardrail.configure({ enabled: false });
    expect(guardrail.enabled).toBe(false);

    guardrail.configure({ enabled: true });
    expect(guardrail.enabled).toBe(true);
  });

  it('should return metadata', () => {
    const guardrail = new MockGuardrail({
      name: 'TestGuardrail',
      version: '1.5.0',
      description: 'Test description',
    });

    const metadata = guardrail.getMetadata();

    expect(metadata.name).toBe('TestGuardrail');
    expect(metadata.enabled).toBe(true);
    expect(metadata.version).toBe('1.5.0');
    expect(metadata.description).toBe('Test description');
  });

  it('should evaluate input', async () => {
    const guardrail = new MockGuardrail();
    const result = await guardrail.evaluate('test input');

    expect(result).toBeInstanceOf(GuardrailResult);
    expect(result.passed).toBe(true);
  });
});
