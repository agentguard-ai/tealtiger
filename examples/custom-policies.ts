/**
 * Custom Policy Definitions Example
 * 
 * This example demonstrates how to create custom policies for different
 * use cases and scenarios.
 */

import { TealOpenAI, TealEngine } from 'tealtiger';
import type { TealPolicy } from 'tealtiger';

async function main() {
  console.log('=== Custom Policy Definitions Example ===\n');

  // Example 1: Restrictive Security Policy
  console.log('1. Restrictive Security Policy');
  const restrictivePolicy: TealPolicy = {
    tools: {
      'chat': { allowed: true },
      'search': { allowed: true },
      'file_read': { allowed: false },
      'file_write': { allowed: false },
      'file_delete': { allowed: false },
      'code_execution': { allowed: false },
      'database_query': { allowed: false }
    },
    identity: {
      agentId: 'secure-agent',
      role: 'restricted',
      permissions: ['chat', 'search'],
      forbidden: ['file_access', 'code_execution', 'database'],
      costLimit: {
        daily: 5.00,
        hourly: 1.00
      }
    },
    codeExecution: {
      allowedLanguages: [],
      blockedFunctions: ['*'],
      blockedPatterns: [/.*/],
      maxLength: 0,
      timeout: 0,
      requireSandbox: true
    },
    behavioral: {
      costLimit: {
        daily: 5.00,
        hourly: 1.00
      },
      rateLimit: {
        requests: 50,
        window: '1h'
      },
      anomalyThreshold: 1.5
    }
  };

  const restrictiveEngine = new TealEngine(restrictivePolicy);
  console.log('✅ Restrictive policy created');
  console.log('Allowed tools:', Object.keys(restrictivePolicy.tools!).filter(
    t => restrictivePolicy.tools![t].allowed
  ));

  console.log('\n---\n');

  // Example 2: Data Analysis Policy
  console.log('2. Data Analysis Policy');
  const dataAnalysisPolicy: TealPolicy = {
    tools: {
      'chat': { allowed: true },
      'database_query': {
        allowed: true,
        allowedTables: ['users', 'orders', 'products'],
        maxRows: 10000,
        rateLimit: { max: 100, window: '1h' }
      },
      'file_read': {
        allowed: true,
        maxSize: '100MB'
      },
      'code_execution': { allowed: false },
      'file_write': { allowed: false },
      'file_delete': { allowed: false }
    },
    identity: {
      agentId: 'data-analyst',
      role: 'analyst',
      permissions: ['read', 'query', 'analyze'],
      forbidden: ['write', 'delete', 'execute'],
      costLimit: {
        daily: 50.00,
        hourly: 10.00
      }
    },
    behavioral: {
      costLimit: {
        daily: 50.00,
        hourly: 10.00
      },
      rateLimit: {
        requests: 500,
        window: '1h'
      },
      anomalyThreshold: 2.0
    }
  };

  const dataAnalysisEngine = new TealEngine(dataAnalysisPolicy);
  console.log('✅ Data analysis policy created');
  console.log('Allowed tables:', dataAnalysisPolicy.tools!['database_query'].allowedTables);

  console.log('\n---\n');

  // Example 3: Code Generation Policy (Safe)
  console.log('3. Safe Code Generation Policy');
  const codeGenPolicy: TealPolicy = {
    tools: {
      'chat': { allowed: true },
      'file_read': { allowed: true, maxSize: '10MB' },
      'file_write': { allowed: true, maxSize: '1MB' },
      'code_execution': { allowed: false }
    },
    identity: {
      agentId: 'code-generator',
      role: 'developer',
      permissions: ['read', 'write', 'generate'],
      forbidden: ['execute', 'delete'],
      costLimit: {
        daily: 100.00,
        hourly: 20.00
      }
    },
    codeExecution: {
      allowedLanguages: ['python', 'javascript', 'typescript'],
      blockedFunctions: [
        'eval',
        'exec',
        'execfile',
        '__import__',
        'compile',
        'open',
        'file'
      ],
      blockedPatterns: [
        /import\s+os/,
        /import\s+sys/,
        /import\s+subprocess/,
        /require\(['"]child_process['"]\)/
      ],
      maxLength: 10000,
      timeout: 5000,
      requireSandbox: true
    },
    behavioral: {
      costLimit: {
        daily: 100.00,
        hourly: 20.00
      },
      rateLimit: {
        requests: 200,
        window: '1h'
      },
      anomalyThreshold: 2.5
    }
  };

  const codeGenEngine = new TealEngine(codeGenPolicy);
  console.log('✅ Code generation policy created');
  console.log('Allowed languages:', codeGenPolicy.codeExecution!.allowedLanguages);
  console.log('Blocked functions:', codeGenPolicy.codeExecution!.blockedFunctions.slice(0, 3), '...');

  console.log('\n---\n');

  // Example 4: Development/Testing Policy (Permissive)
  console.log('4. Development/Testing Policy');
  const devPolicy: TealPolicy = {
    tools: {
      'chat': { allowed: true },
      'file_read': { allowed: true },
      'file_write': { allowed: true },
      'file_delete': { allowed: true },
      'code_execution': { allowed: true },
      'database_query': { allowed: true }
    },
    identity: {
      agentId: 'dev-agent',
      role: 'developer',
      permissions: ['*'],
      costLimit: {
        daily: 1000.00,
        hourly: 100.00
      }
    },
    codeExecution: {
      allowedLanguages: ['*'],
      blockedFunctions: [],
      blockedPatterns: [],
      maxLength: 100000,
      timeout: 30000,
      requireSandbox: false
    },
    behavioral: {
      costLimit: {
        daily: 1000.00,
        hourly: 100.00
      },
      rateLimit: {
        requests: 10000,
        window: '1h'
      },
      anomalyThreshold: 10.0
    }
  };

  const devEngine = new TealEngine(devPolicy);
  console.log('✅ Development policy created (PERMISSIVE - USE ONLY IN DEV)');
  console.log('⚠️  Warning: This policy allows all operations');

  console.log('\n---\n');

  // Example 5: Policy Composition
  console.log('5. Policy Composition (Combining Policies)');
  
  // Base policy
  const basePolicy: TealPolicy = {
    behavioral: {
      costLimit: {
        daily: 20.00,
        hourly: 5.00
      },
      rateLimit: {
        requests: 100,
        window: '1h'
      }
    }
  };

  // Feature-specific policy
  const featurePolicy: TealPolicy = {
    tools: {
      'chat': { allowed: true },
      'search': { allowed: true }
    },
    identity: {
      agentId: 'composed-agent',
      role: 'assistant',
      permissions: ['chat', 'search']
    }
  };

  // Combine policies
  const composedPolicy: TealPolicy = {
    ...basePolicy,
    ...featurePolicy,
    behavioral: {
      ...basePolicy.behavioral,
      ...featurePolicy.behavioral
    }
  };

  const composedEngine = new TealEngine(composedPolicy);
  console.log('✅ Composed policy created');
  console.log('Combined features:', {
    tools: Object.keys(composedPolicy.tools || {}),
    costLimit: composedPolicy.behavioral?.costLimit
  });

  console.log('\n---\n');

  // Example 6: Testing all policies
  console.log('6. Testing All Policies');
  
  const testContext = {
    agentId: 'test-agent',
    action: 'chat.create',
    tool: 'chat',
    content: 'Test message'
  };

  const policies = [
    { name: 'Restrictive', engine: restrictiveEngine },
    { name: 'Data Analysis', engine: dataAnalysisEngine },
    { name: 'Code Generation', engine: codeGenEngine },
    { name: 'Development', engine: devEngine },
    { name: 'Composed', engine: composedEngine }
  ];

  for (const { name, engine } of policies) {
    const result = engine.test(testContext);
    console.log(`${name}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
  }

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch(console.error);
