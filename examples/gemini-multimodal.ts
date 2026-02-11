/**
 * TealGemini - Multimodal Usage (Text + Images)
 * 
 * This example demonstrates how to use TealGemini with images.
 */

import { TealGemini } from 'tealtiger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Initialize TealGemini with vision model
  const client = new TealGemini({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    model: 'gemini-pro-vision'
  });

  console.log('=== TealGemini Multimodal Examples ===\n');

  // Example 1: Analyze an image (using base64)
  console.log('1. Image Analysis:');
  
  // For this example, we'll create a simple base64 image
  // In production, you would read an actual image file
  const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const response1 = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: 'What do you see in this image?' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleImageBase64
          }
        }
      ]
    }]
  });
  console.log('Response:', response1.text);
  console.log('Cost:', response1.metadata?.cost, 'USD');
  console.log();

  // Example 2: Multiple images
  console.log('2. Compare Multiple Images:');
  const response2 = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: 'Compare these two images' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleImageBase64
          }
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleImageBase64
          }
        }
      ]
    }]
  });
  console.log('Response:', response2.text);
  console.log('Cost:', response2.metadata?.cost, 'USD');
  console.log();

  // Example 3: Image with specific question
  console.log('3. Specific Image Question:');
  const response3 = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: 'Is there any text in this image? If so, what does it say?' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleImageBase64
          }
        }
      ]
    }]
  });
  console.log('Response:', response3.text);
  console.log('Cost:', response3.metadata?.cost, 'USD');
  console.log();

  // Example 4: Reading an actual image file (if available)
  console.log('4. Reading from File:');
  const imagePath = path.join(__dirname, 'sample-image.jpg');
  
  if (fs.existsSync(imagePath)) {
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    const response4 = await client.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Describe this image in detail' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          }
        ]
      }]
    });
    console.log('Response:', response4.text);
    console.log('Cost:', response4.metadata?.cost, 'USD');
  } else {
    console.log('(Skipped - sample-image.jpg not found)');
  }
  console.log();

  // Example 5: Image with follow-up questions
  console.log('5. Multi-turn with Image:');
  const response5a = await client.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: 'What colors do you see in this image?' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleImageBase64
          }
        }
      ]
    }]
  });
  console.log('First Response:', response5a.text);
  
  // Follow-up question (without image)
  const response5b = await client.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'What colors do you see in this image?' },
          {
            inlineData: {
              mimeType: 'image/png',
              data: sampleImageBase64
            }
          }
        ]
      },
      {
        role: 'model',
        parts: [{ text: response5a.text }]
      },
      {
        role: 'user',
        parts: [{ text: 'What emotions does this evoke?' }]
      }
    ]
  });
  console.log('Follow-up Response:', response5b.text);
  console.log('Total Cost:', response5b.metadata?.cost, 'USD');
  console.log();

  console.log('=== Multimodal Examples Complete ===');
}

// Helper function to read image from URL (optional)
async function getImageFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Run examples
main().catch(console.error);
