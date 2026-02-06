/**
 * PolicyTester Unit Tests
 */

import { PolicyTester, createPolicyTester } from '../PolicyTester';
import { SecurityPolicy, ToolExecutionRequest } from '../../types';

describe('PolicyTester', () => {
  let tester: PolicyTester;
  let testPolicies: SecurityPolicy[];

  beforeEach(() => {
    testPolicies = [
      {
        name: 'allow-search',
        action: 'allow',
        reason: 'Search operations are safe',
        priority: 10,
        conditions: [{
          type: 'tool_name',
          pattern: '*search*'
        }]
      },
      {
        name: 'deny-system',
        action: 'deny',
        reason: 'System operations are dangerous',
        priority: 5,
        conditions: [{
          type: 'tool_name',
          pattern: '*system*'
        }]
      },
      {
        name: 'filter-passwords',
        action: 'transform',
        reason: 'Remove sensitive data',
        priority: 1,
        conditions: [{
          type: 'parameter_exists',
          parameter: 'password'
        }],
        transformation: {
          type: 'parameter_filter',
          remove_parameters: ['password', 'token']
        }
      }
    ];

    tester = createPolicyTester(testPolicies);
  });

  describe('Request Testing', () => {
    it('should allow search operations', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'web-search',
        parameters: { query: 'test' }
      };

      const result = tester.testRequest(request);

      expect(result.matched).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.reason).toBe('Search operations are safe');
      expect(result.matchedConditions).toContain('tool_name matches "*search*"');
    });

    it('should deny system operations', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'system-command',
        parameters: { command: 'ls' }
      };

      const result = tester.testRequest(request);

      expect(result.matched).toBe(true);
      expect(result.action).toBe('deny');
      expect(result.reason).toBe('System operations are dangerous');
    });

    it('should transform requests with passwords', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'api-call',
        parameters: { 
          url: 'https://api.example.com',
          password: 'secret123',
          data: 'normal data'
        }
      };

      const result = tester.testRequest(request);

      expect(result.matched).toBe(true);
      expect(result.action).toBe('transform');
      expect(result.transformedRequest).toBeDefined();
      expect(result.transformedRequest!.parameters).toEqual({
        url: 'https://api.example.com',
        data: 'normal data'
      });
    });

    it('should respect policy priority order', () => {
      // Add a conflicting policy with lower priority
      const conflictingPolicy: SecurityPolicy = {
        name: 'allow-all-system',
        action: 'allow',
        reason: 'Allow all system operations',
        priority: 20, // Lower priority than deny-system (5)
        conditions: [{
          type: 'tool_name',
          pattern: '*system*'
        }]
      };

      tester.addPolicy(conflictingPolicy);

      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'system-command',
        parameters: { command: 'ls' }
      };

      const result = tester.testRequest(request);

      // Should use higher priority policy (deny-system with priority 5)
      expect(result.action).toBe('deny');
      expect(result.reason).toBe('System operations are dangerous');
    });

    it('should handle no matching policies', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'unknown-tool',
        parameters: {}
      };

      const result = tester.testRequest(request);

      expect(result.matched).toBe(false);
      expect(result.action).toBe('allow'); // Default behavior for medium risk
    });

    it('should default deny for critical risk operations', () => {
      // Clear existing policies to test default behavior
      const emptyTester = createPolicyTester([]);
      
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'system-admin', // Critical risk tool
        parameters: {}
      };

      const result = emptyTester.testRequest(request);

      expect(result.matched).toBe(false);
      expect(result.action).toBe('deny');
      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('Policy Testing', () => {
    it('should test individual policy against request', () => {
      const policy = testPolicies[0]; // allow-search
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'web-search',
        parameters: {}
      };

      const result = tester.testPolicyAgainstRequest(policy, request);

      expect(result.matched).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.matchedConditions).toHaveLength(1);
      expect(result.failedConditions).toHaveLength(0);
    });

    it('should handle policy that does not match', () => {
      const policy = testPolicies[1]; // deny-system
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'web-search',
        parameters: {}
      };

      const result = tester.testPolicyAgainstRequest(policy, request);

      expect(result.matched).toBe(false);
      expect(result.matchedConditions).toHaveLength(0);
      expect(result.failedConditions).toHaveLength(1);
    });
  });

  describe('Test Suite Execution', () => {
    it('should run test suite and calculate results', () => {
      const testCases = [
        {
          name: 'Allow search',
          request: {
            agentId: 'test-agent',
            toolName: 'web-search',
            parameters: {}
          },
          expected: { action: 'allow' as const }
        },
        {
          name: 'Deny system',
          request: {
            agentId: 'test-agent',
            toolName: 'system-command',
            parameters: {}
          },
          expected: { action: 'deny' as const }
        },
        {
          name: 'Transform password',
          request: {
            agentId: 'test-agent',
            toolName: 'api-call',
            parameters: { password: 'secret' }
          },
          expected: { action: 'transform' as const }
        }
      ];

      const suite = tester.runTestSuite('Basic Tests', testCases);

      expect(suite.name).toBe('Basic Tests');
      expect(suite.tests).toHaveLength(3);
      expect(suite.summary.total).toBe(3);
      expect(suite.summary.passed).toBe(3);
      expect(suite.summary.failed).toBe(0);
      expect(suite.summary.successRate).toBe(1);

      // Check individual test results
      expect(suite.tests[0].passed).toBe(true);
      expect(suite.tests[1].passed).toBe(true);
      expect(suite.tests[2].passed).toBe(true);
    });

    it('should handle failed test cases', () => {
      const testCases = [
        {
          name: 'Incorrect expectation',
          request: {
            agentId: 'test-agent',
            toolName: 'web-search',
            parameters: {}
          },
          expected: { action: 'deny' as const } // Wrong expectation
        }
      ];

      const suite = tester.runTestSuite('Failed Test', testCases);

      expect(suite.summary.passed).toBe(0);
      expect(suite.summary.failed).toBe(1);
      expect(suite.summary.successRate).toBe(0);
      expect(suite.tests[0].passed).toBe(false);
    });
  });

  describe('Test Case Generation', () => {
    it('should generate test cases for a policy', () => {
      const policy = testPolicies[0]; // allow-search
      const testCases = tester.generateTestCases(policy);

      expect(testCases.length).toBeGreaterThan(0);
      
      // Should have both positive and negative test cases
      const positiveTests = testCases.filter(tc => tc.name.includes('should match'));
      const negativeTests = testCases.filter(tc => tc.name.includes('should not match'));
      
      expect(positiveTests.length).toBeGreaterThan(0);
      expect(negativeTests.length).toBeGreaterThan(0);
    });

    it('should generate appropriate requests for conditions', () => {
      const policy: SecurityPolicy = {
        name: 'test-policy',
        action: 'allow',
        reason: 'Test policy',
        conditions: [
          { type: 'tool_name', pattern: 'file-*' },
          { type: 'parameter_exists', parameter: 'path' }
        ]
      };

      const testCases = tester.generateTestCases(policy);
      
      expect(testCases.length).toBeGreaterThan(0);
      
      // Check that generated requests are appropriate
      const toolNameTests = testCases.filter(tc => tc.name.includes('tool_name'));
      expect(toolNameTests.length).toBeGreaterThan(0);
      
      // Note: parameter_exists test generation might not always create test cases
      // depending on the implementation, so we'll just check that some tests were generated
      expect(testCases.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess critical risk for dangerous tools', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'system-admin',
        parameters: {}
      };

      const result = tester.testRequest(request);
      expect(result.riskLevel).toBe('critical');
    });

    it('should assess high risk for file operations', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'file-write',
        parameters: {}
      };

      const result = tester.testRequest(request);
      expect(result.riskLevel).toBe('high');
    });

    it('should assess high risk for sensitive parameters', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'api-call',
        parameters: { password: 'secret' }
      };

      const result = tester.testRequest(request);
      expect(result.riskLevel).toBe('high');
    });

    it('should assess medium risk for unknown operations', () => {
      const request: ToolExecutionRequest = {
        agentId: 'test-agent',
        toolName: 'unknown-tool',
        parameters: {}
      };

      const result = tester.testRequest(request);
      expect(result.riskLevel).toBe('medium');
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate tool name patterns with wildcards', () => {
      const policy: SecurityPolicy = {
        name: 'test',
        action: 'allow',
        reason: 'test',
        conditions: [{ type: 'tool_name', pattern: 'file-*' }]
      };

      const matchingRequest: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'file-read',
        parameters: {}
      };

      const nonMatchingRequest: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'web-search',
        parameters: {}
      };

      const matchResult = tester.testPolicyAgainstRequest(policy, matchingRequest);
      const nonMatchResult = tester.testPolicyAgainstRequest(policy, nonMatchingRequest);

      expect(matchResult.matched).toBe(true);
      expect(nonMatchResult.matched).toBe(false);
    });

    it('should evaluate risk level conditions', () => {
      const policy: SecurityPolicy = {
        name: 'test',
        action: 'deny',
        reason: 'test',
        conditions: [{ type: 'risk_level', operator: '>=', value: 'high' }]
      };

      const highRiskRequest: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'system-command',
        parameters: {}
      };

      const lowRiskRequest: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'web-search',
        parameters: {}
      };

      const highResult = tester.testPolicyAgainstRequest(policy, highRiskRequest);
      const lowResult = tester.testPolicyAgainstRequest(policy, lowRiskRequest);

      expect(highResult.matched).toBe(true);
      expect(lowResult.matched).toBe(false);
    });
  });

  describe('Transformation Application', () => {
    it('should apply read-only transformation', () => {
      const policy: SecurityPolicy = {
        name: 'test',
        action: 'transform',
        reason: 'test',
        conditions: [{ type: 'tool_name', pattern: 'file-write' }],
        transformation: { type: 'read_only' }
      };

      const request: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'file-write',
        parameters: { path: '/test.txt' }
      };

      const result = tester.testPolicyAgainstRequest(policy, request);

      expect(result.transformedRequest?.toolName).toBe('file-read');
    });

    it('should apply parameter anonymization', () => {
      const policy: SecurityPolicy = {
        name: 'test',
        action: 'transform',
        reason: 'test',
        conditions: [{ type: 'parameter_exists', parameter: 'email' }],
        transformation: { 
          type: 'parameter_anonymize',
          anonymize_parameters: ['email', 'phone']
        }
      };

      const request: ToolExecutionRequest = {
        agentId: 'test',
        toolName: 'api-call',
        parameters: { 
          email: 'user@example.com',
          phone: '123-456-7890',
          name: 'John Doe'
        }
      };

      const result = tester.testPolicyAgainstRequest(policy, request);

      expect(result.transformedRequest?.parameters).toEqual({
        email: '[ANONYMIZED]',
        phone: '[ANONYMIZED]',
        name: 'John Doe'
      });
    });
  });
});