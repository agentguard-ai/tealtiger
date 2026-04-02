/**
 * TealBedrock - Streaming Examples
 * 
 * This example demonstrates streaming responses for long-form content.
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

  console.log('=== TealBedrock Streaming Examples ===\n');

  // Example 1: Basic streaming with Claude
  console.log('1. Basic Streaming (Claude v2):');
  console.log('Prompt: Write a short story about AI\n');
  console.log('Response (streaming):');
  
  const stream1 = client.invokeModelStream({
    modelId: 'anthropic.claude-v2',
    prompt: 'Write a short story about AI in 3 paragraphs',
    maxTokens: 500
  });

  for await (const chunk of stream1) {
    if (!chunk.done) {
      process.stdout.write(chunk.text);
    }
  }
  console.log('\n');

  // Example 2: Streaming with Amazon Titan
  console.log('2. Streaming with Amazon Titan:');
  console.log('Prompt: Explain cloud computing\n');
  console.log('Response (streaming):');
  
  const stream2 = client.invokeModelStream({
    modelId: 'amazon.titan-text-express-v1',
    prompt: 'Explain cloud computing and its benefits in detail',
    maxTokens: 400
  });

  for await (const chunk of stream2) {
    if (!chunk.done) {
      process.stdout.write(chunk.text);
    }
  }
  console.log('\n');

  // Example 3: Streaming with progress indicator
  console.log('3. Streaming with Progress (Cohere Command):');
  console.log('Prompt: Write a blog post about AI security\n');
  
  let chunkCount = 0;
  const stream3 = client.invokeModelStream({
    modelId: 'cohere.command-text-v14',
    prompt: 'Write a blog post about AI security best practices',
    maxTokens: 600
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
  console.log('4. Streaming with Full Text Accumulation (Meta Llama):');
  console.log('Prompt: List benefits of machine learning\n');
  
  let fullText = '';
  const stream4 = client.invokeModelStream({
    modelId: 'meta.llama2-13b-chat-v1',
    prompt: 'List 5 benefits of machine learning with detailed explanations',
    maxTokens: 500
  });

  for await (const chunk of stream4) {
    if (!chunk.done) {
      fullText += chunk.text;
      process.stdout.write(chunk.text);
    }
  }
  
  console.log('\n\nFull text length:', fullText.length, 'characters');
  console.log('Word count:', fullText.split(' ').length, 'words');
  console.log();

  // Example 5: Streaming with error handling
  console.log('5. Streaming with Error Handling (Claude Instant):');
  
  try {
    const stream5 = client.invokeModelStream({
      modelId: 'anthropic.claude-instant-v1',
      prompt: 'Write a detailed essay about quantum computing',
      maxTokens: 800
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
  console.log('6. Streaming with Custom Formatting (AI21 Jurassic):');
  console.log('Prompt: Write code examples\n');
  
  const stream6 = client.invokeModelStream({
    modelId: 'ai21.j2-mid-v1',
    prompt: 'Show me 3 Python code examples for data processing',
    maxTokens: 600
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

  // Example 7: Streaming comparison across providers
  console.log('7. Streaming Speed Comparison:\n');

  const providers = [
    { name: 'Claude 3 Haiku (Fastest)', id: 'anthropic.claude-3-haiku-20240307-v1:0' },
    { name: 'Claude Instant', id: 'anthropic.claude-instant-v1' },
    { name: 'Titan Text Lite', id: 'amazon.titan-text-lite-v1' }
  ];

  const testPrompt = 'Explain machine learning in 2 paragraphs';

  for (const provider of providers) {
    console.log(`${provider.name}:`);
    
    const startTime = Date.now();
    let chunks = 0;
    
    const stream = client.invokeModelStream({
      modelId: provider.id,
      prompt: testPrompt,
      maxTokens: 200
    });

    for await (const chunk of stream) {
      if (!chunk.done) {
        chunks++;
        process.stdout.write(chunk.text);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n  Time: ${duration}ms | Chunks: ${chunks}\n`);
  }

  // Example 8: Streaming with temperature variations
  console.log('8. Streaming with Temperature Variations (Claude v2):\n');

  const temperatures = [0.3, 0.7, 0.9];
  const creativePrompt = 'Write a creative opening for a sci-fi story';

  for (const temp of temperatures) {
    console.log(`Temperature ${temp}:`);
    
    const stream = client.invokeModelStream({
      modelId: 'anthropic.claude-v2',
      prompt: creativePrompt,
      maxTokens: 200,
      temperature: temp
    });

    for await (const chunk of stream) {
      if (!chunk.done) {
        process.stdout.write(chunk.text);
      }
    }
    console.log('\n');
  }

  // Example 9: Streaming with stop sequences
  console.log('9. Streaming with Stop Sequences:');
  console.log('Prompt: Write a list of items (stop at 5)\n');
  
  const stream9 = client.invokeModelStream({
    modelId: 'anthropic.claude-v2',
    prompt: 'List 10 programming languages with descriptions',
    maxTokens: 500,
    stopSequences: ['6.', '6:']  // Stop after 5 items
  });

  for await (const chunk of stream9) {
    if (!chunk.done) {
      process.stdout.write(chunk.text);
    } else {
      console.log('\n[Stopped by stop sequence]');
    }
  }
  console.log();

  // Example 10: Long-form content streaming
  console.log('10. Long-form Content Streaming (Meta Llama 70B):');
  console.log('Prompt: Write a comprehensive guide\n');
  
  let totalChunks = 0;
  let totalChars = 0;
  
  const stream10 = client.invokeModelStream({
    modelId: 'meta.llama2-70b-chat-v1',
    prompt: 'Write a comprehensive guide to getting started with AI development',
    maxTokens: 1000
  });

  for await (const chunk of stream10) {
    if (!chunk.done) {
      totalChunks++;
      totalChars += chunk.text.length;
      process.stdout.write(chunk.text);
      
      // Progress indicator every 10 chunks
      if (totalChunks % 10 === 0) {
        process.stdout.write(` [${totalChunks} chunks] `);
      }
    } else {
      console.log(`\n\n[Total: ${totalChunks} chunks, ${totalChars} characters]`);
    }
  }
  console.log();

  console.log('=== Streaming Examples Complete ===');
}

// Run examples
main().catch(console.error);
