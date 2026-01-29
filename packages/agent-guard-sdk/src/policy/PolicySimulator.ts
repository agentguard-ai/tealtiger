/**
 * Policy Simulation Utilities
 * 
 * This module provides utilities for simulating policy behavior
 * and testing policy effectiveness with various scenarios
 */

import {
  SecurityPolicy,
  ToolExecutionRequest,
  SecurityDecision,
  RiskLevel
} from '../types';
import { PolicyTester, PolicyTestResult } from './PolicyTester';

/**
 * Simulation scenario definition
 */
export interface SimulationScenario {
  /** Name of the scenario */
  name: string;
  
  /** Description of what this scenario tests */
  description: string;
  
  /** List of requests to simulate */
  requests: ToolExecutionRequest[];
  
  /** Expected outcomes for each request */
  expectedOutcomes?: Partial<SecurityDecision>[];
  
  /** Tags for categorizing scenarios */
  tags?: string[];
}

/**
 * Simulation result for a single request
 */
export interface SimulationRequestResult {
  /** The original request */
  request: ToolExecutionRequest;
  
  /** Policy test result */
  policyResult: PolicyTestResult;
  
  /** Expected outcome (if provided) */
  expected?: Partial<SecurityDecision> | undefined;
  
  /** Whether the result matches expectations */
  matchesExpected?: boolean | undefined;
  
  /** Performance metrics */
  performance: {
    /** Evaluation time in milliseconds */
    evaluationTime: number;
    
    /** Number of policies evaluated */
    policiesEvaluated: number;
  };
}

/**
 * Complete simulation result
 */
export interface SimulationResult {
  /** Scenario information */
  scenario: SimulationScenario;
  
  /** Results for each request */
  requestResults: SimulationRequestResult[];
  
  /** Summary statistics */
  summary: {
    /** Total requests simulated */
    totalRequests: number;
    
    /** Requests that were allowed */
    allowed: number;
    
    /** Requests that were denied */
    denied: number;
    
    /** Requests that were transformed */
    transformed: number;
    
    /** Requests matching expectations (if provided) */
    matchingExpected?: number | undefined;
    
    /** Success rate (if expectations provided) */
    successRate?: number | undefined;
    
    /** Average evaluation time */
    averageEvaluationTime: number;
    
    /** Total evaluation time */
    totalEvaluationTime: number;
  };
  
  /** Risk distribution */
  riskDistribution: Record<RiskLevel, number>;
  
  /** Policy usage statistics */
  policyUsage: Record<string, number>;
}

/**
 * Batch simulation result for multiple scenarios
 */
export interface BatchSimulationResult {
  /** Individual scenario results */
  scenarioResults: SimulationResult[];
  
  /** Aggregate statistics */
  aggregate: {
    /** Total scenarios run */
    totalScenarios: number;
    
    /** Total requests across all scenarios */
    totalRequests: number;
    
    /** Overall success rate */
    overallSuccessRate?: number | undefined;
    
    /** Performance summary */
    performance: {
      /** Average evaluation time per request */
      averageEvaluationTime: number;
      
      /** Slowest scenario */
      slowestScenario: string;
      
      /** Fastest scenario */
      fastestScenario: string;
    };
    
    /** Most and least used policies */
    policyUsage: {
      mostUsed: string;
      leastUsed: string;
      usage: Record<string, number>;
    };
  };
}

/**
 * Policy simulation engine
 */
export class PolicySimulator {
  private tester: PolicyTester;
  private policies: SecurityPolicy[];

  constructor(policies: SecurityPolicy[]) {
    this.policies = [...policies];
    this.tester = new PolicyTester(policies);
  }

  /**
   * Run a single simulation scenario
   */
  async runScenario(scenario: SimulationScenario): Promise<SimulationResult> {
    const requestResults: SimulationRequestResult[] = [];
    const policyUsage: Record<string, number> = {};
    let totalEvaluationTime = 0;

    // Initialize policy usage counters
    for (const policy of this.policies) {
      policyUsage[policy.name] = 0;
    }

    // Process each request
    for (let i = 0; i < scenario.requests.length; i++) {
      const request = scenario.requests[i];
      const expected = scenario.expectedOutcomes?.[i];

      const startTime = performance.now();
      const policyResult = this.tester.testRequest(request);
      const endTime = performance.now();

      const evaluationTime = endTime - startTime;
      totalEvaluationTime += evaluationTime;

      // Track policy usage
      if (policyResult.matched && policyResult.action) {
        // Find which policy was used (simplified - assumes policy names are unique)
        const matchedPolicy = this.policies.find(p => 
          this.tester.testPolicyAgainstRequest(p, request).matched
        );
        if (matchedPolicy) {
          policyUsage[matchedPolicy.name]++;
        }
      }

      const requestResult: SimulationRequestResult = {
        request,
        policyResult,
        expected,
        performance: {
          evaluationTime,
          policiesEvaluated: this.policies.length
        }
      };

      // Check if result matches expectations
      if (expected) {
        requestResult.matchesExpected = this.matchesExpected(policyResult, expected);
      }

      requestResults.push(requestResult);
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(requestResults, totalEvaluationTime);
    const riskDistribution = this.calculateRiskDistribution(requestResults);

    return {
      scenario,
      requestResults,
      summary,
      riskDistribution,
      policyUsage
    };
  }

  /**
   * Run multiple simulation scenarios
   */
  async runBatchSimulation(scenarios: SimulationScenario[]): Promise<BatchSimulationResult> {
    const scenarioResults: SimulationResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      scenarioResults.push(result);
    }

    const aggregate = this.calculateAggregateStatistics(scenarioResults);

    return {
      scenarioResults,
      aggregate
    };
  }

