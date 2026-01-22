# Getting Started with AI Agent Security Platform

Welcome to the AI Agent Security Platform! This guide will help you integrate security controls into your AI agents in just a few minutes.

## 🚀 Quick Start (5 minutes)

### 1. Install the SDK

**JavaScript/TypeScript:**
```bash
npm install @ai-security/agent-sdk
```

**Python:**
```bash
pip install ai-agent-security-sdk
```

### 2. Basic Integration

**JavaScript/TypeScript:**
```typescript
import { SecureAgent } from '@ai-security/agent-sdk';

// Initialize with basic security policies
const agent = new SecureAgent({
  agentId: 'my-chatbot-v1',
  policies: {
    allowedTools: ['web-search', 'calculator'],
    riskLevel: 'medium',
    transformations: {
      'file-write': 'file-read' // Convert write to read-only
    }
  }
});

// Your agent tool calls are now automatically secured
const result = await agent.callTool('web-search', {
  query: 'latest AI security best practices'
});
```

**Python:**
```python
from ai_security_sdk import SecureAgent

# Initialize with basic security policies
agent = SecureAgent(
    agent_id='my-data-agent-v1',
    policies={
        'allowed_tools': ['database-query', 'api-call'],
        'risk_level': 'high',
        'transformations': {
            'database-write': 'database-read'
        }
    }
)

# Your agent tool calls are now automatically secured
result = await agent.call_tool('database-query', {
    'query': 'SELECT * FROM users WHERE active = true'
})
```

### 3. Start Local Development Environment

```bash
# Clone the repository (for local development)
git clone https://github.com/yourusername/ai-agent-security-platform.git
cd ai-agent-security-platform

# Start security services
docker-compose up -d

# Your agents can now connect to local security infrastructure
```

## 📋 Core Concepts

### Security Sidecar Agent (SSA)
Every tool/API call from your agent is intercepted and evaluated by the SSA before execution.

### Policy Engine
Deterministic rules that govern what your agents can and cannot do:

```json
{
  "version": "1.0",
  "rules": [
    {
      "name": "allow-read-operations",
      "condition": "tool.category == 'read'",
      "action": "allow"
    },
    {
      "name": "transform-write-to-read",
      "condition": "tool.category == 'write' && risk_level < 'high'",
      "action": "transform",
      "transformation": "read-only"
    },
    {
      "name": "deny-high-risk",
      "condition": "risk_level >= 'critical'",
      "action": "deny",
      "reason": "Operation exceeds risk threshold"
    }
  ]
}
```

### Risk Classification
AI-powered analysis of agent intents:
- **Low**: Safe operations (read data, calculations)
- **Medium**: Moderate risk (API calls, file operations)
- **High**: Sensitive operations (database writes, external integrations)
- **Critical**: Dangerous operations (system commands, credential access)

## 🛠️ Advanced Configuration

### Custom Policy Templates

```typescript
import { PolicyTemplate } from '@ai-security/agent-sdk';

const chatbotPolicy = new PolicyTemplate({
  name: 'secure-chatbot',
  allowedTools: [
    'web-search',
    'knowledge-base-query',
    'response-generation'
  ],
  deniedTools: [
    'file-system-access',
    'database-write',
    'external-api-call'
  ],
  transformations: {
    'user-data-access': 'anonymized-data-access'
  },
  riskThresholds: {
    maxRiskLevel: 'medium',
    requireApproval: ['high', 'critical']
  }
});

const agent = new SecureAgent({
  agentId: 'customer-support-bot',
  policyTemplate: chatbotPolicy
});
```

### Local Policy Testing

```bash
# Test your policies before deployment
npx @ai-security/policy-tester validate ./my-policies.json

# Simulate agent actions
npx @ai-security/policy-tester simulate \
  --policy ./my-policies.json \
  --action "web-search" \
  --parameters '{"query": "customer data"}'
```

## 🔍 Monitoring and Debugging

### Enable Debug Logging

```typescript
const agent = new SecureAgent({
  agentId: 'my-agent',
  debug: true, // Enable detailed logging
  policies: './security-policies.json'
});

// View security decisions in real-time
agent.on('security-decision', (decision) => {
  console.log('Security Decision:', {
    action: decision.action,
    reason: decision.reason,
    riskLevel: decision.riskLevel
  });
});
```

### Audit Trail Access

```typescript
// Access audit logs for compliance
const auditLogs = await agent.getAuditTrail({
  timeRange: '24h',
  includeDecisions: true,
  includeExecutions: true
});

console.log(`Found ${auditLogs.length} security events`);
```

## 🎯 Common Use Cases

### 1. Customer Support Chatbot
```typescript
const supportBot = new SecureAgent({
  agentId: 'support-bot-v2',
  policies: {
    allowedTools: ['knowledge-base', 'ticket-system', 'email'],
    dataAccess: 'customer-data-read-only',
    riskLevel: 'low'
  }
});
```

### 2. Data Analysis Agent
```python
data_agent = SecureAgent(
    agent_id='analytics-agent-v1',
    policies={
        'allowed_tools': ['database-query', 'visualization', 'statistics'],
        'data_access': 'anonymized-only',
        'risk_level': 'medium',
        'require_approval': ['data-export', 'external-sharing']
    }
)
```

### 3. Code Generation Assistant
```typescript
const codeAgent = new SecureAgent({
  agentId: 'code-assistant-v1',
  policies: {
    allowedTools: ['code-analysis', 'documentation', 'testing'],
    deniedTools: ['file-system-write', 'package-install', 'network-access'],
    transformations: {
      'code-execution': 'code-analysis-only'
    }
  }
});
```

## 🚨 Security Best Practices

### 1. Principle of Least Privilege
Only grant the minimum permissions your agent needs:

```typescript
// ❌ Too permissive
const agent = new SecureAgent({
  policies: { allowedTools: '*' } // Allows everything
});

// ✅ Specific permissions
const agent = new SecureAgent({
  policies: { 
    allowedTools: ['web-search', 'calculator'],
    maxRiskLevel: 'medium'
  }
});
```

### 2. Regular Policy Updates
```bash
# Update policies regularly
npm update @ai-security/agent-sdk

# Validate policy changes
npx @ai-security/policy-tester validate ./updated-policies.json
```

### 3. Monitor Security Events
```typescript
agent.on('security-violation', (event) => {
  // Alert security team
  console.error('Security violation detected:', event);
  // Log to SIEM system
  securityLogger.alert(event);
});
```

## 📚 Next Steps

1. **[Policy Configuration Guide](./policy-guide.md)** - Learn advanced policy configuration
2. **[Integration Examples](../examples/)** - See real-world integration examples
3. **[API Reference](./api-reference.md)** - Complete SDK documentation
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## 🤝 Need Help?

- **Discord**: [Join our community](https://discord.gg/ai-security)
- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/ai-agent-security-platform/issues)
- **Documentation**: [Full documentation site](https://ai-agent-security.dev)

---

**Ready to secure your AI agents?** Start with the quick start guide above, or explore our [example applications](../examples/) for inspiration!