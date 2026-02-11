/**
 * Cost Comparison Example
 * 
 * Demonstrates using CostCalculator to compare costs across providers
 */

import { CostCalculator } from 'tealtiger';

async function main() {
  console.log('💰 TealTiger Cost Comparison Example\n');

  const calculator = new CostCalculator();

  // Define token usage for comparison
  const tokenUsage = {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
  };

  console.log('📊 Token Usage:');
  console.log(`   Input: ${tokenUsage.inputTokens} tokens`);
  console.log(`   Output: ${tokenUsage.outputTokens} tokens`);
  console.log(`   Total: ${tokenUsage.totalTokens} tokens\n`);

  // Compare costs across different models and providers
  const models = [
    { model: 'gpt-3.5-turbo', provider: 'openai' as const },
    { model: 'gpt-4', provider: 'openai' as const },
    { model: 'gpt-4-turbo', provider: 'openai' as const },
    { model: 'claude-2', provider: 'anthropic' as const },
    { model: 'claude-instant-1', provider: 'anthropic' as const },
    { model: 'gemini-pro', provider: 'google' as const },
  ];

  console.log('💵 Cost Comparison Across Providers:\n');
  const comparison = calculator.compareProviders(tokenUsage, models);

  // Display all provider costs
  comparison.providers.forEach((provider, index) => {
    const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${icon} ${provider.model} (${provider.provider})`);
    console.log(`   Cost: $${provider.cost.toFixed(6)}`);
    console.log(`   Input: $${provider.breakdown.inputCost.toFixed(6)}`);
    console.log(`   Output: $${provider.breakdown.outputCost.toFixed(6)}\n`);
  });

  // Display cheapest and most expensive
  console.log('🏆 Summary:');
  console.log(`   Cheapest: ${comparison.cheapest.model} - $${comparison.cheapest.cost.toFixed(6)}`);
  console.log(`   Most Expensive: ${comparison.mostExpensive.model} - $${comparison.mostExpensive.cost.toFixed(6)}`);
  console.log(`   Difference: $${(comparison.mostExpensive.cost - comparison.cheapest.cost).toFixed(6)}`);
  console.log(`   Savings: ${((1 - comparison.cheapest.cost / comparison.mostExpensive.cost) * 100).toFixed(1)}%\n`);

  // Project costs over time
  console.log('📈 Cost Projections (1000 requests/day):\n');
  
  const periods: Array<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'> = [
    'daily',
    'weekly',
    'monthly',
    'yearly',
  ];

  periods.forEach(period => {
    const projection = calculator.projectCost(
      'gpt-3.5-turbo',
      1000,
      tokenUsage,
      period,
      'openai'
    );

    console.log(`   ${period.charAt(0).toUpperCase() + period.slice(1)}: $${projection.projectedCost.toFixed(2)}`);
  });

  // Generate optimization recommendations
  console.log('\n💡 Optimization Recommendations:\n');
  const recommendations = calculator.generateOptimizationRecommendations(
    'gpt-4',
    tokenUsage,
    [
      { model: 'gpt-3.5-turbo', provider: 'openai' as const },
      { model: 'claude-instant-1', provider: 'anthropic' as const },
      { model: 'gemini-pro', provider: 'google' as const },
    ],
    'openai'
  );

  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. Switch to ${rec.alternativeModel} (${rec.alternativeProvider})`);
    console.log(`      Savings: $${rec.savings.amount.toFixed(6)} (${rec.savings.percentage.toFixed(1)}%)`);
    console.log(`      Reason: ${rec.reason}\n`);
  });

  // Cost alert thresholds
  console.log('🚨 Cost Alert Example:\n');
  const alertCheck = calculator.checkAlertThreshold(
    'gpt-4',
    tokenUsage,
    0.01, // Alert if cost exceeds $0.01
    'openai'
  );

  if (alertCheck.exceeded) {
    console.log(`   ⚠️  Alert: Cost threshold exceeded!`);
    console.log(`   Current: $${alertCheck.currentCost.toFixed(6)}`);
    console.log(`   Threshold: $${alertCheck.threshold.toFixed(6)}`);
    console.log(`   Overage: $${alertCheck.overage.toFixed(6)}`);
  } else {
    console.log(`   ✅ Cost within threshold`);
    console.log(`   Current: $${alertCheck.currentCost.toFixed(6)}`);
    console.log(`   Threshold: $${alertCheck.threshold.toFixed(6)}`);
  }

  console.log('\n✨ Cost Management Benefits:');
  console.log('   ✓ Compare costs across all providers');
  console.log('   ✓ Project future spending');
  console.log('   ✓ Get optimization recommendations');
  console.log('   ✓ Set cost alert thresholds');
  console.log('   ✓ Make data-driven provider decisions');
}

main();
