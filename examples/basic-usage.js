/**
 * Basic Usage Example - JavaScript
 * 
<<<<<<< HEAD
 * This example shows how to use the TealTiger SDK with TealEngine v1.1.0
 * in a simple JavaScript application.
 */

const { TealOpenAI, TealEngine } = require('tealtiger');

async function basicExample() {
  console.log('🚀 TealTiger SDK - Basic Usage Example (v1.1.0)');
  console.log('================================================');

  try {
    // Example 1: Using a policy template
    console.log('\n1. Using Policy Template');
    console.log('------------------------');
    
    const engine = new TealEngine(TealEngine.Templates.customerSupport());
    
    const client = new TealOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      agentId: 'basic-example-agent',
      engine: engine
    });

    console.log('✅ Client initialized with Customer Support policy');

    // Example 2: Simple chat request
    console.log('\n2. Simple Chat Request');
    console.log('----------------------');
    
    const response = await client.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Hello! How can I help you today?' }
      ]
    });

    console.log('✅ Chat response received');
    console.log('Response:', response.choices[0].message.content?.substring(0, 100) + '...');
    
    // Check metadata
    if (response.metadata) {
      console.log('\nMetadata:');
      console.log('- Policy evaluated:', response.metadata.policyEvaluated ? '✅' : '❌');
      console.log('- Guardrails passed:', response.metadata.guardrailsPassed ? '✅' : '❌');
      console.log('- Cost tracked:', response.metadata.costTracked ? '✅' : '❌');
    }

    // Example 3: Custom policy
    console.log('\n3. Custom Policy');
    console.log('----------------');
    
    const customEngine = new TealEngine({
      tools: {
        'chat': { allowed: true },
        'file_read': { allowed: true },
        'file_write': { allowed: false }
      },
      identity: {
        agentId: 'basic-example-agent',
        role: 'assistant',
        permissions: ['read', 'chat']
      },
      behavioral: {
        costLimit: {
          daily: 5.00,
          hourly: 1.00
        },
        rateLimit: {
          requests: 100,
          window: '1h'
        }
      }
    });

    const customClient = new TealOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      agentId: 'basic-example-agent',
      engine: customEngine
    });

    console.log('✅ Client initialized with custom policy');

    // Example 4: Policy validation
    console.log('\n4. Policy Validation');
    console.log('--------------------');
    
    const validation = customEngine.validate();
    console.log('Policy valid:', validation.valid ? '✅ YES' : '❌ NO');
    
    if (!validation.valid) {
      console.log('Errors:', validation.errors);
    }

    // Example 5: Testing a policy
    console.log('\n5. Testing Policy');
    console.log('-----------------');
    
    const testResult = customEngine.test({
      agentId: 'basic-example-agent',
      action: 'chat.create',
      tool: 'chat',
      content: 'Test message'
    });

    console.log('Test result:');
    console.log('- Allowed:', testResult.allowed ? '✅ YES' : '❌ NO');
    console.log('- Reason:', testResult.reason);

    console.log('\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
=======
 * This example shows how to use the TealTiger SDK in a simple JavaScript application
 */

const { TealTiger } = require('../dist/index');

async function basicExample() {
  console.log('🚀 TealTiger SDK - Basic Usage Example');
  console.log('======================================');

  // Initialize the SDK
  const tealTiger = new TealTiger({
    apiKey: 'test-api-key-12345',
    ssaUrl: 'http://localhost:3001',
    debug: true
  });

  try {
    // Check if the Security Sidecar Agent is healthy
    console.log('\n1. Health Check');
    const health = await tealTiger.healthCheck();
    console.log('✅ SSA Health:', health);

    // Example 1: Safe web search (should be allowed)
    console.log('\n2. Safe Web Search');
    const searchResult = await tealTiger.executeTool(
      'web-search',
      { query: 'AI security best practices' },
      undefined,
      async (toolName, params) => {
        // Mock tool execution
        console.log(`🔧 Executing ${toolName} with params:`, params);
        return {
          tool: toolName,
          query: params.query,
          results: [
            { title: 'AI Security Guide', url: 'https://example.com/guide' },
            { title: 'Best Practices', url: 'https://example.com/practices' }
          ]
        };
      }
    );
    
    console.log('✅ Search Result:', searchResult);

    // Example 2: System command (should be denied)
    console.log('\n3. System Command (Should be Denied)');
    const systemResult = await tealTiger.executeTool(
      'system-command',
      { command: 'ls -la' },
      undefined,
      async (toolName, params) => {
        // This won't be executed due to security denial
        console.log(`🔧 Executing ${toolName} with params:`, params);
        return { output: 'file1.txt file2.txt' };
      }
    );
    
    console.log('❌ System Command Result:', systemResult);

    // Example 3: File write (should be transformed)
    console.log('\n4. File Write (Should be Transformed)');
    const writeResult = await tealTiger.executeTool(
      'file-write',
      { path: '/tmp/test.txt', content: 'Hello World' },
      undefined,
      async (toolName, params) => {
        console.log(`🔧 Executing ${toolName} with params:`, params);
        // The tool name might be transformed to 'file-read'
        if (toolName === 'file-read') {
          return { content: 'Mock file content', path: params.path };
        } else {
          return { success: true, path: params.path };
        }
      }
    );
    
    console.log('🔄 Write Result:', writeResult);

    // Get SDK statistics
    console.log('\n5. SDK Statistics');
    const stats = tealTiger.getStatistics();
    console.log('📊 Statistics:', stats);

    // Get audit trail
    console.log('\n6. Audit Trail');
    const auditTrail = await tealTiger.getAuditTrail({ limit: 5 });
    console.log('📝 Recent Audit Entries:', auditTrail.auditTrail.entries.length);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.details) {
      console.error('Error Details:', error.details);
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
    }
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };