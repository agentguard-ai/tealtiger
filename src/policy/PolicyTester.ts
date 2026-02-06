/**
 * Policy Testing Utilities
 * 
 * This module provides utilities for testing security policies locally
 * without requiring a running SSA instance
 */

import {
  SecurityPolicy,
  ToolExecutionRequest,
  SecurityDecision,
  SecurityAction,
  RiskLevel,
  PolicyCondition
} from '../types';

/**
 * Test result for a single policy evaluation
 */
export interface PolicyTestResult {
  /** Whether the policy matched the request */
  matched: boolean;
  
  /** The action that would be taken */
  action?: SecurityAction;
  
  /** The reason for the action */
  reason?: string;
  
  /** Risk level assessment */
  riskLevel: RiskLevel;
  
  /** Which conditions matched */
  matchedConditions: string[];
  
  /** Which conditions failed */
  failedConditions: string[];
  
  /** Transformed request (if action is transform) */
  transformedRequest?: ToolExecutionRequest;
}

/**
 * Test suite result
 */
export interface PolicyTestSuite {
  /** Name of the test suite */
  name: string;
  
  /** Individual test results */
  tests: Array<{
    name: string;
    request: ToolExecutionRequest;
    expected: Partial<SecurityDecision>;
    result: PolicyTestResult;
    passed: boolean;
  }>;
  
  /** Overall suite statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  };
}

/**
 * Local policy testing engine
 */
export class PolicyTester {
  private policies: SecurityPolicy[] = [];

  constructor(policies: SecurityPolicy[] = []) {
    this.policies = [...policies];
  }

  /**
   * Add a policy to test
   */
  addPolicy(policy: SecurityPolicy): PolicyTester {
    this.policies.push(policy);
    return this;
  }

  /**
   * Add multiple policies
   */
  addPolicies(policies: SecurityPolicy[]): PolicyTester {
    this.policies.push(...policies);
    return this;
  }

  /**
   * Clear all policies
   */
  clearPolicies(): PolicyTester {
    this.policies = [];
    return this;
  }

  /**
   * Test a single request against all policies
   */
  testRequest(request: ToolExecutionRequest): PolicyTestResult {
    const riskLevel = this.assessRisk(request);
    
    // Sort policies by priority (lower number = higher priority)
    const sortedPolicies = [...this.policies].sort((a, b) => 
      (a.priority || 999) - (b.priority || 999)
    );

    // Test each policy in priority order
    for (const policy of sortedPolicies) {
      const result = this.testPolicyAgainstRequest(policy, request, riskLevel);
      if (result.matched) {
        return result;
      }
    }

    // No policy matched - return default behavior
    return {
      matched: false,
      riskLevel,
      matchedConditions: [],
      failedConditions: [],
      action: riskLevel === 'critical' ? 'deny' : 'allow',
      reason: riskLevel === 'critical' 
        ? 'High risk operation denied by default'
        : 'No matching policy - allowed by default'
    };
  }

  /**
   * Test a policy against a specific request
   */
  testPolicyAgainstRequest(
    policy: SecurityPolicy, 
    request: ToolExecutionRequest, 
    riskLevel?: RiskLevel
  ): PolicyTestResult {
    const assessedRiskLevel = riskLevel || this.assessRisk(request);
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];

    // Test each condition
    for (const condition of policy.conditions) {
      const conditionResult = this.evaluateCondition(condition, request, assessedRiskLevel);
      const conditionName = this.getConditionName(condition);
      
      if (conditionResult) {
        matchedConditions.push(conditionName);
      } else {
        failedConditions.push(conditionName);
      }
    }

    // All conditions must match for policy to apply
    const matched = failedConditions.length === 0;

    const result: PolicyTestResult = {
      matched,
      riskLevel: assessedRiskLevel,
      matchedConditions,
      failedConditions
    };

    if (matched) {
      result.action = policy.action;
      result.reason = policy.reason;

      // Apply transformation if needed
      if (policy.action === 'transform' && policy.transformation) {
        result.transformedRequest = this.applyTransformation(request, policy.transformation);
      }
    }

    return result;
  }

