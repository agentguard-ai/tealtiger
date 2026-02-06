# AgentGuard SDK

[![npm version](https://badge.fury.io/js/agentguard-sdk.svg)](https://badge.fury.io/js/agentguard-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript/JavaScript SDK for the AI Agent Security Platform. Secure your AI agents with comprehensive security evaluation, policy enforcement, and audit trails.

## 🚀 Quick Start

### Installation

```bash
npm install agentguard-sdk
```

### Basic Usage

```typescript
import { AgentGuard } from 'agentguard-sdk';

// Initialize the SDK
const agentGuard = new AgentGuard({
  apiKey: 'your-api-key',
  ssaUrl: 'http://localhost:3001'
});

// Secure tool execution
const result = await agentGuard.executeTool(
  'web-search',
  { query: 'AI security best practices' },
  undefined,
  async (toolName, params) => {
    // Your tool execution logic here
    return await executeWebSearch(params.query);
  }
);

if (result.success) {
  console.log('Tool executed successfully:', result.data);
} else {
  console.log('Tool execution denied:', result.error?.message);
}
```

## 📋 Features

- **🔒 Security Evaluation**: Evaluate tool calls before execution
- **🛡️ Policy Enforcement**: Automatic policy-based decision making
- **🔄 Request Transformation**: Safe transformation of risky operations
- **📊 Audit Trail**: Complete audit logging for compliance
- **⚡ Performance**: < 100ms security evaluation overhead
- **🔧 TypeScript Support**: Full type safety and IntelliSense
- **🌐 Framework Agnostic**: Works with any JavaScript/Node.js agent

## 🏗️ Architecture

The AgentGuard SDK acts as a security middleware between your AI agent and its tool executions:

```
Your AI Agent → AgentGuard SDK → Security Sidecar Agent → Policy Decision → Tool Execution
```

## 📖 API Reference

### AgentGuard Class

#### Constructor

```typescript
new AgentGuard(config: AgentGuardConfig)
```

**Configuration Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | string | ✅ | - | API key for SSA authentication |
| `ssaUrl` | string | ✅ | - | Security Sidecar Agent URL |
| `agentId` | string | ❌ | auto-generated | Unique agent identifier |
| `timeout` | number | ❌ | 5000 | Request timeout in milliseconds |
| `retries` | number | ❌ | 3 | Number of retry attempts |
| `debug` | boolean | ❌ | false | Enable debug logging |

#### Methods

##### `executeTool<T>(toolName, parameters, context?, toolExecutor?): Promise<ToolExecutionResult<T>>`

Execute a tool with security evaluation.

```typescript
const result = await agentGuard.executeTool(
  'web-search',
  { query: 'AI security' },
  { sessionId: 'session-123' },
  async (toolName, params) => {
    return await myToolExecutor(toolName, params);
  }
);
```

##### `evaluateTool(toolName, parameters, context?): Promise<SecurityDecision>`

Evaluate tool security without execution.

```typescript
const decision = await agentGuard.evaluateTool('system-command', { cmd: 'ls' });
console.log(decision.action); // 'allow', 'deny', or 'transform'
```

##### `healthCheck(): Promise<HealthStatus>`

Check Security Sidecar Agent health.

```typescript
const health = await agentGuard.healthCheck();
console.log(health.status); // 'healthy'
```

##### `getAuditTrail(options?): Promise<AuditTrailResponse>`

Get audit trail for the current agent.

```typescript
const audit = await agentGuard.getAuditTrail({ limit: 10 });
console.log(audit.auditTrail.entries);
```

##### `getStatistics(): SDKStatistics`

Get SDK usage statistics.

```typescript
const stats = agentGuard.getStatistics();
console.log(`Success rate: ${stats.allowedRequests / stats.totalRequests * 100}%`);
```

## 🔒 Security Decisions

The SDK handles three types of security decisions:

### Allow ✅
Safe operations that can proceed normally.

```typescript
// Example: Web search
const result = await agentGuard.executeTool('web-search', { query: 'AI news' });
// result.securityDecision.action === 'allow'
```

### Deny ❌
Dangerous operations that are blocked.

```typescript
// Example: System command
const result = await agentGuard.executeTool('system-command', { cmd: 'rm -rf /' });
// result.success === false
// result.securityDecision.action === 'deny'
```

### Transform 🔄
Risky operations that are modified for safety.

```typescript
// Example: File write → File read
const result = await agentGuard.executeTool('file-write', { path: '/tmp/test.txt' });
// result.securityDecision.action === 'transform'
// result.securityDecision.transformedRequest.toolName === 'file-read'
```

## 🛠️ Examples

### JavaScript Example

```javascript
const { AgentGuard } = require('agentguard-sdk');

const agentGuard = new AgentGuard({
  apiKey: 'test-api-key-12345',
  ssaUrl: 'http://localhost:3001',
  debug: true
});

// Simple tool execution
agentGuard.executeTool('web-search', { query: 'AI security' })
  .then(result => {
    if (result.success) {
      console.log('Search completed:', result.data);
    } else {
      console.log('Search denied:', result.error.message);
    }
  })
  .catch(console.error);
```

### TypeScript Example

```typescript
import { AgentGuard, ToolExecutionResult } from 'agentguard-sdk';

interface SearchResult {
  query: string;
  results: Array<{ title: string; url: string }>;
}

const agentGuard = new AgentGuard({
  apiKey: process.env.AGENT_GUARD_API_KEY!,
  ssaUrl: process.env.SSA_URL!
});

const searchTool = async (query: string): Promise<SearchResult> => {
  const result: ToolExecutionResult<SearchResult> = await agentGuard.executeTool(
    'web-search',
    { query },
    undefined,
    async (toolName, params) => {
      // Your search implementation
      return {
        query: params.query,
        results: await performWebSearch(params.query)
      };
    }
  );

  if (!result.success) {
    throw new Error(`Search denied: ${result.error?.message}`);
  }

  return result.data!;
};
```

## 🔧 Error Handling

The SDK provides comprehensive error handling with specific error types:

```typescript
import { isAgentGuardError, AgentGuardErrorCode } from 'agentguard-sdk';

try {
  const result = await agentGuard.executeTool('my-tool', { param: 'value' });
} catch (error) {
  if (isAgentGuardError(error)) {
    switch (error.code) {
      case AgentGuardErrorCode.AUTHENTICATION_ERROR:
        console.error('Invalid API key');
        break;
      case AgentGuardErrorCode.NETWORK_ERROR:
        console.error('Cannot connect to SSA');
        break;
      case AgentGuardErrorCode.SECURITY_DENIED:
        console.error('Tool execution denied by security policy');
        break;
      default:
        console.error('AgentGuard error:', error.message);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

## 📊 Monitoring & Analytics

### Statistics

```typescript
const stats = agentGuard.getStatistics();
console.log({
  totalRequests: stats.totalRequests,
  successRate: (stats.allowedRequests + stats.transformedRequests) / stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  errorRate: stats.errorCount / stats.totalRequests
});
```

### Audit Trail

```typescript
const audit = await agentGuard.getAuditTrail({ limit: 50 });

// Analyze security decisions
const decisions = audit.auditTrail.entries.filter(e => e.type === 'security_decision');
const deniedRequests = decisions.filter(e => e.action === 'deny');

console.log(`Denied requests: ${deniedRequests.length}/${decisions.length}`);
```

## 🧪 Testing

The SDK includes comprehensive testing utilities:

```typescript
// Mock the SSA for testing
const mockAgentGuard = new AgentGuard({
  apiKey: 'test-key',
  ssaUrl: 'http://localhost:3001'
});

// Test security evaluation
const decision = await mockAgentGuard.evaluateTool('test-tool', { param: 'value' });
expect(decision.action).toBe('allow');
```

## 🔗 Integration Examples

### LangChain Integration

```typescript
import { AgentGuard } from 'agentguard-sdk';
import { Tool } from 'langchain/tools';

class SecureWebSearchTool extends Tool {
  name = 'web-search';
  description = 'Search the web securely';
  
  private agentGuard = new AgentGuard({
    apiKey: process.env.AGENT_GUARD_API_KEY!,
    ssaUrl: process.env.SSA_URL!
  });

  async _call(query: string): Promise<string> {
    const result = await this.agentGuard.executeTool(
      'web-search',
      { query },
      undefined,
      async (toolName, params) => {
        return await this.performSearch(params.query);
      }
    );

    if (!result.success) {
      throw new Error(`Search denied: ${result.error?.message}`);
    }

    return JSON.stringify(result.data);
  }

  private async performSearch(query: string): Promise<any> {
    // Your search implementation
  }
}
```

## 📚 Advanced Usage

See the [examples](./examples/) directory for more advanced usage patterns:

- [Basic Usage](./examples/basic-usage.js) - Simple JavaScript example
- [Advanced Usage](./examples/advanced-usage.ts) - TypeScript with all features
- [Framework Integration](./examples/framework-examples/) - Integration with popular frameworks

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/docs)
- 🐛 [Issue Tracker](https://github.com/nagasatish007/ai-agent-security-platform/issues)
- 💬 [Discussions](https://github.com/nagasatish007/ai-agent-security-platform/discussions)

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.