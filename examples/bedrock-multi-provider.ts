/**
 * TealBedrock - Multi-Provider Comparison Examples
 * 
 * This example demonstrates comparing different AI providers for the same task.
 */

import { TealBedrock } from 'tealtiger';

async function main() {
  // Initialize TealBedrock client
  const client = new TealBedrock({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    }
  });

  console.log('=== TealBedrock Multi-Provider Comparison ===\n');

  const prompt = 'Explain artificial intelligence in one paragraph';
  const maxTokens = 200;

  // Example 1: Compare all providers for the same task
  console.log('Task: Explain artificial intelligence in one paragraph\n');

  console.log('1. Anthropic Claude v2:');
  const claude = await client.invokeModel({
    modelId: 'anthropic.claude-v2',
    prompt,
    maxTokens
  });
  console.log('Response:', claude.text.substring(0, 150) + '...');
  console.log('Cost:', claude.metadata?.cost, 'USD');
  console.log('Tokens:', claude.inputTokens, 'in /', claude.outputTokens, 'out');
  console.log();

  console.log('2. Amazon Titan Text Express:');
  const titan = await client.invokeModel({
    modelId: 'amazon.titan-text-express-v1',
    prompt,
    maxTokens
  });
  console.log('Response:', titan.text.substring(0, 150) + '...');
  console.log('Cost:', titan.metadata?.cost, 'USD');
  console.log('Tokens:', titan.inputTokens, 'in /', titan.outputTokens, 'out');
  console.log();

  console.log('3. AI21 Jurassic-2 Mid:');
  const jurassic = await client.invokeModel({
    modelId: 'ai21.j2-mid-v1',
    prompt,
    maxTokens
  });
  console.log('Response:', jurassic.text.substring(0, 150) + '...');
  console.log('Cost:', jurassic.metadata?.cost, 'USD');
  console.log();

  console.log('4. Cohere Command:');
  const cohere = await client.invokeModel({
    modelId: 'cohere.command-text-v14',
    prompt,
    maxTokens
  });
  console.log('Response:', cohere.text.substring(0, 150) + '...');
  console.log('Cost:', cohere.metadata?.cost, 'USD');
  console.log();

  console.log('5. Meta Llama 2 13B:');
  const llama = await client.invokeModel({
    modelId: 'meta.llama2-13b-chat-v1',
    prompt,
    maxTokens
  });
  console.log('Response:', llama.text.substring(0, 150) + '...');
  console.log('Cost:', llama.metadata?.cost, 'USD');
  console.log('Tokens:', llama.inputTokens, 'in /', llama.outputTokens, 'out');
  console.log();

  // Example 2: Cost comparison for different model tiers
  console.log('\n=== Cost Comparison: Simple Task ===\n');
  const simplePrompt = 'What is 2+2?';

  console.log('Task: What is 2+2?\n');

  const models = [
    { name: 'Claude 3 Haiku (Cheapest)', id: 'anthropic.claude-3-haiku-20240307-v1:0' },
    { name: 'Claude Instant', id: 'anthropic.claude-instant-v1' },
    { name: 'Titan Text Lite', id: 'amazon.titan-text-lite-v1' },
    { name: 'Cohere Command Light', id: 'cohere.command-light-text-v14' },
    { name: 'Claude v2 (Most Capable)', id: 'anthropic.claude-v2' }
  ];

  for (const model of models) {
    const response = await client.invokeModel({
      modelId: model.id,
      prompt: simplePrompt,
      maxTokens: 50
    });
    console.log(`${model.name}:`);
    console.log('  Response:', response.text.trim());
    console.log('  Cost:', response.metadata?.cost, 'USD');
    console.log();
  }

  // Example 3: Performance comparison (creative vs factual)
  console.log('\n=== Performance Comparison: Creative Task ===\n');
  const creativePrompt = 'Write a creative tagline for a coffee shop';

  console.log('Task: Write a creative tagline for a coffee shop\n');

  const creativeModels = [
    { name: 'Claude v2 (High Temp)', id: 'anthropic.claude-v2', temp: 0.9 },
    { name: 'Cohere Command (High Temp)', id: 'cohere.command-text-v14', temp: 0.9 },
    { name: 'Titan Express (High Temp)', id: 'amazon.titan-text-express-v1', temp: 0.9 }
  ];

  for (const model of creativeModels) {
    const response = await client.invokeModel({
      modelId: model.id,
      prompt: creativePrompt,
      maxTokens: 100,
      temperature: model.temp
    });
    console.log(`${model.name}:`);
    console.log('  Response:', response.text.trim());
    console.log('  Cost:', response.metadata?.cost, 'USD');
    console.log();
  }

  // Example 4: Regional comparison
  console.log('\n=== Regional Comparison ===\n');

  const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];
  const testPrompt = 'Hello, how are you?';

  for (const region of regions) {
    const regionalClient = new TealBedrock({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
      }
    });

    const startTime = Date.now();
    const response = await regionalClient.invokeModel({
      modelId: 'anthropic.claude-instant-v1',
      prompt: testPrompt,
      maxTokens: 50
    });
    const latency = Date.now() - startTime;

    console.log(`Region: ${region}`);
    console.log('  Latency:', latency, 'ms');
    console.log('  Response:', response.text.substring(0, 50) + '...');
    console.log();
  }

  // Example 5: Provider selection based on use case
  console.log('\n=== Provider Selection Guide ===\n');

  const useCases = [
    {
      name: 'Simple Q&A (Cost-Optimized)',
      model: 'anthropic.claude-3-haiku-20240307-v1:0',
      prompt: 'What is the capital of France?'
    },
    {
      name: 'Complex Reasoning',
      model: 'anthropic.claude-v2',
      prompt: 'Explain the implications of quantum computing on cryptography'
    },
    {
      name: 'Creative Writing',
      model: 'cohere.command-text-v14',
      prompt: 'Write a poem about technology'
    },
    {
      name: 'AWS-Native Integration',
      model: 'amazon.titan-text-express-v1',
      prompt: 'Describe AWS services for machine learning'
    },
    {
      name: 'Open Source (Llama)',
      model: 'meta.llama2-70b-chat-v1',
      prompt: 'What are the benefits of open source AI?'
    }
  ];

  for (const useCase of useCases) {
    console.log(`Use Case: ${useCase.name}`);
    console.log(`  Model: ${useCase.model}`);
    
    const response = await client.invokeModel({
      modelId: useCase.model,
      prompt: useCase.prompt,
      maxTokens: 150
    });
    
    console.log('  Response:', response.text.substring(0, 100) + '...');
    console.log('  Cost:', response.metadata?.cost, 'USD');
    console.log();
  }

  console.log('=== Multi-Provider Comparison Complete ===');
}

// Run examples
main().catch(console.error);
