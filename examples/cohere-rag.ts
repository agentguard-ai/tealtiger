/**
 * Cohere RAG (Retrieval Augmented Generation) Example
 * 
 * Demonstrates using Cohere's RAG features with documents and citations
 */

import { TealCohere } from 'tealtiger';

async function main() {
  // Initialize TealCohere client
  const client = new TealCohere({
    apiKey: process.env.COHERE_API_KEY || 'your-cohere-api-key',
    agentId: 'cohere-rag-agent',
  });

  console.log('📚 TealTiger Cohere RAG Example\n');

  try {
    // Define knowledge base documents
    const documents = [
      {
        title: 'TealTiger Overview',
        snippet: 'TealTiger is an AI security platform that provides guardrails, cost tracking, and policy management for LLM applications. It supports multiple providers including OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, Mistral AI, and Cohere.',
      },
      {
        title: 'Security Features',
        snippet: 'TealTiger includes TealGuard for content moderation, PII detection, and prompt injection prevention. TealEngine provides policy enforcement and TealCircuit implements circuit breaker patterns.',
      },
      {
        title: 'Cost Management',
        snippet: 'TealTiger tracks costs across all providers with real-time monitoring, budget management, and cost optimization recommendations. It helps teams control AI spending effectively.',
      },
    ];

    // Chat with RAG - the model will use the provided documents
    console.log('📝 Sending RAG chat request with documents...');
    const response = await client.chat({
      message: 'What security features does TealTiger provide?',
      model: 'command',
      documents,
    });

    console.log('\n✅ Response:');
    console.log(response.text);

    // Display citations if available
    if (response.citations && response.citations.length > 0) {
      console.log('\n📎 Citations:');
      response.citations.forEach((citation, index) => {
        console.log(`  ${index + 1}. Document: "${citation.document_ids?.join(', ')}"`);
        console.log(`     Text: "${citation.text}"`);
      });
    }

    // Display cost information
    if (response.security?.costRecord) {
      console.log('\n💰 Cost Information:');
      console.log(`  Cost: $${response.security.costRecord.actualCost.toFixed(6)}`);
      console.log(`  Tokens: ${response.security.costRecord.actualTokens.totalTokens}`);
    }

    // Example with web search connector
    console.log('\n🌐 Sending request with web search connector...');
    const webResponse = await client.chat({
      message: 'What are the latest developments in AI security?',
      model: 'command',
      connectors: [{ id: 'web-search' }],
    });

    console.log('\n✅ Response with web search:');
    console.log(webResponse.text);

    // Display search queries if available
    if (webResponse.search_queries && webResponse.search_queries.length > 0) {
      console.log('\n🔍 Search Queries Used:');
      webResponse.search_queries.forEach((query, index) => {
        console.log(`  ${index + 1}. ${query.text}`);
      });
    }

    console.log('\n📚 RAG Benefits:');
    console.log('  ✓ Grounded responses based on your documents');
    console.log('  ✓ Citation tracking for transparency');
    console.log('  ✓ Web search integration for current information');
    console.log('  ✓ Reduced hallucinations');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

main();
