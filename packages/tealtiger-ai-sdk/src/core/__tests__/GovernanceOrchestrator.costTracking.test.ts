/**
 * Unit tests for GovernanceOrchestrator — Cost Tracking Methods (Task 3.6)
 *
 * Tests checkBudget() and recordCost() implementations including:
 * - Budget checking against per-request, per-session, and daily limits
 * - Actual cost recording and accumulation
 * - Anomaly threshold detection
 * - Missing pricing data handling
 * - Missing token usage handling
 * - No costTracker configured (disabled mode)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GovernanceOrchestrator } from '../GovernanceOrchestrator';
import type { ICostTracker } from '../GovernanceOrchestrator';
import type { TealTigerMiddlewareConfig } from '../../types/config';
import type { TokenUsage } from '../../types/decision';

// Mock the dynamic import of tealtiger-sdk
let mockEstimateCost: ReturnType<typeof vi.fn>;
let mockCalculateActualCost: ReturnType<typeof vi.fn>;

vi.mock('tealtiger-sdk', () => {
  return {
    TealGuard: class MockTealGuard {
      constructor() {}
      async check() {
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: '',
          reason: 'Mock guard',
        };
      }
    },
    TealEngineV12: class MockTealEngineV12 {
      constructor() {}
      async evaluateV12(_req: unknown, ctx: { correlation_id: string }) {
        return {
          action: 'ALLOW',
          reason_codes: ['POLICY_COMPLIANT'],
          risk_score: 0,
          correlation_id: ctx.correlation_id,
          reason: 'Mock engine',
        };
      }
    },
    CostTracker: class MockCostTracker {
      constructor() {}
      estimateCost(model: string, tokens: TokenUsage) {
        return mockEstimateCost(model, tokens);
      }
      calculateActualCost(requestId: string, agentId: string, model: string, tokens: TokenUsage) {
        return mockCalculateActualCost(requestId, agentId, model, tokens);
      }
    },
    TealAudit: class MockTealAudit {
      constructor() {}
      log() {}
    },
    TealSecrets: class MockTealSecrets {
      constructor() {}
      async init() {}
      async evaluate() {
        return { action: 'ALLOW', reason_codes: [] };
      }
    },
    TealRegistry: class MockTealRegistry {
      constructor() {}
      async init() {}
      async evaluate() {
        return { action: 'ALLOW', reason_codes: ['POLICY_COMPLIANT'] };
      }
    },
  };
});

describe('GovernanceOrchestrator — Cost Tracking (Task 3.6)', () => {
  beforeEach(() => {
    mockEstimateCost = vi.fn().mockReturnValue({ estimatedCost: 0.005 });
    mockCalculateActualCost = vi.fn().mockReturnValue({ actualCost: 0.004 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkBudget()', () => {
    it('returns withinBudget: true with zero cost when no costTracker configured', async () => {
      const orchestrator = new GovernanceOrchestrator({});
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('openai/gpt-4', 1000);

      expect(result).toEqual({ withinBudget: true, estimatedCost: 0 });
    });

    it('calls costTracker.estimateCost with model and token usage estimate', async () => {
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perRequestLimit: 1.0 },
      });
      await orchestrator.ensureInitialized();

      await orchestrator.checkBudget('openai/gpt-4', 500);

      expect(mockEstimateCost).toHaveBeenCalledWith('openai/gpt-4', {
        inputTokens: 500,
        outputTokens: 0,
        totalTokens: 500,
      });
    });

    it('returns withinBudget: true when estimated cost is within all limits', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.005 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: {
          enabled: true,
          perRequestLimit: 1.0,
          perSessionLimit: 10.0,
          dailyLimit: 50.0,
        },
      });
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('openai/gpt-4', 1000);

      expect(result.withinBudget).toBe(true);
      expect(result.estimatedCost).toBe(0.005);
    });

    it('returns withinBudget: false with exceededBudgetType "per-request" when cost exceeds per-request limit', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 2.0 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perRequestLimit: 1.0 },
      });
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('openai/gpt-4', 50000);

      expect(result.withinBudget).toBe(false);
      expect(result.exceededBudgetType).toBe('per-request');
      expect(result.remainingBudget).toBe(1.0);
    });

    it('returns withinBudget: false with exceededBudgetType "per-session" when session cost exceeded', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.01 });
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.95 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perSessionLimit: 1.0 },
      });
      await orchestrator.ensureInitialized();

      // Record enough cost to approach session limit
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 });

      // Now check budget — session cost (0.95) + estimated (0.01) > 1.0 won't trigger
      // We need the sum to exceed
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.1 });
      const result = await orchestrator.checkBudget('openai/gpt-4', 2000);

      expect(result.withinBudget).toBe(false);
      expect(result.exceededBudgetType).toBe('per-session');
      expect(result.remainingBudget).toBeCloseTo(0.05, 4);
    });

    it('returns withinBudget: false with exceededBudgetType "daily" when daily cost exceeded', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.5 });
      mockCalculateActualCost.mockReturnValue({ actualCost: 4.8 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, dailyLimit: 5.0 },
      });
      await orchestrator.ensureInitialized();

      // Record cost to approach daily limit
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 100000, outputTokens: 50000, totalTokens: 150000 });

      const result = await orchestrator.checkBudget('openai/gpt-4', 10000);

      expect(result.withinBudget).toBe(false);
      expect(result.exceededBudgetType).toBe('daily');
      expect(result.remainingBudget).toBeCloseTo(0.2, 4);
    });

    it('returns pricingUnavailable: true when pricing data is missing', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 0, pricingUnavailable: true });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perRequestLimit: 1.0 },
      });
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('custom/unknown-model', 1000);

      expect(result.withinBudget).toBe(true);
      expect(result.estimatedCost).toBe(0);
      expect(result.pricingUnavailable).toBe(true);
    });

    it('checks per-request limit before per-session and daily limits', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 5.0 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: {
          enabled: true,
          perRequestLimit: 1.0,
          perSessionLimit: 2.0,
          dailyLimit: 3.0,
        },
      });
      await orchestrator.ensureInitialized();

      const result = await orchestrator.checkBudget('openai/gpt-4', 100000);

      // Per-request is the first limit checked
      expect(result.exceededBudgetType).toBe('per-request');
    });
  });

  describe('recordCost()', () => {
    it('returns zero cost with usageReported: false when no costTracker configured', () => {
      const orchestrator = new GovernanceOrchestrator({});

      const result = orchestrator.recordCost('openai/gpt-4', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      expect(result).toEqual({ actualCost: 0, model: 'openai/gpt-4', usageReported: false });
    });

    it('returns zero cost with usageReported: false when usage is all zeros', async () => {
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const result = orchestrator.recordCost('openai/gpt-4', {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });

      expect(result).toEqual({ actualCost: 0, model: 'openai/gpt-4', usageReported: false });
      expect(mockCalculateActualCost).not.toHaveBeenCalled();
    });

    it('calls costTracker.calculateActualCost with correct parameters', async () => {
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.008 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const usage: TokenUsage = { inputTokens: 500, outputTokens: 200, totalTokens: 700 };
      orchestrator.recordCost('openai/gpt-4', usage);

      expect(mockCalculateActualCost).toHaveBeenCalledWith(
        'request-id',
        'middleware',
        'openai/gpt-4',
        usage,
      );
    });

    it('returns actual cost and usageReported: true on success', async () => {
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.012 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      const result = orchestrator.recordCost('openai/gpt-4', {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      expect(result).toEqual({ actualCost: 0.012, model: 'openai/gpt-4', usageReported: true });
    });

    it('accumulates session cost across multiple calls', async () => {
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.01 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      orchestrator.recordCost('openai/gpt-4', { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 200, outputTokens: 100, totalTokens: 300 });
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 300, outputTokens: 150, totalTokens: 450 });

      expect(orchestrator.getSessionCost()).toBeCloseTo(0.03, 6);
    });

    it('accumulates daily cost across multiple calls', async () => {
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.05 });
      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true },
      });
      await orchestrator.ensureInitialized();

      orchestrator.recordCost('openai/gpt-4', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      orchestrator.recordCost('anthropic/claude-3', { inputTokens: 800, outputTokens: 400, totalTokens: 1200 });

      expect(orchestrator.getDailyCost()).toBeCloseTo(0.10, 6);
    });

    it('emits console warning when anomaly threshold is exceeded', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.01 });
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.03 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, anomalyThreshold: 200 },
      });
      await orchestrator.ensureInitialized();

      // First, do a checkBudget to store the lastEstimate
      await orchestrator.checkBudget('openai/gpt-4', 1000);

      // Now record a cost that is 300% of the estimate (0.03 / 0.01 = 300%)
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost anomaly detected'),
      );
      warnSpy.mockRestore();
    });

    it('does not emit anomaly warning when within threshold', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.01 });
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.015 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, anomalyThreshold: 200 },
      });
      await orchestrator.ensureInitialized();

      // checkBudget stores the estimate
      await orchestrator.checkBudget('openai/gpt-4', 1000);

      // Record cost that is 150% of estimate (within 200% threshold)
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('does not check anomaly when lastEstimate is 0', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.05 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, anomalyThreshold: 200 },
      });
      await orchestrator.ensureInitialized();

      // Record cost without prior checkBudget (lastEstimate = 0)
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('integration: checkBudget + recordCost lifecycle', () => {
    it('cost recorded after checkBudget affects next checkBudget session check', async () => {
      mockEstimateCost.mockReturnValue({ estimatedCost: 0.3 });
      mockCalculateActualCost.mockReturnValue({ actualCost: 0.4 });

      const orchestrator = new GovernanceOrchestrator({
        costTracking: { enabled: true, perSessionLimit: 1.0 },
      });
      await orchestrator.ensureInitialized();

      // First request — within budget
      let result = await orchestrator.checkBudget('openai/gpt-4', 5000);
      expect(result.withinBudget).toBe(true);

      // Record cost
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 5000, outputTokens: 2000, totalTokens: 7000 });
      orchestrator.recordCost('openai/gpt-4', { inputTokens: 5000, outputTokens: 2000, totalTokens: 7000 });

      // Third request — session cost is now 0.8, + 0.3 estimate = 1.1 > 1.0
      result = await orchestrator.checkBudget('openai/gpt-4', 5000);
      expect(result.withinBudget).toBe(false);
      expect(result.exceededBudgetType).toBe('per-session');
    });
  });
});
