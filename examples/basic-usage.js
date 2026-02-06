/**
 * Basic Usage Example - JavaScript
 * 
 * This example shows how to use the TealTiger SDK in a simple JavaScript application
 */

const { TealTiger } = require('tealtiger');

async function basicExample() {
  console.log('🚀 TealTiger SDK - Basic Usage Example');
  console.log('=====================================');

  // Initialize the SDK
  const tealTiger = new TealTiger({
    apiKey: 'test-api-key-12345',
    ssaUrl: 'http://localhost:3001',
    debug: true
  });

  try {
    // Check if the Security Sidecar Agent is healthy
    console.log('\n1. Health Check');
    const health = await tealTiger.healthCheck();
    console.log('✅ SSA Health:', health);

    // Example 1: Safe web search (should be allowed)
    console.log('\n2. Safe Web Search');
    const searchResult = await tealTiger.executeTool(
      'web-search',
      { query: 'AI security best practices' },
      undefined,
      async (toolName, params) => {
        // Mock tool execution
        console.log(`🔧 Executing ${toolName} with params:`, params);
        return {
          tool: toolName,
          query: params.query,
          results: [
            { title: 'AI Security Guide', url: 'https://example.com/guide' },
            { title: 'Best Practices', url: 'https://example.com/practices' }
          ]
        };
      }
    );
    
    console.log('✅ Search Result:', searchResult);

    // Example 2: System command (should be denied)
    console.log('\n3. System Command (Should be Denied)');
    const systemResult = await tealTiger.executeTool(
      'system-command',
      { command: 'ls -la' },
      undefined,
      async (toolName, params) => {
        // This won't be executed due to security denial
        console.log(`🔧 Executing ${toolName} with params:`, params);
        return { output: 'file1.txt file2.txt' };
      }
    );
    
    console.log('❌ System Command Result:', systemResult);

    // Example 3: File write (should be transformed)
    console.log('\n4. File Write (Should be Transformed)');
    const writeResult = await tealTiger.executeTool(
      'file-write',
      { path: '/tmp/test.txt', content: 'Hello World' },
      undefined,
      async (toolName, params) => {
        console.log(`🔧 Executing ${toolName} with params:`, params);
        // The tool name might be transformed to 'file-read'
        if (toolName === 'file-read') {
          return { content: 'Mock file content', path: params.path };
        } else {
          return { success: true, path: params.path };
        }
      }
    );
    
    console.log('🔄 Write Result:', writeResult);

    // Get SDK statistics
    console.log('\n5. SDK Statistics');
    const stats = tealTiger.getStatistics();
    console.log('📊 Statistics:', stats);

    // Get audit trail
    console.log('\n6. Audit Trail');
    const auditTrail = await tealTiger.getAuditTrail({ limit: 5 });
    console.log('📝 Recent Audit Entries:', auditTrail.auditTrail.entries.length);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.details) {
      console.error('Error Details:', error.details);
    }
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };