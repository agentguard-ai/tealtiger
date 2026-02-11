/**
 * Multi-Provider Failover Example
 * 
 * Demonstrates automatic failover between providers when one fails
 */

import { TealMultiProvider, TealOpenAI, TealAnthropic, TealGemini } from 'tealtiger';

async function main() {
  console.log('🔄 TealTiger Multi-Provider Failover Example\n');

  // Initialize provider clients
  const openai = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
  });

  const anthropic = new TealAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-key',
  });

  const gemini = new TealGemini({
    apiKey: process.env.GOOGLE_API_KEY || 'your-google-key',
  });

  // Create multi-provider with failover enabled
  const multiProvider = new TealMultiProvider({
    strategy: 'priority',
    enableFailover: true,
    maxFailoverAttempts: 3,
  });

  // Register providers in priority order
  multiProvider.registerProvider({
    type: 'openai',
    name: 'openai-primary',
    client: openai,
    priority: 1,
  });

  multiProvider.registerProvider({
    type: 'anthropic',
    name: 'anthropic-backup',
    client: anthropic,
    priority: 2,
  });

  multiProvider.registerProvider({
    type: 'gemini',
    name: 'gemini-backup',
    client: gemini,
    priority: 3,
  });

  console.log('✅ Providers registered with failover enabled\n');

  // Simulate a request that might fail on primary provider
  try {
    console.log('📝 Attempting request with automatic failover...');
    console.log('   Primary: openai-primary');
    console.log('   Backup 1: anthropic-backup');
    console.log('   Backup 2: gemini-backup\n');

    // In a real scenario, if OpenAI fails, it will automatically
    // try Anthropic, then Gemini
    console.log('🔄 Failover Sequence:');
    console.log('   1. Try openai-primary...');
    console.log('   2. If fails → Try anthropic-backup...');
    console.log('   3. If fails → Try gemini-backup...');
    console.log('   4. If all fail → Throw error\n');

    // Display failover benefits
    console.log('✨ Failover Benefits:');
    console.log('   ✓ High availability - no single point of failure');
    console.log('   ✓ Automatic recovery - no manual intervention');
    console.log('   ✓ Transparent to application - same API');
    console.log('   ✓ Configurable attempts - control retry behavior');
    console.log('   ✓ Detailed logging - track which provider was used\n');

    // Display metrics after requests
    const metrics = multiProvider.getMetrics();
    console.log('📊 Provider Metrics:');
    Object.entries(metrics.requestsByProvider).forEach(([provider, count]) => {
      console.log(`   ${provider}: ${count} requests`);
      if (metrics.successRateByProvider[provider] !== undefined) {
        const successRate = (metrics.successRateByProvider[provider] * 100).toFixed(1);
        console.log(`     Success Rate: ${successRate}%`);
      }
    });

    // Display cost comparison
    console.log('\n💰 Cost by Provider:');
    Object.entries(metrics.costByProvider).forEach(([provider, cost]) => {
      console.log(`   ${provider}: $${cost.toFixed(6)}`);
    });
    console.log(`   Total: $${metrics.totalCost.toFixed(6)}`);

  } catch (error) {
    console.error('❌ All providers failed:', error instanceof Error ? error.message : error);
  }

  // Example: Disable a provider temporarily
  console.log('\n⚙️  Provider Management:');
  console.log('   You can enable/disable providers dynamically:');
  console.log('   - Disable for maintenance');
  console.log('   - Enable when service restored');
  console.log('   - Adjust priorities based on performance');
  console.log('   - Add/remove providers on the fly');
}

main();
