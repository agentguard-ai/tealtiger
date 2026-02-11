/**
 * Audit Log Analysis Example
 * 
 * This example demonstrates TealAudit's logging, querying,
 * and analysis capabilities.
 */

import {
  TealOpenAI,
  TealAudit
} from 'tealtiger';
import * as fs from 'fs';

async function main() {
  console.log('=== Audit Log Analysis Example ===\n');

  // Example 1: Basic audit setup
  console.log('1. Basic Audit Setup');
  const audit = new TealAudit({
    outputs: ['console', 'file'],
    filePath: './logs/tealtiger-audit.log',
    level: 'detailed',
    maxFileSize: 10 * 1024 * 1024 // 10MB
  });

  console.log('✅ Audit configured with console and file output');

  console.log('\n---\n');

  // Example 2: Logging different event types
  console.log('2. Logging Different Event Types');
  
  // Successful request
  audit.log({
    timestamp: new Date(),
    agentId: 'agent-001',
    action: 'chat.create',
    model: 'gpt-3.5-turbo',
    cost: 0.002,
    duration: 1500,
    policyDecisions: {
      allowed: 'true',
      triggeredPolicies: 'tools.chat'
    }
  });

  // Failed request
  audit.log({
    timestamp: new Date(),
    agentId: 'agent-001',
    action: 'file.delete',
    error: 'PolicyViolationError: Tool file_delete is not allowed',
    duration: 5,
    policyDecisions: {
      allowed: 'false',
      triggeredPolicies: 'tools.file_delete'
    }
  });

  // High-cost request
  audit.log({
    timestamp: new Date(),
    agentId: 'agent-002',
    action: 'chat.create',
    model: 'gpt-4',
    cost: 0.15,
    duration: 3000,
    metadata: {
      tokens: 5000,
      reason: 'complex-analysis'
    }
  });

  console.log('✅ Logged 3 different event types');

  console.log('\n---\n');

  // Example 3: Querying audit logs
  console.log('3. Querying Audit Logs');
  
  // Query by agent
  const agent001Events = audit.query({
    agents: ['agent-001']
  });
  console.log(`Events for agent-001: ${agent001Events.length}`);

  // Query by cost threshold
  const highCostEvents = audit.query({
    minCost: 0.10
  });
  console.log(`High-cost events (>$0.10): ${highCostEvents.length}`);

  // Query errors only
  const errorEvents = audit.query({
    hasError: true
  });
  console.log(`Error events: ${errorEvents.length}`);

  // Query by time range
  const recentEvents = audit.query({
    startTime: new Date(Date.now() - 60000), // Last minute
    endTime: new Date()
  });
  console.log(`Recent events (last minute): ${recentEvents.length}`);

  console.log('\n---\n');

  // Example 4: Audit log analysis
  console.log('4. Audit Log Analysis');
  
  // Generate sample data
  const agents = ['agent-001', 'agent-002', 'agent-003'];
  const actions = ['chat.create', 'completions.create', 'embeddings.create'];
  const models = ['gpt-3.5-turbo', 'gpt-4', 'text-embedding-ada-002'];

  for (let i = 0; i < 50; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const success = Math.random() > 0.1; // 90% success rate

    audit.log({
      timestamp: new Date(Date.now() - Math.random() * 3600000), // Last hour
      agentId: agent,
      action,
      model,
      cost: Math.random() * 0.05,
      duration: 500 + Math.random() * 2000,
      ...(success ? {} : { error: 'API Error' })
    });
  }

  console.log('✅ Generated 50 sample events');

  // Analyze all events
  const allEvents = audit.query({});
  
  // Calculate statistics
  const stats = {
    totalEvents: allEvents.length,
    totalCost: allEvents.reduce((sum, e) => sum + (e.cost || 0), 0),
    avgDuration: allEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / allEvents.length,
    errorRate: (allEvents.filter(e => e.error).length / allEvents.length) * 100,
    byAgent: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
    byModel: {} as Record<string, number>
  };

  // Group by agent
  allEvents.forEach(e => {
    stats.byAgent[e.agentId] = (stats.byAgent[e.agentId] || 0) + 1;
  });

  // Group by action
  allEvents.forEach(e => {
    stats.byAction[e.action] = (stats.byAction[e.action] || 0) + 1;
  });

  // Group by model
  allEvents.forEach(e => {
    if (e.model) {
      stats.byModel[e.model] = (stats.byModel[e.model] || 0) + 1;
    }
  });

  console.log('\nAudit Statistics:');
  console.log(`Total events: ${stats.totalEvents}`);
  console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`Avg duration: ${stats.avgDuration.toFixed(0)}ms`);
  console.log(`Error rate: ${stats.errorRate.toFixed(2)}%`);
  console.log(`\nBy agent:`, stats.byAgent);
  console.log(`By action:`, stats.byAction);
  console.log(`By model:`, stats.byModel);

  console.log('\n---\n');

  // Example 5: Export audit logs
  console.log('5. Export Audit Logs');
  
  // Export as JSON
  const jsonExport = audit.export('json');
  fs.writeFileSync('./logs/audit-export.json', jsonExport);
  console.log('✅ Exported to JSON: ./logs/audit-export.json');

  // Export as CSV
  const csvExport = audit.export('csv');
  fs.writeFileSync('./logs/audit-export.csv', csvExport);
  console.log('✅ Exported to CSV: ./logs/audit-export.csv');

  console.log('\n---\n');

  // Example 6: Compliance reporting
  console.log('6. Compliance Reporting');
  
  // Generate compliance report
  const complianceReport = {
    reportDate: new Date().toISOString(),
    period: 'Last Hour',
    summary: {
      totalRequests: allEvents.length,
      successfulRequests: allEvents.filter(e => !e.error).length,
      failedRequests: allEvents.filter(e => e.error).length,
      totalCost: stats.totalCost.toFixed(4),
      avgResponseTime: stats.avgDuration.toFixed(0) + 'ms'
    },
    policyViolations: allEvents.filter(e => 
      e.error && e.error.includes('Policy')
    ).length,
    highCostTransactions: allEvents.filter(e => 
      (e.cost || 0) > 0.10
    ).length,
    agentActivity: stats.byAgent,
    modelUsage: stats.byModel
  };

  console.log('Compliance Report:');
  console.log(JSON.stringify(complianceReport, null, 2));

  console.log('\n---\n');

  // Example 7: Real-time monitoring
  console.log('7. Real-Time Monitoring Setup');
  
  const realtimeAudit = new TealAudit({
    outputs: ['console', 'custom'],
    level: 'detailed'
  });

  // Add custom output for real-time monitoring
  realtimeAudit.addOutput({
    write: (event) => {
      // Send to monitoring service
      if (event.error) {
        console.log(`🚨 Error detected: ${event.error}`);
      }
      
      if ((event.cost || 0) > 0.10) {
        console.log(`💰 High cost: $${event.cost?.toFixed(4)}`);
      }
      
      if ((event.duration || 0) > 5000) {
        console.log(`⏱️  Slow request: ${event.duration}ms`);
      }
    }
  });

  console.log('✅ Real-time monitoring configured');

  // Test real-time monitoring
  realtimeAudit.log({
    timestamp: new Date(),
    agentId: 'realtime-agent',
    action: 'chat.create',
    cost: 0.15,
    duration: 6000
  });

  console.log('\n---\n');

  // Example 8: Audit log rotation
  console.log('8. Audit Log Rotation');
  
  const rotatingAudit = new TealAudit({
    outputs: ['file'],
    filePath: './logs/rotating-audit.log',
    maxFileSize: 1024 * 1024, // 1MB
    level: 'detailed'
  });

  console.log('✅ Audit configured with 1MB rotation');
  console.log('Files will rotate automatically when size limit is reached');

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch(console.error);
