/**
 * Policy Testing Example
 * 
 * This example demonstrates how to test and validate TealEngine policies
 * before deploying them to production.
 */

import { TealEngine } from 'tealtiger';

async function main() {
  console.log('=== TealEngine Policy Testing Example ===\n');

  // Example 1: Testing a custom policy
  console.log('1. Testing Custom Policy');
  console.log('------------------------');
  
  const customPolicy = {
    tools: {
      'chat': { allowed: true },
      'file_read': { allowed: true },
      'file_write': { allowed: false },
      'database_write': { allowed: false }
    },
    identity: {
      agentId: 'test-agent-001',
      role: 'assistant',
      permissions: ['read', 'chat'],
      forbidden: ['write', 'delete']
    },
    codeExecution: {
      allowedLanguages: [],
      blockedPatterns: ['eval', 'exec', 'system'],
      sandboxRequired: true
    },
    behavioral: {
      costLimit: {
        daily: 5.00,
        hourly: 1.00
      },
      rateLimit: {
        requests: 50,
        window: '1h'
      }
    }
  };

  const engine = new TealEngine(customPolicy);

  // Test case 1: Allowed action
  console.log('\nTest Case 1: Allowed chat action');
  const test1 = engine.test({
    agentId: 'test-agent-001',
    action: 'chat.create',
    tool: 'chat',
    content: 'Hello, how can I help?'
  });
  console.log('Result:', test1.allowed ? '✅ PASS' : '❌ FAIL');
  console.log('Reason:', test1.reason);

  // Test case 2: Blocked action
  console.log('\nTest Case 2: Blocked file write');
  const test2 = engine.test({
    agentId: 'test-agent-001',
    action: 'file.write',
    tool: 'file_write',
    content: 'Write to file'
  });
  console.log('Result:', !test2.allowed ? '✅ PASS' : '❌ FAIL');
  console.log('Reason:', test2.reason);

  // Test case 3: Code execution blocked
  console.log('\nTest Case 3: Code execution blocked');
  const test3 = engine.test({
    agentId: 'test-agent-001',
    action: 'code.execute',
    tool: 'code_execution',
    content: 'eval("malicious code")'
  });
  console.log('Result:', !test3.allowed ? '✅ PASS' : '❌ FAIL');
  console.log('Reason:', test3.reason);

  console.log('\n---\n');

  // Example 2: Policy validation
  console.log('2. Policy Validation');
  console.log('--------------------');

  const validationResult = engine.validate();
  console.log('Policy valid:', validationResult.valid ? '✅ YES' : '❌ NO');
  
  if (!validationResult.valid) {
    console.log('Errors:', validationResult.errors);
  }

  console.log('\n---\n');

  // Example 3: Testing policy templates
  console.log('3. Testing Policy Templates');
  console.log('---------------------------');

  const templates = [
    { name: 'Customer Support', template: TealEngine.Templates.customerSupport() },
    { name: 'Data Analysis', template: TealEngine.Templates.dataAnalysis() },
    { name: 'Code Generation', template: TealEngine.Templates.codeGeneration() },
    { name: 'Strict Security', template: TealEngine.Templates.strictSecurity() }
  ];

  for (const { name, template } of templates) {
    console.log(`\nTemplate: ${name}`);
    const templateEngine = new TealEngine(template);
    const validation = templateEngine.validate();
    console.log('Valid:', validation.valid ? '✅ YES' : '❌ NO');
    
    // Test a common action
    const testResult = templateEngine.test({
      agentId: 'template-test',
      action: 'chat.create',
      tool: 'chat',
      content: 'Test message'
    });
    console.log('Chat allowed:', testResult.allowed ? '✅ YES' : '❌ NO');
  }

  console.log('\n---\n');

  // Example 4: Coverage testing
  console.log('4. Policy Coverage Testing');
  console.log('--------------------------');

  const coverageEngine = new TealEngine(customPolicy);
  
  const testScenarios = [
    { name: 'Chat', tool: 'chat', action: 'chat.create' },
    { name: 'File Read', tool: 'file_read', action: 'file.read' },
    { name: 'File Write', tool: 'file_write', action: 'file.write' },
    { name: 'Database Write', tool: 'database_write', action: 'database.write' },
    { name: 'Code Execution', tool: 'code_execution', action: 'code.execute' }
  ];

  console.log('\nTesting coverage for all scenarios:');
  const results = testScenarios.map(scenario => {
    const result = coverageEngine.test({
      agentId: 'test-agent-001',
      action: scenario.action,
      tool: scenario.tool,
      content: `Test ${scenario.name}`
    });
    return {
      scenario: scenario.name,
      allowed: result.allowed,
      reason: result.reason
    };
  });

  console.log('\nCoverage Report:');
  results.forEach(result => {
    const status = result.allowed ? '✅ ALLOW' : '❌ BLOCK';
    console.log(`  ${status} - ${result.scenario}: ${result.reason}`);
  });

  const coverage = {
    total: results.length,
    allowed: results.filter(r => r.allowed).length,
    blocked: results.filter(r => !r.allowed).length
  };
  console.log(`\nCoverage: ${coverage.allowed}/${coverage.total} allowed, ${coverage.blocked}/${coverage.total} blocked`);

  console.log('\n---\n');

  // Example 5: Performance testing
  console.log('5. Performance Testing');
  console.log('----------------------');

  const perfEngine = new TealEngine(customPolicy);
  const iterations = 1000;

  console.log(`\nRunning ${iterations} policy evaluations...`);
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    perfEngine.test({
      agentId: 'test-agent-001',
      action: 'chat.create',
      tool: 'chat',
      content: `Test message ${i}`
    });
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;

  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average time per evaluation: ${avgTime.toFixed(3)}ms`);
  console.log(`Throughput: ${(iterations / (totalTime / 1000)).toFixed(0)} evaluations/second`);

  // Check if performance meets target (<5ms per evaluation)
  const meetsTarget = avgTime < 5;
  console.log(`Performance target (<5ms): ${meetsTarget ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n---\n');

  // Example 6: Edge case testing
  console.log('6. Edge Case Testing');
  console.log('--------------------');

  const edgeCases = [
    {
      name: 'Empty content',
      test: { agentId: 'test-agent-001', action: 'chat.create', tool: 'chat', content: '' }
    },
    {
      name: 'Very long content',
      test: { agentId: 'test-agent-001', action: 'chat.create', tool: 'chat', content: 'x'.repeat(10000) }
    },
    {
      name: 'Special characters',
      test: { agentId: 'test-agent-001', action: 'chat.create', tool: 'chat', content: '!@#$%^&*()_+{}[]|\\:";\'<>?,./' }
    },
    {
      name: 'Unicode characters',
      test: { agentId: 'test-agent-001', action: 'chat.create', tool: 'chat', content: '你好世界 🌍 مرحبا' }
    },
    {
      name: 'Unknown tool',
      test: { agentId: 'test-agent-001', action: 'unknown.action', tool: 'unknown_tool', content: 'test' }
    }
  ];

  console.log('\nTesting edge cases:');
  edgeCases.forEach(({ name, test }) => {
    try {
      const result = engine.test(test);
      console.log(`  ✅ ${name}: ${result.allowed ? 'ALLOW' : 'BLOCK'}`);
    } catch (error: any) {
      console.log(`  ❌ ${name}: ERROR - ${error.message}`);
    }
  });

  console.log('\n---\n');

  // Example 7: Policy comparison
  console.log('7. Policy Comparison');
  console.log('--------------------');

  const strictPolicy = TealEngine.Templates.strictSecurity();
  const lenientPolicy = TealEngine.Templates.development();

  const strictEngine = new TealEngine(strictPolicy);
  const lenientEngine = new TealEngine(lenientPolicy);

  const comparisonTests = [
    { tool: 'chat', action: 'chat.create' },
    { tool: 'file_write', action: 'file.write' },
    { tool: 'code_execution', action: 'code.execute' },
    { tool: 'database_write', action: 'database.write' }
  ];

  console.log('\nComparing Strict vs Lenient policies:');
  console.log('Tool                 | Strict | Lenient');
  console.log('---------------------|--------|--------');

  comparisonTests.forEach(({ tool, action }) => {
    const strictResult = strictEngine.test({
      agentId: 'test',
      action,
      tool,
      content: 'test'
    });
    const lenientResult = lenientEngine.test({
      agentId: 'test',
      action,
      tool,
      content: 'test'
    });

    const strictStatus = strictResult.allowed ? '✅' : '❌';
    const lenientStatus = lenientResult.allowed ? '✅' : '❌';
    
    console.log(`${tool.padEnd(20)} | ${strictStatus}     | ${lenientStatus}`);
  });

  console.log('\n=== Policy Testing Complete ===');
}

// Run the example
main().catch(console.error);
