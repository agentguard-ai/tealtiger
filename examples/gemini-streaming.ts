/**
 * TealGemini - Streaming Examples
 * 
 * This example demonstrates streaming responses for long-form content.
 */

import { TealGemini } from 'tealtiger';

async function main() {
  // Initialize TealGemini client
  const client = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    model: 'gemini-pro'
  });

  console.log('=== TealGemini Streaming Examples ===\n');

  // Example 1: Basic streaming
  console.log('1. Basic Streaming:');
  console.log('Prompt: Write a short story about AI\n');
  console.log('Response (streaming):');
  
  const stream1 = client.generateContentStream({
    contents: [{
      role: 'user',
      parts: [{ text: 'Write a short story about AI in 3 paragraphs' }]
    }]
  });

  for await (const chunk of stream1) {
    if (!chunk.done) {
      process.stdout.write(chunk.text);
    }
  }
  console.log('\n');

  // Example 2: Streaming with creative config
  console.log('2. Creative Streaming (High Temperature):');
  console.log('Prompt: Write a poem about technology\n');
  console.log('Response (streaming):');
  
  const stream2 = client.generateContentStream({
    contents: [{
      role: 'user',
      parts: [{ text: 'Write a creative poem about technology' }]
    }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 500
    }
  });

  for await (const chunk of stream2) {
    if (!chunk.done) {
      process.stdout.write(chunk.text);
    }
  }
  console.log('\n');

  // Example 3: Streaming with progress indicator
  console.log('3. Streaming with Progress:');
  console.log('Prompt: Explain machine learning\n');
  
  let chunkCount = 0;
  const stream3 = client.generateContentStream({
    contents: [{
      role: 'user',
      parts: [{ text: 'Explain machine learning in detail' }]
    }]
  });

  for await (const chunk of stream3) {
    if (!chunk.done) {
      chunkCount++;
      process.stdout.write(chunk.text);
    } else {
      console.log(`\n\n[Received ${chunkCount} chunks]`);
    }
  }
  console.log();

  // Example 4: Streaming with accumulation
  console.log('4. Streaming with Full Text Accumulation:');
  console.log('Prompt: List 5 benefits of AI\n');
  
  let fullText = '';
  const stream4 = client.generateContentStream({
    contents: [{
      role: 'user',
      parts: [{ text: 'List 5 benefits of AI with explanations' }]
    }]
  });

  for await (const chunk of stream4) {
    if (!chunk.done) {
      fullText += chunk.text;
      process.stdout.write(chunk.text);
    }
  }
  
  console.log('\n\nFull text length:', fullText.length, 'characters');
  console.log();

  // Example 5: Streaming with error handling
  console.log('5. Streaming with Error Handling:');
  
  try {
    const stream5 = client.generateContentStream({
      contents: [{
        role: 'user',
        parts: [{ text: 'Write a detailed essay about quantum computing' }]
      }],
      generationConfig: {
        maxOutputTokens: 2048
      }
    });

    let wordCount = 0;
    for await (const chunk of stream5) {
      if (!chunk.done) {
        wordCount += chunk.text.split(' ').length;
        process.stdout.write(chunk.text);
      } else {
        console.log(`\n\n[Approximately ${wordCount} words generated]`);
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
  }
  console.log();

  // Example 6: Streaming with custom formatting
  console.log('6. Streaming with Custom Formatting:');
  console.log('Prompt: Write code examples\n');
  
  const stream6 = client.generateContentStream({
    contents: [{
      role: 'user',
      parts: [{ text: 'Show me 3 Python code examples for data processing' }]
    }]
  });

  let inCodeBlock = false;
  for await (const chunk of stream6) {
    if (!chunk.done) {
      const text = chunk.text;
      
      // Detect code blocks
      if (text.includes('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) {
          process.stdout.write('\n[CODE BLOCK START]\n');
        } else {
          process.stdout.write('\n[CODE BLOCK END]\n');
        }
      }
      
      process.stdout.write(text);
    }
  }
  console.log('\n');

  console.log('=== Streaming Examples Complete ===');
}

// Run examples
main().catch(console.error);