  /**
   * Generate common simulation scenarios
   */
  static generateCommonScenarios(): SimulationScenario[] {
    return [
      {
        name: 'Basic Operations',
        description: 'Test basic allow/deny behavior for common operations',
        requests: [
          {
            agentId: 'test-agent',
            toolName: 'web-search',
            parameters: { query: 'test query' }
          },
          {
            agentId: 'test-agent',
            toolName: 'file-read',
            parameters: { path: '/safe/file.txt' }
          },
          {
            agentId: 'test-agent',
            toolName: 'system-admin',
            parameters: { command: 'rm -rf /' }
          }
        ],
        expectedOutcomes: [
          { action: 'allow' },
          { action: 'allow' },
          { action: 'deny' }
        ],
        tags: ['basic', 'security']
      },

      {
        name: 'Parameter Filtering',
        description: 'Test parameter filtering and anonymization',
        requests: [
          {
            agentId: 'test-agent',
            toolName: 'api-call',
            parameters: { 
              url: 'https://api.example.com',
              password: 'secret123',
              data: 'normal data'
            }
          },
          {
            agentId: 'test-agent',
            toolName: 'database-query',
            parameters: {
              query: 'SELECT * FROM users',
              token: 'auth-token-123'
            }
          }
        ],
        expectedOutcomes: [
          { action: 'transform' },
          { action: 'transform' }
        ],
        tags: ['transformation', 'privacy']
      },

      {
        name: 'Risk Level Scenarios',
        description: 'Test different risk level handling',
        requests: [
          {
            agentId: 'low-risk-agent',
            toolName: 'web-search',
            parameters: { query: 'weather' }
          },
          {
            agentId: 'medium-risk-agent',
            toolName: 'file-write',
            parameters: { path: '/tmp/test.txt', content: 'test' }
          },
          {
            agentId: 'high-risk-agent',
            toolName: 'system-command',
            parameters: { command: 'ls -la' }
          },
          {
            agentId: 'critical-agent',
            toolName: 'credential-access',
            parameters: { service: 'production-db' }
          }
        ],
        tags: ['risk-assessment', 'security']
      },

      {
        name: 'Agent-Specific Policies',
        description: 'Test agent-specific access controls',
        requests: [
          {
            agentId: 'admin-agent',
            toolName: 'system-admin',
            parameters: { command: 'restart service' }
          },
          {
            agentId: 'readonly-agent',
            toolName: 'system-admin',
            parameters: { command: 'restart service' }
          },
          {
            agentId: 'data-agent',
            toolName: 'database-write',
            parameters: { table: 'analytics', data: {} }
          },
          {
            agentId: 'search-agent',
            toolName: 'database-write',
            parameters: { table: 'analytics', data: {} }
          }
        ],
        expectedOutcomes: [
          { action: 'allow' },
          { action: 'deny' },
          { action: 'allow' },
          { action: 'deny' }
        ],
        tags: ['access-control', 'agent-specific']
      },

      {
        name: 'Edge Cases',
        description: 'Test edge cases and unusual scenarios',
        requests: [
          {
            agentId: '',
            toolName: 'test-tool',
            parameters: {}
          },
          {
            agentId: 'test-agent',
            toolName: '',
            parameters: {}
          },
          {
            agentId: 'test-agent',
            toolName: 'test-tool',
            parameters: null as any
          }
        ],
        tags: ['edge-cases', 'validation']
      },

      {
        name: 'Performance Test',
        description: 'Test policy evaluation performance with many requests',
        requests: Array.from({ length: 100 }, (_, i) => ({
          agentId: `agent-${i % 10}`,
          toolName: `tool-${i % 5}`,
          parameters: { index: i }
        })),
        tags: ['performance', 'load-test']
      }
    ];
  }

