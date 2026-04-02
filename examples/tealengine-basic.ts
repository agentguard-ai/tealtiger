/**
 * TealEngine Basic Usage Example
 * 
 * This example demonstrates basic TealEngine usage with policy templates
 * and simple policy evaluation.
 */

import { TealOpenAI, TealEngine } from 'tealtiger';

async function main() {
  console.log('=== TealEngine Basic Usage Example ===\n');

  // Example 1: Using a policy template
  console.log('1. Using Policy Template (Customer Support)');
  const customerSupportEngine = new TealEngine(
    TealEngine.Templates.customerSupport()
  );

  const client1 = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    agentId: 'support-agent-001',
    engine: customerSupportEngine
  });

  try {
    const response1 = await client1.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Hello! I need help with my account.' }
      ]
    });

    console.log('✅ Request allowed by policy');
    console.log('Response:', response1.choices[0].message.content);
    console.log('Metadata:', response1.metadata);
  } catch (error: any) {
    console.log('❌ Request blocked:', error.message);
  }

  console.log('\n---\n');

  // Example 2: Custom policy definition
  console.log('2. Custom Policy Definition');
  const customEngine = new TealEngine({
    tools: {
      'chat': { allowed: true },
      'file_read': { allowed: true },
      'file_write': { allowed: false },
      'file_delete': { allowed: false }
    },
    identity: {
      agentId: 'custom-agent-001',
      role: 'assistant',
      permissions: ['read', 'chat'],
      forbidden: ['write', 'delete']
    },
    behavioral: {
      costLimit: {
        daily: 10.00,
        hourly: 2.00
      },
      rateLimit: {
        requests: 100,
        window: '1h'
      }
    }
  });

  const client2 = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    agentId: 'custom-agent-001',
    engine: customEngine
  });

  try {
    const response2 = await client2.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'What is the weather today?' }
      ]
    });

    console.log('✅ Request allowed by custom policy');
    console.log('Response:', response2.choices[0].message.content?.substring(0, 100) + '...');
  } catch (error: any) {
    console.log('❌ Request blocked:', error.message);
  }

  console.log('\n---\n');

  // Example 3: Policy validation
  console.log('3. Policy Validation');
  const validationResult = customEngine.validate();
  
  if (validationResult.valid) {
    console.log('✅ Policy is valid');
  } else {
    console.log('❌ Policy has errors:', validationResult.errors);
  }

  console.log('\n---\n');

  // Example 4: Testing policies
  console.log('4. Testing Policies');
  const testResult = customEngine.test({
    agentId: 'custom-agent-001',
    action: 'chat.create',
    tool: 'chat',
    content: 'Test message'
  });

  console.log('Test result:', {
    allowed: testResult.allowed,
    reason: testResult.reason,
    triggeredPolicies: testResult.triggeredPolicies
  });

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch(console.error);
