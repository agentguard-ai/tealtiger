/**
 * Advanced Usage Example - TypeScript
 * 
 * This example shows advanced features of the TealTiger SDK
 */

import { 
  TealTiger, 
  TealTigerConfig, 
  SecurityDecision, 
  ToolExecutionResult,
  isTealTigerError,
  TealTigerErrorCode
} from 'tealtiger';

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
    }
  }

  /**
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
    }
  }

  /**
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
    console.log('===========================================');

    await this.evaluateOnly();
    await this.customToolExecution();
    await this.policyManagement();
    await this.auditAnalysis();
    await this.statisticsMonitoring();

    console.log('\n✅ All examples completed!');
  }
}

// Run the advanced example
async function main(): Promise<void> {
  const config: Partial<TealTigerConfig> = {
    apiKey: 'test-api-key-12345',
    ssaUrl: 'http://localhost:3001',
    agentId: 'advanced-example-agent',
    timeout: 10000,
    retries: 2
  };

  const example = new AdvancedAgentExample(config);
  
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