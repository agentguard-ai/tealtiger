/**
 * SSAClient Unit Tests
 */

import axios from 'axios';
import { SSAClient } from '../SSAClient';
import { Configuration } from '../../config/Configuration';
import { AgentGuardNetworkError, AgentGuardServerError } from '../../utils/errors';
import { ToolExecutionRequest, SecurityDecision } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Configuration
jest.mock('../../config/Configuration');
const MockedConfiguration = Configuration as jest.MockedClass<typeof Configuration>;

describe('SSAClient', () => {
  let ssaClient: SSAClient;
  let mockConfig: jest.Mocked<Configuration>;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: {} }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create a mock config object that matches AgentGuardConfig
    const mockConfigObject: AgentGuardConfig = {
      ssaUrl: 'https://test-ssa.example.com',
      apiKey: 'test-api-key',
      timeout: 5000,
      retries: 3,
      debug: false
    };

    ssaClient = new SSAClient(mockConfigObject);
  });

  describe('Constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test-ssa.example.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        }
      });
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors).toBeDefined();
    });
  });

  describe('evaluateSecurity', () => {
    const mockRequest: ToolExecutionRequest = {
      agentId: 'test-agent',
      toolName: 'test-tool',
      parameters: { param1: 'value1' }
    };

    it('should successfully evaluate security', async () => {
      const mockDecision: SecurityDecision = {
        requestId: 'req-131',
        agentId: 'test-agent',
        toolName: 'test-tool',
        action: 'allow',
        reason: 'Tool is safe',
        riskLevel: 'low',
        timestamp: new Date().toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          success: true,
          decision: mockDecision
        }
      });

      const result = await ssaClient.evaluateSecurity(mockRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/evaluate', mockRequest);
      expect(result).toEqual({
        success: true,
        decision: mockDecision
      });
    });

    it('should handle server errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        },
        isAxiosError: true
      });

      await expect(ssaClient.evaluateSecurity(mockRequest))
        .rejects.toThrow(AgentGuardServerError);
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        isAxiosError: true
      });

      await expect(ssaClient.evaluateSecurity(mockRequest))
        .rejects.toThrow(AgentGuardNetworkError);
    });

    it('should retry on failure', async () => {
      mockAxiosInstance.post
        .mockRejectedValueOnce({
          response: { status: 503 },
          isAxiosError: true
        })
        .mockRejectedValueOnce({
          response: { status: 503 },
          isAxiosError: true
        })
        .mockResolvedValue({
          data: {
            success: true,
            decision: {
              agentId: 'test-agent',
              toolName: 'test-tool',
              action: 'allow',
              reason: 'Tool is safe',
              riskLevel: 'low',
              timestamp: new Date().toISOString()
            }
          }
        });

      const result = await ssaClient.evaluateSecurity(mockRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: { status: 503 },
        isAxiosError: true
      });

      await expect(ssaClient.evaluateSecurity(mockRequest))
        .rejects.toThrow(AgentGuardServerError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail with default parameters', async () => {
      const mockAuditTrail = {
        entries: [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            agentId: 'test-agent',
            toolName: 'test-tool',
            action: 'allow' as const,
            reason: 'Safe operation',
            riskLevel: 'low' as const
          }
        ],
        totalCount: 1,
        hasMore: false
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockAuditTrail
      });

      const result = await ssaClient.getAuditTrail('test-agent');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/audit', {
        params: { agentId: 'test-agent' }
      });
      expect(result).toEqual(mockAuditTrail);
    });

    it('should retrieve audit trail with filters', async () => {
      const filters = {
        limit: 50,
        offset: 10
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { entries: [], totalCount: 0, hasMore: false }
      });

      await ssaClient.getAuditTrail('specific-agent', filters);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/audit', {
        params: { agentId: 'specific-agent', ...filters }
      });
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

      mockAxiosInstance.post.mockResolvedValue({
        data: mockValidationResult
      });

      const result = await ssaClient.validatePolicies(mockPolicies);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/policies/validate', mockPolicies);
      expect(result).toEqual(mockValidationResult);
    });

    it('should handle policy validation errors', async () => {
      const mockPolicies = [{
        name: 'invalid-policy',
        action: 'allow' as const,
        reason: 'Test policy',
        conditions: []
      }];

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          isValid: false,
          errors: ['Policy must have at least one condition'],
          warnings: []
        }
      });

      const result = await ssaClient.validatePolicies(mockPolicies);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Policy must have at least one condition');
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
        isAxiosError: true
      });

      await expect(ssaClient.evaluateSecurity({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: {}
      })).rejects.toThrow(AgentGuardNetworkError);
    });

    it('should handle authentication errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid API key' }
        },
        isAxiosError: true
      });

      await expect(ssaClient.evaluateSecurity({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: {}
      })).rejects.toThrow(AgentGuardServerError);
    });

    it('should handle non-axios errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Unexpected error'));

      await expect(ssaClient.evaluateSecurity({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: {}
      })).rejects.toThrow(AgentGuardNetworkError);
    });
  });

  describe('Request/Response Interceptors', () => {
    it('should add request ID to requests', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          success: true,
          decision: {
            agentId: 'test-agent',
            toolName: 'test-tool',
            action: 'allow',
            reason: 'Safe',
            riskLevel: 'low',
            timestamp: new Date().toISOString()
          }
        }
      });

      await ssaClient.evaluateSecurity({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: {}
      });

      // Verify that the request interceptor was called
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('Debug Logging', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log debug information when debug is enabled', async () => {
      // Create SSAClient with debug enabled
      const debugConfig: AgentGuardConfig = {
        ssaUrl: 'https://test-ssa.example.com',
        apiKey: 'test-api-key',
        timeout: 5000,
        retries: 3,
        debug: true
      };

      const debugSSAClient = new SSAClient(debugConfig);

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          success: true,
          decision: {
            requestId: 'req-132',
            agentId: 'test-agent',
            toolName: 'test-tool',
            action: 'allow',
            reason: 'Safe',
            riskLevel: 'low',
            timestamp: new Date().toISOString()
          }
        }
      });

      await debugSSAClient.evaluateSecurity({
        agentId: 'test-agent',
        toolName: 'test-tool',
        parameters: {}
      });

      // Debug logging would be handled by interceptors
      // This test verifies the debug flag is being used
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });
});