/**
 * Unit tests for Guardrail Base Architecture
 */

const { Guardrail, GuardrailResult } = require('../Guardrail');
const { GuardrailEngine } = require('../GuardrailEngine');
const { GuardrailRegistry, registry } = require('../GuardrailRegistry');
const { GuardrailCache } = require('../GuardrailCache');

// Mock Guardrail for testing
class MockGuardrail extends Guardrail {
  constructor(config = {}) {
    super(config);
    this.shouldPass = config.shouldPass !== undefined ? config.shouldPass : true;
    this.delay = config.delay || 0;
  }

  async evaluate(input, context) {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    return new GuardrailResult({
      passed: this.shouldPass,
      action: this.shouldPass ? 'allow' : 'block',
      reason: this.shouldPass ? 'Input is safe' : 'Input is unsafe',
      riskScore: this.shouldPass ? 0 : 75
    });
  }
}

describe('Guardrail Base Interface', () => {
  test('should not allow direct instantiation', () => {
    expect(() => new Guardrail()).toThrow('Guardrail is an abstract class');
  });

  test('should allow subclass instantiation', () => {
    const guardrail = new MockGuardrail({ name: 'test-guardrail' });
    expect(guardrail.name).toBe('test-guardrail');
    expect(guardrail.enabled).toBe(true);
  });

  test('should configure guardrail', () => {
    const guardrail = new MockGuardrail();
    guardrail.configure({ enabled: false, customOption: 'value' });
    
    expect(guardrail.enabled).toBe(false);
    expect(guardrail.config.customOption).toBe('value');
  });

  test('should return metadata', () => {
    const guardrail = new MockGuardrail({ 
      name: 'test', 
      version: '2.0.0',
      description: 'Test guardrail'
    });
    
    const metadata = guardrail.getMetadata();
    expect(metadata.name).toBe('test');
    expect(metadata.version).toBe('2.0.0');
    expect(metadata.description).toBe('Test guardrail');
  });
});

describe('GuardrailResult', () => {
  test('should create result with all fields', () => {
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe input',
      riskScore: 10
    });

    expect(result.passed).toBe(true);
    expect(result.action).toBe('allow');
    expect(result.isPassed()).toBe(true);
    expect(result.shouldBlock()).toBe(false);
    expect(result.getRiskScore()).toBe(10);
  });

  test('should detect blocking action', () => {
    const result = new GuardrailResult({
      passed: false,
      action: 'block',
      reason: 'Unsafe input',
      riskScore: 90
    });

    expect(result.shouldBlock()).toBe(true);
  });
});

describe('GuardrailEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new GuardrailEngine();
  });

  test('should register guardrails', () => {
    const guardrail = new MockGuardrail({ name: 'test' });
    engine.registerGuardrail(guardrail);

    const registered = engine.getRegisteredGuardrails();
    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe('test');
  });

  test('should execute guardrails in parallel', async () => {
    const guardrail1 = new MockGuardrail({ name: 'g1', shouldPass: true });
    const guardrail2 = new MockGuardrail({ name: 'g2', shouldPass: true });
    
    engine.registerGuardrail(guardrail1);
    engine.registerGuardrail(guardrail2);

    const result = await engine.execute({ text: 'test input' });

    expect(result.passed).toBe(true);
    expect(result.guardrailsExecuted).toBe(2);
    expect(result.results).toHaveLength(2);
  });

  test('should fail if any guardrail fails', async () => {
    const guardrail1 = new MockGuardrail({ name: 'g1', shouldPass: true });
    const guardrail2 = new MockGuardrail({ name: 'g2', shouldPass: false });
    
    engine.registerGuardrail(guardrail1);
    engine.registerGuardrail(guardrail2);

    const result = await engine.execute({ text: 'test input' });

    expect(result.passed).toBe(false);
    expect(result.failedGuardrails).toContain('g2');
  });

  test('should handle guardrail errors gracefully', async () => {
    class ErrorGuardrail extends Guardrail {
      async evaluate() {
        throw new Error('Guardrail error');
      }
    }

    const errorGuardrail = new ErrorGuardrail({ name: 'error' });
    engine.registerGuardrail(errorGuardrail);

    const result = await engine.execute({ text: 'test' });

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toBeTruthy();
  });

  test('should respect timeout', async () => {
    const slowGuardrail = new MockGuardrail({ 
      name: 'slow', 
      delay: 10000 // 10 seconds
    });
    
    engine = new GuardrailEngine({ timeout: 100 }); // 100ms timeout
    engine.registerGuardrail(slowGuardrail);

    const result = await engine.execute({ text: 'test' });

    expect(result.passed).toBe(false);
    expect(result.results[0].error).toContain('timeout');
  });

  test('should unregister guardrails', () => {
    const guardrail = new MockGuardrail({ name: 'test' });
    engine.registerGuardrail(guardrail);
    engine.unregisterGuardrail('test');

    const registered = engine.getRegisteredGuardrails();
    expect(registered).toHaveLength(0);
  });
});

