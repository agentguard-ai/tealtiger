/**
 * TealBedrock - Basic Usage Examples
 * 
 * This example demonstrates basic usage of TealBedrock with different AI providers.
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

  console.log('=== TealBedrock Basic Usage ===\n');

  // Example 1: Anthropic Claude v2
  console.log('1. Anthropic Claude v2 (Most Capable):');
  const response1 = await client.invokeModel({
    modelId: 'anthropic.claude-v2',
    prompt: 'Explain quantum computing in 2 sentences',
    maxTokens: 200
  });
  console.log('Response:', response1.text);
  console.log('Cost:', response1.metadata?.cost, 'USD');
  console.log('Tokens:', response1.inputTokens, 'in /', response1.outputTokens, 'out');
  console.log();

  // Example 2: Anthropic Claude Instant (Fast & Cheap)
  console.log('2. Anthropic Claude Instant (Fast & Cheap):');
  const response2 = await client.invokeModel({
    modelId: 'anthropic.claude-instant-v1',
    prompt: 'What is machine learning?',
    maxTokens: 150
  });
  console.log('Response:', response2.text);
  console.log('Cost:', response2.metadata?.cost, 'USD');
  console.log();

  // Example 3: Amazon Titan Text Express
  console.log('3. Amazon Titan Text Express:');
  const response3 = await client.invokeModel({
    modelId: 'amazon.titan-text-express-v1',
    prompt: 'Write a product description for a smart watch',
    maxTokens: 200,
    temperature: 0.8
  });
  console.log('Response:', response3.text);
  console.log('Cost:', response3.metadata?.cost, 'USD');
  console.log();

  // Example 4: AI21 Jurassic-2 Ultra
  console.log('4. AI21 Jurassic-2 Ultra:');
  const response4 = await client.invokeModel({
    modelId: 'ai21.j2-ultra-v1',
    prompt: 'Explain the benefits of cloud computing',
    maxTokens: 250
  });
  console.log('Response:', response4.text);
  console.log('Cost:', response4.metadata?.cost, 'USD');
  console.log();

  // Example 5: Cohere Command
  console.log('5. Cohere Command:');
  const response5 = await client.invokeModel({
    modelId: 'cohere.command-text-v14',
    prompt: 'Generate a creative tagline for an AI security product',
    maxTokens: 100,
    temperature: 0.9
  });
  console.log('Response:', response5.text);
  console.log('Cost:', response5.metadata?.cost, 'USD');
  console.log();

  // Example 6: Meta Llama 2 70B
  console.log('6. Meta Llama 2 70B Chat:');
  const response6 = await client.invokeModel({
    modelId: 'meta.llama2-70b-chat-v1',
    prompt: 'What are the key principles of software security?',
    maxTokens: 300
  });
  console.log('Response:', response6.text);
  console.log('Cost:', response6.metadata?.cost, 'USD');
  console.log();

  // Example 7: With custom parameters
  console.log('7. With Custom Parameters (Temperature, TopP):');
  const response7 = await client.invokeModel({
    modelId: 'anthropic.claude-v2',
    prompt: 'Write a creative story opening',
    maxTokens: 200,
    temperature: 0.9,  // More creative
    topP: 0.95,
    stopSequences: ['The End']
  });
  console.log('Response:', response7.text);
  console.log('Cost:', response7.metadata?.cost, 'USD');
  console.log();

  // Example 8: Claude 3 Haiku (Fastest & Cheapest)
  console.log('8. Claude 3 Haiku (Fastest & Cheapest):');
  const response8 = await client.invokeModel({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    prompt: 'What is 2+2?',
    maxTokens: 50
  });
  console.log('Response:', response8.text);
  console.log('Cost:', response8.metadata?.cost, 'USD');
  console.log('Model:', response8.metadata?.model);
  console.log();

  console.log('=== Examples Complete ===');
}

// Run examples
main().catch(console.error);
