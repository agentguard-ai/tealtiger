/**
 * Multi-Provider Setup Example
 * 
 * Demonstrates setting up and using TealMultiProvider with multiple LLM providers
 */

import { TealMultiProvider, TealOpenAI, TealAnthropic, TealGemini, TealMistral } from 'tealtiger';

async function main() {
  console.log('🌐 TealTiger Multi-Provider Setup Example\n');

  // Initialize individual provider clients
  const openai = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
  });

  const anthropic = new TealAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-key',
  });

  const gemini = new TealGemini({
    apiKey: process.env.GOOGLE_API_KEY || 'your-google-key',
  });

  const mistral = new TealMistral({
    apiKey: process.env.MISTRAL_API_KEY || 'your-mistral-key',
  });

  // Create multi-provider orchestrator with priority strategy
  const multiProvider = new TealMultiProvider({
    strategy: 'priority', // Use highest priority provider first
    enableFailover: true, // Enable automatic failover
    maxFailoverAttempts: 3, // Try up to 3 providers
  });

  // Register providers with priorities
  console.log('📝 Registering providers...');
  
  multiProvider.registerProvider({
    type: 'openai',
    name: 'openai-primary',
    client: openai,
    priority: 1, // Highest priority
    enabled: true,
  });

  multiProvider.registerProvider({
    type: 'anthropic',
    name: 'anthropic-backup',
    client: anthropic,
    priority: 2, // Second priority
    enabled: true,
  });

  multiProvider.registerProvider({
    type: 'gemini',
    name: 'gemini-backup',
    client: gemini,
    priority: 3, // Third priority
    enabled: true,
  });

  multiProvider.registerProvider({
    type: 'mistral',
    name: 'mistral-eu',
    client: mistral,
    priority: 4, // Lowest priority
    enabled: true,
    useCases: ['european-data'], // Specific use case
  });

  // List registered providers
  const providers = multiProvider.getProviders();
  console.log(`\n✅ Registered ${providers.length} providers:`);
  providers.forEach(p => {
    console.log(`  - ${p.name} (${p.type}) - Priority: ${p.priority}`);
  });

  // Display routing strategies
  console.log('\n🔀 Available Routing Strategies:');
  console.log('  1. priority - Use highest priority provider');
  console.log('  2. round-robin - Rotate through providers');
  console.log('  3. cost - Use cheapest provider');
  console.log('  4. use-case - Route by specific use case');
  console.log('  5. custom - Custom routing function');

  // Display failover configuration
  const config = multiProvider.getConfig();
  console.log('\n🔄 Failover Configuration:');
  console.log(`  Enabled: ${config.enableFailover}`);
  console.log(`  Max Attempts: ${config.maxFailoverAttempts}`);
  console.log(`  Strategy: ${config.strategy}`);

  // Display metrics
  const metrics = multiProvider.getMetrics();
  console.log('\n📊 Metrics:');
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Total Cost: $${metrics.totalCost.toFixed(6)}`);

  console.log('\n✨ Multi-Provider Benefits:');
  console.log('  ✓ Automatic failover for high availability');
  console.log('  ✓ Load balancing across providers');
  console.log('  ✓ Cost optimization');
  console.log('  ✓ Use-case specific routing');
  console.log('  ✓ Unified metrics and monitoring');
}

main();