describe('GuardrailRegistry', () => {
  beforeEach(() => {
    registry.clear();
  });

  test('should register guardrail class', () => {
    registry.register('mock', MockGuardrail, {
      category: 'test',
      description: 'Mock guardrail for testing'
    });

    expect(registry.has('mock')).toBe(true);
    expect(registry.list()).toContain('mock');
  });

  test('should create guardrail instance', () => {
    registry.register('mock', MockGuardrail);
    const instance = registry.create('mock', { name: 'test-instance' });

    expect(instance).toBeInstanceOf(MockGuardrail);
    expect(instance.name).toBe('test-instance');
  });

  test('should get guardrails by category', () => {
    registry.register('mock1', MockGuardrail, { category: 'security' });
    registry.register('mock2', MockGuardrail, { category: 'security' });
    registry.register('mock3', MockGuardrail, { category: 'compliance' });

    const securityGuardrails = registry.getByCategory('security');
    expect(securityGuardrails).toHaveLength(2);
  });

  test('should search by tags', () => {
    registry.register('mock1', MockGuardrail, { tags: ['pii', 'security'] });
    registry.register('mock2', MockGuardrail, { tags: ['content', 'moderation'] });

    const results = registry.searchByTags(['pii']);
    expect(results).toContain('mock1');
    expect(results).not.toContain('mock2');
  });

  test('should throw error for duplicate registration', () => {
    registry.register('mock', MockGuardrail);
    expect(() => registry.register('mock', MockGuardrail)).toThrow('already registered');
  });

  test('should unregister guardrails', () => {
    registry.register('mock', MockGuardrail);
    registry.unregister('mock');

    expect(registry.has('mock')).toBe(false);
  });
});

describe('GuardrailCache', () => {
  let cache;

  beforeEach(() => {
    cache = new GuardrailCache({ ttl: 1000 });
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  test('should cache and retrieve results', () => {
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe'
    });

    cache.set('test-guardrail', { text: 'input' }, {}, result);
    const cached = cache.get('test-guardrail', { text: 'input' }, {});

    expect(cached).toBeTruthy();
    expect(cached.passed).toBe(true);
  });

  test('should return null for cache miss', () => {
    const result = cache.get('test-guardrail', { text: 'input' }, {});
    expect(result).toBeNull();
  });

  test('should respect TTL', async () => {
    cache = new GuardrailCache({ ttl: 50 }); // 50ms TTL
    
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe'
    });

    cache.set('test-guardrail', { text: 'input' }, {}, result);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cached = cache.get('test-guardrail', { text: 'input' }, {});
    expect(cached).toBeNull();
  });

  test('should track cache statistics', () => {
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe'
    });

    cache.set('test', { text: 'input' }, {}, result);
    cache.get('test', { text: 'input' }, {}); // Hit
    cache.get('test', { text: 'other' }, {}); // Miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  test('should evict oldest entry when max size reached', () => {
    cache = new GuardrailCache({ maxSize: 2 });
    
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe'
    });

    cache.set('g1', { text: '1' }, {}, result);
    cache.set('g2', { text: '2' }, {}, result);
    cache.set('g3', { text: '3' }, {}, result); // Should evict g1

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.evictions).toBe(1);
  });

  test('should clear cache', () => {
    const result = new GuardrailResult({
      passed: true,
      action: 'allow',
      reason: 'Safe'
    });

    cache.set('test', { text: 'input' }, {}, result);
    cache.clear();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });
});
