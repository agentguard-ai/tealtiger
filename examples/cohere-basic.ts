/**
 * Cohere Basic Example
 * 
 * Demonstrates basic usage of TealCohere client for chat and embeddings
 */

import { TealCohere } from 'tealtiger';

async function main() {
  // Initialize TealCohere client
  const client = new TealCohere({
    apiKey: process.env.COHERE_API_KEY || 'your-cohere-api-key',
    agentId: 'cohere-demo-agent',
  });

  console.log('🔵 TealTiger Cohere Basic Example\n');

  try {
    // Simple chat completion
    console.log('📝 Sending chat request...');
    const chatResponse = await client.chat({
      message: 'What are the key features of Cohere AI?',
      model: 'command',
    });

    console.log('\n✅ Chat Response:');
    console.log(chatResponse.text);

    // Display cost information
    if (chatResponse.security?.costRecord) {
      console.log('\n💰 Cost Information:');
      console.log(`  Cost: $${chatResponse.security.costRecord.actualCost.toFixed(6)}`);
      console.log(`  Tokens: ${chatResponse.security.costRecord.actualTokens.totalTokens}`);
    }

    // Generate embeddings
    console.log('\n📊 Generating embeddings...');
    const embedResponse = await client.embed({
      texts: [
        'Machine learning is fascinating',
        'Natural language processing enables AI to understand text',
        'Deep learning powers modern AI systems',
      ],
      model: 'embed-english-v3.0',
    });

    console.log('\n✅ Embeddings generated:');
    console.log(`  Number of embeddings: ${embedResponse.embeddings.length}`);
    console.log(`  Embedding dimension: ${embedResponse.embeddings[0].length}`);

    if (embedResponse.security?.costRecord) {
      console.log(`  💰 Cost: $${embedResponse.security.costRecord.actualCost.toFixed(6)}`);
    }

    // Display Cohere features
    console.log('\n🔵 Cohere Features:');
    console.log('  ✓ Enterprise-grade chat models');
    console.log('  ✓ High-quality embeddings');
    console.log('  ✓ RAG (Retrieval Augmented Generation) support');
    console.log('  ✓ Built-in connectors for web search');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

main();
