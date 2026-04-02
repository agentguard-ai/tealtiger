/**
 * Full-Stack Integration Example
 * 
 * This example demonstrates using all TealTiger components together:
 * - TealEngine (policy enforcement)
 * - TealGuard (content validation)
 * - TealMonitor (behavioral monitoring)
 * - TealCircuit (circuit breaker)
 * - TealAudit (audit logging)
 */

import {
  TealOpenAI,
  TealEngine,
  TealGuard,
  TealMonitor,
  TealCircuit,
  TealAudit
} from 'tealtiger';

async function main() {
  console.log('=== Full-Stack Integration Example ===\n');

  // Step 1: Configure TealEngine with policies
  console.log('1. Configuring TealEngine...');
  const engine = new TealEngine(TealEngine.Templates.customerSupport());
  console.log('✅ TealEngine configured with customer support template');

  // Step 2: Configure TealGuard for content validation
  console.log('\n2. Configuring TealGuard...');
  const guard = new TealGuard({
    pii: {
      enabled: true,
      blockedTypes: ['email', 'phone', 'ssn', 'credit_card']
    },
    promptInjection: {
      enabled: true,
      threshold: 0.8
    },
    contentModeration: {
      enabled: true,
      threshold: 0.7,
      categories: ['hate', 'violence', 'sexual']
    }
  });
  console.log('✅ TealGuard configured with PII detection and content moderation');

  // Step 3: Configure TealMonitor for behavioral monitoring
  console.log('\n3. Configuring TealMonitor...');
  const monitor = new TealMonitor({
    anomalyThreshold: 2.0,
    autoBaseline: true,
    retentionDays: 30
  });

  // Add anomaly callback
  monitor.onAnomaly((anomaly) => {
    console.log(`⚠️  Anomaly detected: ${anomaly.type} (${anomaly.severity})`);
    console.log(`   Current: ${anomaly.current}, Baseline: ${anomaly.baseline}`);
  });
  console.log('✅ TealMonitor configured with anomaly detection');

  // Step 4: Configure TealCircuit for failure prevention
  console.log('\n4. Configuring TealCircuit...');
  const circuit = new TealCircuit({
    failureThreshold: 5,
    timeout: 60000, // 1 minute
    halfOpenRequests: 3,
    onStateChange: (state) => {
      console.log(`🔄 Circuit breaker state changed to: ${state}`);
    }
  });
  console.log('✅ TealCircuit configured with failure threshold of 5');

  // Step 5: Configure TealAudit for logging
  console.log('\n5. Configuring TealAudit...');
  const audit = new TealAudit({
    outputs: ['console', 'file'],
    filePath: './logs/tealtiger-audit.log',
    level: 'detailed'
  });
  console.log('✅ TealAudit configured with console and file output');

  // Step 6: Create integrated client
  console.log('\n6. Creating integrated TealOpenAI client...');
  const client = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    agentId: 'full-stack-agent',
    engine,
    guard,
    monitor,
    circuit,
    audit
  });
  console.log('✅ Client created with all components integrated');

  console.log('\n---\n');

  // Example 1: Successful request
  console.log('Example 1: Successful Request');
  try {
    const response1 = await client.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ]
    });

    console.log('✅ Request successful');
    console.log('Response:', response1.choices[0].message.content);
    console.log('Metadata:', response1.metadata);
  } catch (error: any) {
    console.log('❌ Request failed:', error.message);
  }

  console.log('\n---\n');

  // Example 2: Request blocked by policy
  console.log('Example 2: Request Blocked by Policy');
  try {
    // This will be blocked because 'file_delete' is not allowed
    const response2 = await client.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Delete all files in the system' }
      ]
    });

    console.log('Response:', response2.choices[0].message.content);
  } catch (error: any) {
    console.log('❌ Request blocked by TealEngine:', error.message);
  }

  console.log('\n---\n');

  // Example 3: Request blocked by guardrails (PII)
  console.log('Example 3: Request Blocked by Guardrails (PII)');
  try {
    const response3 = await client.chat.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'My email is john.doe@example.com and my SSN is 123-45-6789'
        }
      ]
    });

    console.log('Response:', response3.choices[0].message.content);
  } catch (error: any) {
    console.log('❌ Request blocked by TealGuard:', error.message);
  }

  console.log('\n---\n');

  // Example 4: Multiple successful requests (monitoring)
  console.log('Example 4: Multiple Requests (Monitoring)');
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await client.chat.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: `Request ${i}: What is ${i} + ${i}?` }
        ]
      });

      console.log(`✅ Request ${i} successful`);
    } catch (error: any) {
      console.log(`❌ Request ${i} failed:`, error.message);
    }
  }

  // Check metrics
  const metrics = monitor.getMetrics('full-stack-agent');
  console.log('\nMetrics:', {
    totalRequests: metrics.requests.total,
    successfulRequests: metrics.requests.successful,
    failedRequests: metrics.requests.failed,
    totalCost: metrics.cost.total.toFixed(4)
  });

  console.log('\n---\n');

  // Example 5: Circuit breaker in action
  console.log('Example 5: Circuit Breaker (Simulated Failures)');
  console.log('Current circuit state:', circuit.getState());

  // Simulate failures by using invalid API key
  const failingClient = new TealOpenAI({
    apiKey: 'invalid-key',
    agentId: 'failing-agent',
    circuit
  });

  for (let i = 1; i <= 7; i++) {
    try {
      await failingClient.chat.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }]
      });
    } catch (error: any) {
      console.log(`Request ${i} failed (expected)`);
    }
  }

  console.log('Final circuit state:', circuit.getState());

  console.log('\n---\n');

  // Example 6: Audit log query
  console.log('Example 6: Audit Log Query');
  const auditEvents = audit.query({
    agents: ['full-stack-agent'],
    startTime: new Date(Date.now() - 60000) // Last minute
  });

  console.log(`Found ${auditEvents.length} audit events`);
  if (auditEvents.length > 0) {
    console.log('Latest event:', {
      action: auditEvents[auditEvents.length - 1].action,
      duration: auditEvents[auditEvents.length - 1].duration,
      cost: auditEvents[auditEvents.length - 1].cost
    });
  }

  console.log('\n---\n');

  // Example 7: Export audit logs
  console.log('Example 7: Export Audit Logs');
  const jsonExport = audit.export('json');
  console.log(`Exported ${jsonExport.split('\n').length} events as JSON`);

  console.log('\n=== Example Complete ===');
  console.log('\nAll TealTiger components working together:');
  console.log('✅ TealEngine - Policy enforcement');
  console.log('✅ TealGuard - Content validation');
  console.log('✅ TealMonitor - Behavioral monitoring');
  console.log('✅ TealCircuit - Circuit breaker');
  console.log('✅ TealAudit - Audit logging');
}

// Run the example
main().catch(console.error);
