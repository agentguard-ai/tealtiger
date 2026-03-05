/**
 * Advanced Usage Example - TypeScript
 * 
<<<<<<< HEAD
 * This example shows advanced features of TealTiger SDK v1.1.0
 * including TealEngine, TealMonitor, TealCircuit, and TealAudit.
 */

import { 
  TealOpenAI,
  TealAnthropic,
  TealEngine,
  TealMonitor,
  TealCircuit,
  TealAudit
} from 'tealtiger';

class AdvancedAgentExample {
  private openaiClient: TealOpenAI;
  private anthropicClient: TealAnthropic;
  private engine: TealEngine;
  private monitor: TealMonitor;
  private circuit: TealCircuit;
  private audit: TealAudit;

  constructor() {
    // Initialize TealEngine with custom policy
    this.engine = new TealEngine({
      tools: {
        'chat': { allowed: true },
        'file_read': { allowed: true },
        'file_write': { allowed: false },
        'code_execution': { allowed: false }
      },
      identity: {
        agentId: 'advanced-agent-001',
        role: 'assistant',
        permissions: ['read', 'chat'],
        forbidden: ['write', 'execute']
      },
      codeExecution: {
        allowedLanguages: [],
        blockedPatterns: ['eval', 'exec', 'system'],
        sandboxRequired: true
      },
      behavioral: {
        costLimit: {
          daily: 20.00,
          hourly: 5.00
        },
        rateLimit: {
          requests: 200,
          window: '1h'
        }
      }
    });

    // Initialize TealMonitor for anomaly detection
    this.monitor = new TealMonitor({
      agentId: 'advanced-agent-001',
      baselineWindow: 100,
      anomalyThreshold: 2.0,
      onAnomaly: (anomaly) => {
        console.log('🚨 Anomaly detected:', anomaly);
      }
    });

    // Initialize TealCircuit for resilience
    this.circuit = new TealCircuit({
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenRequests: 3,
      onStateChange: (oldState, newState) => {
        console.log(`🔄 Circuit breaker: ${oldState} → ${newState}`);
      }
    });

    // Initialize TealAudit for logging
    this.audit = new TealAudit({
      outputs: [
        { type: 'console', level: 'info' },
        { 
          type: 'file', 
          path: './logs/advanced-agent.log',
          maxSize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }
      ]
    });

    // Initialize clients
    this.openaiClient = new TealOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      agentId: 'advanced-agent-001',
      engine: this.engine,
      monitor: this.monitor,
      circuit: this.circuit,
      audit: this.audit
    });

    this.anthropicClient = new TealAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
      agentId: 'advanced-agent-001',
      engine: this.engine,
      monitor: this.monitor,
      circuit: this.circuit,
      audit: this.audit
    });
  }

  /**
   * Example 1: Multi-provider usage
   */
  async multiProviderExample(): Promise<void> {
    console.log('\n🔀 Multi-Provider Example');
    console.log('=========================');

    try {
      // OpenAI request
      console.log('\n1. OpenAI Request');
      const openaiResponse = await this.openaiClient.chat.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'What is TypeScript?' }
        ]
      });

      console.log('✅ OpenAI response received');
      console.log('Response:', openaiResponse.choices[0].message.content?.substring(0, 100) + '...');

      // Anthropic request
      console.log('\n2. Anthropic Request');
      const anthropicResponse = await this.anthropicClient.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: 'What is TypeScript?' }
        ]
      });

      console.log('✅ Anthropic response received');
      console.log('Response:', anthropicResponse.content[0].text?.substring(0, 100) + '...');

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Example 2: Monitoring and anomaly detection
   */
  async monitoringExample(): Promise<void> {
    console.log('\n📊 Monitoring Example');
    console.log('=====================');

    try {
      // Make several requests to build baseline
      console.log('\nBuilding baseline with normal requests...');
      for (let i = 0; i < 10; i++) {
        await this.openaiClient.chat.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: `Request ${i + 1}` }
          ]
        });
      }

      console.log('✅ Baseline established');

      // Get metrics
      const metrics = this.monitor.getMetrics();
      console.log('\nCurrent Metrics:');
      console.log('- Total requests:', metrics.totalRequests);
      console.log('- Total cost:', `$${metrics.totalCost.toFixed(4)}`);
      console.log('- Average cost:', `$${metrics.averageCost.toFixed(4)}`);
      console.log('- Tool usage:', metrics.toolUsage);

    } catch (error: any) {
      console.error('❌ Error:', error.message);
=======
 * This example shows advanced features of the TealTiger SDK
 */

import { 
  TealTiger, 
  TealTigerConfig, 
  SecurityDecision, 
  ToolExecutionResult,
  isTealTigerError,
  TealTigerErrorCode
} from '../src/index';

interface CustomToolResult {
  success: boolean;
  data?: any;
  metadata?: Record<string, unknown>;
}

class AdvancedAgentExample {
  private tealTiger: TealTiger;

  constructor(config: Partial<TealTigerConfig>) {
    this.tealTiger = new TealTiger({
      ...config,
      debug: true
    });
  }

  /**
   * Example of security evaluation without execution
   */
  async evaluateOnly(): Promise<void> {
    console.log('\n🔍 Security Evaluation Only');
    console.log('============================');

    try {
      const decision = await this.tealTiger.evaluateTool(
        'database-write',
        { 
          table: 'users', 
          data: { name: 'John', email: 'john@example.com' } 
        }
      );

      console.log('Security Decision:', {
        action: decision.action,
        reason: decision.reason,
        riskLevel: decision.riskLevel
      });

      if (decision.action === 'allow') {
        console.log('✅ Tool would be allowed');
      } else if (decision.action === 'deny') {
        console.log('❌ Tool would be denied');
      } else if (decision.action === 'transform') {
        console.log('🔄 Tool would be transformed');
        console.log('Transformed request:', decision.transformedRequest);
      }

    } catch (error) {
      console.error('Evaluation failed:', error);
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
    }
  }

  /**
<<<<<<< HEAD
   * Example 3: Circuit breaker resilience
   */
  async circuitBreakerExample(): Promise<void> {
    console.log('\n🔌 Circuit Breaker Example');
    console.log('==========================');

    try {
      // Simulate failures
      console.log('\nSimulating failures...');
      
      for (let i = 0; i < 3; i++) {
        try {
          await this.circuit.execute(async () => {
            throw new Error('Simulated failure');
          });
        } catch (error: any) {
          console.log(`Attempt ${i + 1}: ${error.message}`);
        }
      }

      // Check circuit state
      const state = this.circuit.getState();
      console.log('\nCircuit state:', state);

      // Get statistics
      const stats = this.circuit.getStatistics();
      console.log('Circuit statistics:');
      console.log('- Total requests:', stats.totalRequests);
      console.log('- Successful:', stats.successfulRequests);
      console.log('- Failed:', stats.failedRequests);
      console.log('- Rejected:', stats.rejectedRequests);

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Example 4: Audit trail analysis
   */
  async auditExample(): Promise<void> {
    console.log('\n📝 Audit Trail Example');
    console.log('======================');

    try {
      // Log some events
      this.audit.log({
        type: 'policy_evaluation',
        agentId: 'advanced-agent-001',
        action: 'chat.create',
        result: 'allowed',
        timestamp: new Date()
      });

      this.audit.log({
        type: 'guardrail_check',
        agentId: 'advanced-agent-001',
        guardrail: 'pii_detection',
        result: 'passed',
        timestamp: new Date()
      });

      // Query audit logs
      const logs = this.audit.query({
        agentId: 'advanced-agent-001',
        limit: 10
      });

      console.log(`\nFound ${logs.length} audit entries`);
      logs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.type} - ${log.result} (${log.timestamp.toISOString()})`);
      });

      // Export audit logs
      const exported = this.audit.export({
        format: 'json',
        agentId: 'advanced-agent-001'
      });

      console.log(`\nExported ${exported.length} bytes of audit data`);

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Example 5: Policy testing and validation
   */
  async policyExample(): Promise<void> {
    console.log('\n🔒 Policy Example');
    console.log('=================');

    try {
      // Validate policy
      const validation = this.engine.validate();
      console.log('\nPolicy validation:', validation.valid ? '✅ VALID' : '❌ INVALID');
      
      if (!validation.valid) {
        console.log('Errors:', validation.errors);
      }

      // Test different actions
      const testCases = [
        { action: 'chat.create', tool: 'chat', expected: true },
        { action: 'file.read', tool: 'file_read', expected: true },
        { action: 'file.write', tool: 'file_write', expected: false },
        { action: 'code.execute', tool: 'code_execution', expected: false }
      ];

      console.log('\nTesting policy:');
      testCases.forEach(({ action, tool, expected }) => {
        const result = this.engine.test({
          agentId: 'advanced-agent-001',
          action,
          tool,
          content: 'Test'
        });

        const status = result.allowed === expected ? '✅' : '❌';
        console.log(`${status} ${action}: ${result.allowed ? 'ALLOW' : 'BLOCK'} (expected: ${expected ? 'ALLOW' : 'BLOCK'})`);
      });

    } catch (error: any) {
      console.error('❌ Error:', error.message);
=======
   * Example with custom tool executor and error handling
   */
  async customToolExecution(): Promise<void> {
    console.log('\n🛠️ Custom Tool Execution');
    console.log('========================');

    const customExecutor = async (toolName: string, params: any): Promise<CustomToolResult> => {
      console.log(`Executing custom tool: ${toolName}`);
      
      // Simulate different tool behaviors
      switch (toolName) {
        case 'web-search':
          return {
            success: true,
            data: {
              query: params.query,
              results: ['Result 1', 'Result 2', 'Result 3']
            },
            metadata: { source: 'custom-search-engine' }
          };

        case 'file-read':
          return {
            success: true,
            data: {
              content: 'File content here...',
              size: 1024
            }
          };

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    };

    try {
      const result: ToolExecutionResult<CustomToolResult> = await this.tealTiger.executeTool(
        'web-search',
        { query: 'TypeScript best practices' },
        { 
          userAgent: 'AdvancedAgent/1.0',
          sessionId: 'session-123' 
        },
        customExecutor
      );

      if (result.success && result.data) {
        console.log('✅ Tool executed successfully');
        console.log('Result data:', result.data);
        console.log('Security decision:', result.securityDecision.action);
      } else {
        console.log('❌ Tool execution failed');
        console.log('Error:', result.error);
      }

    } catch (error) {
      if (isTealTigerError(error)) {
        console.error('TealTiger Error:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
      } else {
        console.error('Unknown error:', error);
      }
    }
  }

  /**
   * Example of policy management
   */
  async policyManagement(): Promise<void> {
    console.log('\n📋 Policy Management');
    console.log('====================');

    try {
      // Get current policies
      const policies = await this.tealTiger.getPolicies();
      console.log(`Current policies: ${policies.count} policies loaded`);
      console.log('Policy version:', policies.version);

      // Validate a custom policy
      const customPolicy = {
        name: 'allow-safe-apis',
        description: 'Allow calls to safe external APIs',
        conditions: [
          { type: 'tool_name' as const, pattern: 'api-call' },
          { type: 'parameter_exists' as const, parameter: 'url' }
        ],
        action: 'allow' as const,
        reason: 'Safe API calls are permitted'
      };

      const validation = await this.tealTiger.validatePolicies([customPolicy]);
      console.log('Policy validation:', validation);

    } catch (error) {
      console.error('Policy management failed:', error);
    }
  }

  /**
   * Example of audit trail analysis
   */
  async auditAnalysis(): Promise<void> {
    console.log('\n📊 Audit Trail Analysis');
    console.log('=======================');

    try {
      const auditTrail = await this.tealTiger.getAuditTrail({ limit: 10 });
      
      console.log(`Total audit entries: ${auditTrail.auditTrail.total}`);
      console.log(`Retrieved: ${auditTrail.auditTrail.entries.length} entries`);

      // Analyze decisions
      const decisions = auditTrail.auditTrail.entries.filter(
        entry => entry.type === 'security_decision'
      );

      const summary = decisions.reduce((acc, entry) => {
        const action = entry.action || 'unknown';
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Decision summary:', summary);

      // Show recent entries
      console.log('\nRecent entries:');
      auditTrail.auditTrail.entries.slice(0, 3).forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.timestamp}: ${entry.action} - ${entry.toolName}`);
      });

    } catch (error) {
      console.error('Audit analysis failed:', error);
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
    }
  }

  /**
<<<<<<< HEAD
   * Run all examples
   */
  async runAll(): Promise<void> {
    console.log('🚀 TealTiger SDK - Advanced Usage Examples (v1.1.0)');
    console.log('====================================================');

    await this.multiProviderExample();
    await this.monitoringExample();
    await this.circuitBreakerExample();
    await this.auditExample();
    await this.policyExample();
=======
   * Example of statistics monitoring
   */
  async statisticsMonitoring(): Promise<void> {
    console.log('\n📈 Statistics Monitoring');
    console.log('========================');

    const stats = this.tealTiger.getStatistics();
    
    console.log('SDK Statistics:');
    console.log(`- Total requests: ${stats.totalRequests}`);
    console.log(`- Allowed: ${stats.allowedRequests}`);
    console.log(`- Denied: ${stats.deniedRequests}`);
    console.log(`- Transformed: ${stats.transformedRequests}`);
    console.log(`- Errors: ${stats.errorCount}`);
    console.log(`- Average response time: ${stats.averageResponseTime.toFixed(2)}ms`);

    // Calculate success rate
    const successRate = stats.totalRequests > 0 
      ? ((stats.allowedRequests + stats.transformedRequests) / stats.totalRequests * 100).toFixed(1)
      : '0';
    
    console.log(`- Success rate: ${successRate}%`);
  }

  /**
   * Run all examples
   */
  async runAll(): Promise<void> {
    console.log('🚀 TealTiger SDK - Advanced Usage Examples');
    console.log('==========================================');

    await this.evaluateOnly();
    await this.customToolExecution();
    await this.policyManagement();
    await this.auditAnalysis();
    await this.statisticsMonitoring();
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a

    console.log('\n✅ All examples completed!');
  }
}

// Run the advanced example
async function main(): Promise<void> {
<<<<<<< HEAD
  const example = new AdvancedAgentExample();
=======
  const config: Partial<TealTigerConfig> = {
    apiKey: 'test-api-key-12345',
    ssaUrl: 'http://localhost:3001',
    agentId: 'advanced-example-agent',
    timeout: 10000,
    retries: 2
  };

  const example = new AdvancedAgentExample(config);
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
  
  try {
    await example.runAll();
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { AdvancedAgentExample };