/**
 * Mistral AI Basic Example
 * 
 * Demonstrates basic usage of TealMistral client with European data residency
 */

import { TealMistral } from 'tealtiger';

async function main() {
  // Initialize TealMistral client
  const client = new TealMistral({
    apiKey: process.env.MISTRAL_API_KEY || 'your-mistral-api-key',
    agentId: 'mistral-demo-agent',
  });

  console.log('🇪🇺 TealTiger Mistral AI Basic Example\n');

  try {
    // Simple chat completion with Mistral Large
    console.log('📝 Sending chat completion request (Mistral Large)...');
    const response = await client.chat.completions.create({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: 'You are a helpful assistant focused on European data privacy.' },
        { role: 'user', content: 'Explain GDPR compliance in simple terms.' },
      ],
      max_tokens: 200,
    });

    console.log('\n✅ Response received:');
    console.log(response.choices[0].message.content);

    // Display cost and token usage
    if (response.security?.costRecord) {
      console.log('\n💰 Cost Information:');
      console.log(`  Cost: $${response.security.costRecord.actualCost.toFixed(6)}`);
      console.log(`  Input Tokens: ${response.security.costRecord.actualTokens.inputTokens}`);
      console.log(`  Output Tokens: ${response.security.costRecord.actualTokens.outputTokens}`);
    }

    // Try Mistral Small for cost-effective queries
    console.log('\n📝 Sending request with Mistral Small (cost-effective)...');
    const smallResponse = await client.chat.completions.create({
      model: 'mistral-small-latest',
      messages: [
        { role: 'user', content: 'What is the capital of France?' },
      ],
      max_tokens: 50,
    });

    console.log('\n✅ Response received:');
    console.log(smallResponse.choices[0].message.content);

    if (smallResponse.security?.costRecord) {
      console.log(`  💰 Cost: $${smallResponse.security.costRecord.actualCost.toFixed(6)}`);
    }

    // Display European data residency information
    console.log('\n🇪🇺 European Data Residency:');
    console.log('  ✓ Data processed in European data centers');
    console.log('  ✓ GDPR compliant');
    console.log('  ✓ No data transfer outside EU');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

main();