  /**
   * Generate stress test scenarios
   */
  static generateStressTestScenarios(requestCount: number = 1000): SimulationScenario[] {
    const toolNames = [
      'web-search', 'file-read', 'file-write', 'database-query', 
      'api-call', 'system-command', 'credential-access'
    ];
    
    const agentIds = [
      'admin-agent', 'readonly-agent', 'data-agent', 'search-agent', 'test-agent'
    ];

    const requests: ToolExecutionRequest[] = [];
    
    for (let i = 0; i < requestCount; i++) {
      requests.push({
        agentId: agentIds[i % agentIds.length],
        toolName: toolNames[i % toolNames.length],
        parameters: {
          index: i,
          timestamp: Date.now(),
          random: Math.random()
        }
      });
    }

    return [{
      name: 'Stress Test',
      description: `Performance test with ${requestCount} requests`,
      requests,
      tags: ['stress-test', 'performance']
    }];
  }

  /**
   * Check if result matches expected outcome
   */
  private matchesExpected(result: PolicyTestResult, expected: Partial<SecurityDecision>): boolean {
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

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    requestResults: SimulationRequestResult[], 
    totalEvaluationTime: number
  ): SimulationResult['summary'] {
    const totalRequests = requestResults.length;
    let allowed = 0;
    let denied = 0;
    let transformed = 0;
    let matchingExpected = 0;

    for (const result of requestResults) {
      switch (result.policyResult.action) {
        case 'allow':
          allowed++;
          break;
        case 'deny':
          denied++;
          break;
        case 'transform':
          transformed++;
          break;
      }

      if (result.matchesExpected === true) {
        matchingExpected++;
      }
    }

    const hasExpectations = requestResults.some(r => r.expected !== undefined);
    const successRate = hasExpectations ? matchingExpected / totalRequests : undefined;

    return {
      totalRequests,
      allowed,
      denied,
      transformed,
      matchingExpected: hasExpectations ? matchingExpected : undefined,
      successRate,
      averageEvaluationTime: totalRequests > 0 ? totalEvaluationTime / totalRequests : 0,
      totalEvaluationTime
    };
  }

  /**
   * Calculate risk distribution
   */
  private calculateRiskDistribution(requestResults: SimulationRequestResult[]): Record<RiskLevel, number> {
    const distribution: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const result of requestResults) {
      distribution[result.policyResult.riskLevel]++;
    }

    return distribution;
  }

  /**
   * Calculate aggregate statistics for batch simulation
   */
  private calculateAggregateStatistics(scenarioResults: SimulationResult[]): BatchSimulationResult['aggregate'] {
    const totalScenarios = scenarioResults.length;
    const totalRequests = scenarioResults.reduce((sum, result) => sum + result.summary.totalRequests, 0);

    // Calculate overall success rate
    let totalMatching = 0;
    let totalWithExpectations = 0;
    
    for (const result of scenarioResults) {
      if (result.summary.matchingExpected !== undefined) {
        totalMatching += result.summary.matchingExpected;
        totalWithExpectations += result.summary.totalRequests;
      }
    }

    const overallSuccessRate = totalWithExpectations > 0 ? totalMatching / totalWithExpectations : undefined;

    // Calculate performance statistics
    const evaluationTimes = scenarioResults.map(r => r.summary.averageEvaluationTime);
    const averageEvaluationTime = evaluationTimes.reduce((sum, time) => sum + time, 0) / evaluationTimes.length;

    const scenarioTotalTimes = scenarioResults.map(r => ({ 
      name: r.scenario.name, 
      time: r.summary.totalEvaluationTime 
    }));
    scenarioTotalTimes.sort((a, b) => a.time - b.time);

    const slowestScenario = scenarioTotalTimes[scenarioTotalTimes.length - 1]?.name || '';
    const fastestScenario = scenarioTotalTimes[0]?.name || '';

    // Aggregate policy usage
    const aggregatedPolicyUsage: Record<string, number> = {};
    
    for (const result of scenarioResults) {
      for (const [policyName, usage] of Object.entries(result.policyUsage)) {
        aggregatedPolicyUsage[policyName] = (aggregatedPolicyUsage[policyName] || 0) + usage;
      }
    }

    const policyUsageEntries = Object.entries(aggregatedPolicyUsage);
    policyUsageEntries.sort((a, b) => b[1] - a[1]);

    const mostUsed = policyUsageEntries[0]?.[0] || '';
    const leastUsed = policyUsageEntries[policyUsageEntries.length - 1]?.[0] || '';

    return {
      totalScenarios,
      totalRequests,
      overallSuccessRate,
      performance: {
        averageEvaluationTime,
        slowestScenario,
        fastestScenario
      },
      policyUsage: {
        mostUsed,
        leastUsed,
        usage: aggregatedPolicyUsage
      }
    };
  }
}

/**
 * Create a new policy simulator
 */
export function createPolicySimulator(policies: SecurityPolicy[]): PolicySimulator {
  return new PolicySimulator(policies);
}