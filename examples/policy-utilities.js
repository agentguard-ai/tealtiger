/**
 * Policy Utilities Examples
 * 
 * This example demonstrates how to use the TealTiger SDK policy utilities
 * for building, testing, validating, and simulating security policies
 */

const {
  PolicyBuilder,
  createPolicy,
  PolicyTemplates,
  PolicyTester,
  createPolicyTester,
  PolicyValidator,
  PolicySimulator,
  createPolicySimulator
} = require('tealtiger');

async function main() {
  console.log('🛡️  TealTiger SDK Policy Utilities Examples\n');

  // ========================================
  // 1. Building Policies with PolicyBuilder
  // ========================================
  console.log('1. Building Security Policies');
  console.log('==============================');

  // Create a custom policy using the fluent API
  const customPolicy = createPolicy()
    .name('restrict-file-operations')
    .description('Restrict file write operations for untrusted agents')
    .priority(10)
    .whenAgentId('untrusted-*')
    .whenToolName('*file-write*')
    .deny('File write operations not allowed for untrusted agents')
    .build();

  console.log('Custom Policy:', JSON.stringify(customPolicy, null, 2));

  // Create a transformation policy
  const transformPolicy = createPolicy()
    .name('sanitize-api-calls')
    .description('Remove sensitive parameters from API calls')
    .priority(5)
    .whenToolName('*api*')
    .whenParameterExists('password')
    .transformFilterParameters(['password', 'token', 'secret'], 'Sensitive data filtered')
    .build();

  console.log('\nTransformation Policy:', JSON.stringify(transformPolicy, null, 2));

  // Use policy templates for common patterns
  const templatePolicies = PolicyTemplates.getDefaultPolicies();
  console.log(`\nGenerated ${templatePolicies.length} template policies`);

  // ========================================
  // 2. Policy Validation
  // ========================================
  console.log('\n\n2. Policy Validation');
  console.log('====================');

  // Validate individual policies
  const validationResult = PolicyValidator.validatePolicy(customPolicy);
  console.log('Custom Policy Validation:', {
    isValid: validationResult.isValid,
    errors: validationResult.errors,
    warnings: validationResult.warnings,
    suggestions: validationResult.suggestions
  });

  // Analyze a set of policies
  const allPolicies = [customPolicy, transformPolicy, ...templatePolicies];
  const policySetAnalysis = PolicyValidator.analyzePolicySet(allPolicies);
  
  console.log('\nPolicy Set Analysis:');
  console.log('- Total Policies:', allPolicies.length);
  console.log('- Conflicts Found:', policySetAnalysis.conflicts.length);
  console.log('- Risk Levels Covered:', policySetAnalysis.coverage.riskLevels);
  console.log('- Performance Estimate:', policySetAnalysis.performance.estimatedEvaluationTime + 'ms');

  if (policySetAnalysis.conflicts.length > 0) {
    console.log('\nPolicy Conflicts:');
    policySetAnalysis.conflicts.forEach((conflict, i) => {
      console.log(`  ${i + 1}. ${conflict.type}: ${conflict.description}`);
      console.log(`     Policies: ${conflict.policies.join(', ')}`);
      console.log(`     Severity: ${conflict.severity}`);
    });
  }

  // ========================================
  // 3. Policy Testing
  // ========================================
  console.log('\n\n3. Policy Testing');
  console.log('=================');

  // Create a policy tester
  const tester = createPolicyTester(allPolicies);

  // Test individual requests
  const testRequests = [
    {
      agentId: 'trusted-agent',
      toolName: 'web-search',
      parameters: { query: 'test query' }
    },
    {
      agentId: 'untrusted-agent-1',
      toolName: 'file-write',
      parameters: { path: '/tmp/test.txt', content: 'data' }
    },
    {
      agentId: 'api-agent',
      toolName: 'external-api-call',
      parameters: { 
        url: 'https://api.example.com',
        password: 'secret123',
        data: 'normal data'
      }
    }
  ];

  console.log('Testing individual requests:');
  testRequests.forEach((request, i) => {
    const result = tester.testRequest(request);
    console.log(`\nRequest ${i + 1}:`);
    console.log('  Agent:', request.agentId);
    console.log('  Tool:', request.toolName);
    console.log('  Result:', result.action);
    console.log('  Risk Level:', result.riskLevel);
    console.log('  Reason:', result.reason);
    
    if (result.transformedRequest) {
      console.log('  Transformed Parameters:', result.transformedRequest.parameters);
    }
  });

  // Run a test suite
  const testSuite = tester.runTestSuite('Basic Security Tests', [
    {
      name: 'Allow safe operations',
      request: {
        agentId: 'trusted-agent',
        toolName: 'web-search',
        parameters: { query: 'weather' }
      },
      expected: { action: 'allow' }
    },
    {
      name: 'Deny critical operations',
      request: {
        agentId: 'any-agent',
        toolName: 'system-admin',
        parameters: { command: 'rm -rf /' }
      },
      expected: { action: 'deny' }
    },
    {
      name: 'Transform sensitive data',
      request: {
        agentId: 'api-agent',
        toolName: 'api-call',
        parameters: { password: 'secret' }
      },
      expected: { action: 'transform' }
    }
  ]);

  console.log('\n\nTest Suite Results:');
  console.log('Suite:', testSuite.name);
  console.log('Summary:', testSuite.summary);
  
  testSuite.tests.forEach((test, i) => {
    console.log(`\nTest ${i + 1}: ${test.name}`);
    console.log('  Expected:', test.expected);
    console.log('  Actual:', { 
      action: test.result.action, 
      riskLevel: test.result.riskLevel 
    });
    console.log('  Passed:', test.passed ? '✅' : '❌');
  });

  // ========================================
  // 4. Policy Simulation
  // ========================================
  console.log('\n\n4. Policy Simulation');
  console.log('====================');

  // Create a policy simulator
  const simulator = createPolicySimulator(allPolicies);

  // Run common scenarios
  const commonScenarios = PolicySimulator.generateCommonScenarios();
  console.log(`Running ${commonScenarios.length} common scenarios...`);

  const batchResult = await simulator.runBatchSimulation(commonScenarios.slice(0, 3)); // Run first 3 scenarios

  console.log('\nBatch Simulation Results:');
  console.log('- Total Scenarios:', batchResult.aggregate.totalScenarios);
  console.log('- Total Requests:', batchResult.aggregate.totalRequests);
  console.log('- Average Evaluation Time:', batchResult.aggregate.performance.averageEvaluationTime.toFixed(2) + 'ms');
  
  if (batchResult.aggregate.overallSuccessRate !== undefined) {
    console.log('- Overall Success Rate:', (batchResult.aggregate.overallSuccessRate * 100).toFixed(1) + '%');
  }

  console.log('\nMost Used Policy:', batchResult.aggregate.policyUsage.mostUsed);
  console.log('Policy Usage Distribution:');
  Object.entries(batchResult.aggregate.policyUsage.usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([policy, count]) => {
      console.log(`  ${policy}: ${count} times`);
    });

  // Show detailed results for first scenario
  const firstScenario = batchResult.scenarioResults[0];
  console.log(`\nDetailed Results for "${firstScenario.scenario.name}":`);
  console.log('- Total Requests:', firstScenario.summary.totalRequests);
  console.log('- Allowed:', firstScenario.summary.allowed);
  console.log('- Denied:', firstScenario.summary.denied);
  console.log('- Transformed:', firstScenario.summary.transformed);
  console.log('- Risk Distribution:', firstScenario.riskDistribution);

  // ========================================
  // 5. Performance Testing
  // ========================================
  console.log('\n\n5. Performance Testing');
  console.log('======================');

  // Run a small stress test
  const stressScenarios = PolicySimulator.generateStressTestScenarios(100);
  console.log('Running stress test with 100 requests...');

  const stressResult = await simulator.runScenario(stressScenarios[0]);
  
  console.log('\nStress Test Results:');
  console.log('- Total Requests:', stressResult.summary.totalRequests);
  console.log('- Total Evaluation Time:', stressResult.summary.totalEvaluationTime.toFixed(2) + 'ms');
  console.log('- Average per Request:', stressResult.summary.averageEvaluationTime.toFixed(2) + 'ms');
  console.log('- Throughput:', (1000 / stressResult.summary.averageEvaluationTime).toFixed(0) + ' requests/second');

  // ========================================
  // 6. Policy Development Workflow
  // ========================================
  console.log('\n\n6. Policy Development Workflow');
  console.log('==============================');

  console.log('Recommended workflow for policy development:');
  console.log('1. ✅ Build policies using PolicyBuilder or templates');
  console.log('2. ✅ Validate policies using PolicyValidator');
  console.log('3. ✅ Test policies using PolicyTester with specific scenarios');
  console.log('4. ✅ Simulate policies using PolicySimulator with realistic workloads');
  console.log('5. ✅ Analyze performance and coverage');
  console.log('6. 🔄 Iterate and refine based on results');

  console.log('\n🎉 Policy utilities examples completed successfully!');
}

// Handle errors gracefully
main().catch(error => {
  console.error('❌ Error running examples:', error);
  process.exit(1);
});