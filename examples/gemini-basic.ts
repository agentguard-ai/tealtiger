/**
 * TealGemini - Basic Usage Examples
 * 
 * This example demonstrates basic usage of TealGemini for text generation.
 */

import { TealGemini } from 'tealtiger';

async function main() {
  // Initialize TealGemini client
  const client = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    model: 'gemini-pro'
  });

  console.log('=== TealGemini Basic Usage ===\n');

  // Example 1: Simple text generation
  console.log('1. Simple Text Generation:');
  const response1 = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: 'Explain quantum computing in 2 sentences' }]
    }]
  });
  console.log('Response:', response1.text);
  console.log('Cost:', response1.metadata?.cost, 'USD');
  console.log('Model:', response1.metadata?.model);
  console.log();

  // Example 2: Multi-turn conversation
  console.log('2. Multi-turn Conversation:');
  const response2 = await client.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: 'What is machine learning?' }]
      },
      {
        role: 'model',
        parts: [{ text: 'Machine learning is a subset of AI that enables systems to learn from data.' }]
      },
      {
        role: 'user',
        parts: [{ text: 'Give me a simple example' }]
      }
    ]
  });
  console.log('Response:', response2.text);
  console.log('Cost:', response2.metadata?.cost, 'USD');
  console.log();

  // Example 3: With generation config
  console.log('3. With Generation Config (Creative):');
  const response3 = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: 'Write a creative tagline for an AI security product' }]
    }],
    generationConfig: {
      temperature: 0.9,  // More creative
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 100
    }
  });
  console.log('Response:', response3.text);
  console.log('Cost:', response3.metadata?.cost, 'USD');
  console.log();

  // Example 4: With different model
  console.log('4. Using Gemini 1.5 Flash (Fast & Cheap):');
  const flashClient = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    model: 'gemini-1.5-flash'
  });
  
  const response4 = await flashClient.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: 'What is 2+2?' }]
    }]
  });
  console.log('Response:', response4.text);
  console.log('Cost:', response4.metadata?.cost, 'USD');
  console.log('Model:', response4.metadata?.model);
  console.log();

  console.log('=== Examples Complete ===');
}

// Run examples
main().catch(console.error);
