/**
 * Azure OpenAI Basic Example
 * 
 * Demonstrates basic usage of TealAzureOpenAI client with Azure-specific configuration
 */

import { TealAzureOpenAI } from 'tealtiger';

async function main() {
  // Initialize TealAzureOpenAI client with Azure-specific configuration
  const client = new TealAzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'your-azure-api-key',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com',
    deployment: 'gpt-4', // Your Azure deployment name
    apiVersion: '2024-02-15-preview', // Azure API version
    agentId: 'azure-demo-agent',
  });

  console.log('🔷 TealTiger Azure OpenAI Basic Example\n');

  try {
    // Simple chat completion
    console.log('📝 Sending chat completion request...');
    const response = await client.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What are the benefits of using Azure OpenAI?' },
      ],
      max_tokens: 150,
    });

    console.log('\n✅ Response received:');
    console.log(response.choices[0].message.content);

    // Display Azure-specific metadata
    if (response.security) {
      console.log('\n🔒 Security Metadata:');
      if (response.security.costRecord) {
        console.log(`  💰 Cost: $${response.security.costRecord.actualCost.toFixed(6)}`);
        console.log(`  📊 Tokens: ${response.security.costRecord.actualTokens.totalTokens}`);
      }
    }

    // Display Azure configuration
    const config = client.getConfig();
    console.log('\n⚙️  Azure Configuration:');
    console.log(`  Endpoint: ${config.endpoint}`);
    console.log(`  Deployment: ${config.deployment}`);
    console.log(`  API Version: ${config.apiVersion}`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

main();