  /**
   * Run a test suite
   */
  runTestSuite(
    suiteName: string,
    testCases: Array<{
      name: string;
      request: ToolExecutionRequest;
      expected: Partial<SecurityDecision>;
    }>
  ): PolicyTestSuite {
    const tests = testCases.map(testCase => {
      const result = this.testRequest(testCase.request);
      
      // Check if result matches expectations
      const passed = this.compareResults(result, testCase.expected);

      return {
        name: testCase.name,
        request: testCase.request,
        expected: testCase.expected,
        result,
        passed
      };
    });

    const summary = {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      successRate: 0
    };
    summary.successRate = summary.total > 0 ? summary.passed / summary.total : 0;

    return {
      name: suiteName,
      tests,
      summary
    };
  }

  /**
   * Generate test cases for a policy
   */
  generateTestCases(policy: SecurityPolicy): Array<{
    name: string;
    request: ToolExecutionRequest;
    expected: Partial<SecurityDecision>;
  }> {
    const testCases: Array<{
      name: string;
      request: ToolExecutionRequest;
      expected: Partial<SecurityDecision>;
    }> = [];

    // Generate positive test cases (should match)
    for (const condition of policy.conditions) {
      const request = this.generateRequestForCondition(condition, true);
      if (request) {
        testCases.push({
          name: `${policy.name} - should match (${this.getConditionName(condition)})`,
          request,
          expected: {
            action: policy.action,
            reason: policy.reason
          }
        });
      }
    }

    // Generate negative test cases (should not match)
    for (const condition of policy.conditions) {
      const request = this.generateRequestForCondition(condition, false);
      if (request) {
        testCases.push({
          name: `${policy.name} - should not match (${this.getConditionName(condition)})`,
          request,
          expected: {
            action: policy.action === 'allow' ? 'deny' : 'allow' // Opposite of policy action
          }
        });
      }
    }

    return testCases;
  }

  /**
   * Assess risk level of a request (simplified version)
   */
  private assessRisk(request: ToolExecutionRequest): RiskLevel {
    const { toolName, parameters } = request;

    // Critical risk tools
    const criticalRiskTools = [
      'system-admin', 'user-impersonation', 'credential-write',
      'security-bypass', 'privilege-escalation'
    ];

    // High risk tools
    const highRiskTools = [
      'file-write', 'file-delete', 'system-command',
      'database-write', 'external-api-call', 'credential-access'
    ];

    if (criticalRiskTools.some(tool => toolName.includes(tool))) {
      return 'critical';
    }

    if (highRiskTools.some(tool => toolName.includes(tool))) {
      return 'high';
    }

    // Check for sensitive parameters
    if (parameters) {
      const sensitiveParams = ['password', 'token', 'key', 'secret', 'credential'];
      const hasSensitiveParams = Object.keys(parameters).some(key =>
        sensitiveParams.some(sensitive => key.toLowerCase().includes(sensitive))
      );

      if (hasSensitiveParams) {
        return 'high';
      }
    }

    // Default to medium risk
    return 'medium';
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: PolicyCondition,
    request: ToolExecutionRequest,
    riskLevel: RiskLevel
  ): boolean {
    switch (condition.type) {
      case 'tool_name':
        return this.matchPattern(request.toolName, condition.pattern || '');

      case 'risk_level':
        return this.compareRiskLevel(riskLevel, condition.operator || '==', condition.value || 'medium');

      case 'agent_id':
        return this.matchPattern(request.agentId, condition.pattern || '');

      case 'parameter_exists':
        return request.parameters && 
               condition.parameter !== undefined &&
               request.parameters.hasOwnProperty(condition.parameter);

      case 'parameter_value':
        return request.parameters && 
               condition.parameter !== undefined &&
               request.parameters[condition.parameter] === condition.value;

      default:
        return false;
    }
  }

