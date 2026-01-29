/**
 * AgentGuard Unit Tests
 */

import { AgentGuard } from '../AgentGuard';
import { SSAClient } from '../SSAClient';
import { Configuration } from '../../config/Configuration';
import { AgentGuardValidationError } from '../../utils/errors';
import { SecurityDecision } from '../../types';

// Mock the SSAClient
jest.mock('../SSAClient');
const MockedSSAClient = SSAClient as jest.MockedClass<typeof SSAClient>;

// Mock the Configuration
jest.mock('../../config/Configuration');
const MockedConfiguration = Configuration as jest.MockedClass<typeof Configuration>;

describe('AgentGuard', () => {
  let agentGuard: AgentGuard;
  let mockSSAClient: jest.Mocked<SSAClient>;
  let mockConfig: jest.Mocked<Configuration>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      get: jest.fn(),
      set: jest.fn(),
      validate: jest.fn(),
      getSafeConfig: jest.fn()
    } as any;

    MockedConfiguration.mockImplementation(() => mockConfig);

    // Setup mock SSA client
    mockSSAClient = {
      evaluateSecurity: jest.fn(),
      getAuditTrail: jest.fn(),
      validatePolicies: jest.fn(),
      getPolicies: jest.fn(),
      healthCheck: jest.fn()
    } as any;

    MockedSSAClient.mockImplementation(() => mockSSAClient);

    // Create AgentGuard instance
    agentGuard = new AgentGuard({
      apiKey: 'test-api-key',
      ssaUrl: 'https://test-ssa.example.com',
      agentId: 'test-agent'
    });
  });

  describe('Constructor', () => {
    it('should create instance with valid configuration', () => {
      expect(agentGuard).toBeInstanceOf(AgentGuard);
      expect(MockedConfiguration).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent'
      });
    });

    it('should create SSA client instance', () => {
      expect(MockedSSAClient).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('executeTool', () => {
    const mockToolExecutor = jest.fn();

    beforeEach(() => {
      mockToolExecutor.mockClear();
      mockConfig.get.mockReturnValue('test-agent');
    });

    it('should execute tool when security decision is allow', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-123',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'allow',
        reason: 'Tool is safe',
        riskLevel: 'low',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      mockToolExecutor.mockResolvedValue({ result: 'success' });

      const result = await agentGuard.executeTool(
        'test-tool',
        { param1: 'value1' },
        mockToolExecutor
      );

      expect(mockSSAClient.evaluateSecurity).toHaveBeenCalledWith({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
        context: undefined
      });

      expect(mockToolExecutor).toHaveBeenCalledWith('test-tool', { param1: 'value1' });

      expect(result).toEqual({
        success: true,
        data: { result: 'success' },
        securityDecision: mockDecision
      });
    });

    it('should deny tool execution when security decision is deny', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-124',
        agentId: 'test-agent',
        toolName: 'dangerous-tool',
        action: 'deny',
        reason: 'Tool is too risky',
        riskLevel: 'critical',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      const result = await agentGuard.executeTool(
        'dangerous-tool',
        { param1: 'value1' },
        mockToolExecutor
      );

      expect(mockToolExecutor).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: false,
        securityDecision: mockDecision,
        error: {
          code: 'SECURITY_DENIED',
          message: 'Tool execution denied: Tool is too risky',
          details: { riskLevel: 'critical' }
        }
      });
    });

    it('should transform tool execution when security decision is transform', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-125',
        agentId: 'test-agent',
        toolName: 'file-write',
        action: 'transform',
        reason: 'Convert to read-only',
        riskLevel: 'medium',
        timestamp: new Date().toISOString(),
        transformedRequest: {
          agentId: 'test-agent',
          toolName: 'file-read',
          parameters: { path: '/test.txt' }
        }
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      mockToolExecutor.mockResolvedValue({ content: 'file content' });

      const result = await agentGuard.executeTool(
        'file-write',
        { path: '/test.txt', content: 'data' },
        mockToolExecutor
      );

      expect(mockToolExecutor).toHaveBeenCalledWith('file-read', { path: '/test.txt' });

      expect(result).toEqual({
        success: true,
        data: { content: 'file content' },
        securityDecision: mockDecision
      });
    });

    it('should validate tool name', async () => {
      await expect(
        agentGuard.executeTool('', {}, mockToolExecutor)
      ).rejects.toThrow(AgentGuardValidationError);

      await expect(
        agentGuard.executeTool('invalid tool name!', {}, mockToolExecutor)
      ).rejects.toThrow(AgentGuardValidationError);
    });

    it('should validate tool parameters', async () => {
      await expect(
        agentGuard.executeTool('test-tool', null as any, mockToolExecutor)
      ).rejects.toThrow(AgentGuardValidationError);
    });

    it('should handle SSA evaluation errors', async () => {
      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: false,
        decision: {} as SecurityDecision,
        error: {
          code: 'SERVER_ERROR',
          message: 'SSA is unavailable'
        }
      });

      const result = await agentGuard.executeTool(
        'test-tool',
        { param1: 'value1' },
        mockToolExecutor
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('SSA is unavailable');
    });
  });

  describe('evaluateTool', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue('test-agent');
    });

    it('should evaluate security without executing tool', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-126',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'allow',
        reason: 'Tool is safe',
        riskLevel: 'low',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      const result = await agentGuard.evaluateTool(
        'test-tool',
        { param1: 'value1' }
      );

      expect(mockSSAClient.evaluateSecurity).toHaveBeenCalledWith({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
        context: undefined
      });

      expect(result).toEqual({
        success: true,
        decision: mockDecision
      });
    });

    it('should handle evaluation errors', async () => {
      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: false,
        decision: {} as SecurityDecision,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Connection failed'
        }
      });

      const result = await agentGuard.evaluateTool(
        'test-tool',
        { param1: 'value1' }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Connection failed');
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail', async () => {
      const mockAuditTrail = {
        entries: [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            agentId: 'test-agent',
            toolName: 'test-tool',
            action: 'allow' as const,
            reason: 'Safe operation',
            riskLevel: 'low' as const,
            requestId: 'req-127'
          }
        ],
        totalCount: 1,
        hasMore: false
      };

      mockSSAClient.getAuditTrail.mockResolvedValue(mockAuditTrail);

      const result = await agentGuard.getAuditTrail();

      expect(mockSSAClient.getAuditTrail).toHaveBeenCalledWith('test-agent', {});
      expect(result).toEqual(mockAuditTrail);
    });

    it('should pass filter options to SSA client', async () => {
      const filters = {
        limit: 50,
        offset: 10
      };

      mockSSAClient.getAuditTrail.mockResolvedValue({
        entries: [],
        totalCount: 0,
        hasMore: false
      });

      await agentGuard.getAuditTrail(filters);

      expect(mockSSAClient.getAuditTrail).toHaveBeenCalledWith('test-agent', filters);
    });
  });

  describe('validatePolicies', () => {
    it('should validate security policies', async () => {
      const mockPolicies = [{
        name: 'test-policy',
        action: 'allow' as const,
        reason: 'Test policy',
        conditions: [
          { type: 'tool_name' as const, pattern: 'safe-*' }
        ]
      }];

      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      mockSSAClient.validatePolicies.mockResolvedValue(mockValidationResult);

      const result = await agentGuard.validatePolicies(mockPolicies);

      expect(mockSSAClient.validatePolicies).toHaveBeenCalledWith(mockPolicies);
      expect(result).toEqual(mockValidationResult);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue('test-agent');
    });

    it('should handle tool executor errors gracefully', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-128',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'allow',
        reason: 'Tool is safe',
        riskLevel: 'low',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      const mockToolExecutor = jest.fn().mockRejectedValue(new Error('Tool execution failed'));

      const result = await agentGuard.executeTool(
        'test-tool',
        { param1: 'value1' },
        mockToolExecutor
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Tool execution failed');
    });

    it('should handle unknown security actions', async () => {
      const mockDecision = {
        requestId: 'req-129',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'unknown-action' as any,
        reason: 'Unknown action',
        riskLevel: 'medium',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      const mockToolExecutor = jest.fn();

      await expect(
        agentGuard.executeTool('test-tool', {}, mockToolExecutor)
      ).rejects.toThrow(AgentGuardValidationError);
    });
  });

  describe('Debug Logging', () => {
    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'agentId') return 'test-agent';
        if (key === 'debug') return true;
        return undefined;
      });

      // Mock console.log
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log debug information when debug is enabled', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-130',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'deny',
        reason: 'Tool is risky',
        riskLevel: 'high',
        timestamp: new Date().toISOString()
      };

      mockSSAClient.evaluateSecurity.mockResolvedValue({
        success: true,
        decision: mockDecision
      });

      await agentGuard.executeTool('test-tool', {}, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        '[AgentGuard SDK] Tool denied:',
        'Tool is risky'
      );
    });
  });
});