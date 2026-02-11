/**
 * Basic Usage Example - JavaScript
 * 
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
    }
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };