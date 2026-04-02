/**
 * TealBedrock - Security & Policy Examples
 * 
 * This example demonstrates TealTiger's security features with AWS Bedrock.
 */

import {
  TealBedrock,
  TealEngine,
  TealGuard,
  TealMonitor,
  TealCircuit,
  TealAudit,
  ConsoleOutput
} from 'tealtiger';

async function main() {
  console.log('=== TealBedrock Security Examples ===\n');

  // Example 1: Policy Enforcement
  console.log('1. Policy Enforcement:');
  const engine = new TealEngine({
    tools: {
      'invokeModel': { allowed: true }
    },
    identity: {
      agentId: 'secure-bedrock-agent',
      role: 'user',
      permissions: ['invoke:model'],
      costLimit: {
        daily: 10.00,  // $10 per day
        hourly: 2.00   // $2 per hour
      }
    }
  });

  const client1 = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'secure-bedrock-agent',
    engine
  });

  try {
    const response = await client1.invokeModel({
      modelId: 'anthropic.claude-v2',
      prompt: 'Hello, how are you?',
      maxTokens: 100
    });
    console.log('✓ Request allowed by policy');
    console.log('Response:', response.text.substring(0, 100) + '...');
    console.log('Cost:', response.metadata?.cost, 'USD');
  } catch (error: any) {
    console.log('✗ Request blocked:', error.message);
  }
  console.log();

  // Example 2: Content Validation (Guardrails)
  console.log('2. Content Validation:');
  const guard = new TealGuard({});

  const client2 = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    guard
  });

  try {
    const response = await client2.invokeModel({
      modelId: 'anthropic.claude-instant-v1',
      prompt: 'What is machine learning?',
      maxTokens: 150
    });
    console.log('✓ Content passed guardrails');
    console.log('Response:', response.text.substring(0, 100) + '...');
  } catch (error: any) {
    console.log('✗ Content blocked by guardrails:', error.message);
  }
  console.log();

  // Example 3: Cost Monitoring
  console.log('3. Cost Monitoring:');
  const monitor = new TealMonitor({});

  const client3 = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'monitored-bedrock-agent',
    monitor
  });

  // Make several requests with different models
  const models = [
    'anthropic.claude-3-haiku-20240307-v1:0',  // Cheapest
    'anthropic.claude-instant-v1',
    'amazon.titan-text-lite-v1'
  ];

  for (const modelId of models) {
    await client3.invokeModel({
      modelId,
      prompt: 'What is AI?',
      maxTokens: 100
    });
  }

  const metrics = monitor.getMetrics('monitored-bedrock-agent');
  console.log('Total requests:', metrics.totalRequests);
  console.log('Total cost:', metrics.totalCost.toFixed(6), 'USD');
  console.log('Average cost per request:', (metrics.totalCost / metrics.totalRequests).toFixed(6), 'USD');
  console.log();

  // Example 4: Circuit Breaker
  console.log('4. Circuit Breaker:');
  const circuit = new TealCircuit({
    failureThreshold: 3,
    timeout: 5000,
    halfOpenRequests: 1
  });

  const client4 = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    circuit
  });

  try {
    const response = await client4.invokeModel({
      modelId: 'anthropic.claude-instant-v1',
      prompt: 'Hello!',
      maxTokens: 50
    });
    console.log('✓ Request succeeded');
    console.log('Circuit state:', response.metadata?.circuitState);
  } catch (error: any) {
    if (error.name === 'CircuitOpenError') {
      console.log('✗ Circuit breaker is open - service unavailable');
    } else {
      console.log('✗ Request failed:', error.message);
    }
  }
  console.log();

  // Example 5: Audit Logging
  console.log('5. Audit Logging:');
  const audit = new TealAudit({
    outputs: [new ConsoleOutput()]
  });

  const client5 = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'audited-bedrock-agent',
    audit
  });

  await client5.invokeModel({
    modelId: 'anthropic.claude-v2',
    prompt: 'What is quantum computing?',
    maxTokens: 200
  });

  console.log('✓ Request logged to audit trail');
  
  // Query audit logs
  const events = audit.query({
    agents: ['audited-bedrock-agent']
  });
  console.log('Total audit events:', events.length);
  console.log();

  // Example 6: Multi-Provider Security
  console.log('6. Multi-Provider Security (All Providers):');
  
  const secureClient = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'multi-provider-agent',
    engine: new TealEngine({
      tools: {
        'invokeModel': { allowed: true }
      },
      identity: {
        agentId: 'multi-provider-agent',
        role: 'user',
        permissions: ['invoke:model']
      }
    }),
    guard: new TealGuard({}),
    monitor: new TealMonitor({})
  });

  const providers = [
    { name: 'Anthropic Claude', id: 'anthropic.claude-instant-v1' },
    { name: 'Amazon Titan', id: 'amazon.titan-text-lite-v1' },
    { name: 'Cohere Command', id: 'cohere.command-light-text-v14' },
    { name: 'Meta Llama', id: 'meta.llama2-13b-chat-v1' }
  ];

  for (const provider of providers) {
    try {
      const response = await secureClient.invokeModel({
        modelId: provider.id,
        prompt: 'What is AI security?',
        maxTokens: 100
      });
      console.log(`✓ ${provider.name}: Passed all security layers`);
      console.log('  Cost:', response.metadata?.cost, 'USD');
    } catch (error: any) {
      console.log(`✗ ${provider.name}: Blocked -`, error.message);
    }
  }
  console.log();

  // Example 7: Regional Security
  console.log('7. Regional Security (Multi-Region):');
  
  const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];
  
  for (const region of regions) {
    const regionalClient = new TealBedrock({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
      },
      agentId: `${region}-agent`,
      engine: new TealEngine({
        tools: {
          'invokeModel': { allowed: true }
        },
        identity: {
          agentId: `${region}-agent`,
          role: 'user',
          permissions: ['invoke:model']
        }
      })
    });

    try {
      const response = await regionalClient.invokeModel({
        modelId: 'anthropic.claude-instant-v1',
        prompt: 'Hello from ' + region,
        maxTokens: 50
      });
      console.log(`✓ ${region}: Request allowed`);
      console.log('  Region:', response.metadata?.region);
    } catch (error: any) {
      console.log(`✗ ${region}: Request blocked -`, error.message);
    }
  }
  console.log();

  // Example 8: Full Security Stack
  console.log('8. Full Security Stack (All Components):');
  const fullySecureClient = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'fully-secured-bedrock-agent',
    
    // Policy enforcement
    engine: new TealEngine({
      tools: {
        'invokeModel': { 
          allowed: true,
          rateLimit: {
            max: 100,
            window: '1h'
          }
        }
      },
      identity: {
        agentId: 'fully-secured-bedrock-agent',
        role: 'user',
        permissions: ['invoke:model'],
        costLimit: {
          daily: 20.00,
          hourly: 5.00
        }
      },
      cost: {
        maxPerRequest: 1.00,
        maxPerDay: 20.00
      }
    }),
    
    // Content validation
    guard: new TealGuard({
      enablePIIDetection: true,
      enablePromptInjectionDetection: true,
      enableContentModeration: true
    }),
    
    // Monitoring
    monitor: new TealMonitor({
      anomalyDetection: {
        enabled: true,
        costThreshold: 10.0,
        requestThreshold: 1000
      }
    }),
    
    // Circuit breaker
    circuit: new TealCircuit({
      failureThreshold: 5,
      timeout: 10000,
      halfOpenRequests: 1
    }),
    
    // Audit logging
    audit: new TealAudit({
      outputs: [new ConsoleOutput()]
    })
  });

  try {
    const response = await fullySecureClient.invokeModel({
      modelId: 'anthropic.claude-v2',
      prompt: 'Explain AI security best practices for AWS Bedrock',
      maxTokens: 300
    });
    
    console.log('✓ Request passed all security layers');
    console.log('Response:', response.text.substring(0, 150) + '...');
    console.log('Metadata:', {
      provider: response.metadata?.provider,
      model: response.metadata?.model,
      region: response.metadata?.region,
      cost: response.metadata?.cost,
      policyEvaluation: response.metadata?.policyEvaluation,
      guardrailResults: response.metadata?.guardrailResults,
      monitoringMetrics: response.metadata?.monitoringMetrics,
      circuitState: response.metadata?.circuitState
    });
  } catch (error: any) {
    console.log('✗ Request blocked by security layer:', error.message);
  }
  console.log();

  // Example 9: Cost-Based Security
  console.log('9. Cost-Based Security (Budget Limits):');
  
  const budgetEngine = new TealEngine({
    tools: {
      'invokeModel': { allowed: true }
    },
    identity: {
      agentId: 'budget-agent',
      role: 'user',
      permissions: ['invoke:model'],
      costLimit: {
        daily: 0.01  // Very low limit for demo
      }
    }
  });

  const budgetClient = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    agentId: 'budget-agent',
    engine: budgetEngine
  });

  // Try to exceed budget
  try {
    // First request should succeed
    await budgetClient.invokeModel({
      modelId: 'anthropic.claude-v2',
      prompt: 'First request',
      maxTokens: 100
    });
    console.log('✓ First request: Within budget');

    // Second request might exceed budget
    await budgetClient.invokeModel({
      modelId: 'anthropic.claude-v2',
      prompt: 'Second request',
      maxTokens: 100
    });
    console.log('✓ Second request: Within budget');
  } catch (error: any) {
    console.log('✗ Request blocked: Budget exceeded');
  }
  console.log();

  // Example 10: Provider-Specific Security
  console.log('10. Provider-Specific Security Policies:');
  
  const providerPolicies = {
    'anthropic': { maxTokens: 2000, temperature: 0.7 },
    'amazon': { maxTokens: 1500, temperature: 0.8 },
    'cohere': { maxTokens: 1000, temperature: 0.9 }
  };

  const policyClient = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    },
    engine: new TealEngine({
      tools: {
        'invokeModel': { allowed: true }
      },
      identity: {
        agentId: 'policy-agent',
        role: 'user',
        permissions: ['invoke:model']
      }
    })
  });

  const testModels = [
    { name: 'Claude', id: 'anthropic.claude-instant-v1', provider: 'anthropic' },
    { name: 'Titan', id: 'amazon.titan-text-lite-v1', provider: 'amazon' },
    { name: 'Command', id: 'cohere.command-light-text-v14', provider: 'cohere' }
  ];

  for (const model of testModels) {
    const policy = providerPolicies[model.provider as keyof typeof providerPolicies];
    
    try {
      const response = await policyClient.invokeModel({
        modelId: model.id,
        prompt: 'Test prompt',
        maxTokens: policy.maxTokens,
        temperature: policy.temperature
      });
      console.log(`✓ ${model.name}: Policy applied (maxTokens: ${policy.maxTokens}, temp: ${policy.temperature})`);
      console.log('  Cost:', response.metadata?.cost, 'USD');
    } catch (error: any) {
      console.log(`✗ ${model.name}: Policy violation -`, error.message);
    }
  }
  console.log();

  console.log('=== Security Examples Complete ===');
}

// Run examples
main().catch(console.error);
