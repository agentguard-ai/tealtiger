/**
 * TealGemini - Security & Policy Examples
 * 
 * This example demonstrates TealTiger's security features with Gemini.
 */

import {
  TealGemini,
  TealEngine,
  TealGuard,
  TealMonitor,
  TealCircuit,
  TealAudit,
  ConsoleOutput,
  HarmCategory,
  HarmBlockThreshold
} from 'tealtiger';

async function main() {
  console.log('=== TealGemini Security Examples ===\n');

  // Example 1: Policy Enforcement
  console.log('1. Policy Enforcement:');
  const engine = new TealEngine({
    tools: {
      'generateContent': { allowed: true }
    },
    identity: {
      agentId: 'secure-agent',
      role: 'user',
      permissions: ['generate:content'],
      costLimit: {
        daily: 5.00,  // $5 per day
        hourly: 1.00  // $1 per hour
      }
    }
  });

  const client1 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    agentId: 'secure-agent',
    engine
  });

  try {
    const response = await client1.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello, how are you?' }]
      }]
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

  const client2 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    guard
  });

  try {
    const response = await client2.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'What is machine learning?' }]
      }]
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

  const client3 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    agentId: 'monitored-agent',
    monitor
  });

  // Make several requests
  for (let i = 0; i < 3; i++) {
    await client3.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Request ${i + 1}: What is AI?` }]
      }]
    });
  }

  const metrics = monitor.getMetrics('monitored-agent');
  console.log('Total requests:', metrics.totalRequests);
  console.log('Total cost:', metrics.totalCost.toFixed(4), 'USD');
  console.log('Average cost per request:', (metrics.totalCost / metrics.totalRequests).toFixed(4), 'USD');
  console.log();

  // Example 4: Circuit Breaker
  console.log('4. Circuit Breaker:');
  const circuit = new TealCircuit({
    failureThreshold: 3,
    timeout: 5000,
    halfOpenRequests: 1
  });

  const client4 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    circuit
  });

  try {
    const response = await client4.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello!' }]
      }]
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

  const client5 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    agentId: 'audited-agent',
    audit
  });

  await client5.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: 'What is quantum computing?' }]
    }]
  });

  console.log('✓ Request logged to audit trail');
  
  // Query audit logs
  const events = audit.query({
    agents: ['audited-agent']
  });
  console.log('Total audit events:', events.length);
  console.log();

  // Example 6: Gemini Safety Settings
  console.log('6. Gemini Safety Settings:');
  const client6 = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ]
  });

  try {
    const response = await client6.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Tell me about AI safety' }]
      }]
    });
    console.log('✓ Content passed safety filters');
    console.log('Response:', response.text.substring(0, 100) + '...');
  } catch (error: any) {
    console.log('✗ Content blocked by safety filters');
  }
  console.log();

  // Example 7: Full Security Stack
  console.log('7. Full Security Stack (All Components):');
  const secureClient = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    agentId: 'fully-secured-agent',
    
    // Policy enforcement
    engine: new TealEngine({
      tools: {
        'generateContent': { allowed: true }
      },
      identity: {
        agentId: 'fully-secured-agent',
        role: 'user',
        permissions: ['generate:content'],
        costLimit: {
          daily: 10.00
        }
      }
    }),
    
    // Content validation
    guard: new TealGuard({}),
    
    // Monitoring
    monitor: new TealMonitor({}),
    
    // Circuit breaker
    circuit: new TealCircuit({
      failureThreshold: 5,
      timeout: 10000,
      halfOpenRequests: 1
    }),
    
    // Audit logging
    audit: new TealAudit({
      outputs: [new ConsoleOutput()]
    }),
    
    // Gemini safety
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ]
  });

  try {
    const response = await secureClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Explain AI security best practices' }]
      }]
    });
    
    console.log('✓ Request passed all security layers');
    console.log('Response:', response.text.substring(0, 100) + '...');
    console.log('Metadata:', {
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

  console.log('=== Security Examples Complete ===');
}

// Run examples
main().catch(console.error);
