/**
 * Simple Agent Example - Shows how to use the AI Agent Security Platform
 * 
 * This example demonstrates a basic agent that uses the security platform
 * to evaluate tool calls before execution.
 */

const axios = require('axios');

class SimpleSecureAgent {
  constructor(config) {
    this.agentId = config.agentId;
    this.apiKey = config.apiKey;
    this.securityApiUrl = config.securityApiUrl || 'http://localhost:3001';
  }

  /**
   * Secure tool call - evaluates security before execution
   */
  async callTool(toolName, parameters) {
    console.log(`🤖 Agent ${this.agentId} calling tool: ${toolName}`);
    
    try {
      // Step 1: Evaluate security
      const securityDecision = await this.evaluateSecurity(toolName, parameters);
      
      console.log(`🔒 Security decision: ${securityDecision.action}`);
      console.log(`📝 Reason: ${securityDecision.reason}`);
      
      // Step 2: Handle security decision
      switch (securityDecision.action) {
        case 'allow':
          return await this.executeTool(toolName, parameters);
        
        case 'transform':
          console.log('🔄 Request transformed for security');
          return await this.executeTool(
            securityDecision.transformedRequest.toolName,
            securityDecision.transformedRequest.parameters
          );
        
        case 'deny':
          throw new Error(`Security denied: ${securityDecision.reason}`);
        
        default:
          throw new Error(`Unknown security action: ${securityDecision.action}`);
      }
      
    } catch (error) {
      console.error('❌ Tool call failed:', error.message);
      throw error;
    }
  }

  /**
   * Evaluate security with the Security Sidecar Agent
   */
  async evaluateSecurity(toolName, parameters) {
    try {
      const response = await axios.post(
        `${this.securityApiUrl}/api/security/evaluate`,
        {
          agentId: this.agentId,
          toolName: toolName,
          parameters: parameters,
          context: {
            timestamp: new Date().toISOString(),
            userAgent: 'SimpleSecureAgent/1.0'
          }
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.success) {
        throw new Error(`Security evaluation failed: ${response.data.error?.message}`);
      }
      
      return response.data.decision;
      
    } catch (error) {
      if (error.response) {
        throw new Error(`Security API error: ${error.response.data?.error?.message || error.message}`);
      }
      throw new Error(`Security API connection failed: ${error.message}`);
    }
  }

  /**
   * Execute the actual tool (mock implementation for demo)
   */
  async executeTool(toolName, parameters) {
    console.log(`⚡ Executing tool: ${toolName}`);
    
    // Mock tool implementations
    switch (toolName) {
      case 'web-search':
        return {
          tool: 'web-search',
          query: parameters.query,
          results: [
            { title: 'AI Security Best Practices', url: 'https://example.com/ai-security' },
            { title: 'Agent Security Framework', url: 'https://example.com/framework' }
          ]
        };
      
      case 'file-read':
        return {
          tool: 'file-read',
          path: parameters.path,
          content: 'Mock file content for security demo'
        };
      
      case 'calculator':
        return {
          tool: 'calculator',
          expression: parameters.expression,
          result: eval(parameters.expression) // Note: eval is dangerous, this is just for demo
        };
      
      default:
        return {
          tool: toolName,
          parameters: parameters,
          result: 'Mock result - tool executed successfully'
        };
    }
  }

  /**
   * Get audit trail for this agent
   */
  async getAuditTrail(limit = 10) {
    try {
      const response = await axios.get(
        `${this.securityApiUrl}/api/security/audit/${this.agentId}?limit=${limit}`,
        {
          headers: {
            'X-API-Key': this.apiKey
          }
        }
      );
      
      return response.data.auditTrail;
      
    } catch (error) {
      console.error('Failed to get audit trail:', error.message);
      return null;
    }
  }
}

// Example usage
async function runExample() {
  console.log('🚀 Starting Simple Secure Agent Example\n');
  
  // Create a secure agent
  const agent = new SimpleSecureAgent({
    agentId: 'simple-demo-agent',
    apiKey: 'demo-api-key-12345678',
    securityApiUrl: 'http://localhost:3001'
  });

  try {
    // Example 1: Safe web search (should be allowed)
    console.log('📍 Example 1: Safe web search');
    const searchResult = await agent.callTool('web-search', {
      query: 'AI agent security best practices'
    });
    console.log('✅ Result:', searchResult);
    console.log();

    // Example 2: File read (should be allowed)
    console.log('📍 Example 2: File read operation');
    const fileResult = await agent.callTool('file-read', {
      path: '/tmp/safe-file.txt'
    });
    console.log('✅ Result:', fileResult);
    console.log();

    // Example 3: File write (should be transformed to read)
    console.log('📍 Example 3: File write operation (will be transformed)');
    const writeResult = await agent.callTool('file-write', {
      path: '/tmp/test.txt',
      content: 'This should be transformed to read-only'
    });
    console.log('✅ Result:', writeResult);
    console.log();

    // Example 4: System command (should be denied)
    console.log('📍 Example 4: System command (will be denied)');
    try {
      await agent.callTool('system-command', {
        command: 'ls -la'
      });
    } catch (error) {
      console.log('❌ Expected denial:', error.message);
    }
    console.log();

    // Show audit trail
    console.log('📍 Audit Trail:');
    const auditTrail = await agent.getAuditTrail(5);
    if (auditTrail) {
      auditTrail.entries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.timestamp}: ${entry.action} - ${entry.toolName}`);
      });
    }

  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = SimpleSecureAgent;