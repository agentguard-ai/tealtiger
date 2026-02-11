/**
 * Monitoring and Alerting Example
 * 
 * This example demonstrates TealMonitor's behavioral monitoring
 * and anomaly detection capabilities.
 */

import {
  TealOpenAI,
  TealMonitor
} from 'tealtiger';

async function main() {
  console.log('=== Monitoring and Alerting Example ===\n');

  // Example 1: Basic monitoring setup
  console.log('1. Basic Monitoring Setup');
  const monitor = new TealMonitor({
    anomalyThreshold: 2.0,
    autoBaseline: false, // Manual baseline for demo
    retentionDays: 30
  });

  // Set manual baseline
  monitor.setBaseline('demo-agent', {
    cost: {
      hourly: 1.00,
      daily: 10.00
    },
    requests: {
      rate: 10 // 10 requests per minute
    }
  });

  console.log('✅ Monitor configured with manual baseline');
  console.log('Baseline:', {
    hourlyCost: '$1.00',
    dailyCost: '$10.00',
    requestRate: '10 req/min'
  });

  console.log('\n---\n');

  // Example 2: Anomaly detection callbacks
  console.log('2. Anomaly Detection Callbacks');
  
  const anomalies: any[] = [];
  
  monitor.onAnomaly((anomaly) => {
    anomalies.push(anomaly);
    
    console.log(`\n⚠️  ANOMALY DETECTED!`);
    console.log(`Type: ${anomaly.type}`);
    console.log(`Severity: ${anomaly.severity}`);
    console.log(`Current: ${anomaly.current}`);
    console.log(`Baseline: ${anomaly.baseline}`);
    console.log(`Ratio: ${anomaly.ratio.toFixed(2)}x`);
    console.log(`Timestamp: ${anomaly.timestamp.toISOString()}`);
    
    // Send alert (simulated)
    sendAlert(anomaly);
  });

  console.log('✅ Anomaly callback registered');

  console.log('\n---\n');

  // Example 3: Normal usage tracking
  console.log('3. Tracking Normal Usage');
  
  for (let i = 1; i <= 10; i++) {
    monitor.track({
      agentId: 'demo-agent',
      type: 'request',
      timestamp: new Date(),
      request: {
        action: 'chat.create',
        model: 'gpt-3.5-turbo',
        success: true,
        duration: 500 + Math.random() * 500
      },
      cost: {
        amount: 0.001 + Math.random() * 0.002,
        currency: 'USD',
        model: 'gpt-3.5-turbo'
      }
    });
  }

  const normalMetrics = monitor.getMetrics('demo-agent');
  console.log('Normal usage metrics:', {
    totalRequests: normalMetrics.requests.total,
    totalCost: normalMetrics.cost.total.toFixed(4),
    avgCostPerRequest: (normalMetrics.cost.total / normalMetrics.requests.total).toFixed(4)
  });

  console.log('\n---\n');

  // Example 4: Cost spike detection
  console.log('4. Cost Spike Detection');
  
  // Simulate cost spike
  monitor.track({
    agentId: 'demo-agent',
    type: 'request',
    timestamp: new Date(),
    request: {
      action: 'chat.create',
      model: 'gpt-4',
      success: true,
      duration: 2000
    },
    cost: {
      amount: 5.00, // Spike!
      currency: 'USD',
      model: 'gpt-4'
    }
  });

  console.log('Simulated cost spike: $5.00 (baseline: $1.00/hour)');

  console.log('\n---\n');

  // Example 5: Rate spike detection
  console.log('5. Rate Spike Detection');
  
  // Simulate rate spike
  for (let i = 1; i <= 50; i++) {
    monitor.track({
      agentId: 'demo-agent',
      type: 'request',
      timestamp: new Date(),
      request: {
        action: 'chat.create',
        model: 'gpt-3.5-turbo',
        success: true,
        duration: 100
      }
    });
  }

  console.log('Simulated rate spike: 50 requests (baseline: 10 req/min)');

  console.log('\n---\n');

  // Example 6: Tool usage anomaly
  console.log('6. Tool Usage Anomaly Detection');
  
  // Track unusual tool usage
  for (let i = 1; i <= 20; i++) {
    monitor.track({
      agentId: 'demo-agent',
      type: 'tool',
      timestamp: new Date(),
      tool: {
        name: 'database_query',
        duration: 1000,
        success: true
      }
    });
  }

  console.log('Simulated unusual tool usage: 20x database_query');

  console.log('\n---\n');

  // Example 7: Metrics summary
  console.log('7. Metrics Summary');
  
  const finalMetrics = monitor.getMetrics('demo-agent');
  console.log('Final metrics:', {
    totalRequests: finalMetrics.requests.total,
    successfulRequests: finalMetrics.requests.successful,
    failedRequests: finalMetrics.requests.failed,
    totalCost: finalMetrics.cost.total.toFixed(4),
    hourlyCost: finalMetrics.cost.hourly.toFixed(4),
    dailyCost: finalMetrics.cost.daily.toFixed(4),
    costTrend: finalMetrics.cost.trend.toFixed(2) + '%'
  });

  console.log('\n---\n');

  // Example 8: Anomaly summary
  console.log('8. Anomaly Summary');
  console.log(`Total anomalies detected: ${anomalies.length}`);
  
  const anomalyTypes = anomalies.reduce((acc: any, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('Anomalies by type:', anomalyTypes);

  console.log('\n---\n');

  // Example 9: Real-world integration
  console.log('9. Real-World Integration Example');
  
  const client = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    agentId: 'production-agent',
    monitor: new TealMonitor({
      anomalyThreshold: 2.5,
      autoBaseline: true,
      retentionDays: 30
    })
  });

  // Configure alerting
  const productionMonitor = client['monitor'];
  if (productionMonitor) {
    productionMonitor.onAnomaly((anomaly) => {
      // In production, send to monitoring service
      console.log(`📧 Alert sent to ops team: ${anomaly.type}`);
      
      // Example integrations:
      // - Send to Slack
      // - Send to PagerDuty
      // - Send to email
      // - Log to monitoring service (Datadog, New Relic, etc.)
    });
  }

  console.log('✅ Production monitoring configured');

  console.log('\n=== Example Complete ===');
}

// Simulated alert function
function sendAlert(anomaly: any) {
  console.log(`📧 Sending alert to ops team...`);
  console.log(`   Subject: [TealTiger] ${anomaly.type} detected`);
  console.log(`   Severity: ${anomaly.severity}`);
  console.log(`   Details: ${anomaly.ratio.toFixed(2)}x baseline`);
}

// Run the example
main().catch(console.error);