  /**
   * Pattern matching with wildcards
   */
  private matchPattern(value: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(value);
    }
    return value === pattern;
  }

  /**
   * Compare risk levels
   */
  private compareRiskLevel(current: RiskLevel, operator: string, target: string): boolean {
    const levels: Record<RiskLevel, number> = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const currentLevel = levels[current] || 2;
    const targetLevel = levels[target as RiskLevel] || 2;

    switch (operator) {
      case '>=': return currentLevel >= targetLevel;
      case '>': return currentLevel > targetLevel;
      case '<=': return currentLevel <= targetLevel;
      case '<': return currentLevel < targetLevel;
      case '==': return currentLevel === targetLevel;
      default: return false;
    }
  }

  /**
   * Apply transformation to request
   */
  private applyTransformation(
    request: ToolExecutionRequest,
    transformation: any
  ): ToolExecutionRequest {
    const transformed = { ...request };

    switch (transformation.type) {
      case 'read_only':
        transformed.toolName = transformed.toolName.replace('write', 'read');
        break;

      case 'parameter_filter':
        if (transformation.remove_parameters) {
          const newParams = { ...transformed.parameters };
          transformation.remove_parameters.forEach((param: string) => {
            delete newParams[param];
          });
          transformed.parameters = newParams;
        }
        break;

      case 'parameter_anonymize':
        if (transformation.anonymize_parameters) {
          const newParams = { ...transformed.parameters };
          transformation.anonymize_parameters.forEach((param: string) => {
            if (newParams[param]) {
              newParams[param] = '[ANONYMIZED]';
            }
          });
          transformed.parameters = newParams;
        }
        break;
    }

    return transformed;
  }

  /**
   * Get human-readable condition name
   */
  private getConditionName(condition: PolicyCondition): string {
    switch (condition.type) {
      case 'tool_name':
        return `tool_name matches "${condition.pattern}"`;
      case 'risk_level':
        return `risk_level ${condition.operator} ${condition.value}`;
      case 'agent_id':
        return `agent_id matches "${condition.pattern}"`;
      case 'parameter_exists':
        return `parameter "${condition.parameter}" exists`;
      case 'parameter_value':
        return `parameter "${condition.parameter}" equals "${condition.value}"`;
      default:
        return `unknown condition: ${condition.type}`;
    }
  }

  /**
   * Generate a request that matches/doesn't match a condition
   */
  private generateRequestForCondition(
    condition: PolicyCondition,
    shouldMatch: boolean
  ): ToolExecutionRequest | null {
    const baseRequest: ToolExecutionRequest = {
      agentId: 'test-agent',
      toolName: 'test-tool',
      parameters: {}
    };

    switch (condition.type) {
      case 'tool_name':
        baseRequest.toolName = shouldMatch 
          ? (condition.pattern || 'test-tool').replace('*', 'example')
          : 'different-tool';
        break;

      case 'agent_id':
        baseRequest.agentId = shouldMatch
          ? (condition.pattern || 'test-agent').replace('*', 'example')
          : 'different-agent';
        break;

      case 'parameter_exists':
        if (shouldMatch && condition.parameter) {
          baseRequest.parameters[condition.parameter] = 'test-value';
        }
        break;

      case 'parameter_value':
        if (condition.parameter) {
          baseRequest.parameters[condition.parameter] = shouldMatch
            ? condition.value
            : 'different-value';
        }
        break;

      case 'risk_level':
        // Generate tool name that produces desired risk level
        if (shouldMatch) {
          if (condition.value === 'critical') {
            baseRequest.toolName = 'system-admin';
          } else if (condition.value === 'high') {
            baseRequest.toolName = 'file-write';
          } else if (condition.value === 'low') {
            baseRequest.toolName = 'web-search';
          }
        }
        break;

      default:
        return null;
    }

    return baseRequest;
  }

  /**
   * Compare test result with expected result
   */
  private compareResults(result: PolicyTestResult, expected: Partial<SecurityDecision>): boolean {
    if (expected.action && result.action !== expected.action) {
      return false;
    }

    if (expected.reason && result.reason !== expected.reason) {
      return false;
    }

    if (expected.riskLevel && result.riskLevel !== expected.riskLevel) {
      return false;
    }

    return true;
  }
}

/**
 * Create a new policy tester
 */
export function createPolicyTester(policies?: SecurityPolicy[]): PolicyTester {
  return new PolicyTester(policies);
}