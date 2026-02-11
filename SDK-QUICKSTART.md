# AgentGuard SDK - Quick Start Guide

## For Agent Developers (No Database Required!)

The AgentGuard SDK is a **client library** that connects to a Security Sidecar Agent (SSA) server. You don't need to set up any database or infrastructure - just install the SDK and connect to your organization's SSA server.

## Installation

```bash
npm install agentguard-sdk
```

## Basic Usage

```javascript
import { AgentGuard } from 'agentguard-sdk';

// Initialize with your organization's SSA server
const agentGuard = new AgentGuard({
  apiKey: 'your-api-key',           // Provided by your security team
  ssaUrl: 'https://ssa.company.com', // Your organization's SSA server
  agentId: 'my-agent-v1'            // Your agent identifier
});

// Execute tools securely
const result = await agentGuard.executeTool('web-search', {
  query: 'latest AI security news'
});

if (result.success) {
  console.log('Search results:', result.data);
} else {
  console.log('Request denied:', result.securityDecision.reason);
}
```

## What You Need

### ✅ Required (Provided by Your Organization)
- **SSA Server URL** - Your company's security server endpoint
- **API Key** - Authentication credentials from your security team
- **Network Access** - Ability to reach the SSA server (usually internal)

### ❌ NOT Required (Handled by Platform Team)
- **PostgreSQL Database** - Managed by your platform team
- **Security Policies** - Configured by your security team  
- **Audit Logging** - Centralized on the SSA server
- **Infrastructure** - Deployed and managed by DevOps

## Architecture

```
Your Agent Application:
┌─────────────────────────┐
│  Your AI Agent Code     │
│  ┌─────────────────┐   │
│  │ AgentGuard SDK  │───┼──→ HTTPS Request
│  └─────────────────┘   │
└─────────────────────────┘
                          │
                          ▼
Company Infrastructure:   
┌─────────────────────────┐
│    SSA Server           │
│  ┌─────────────────┐   │
│  │ Policy Engine   │   │
│  │ Audit Logger    │   │
│  │ PostgreSQL DB   │   │
│  └─────────────────┘   │
└─────────────────────────┘
                          │
                          ▼
┌─────────────────────────┐
│   External APIs/Tools   │
│  (web-search, file-io)  │
└─────────────────────────┘
```

## Development Workflow

1. **Get Credentials** - Request API key and SSA URL from your security team
2. **Install SDK** - `npm install agentguard-sdk`
3. **Configure Agent** - Set up AgentGuard with your credentials
4. **Develop Securely** - All tool calls automatically go through security evaluation
5. **Deploy** - Your agent works with existing company security infrastructure

## Example: Secure File Operations

```javascript
import { AgentGuard } from 'agentguard-sdk';

const agentGuard = new AgentGuard({
  apiKey: process.env.AGENT_GUARD_API_KEY,
  ssaUrl: process.env.SSA_SERVER_URL,
  agentId: 'document-processor-v2'
});

async function processDocument(filePath) {
  try {
    // This request goes through security evaluation
    const readResult = await agentGuard.executeTool('file-read', {
      path: filePath
    });
    
    if (!readResult.success) {
      console.log('File access denied:', readResult.securityDecision.reason);
      return null;
    }
    
    // Process the file content
    const content = readResult.data;
    
    // Attempt to write results (might be transformed to read-only)
    const writeResult = await agentGuard.executeTool('file-write', {
      path: '/tmp/processed.txt',
      content: processContent(content)
    });
    
    if (writeResult.securityDecision.action === 'transform') {
      console.log('Write operation transformed:', writeResult.securityDecision.reason);
      // Handle read-only transformation
    }
    
    return writeResult;
    
  } catch (error) {
    console.error('Security evaluation failed:', error);
    return null;
  }
}
```

## Configuration Options

```javascript
const agentGuard = new AgentGuard({
  // Required
  apiKey: 'your-api-key',
  ssaUrl: 'https://ssa.company.com',
  
  // Optional
  agentId: 'my-agent',           // Agent identifier for audit trail
  timeout: 10000,                // Request timeout (default: 5000ms)
  retries: 3,                    // Retry attempts (default: 3)
  debug: true,                   // Enable debug logging
  headers: {                     // Custom headers
    'User-Agent': 'MyAgent/1.0'
  }
});
```

## Error Handling

```javascript
import { AgentGuardError, AgentGuardErrorCode } from 'agentguard-sdk';

try {
  const result = await agentGuard.executeTool('dangerous-operation', params);
} catch (error) {
  if (error instanceof AgentGuardError) {
    switch (error.code) {
      case AgentGuardErrorCode.SECURITY_DENIED:
        console.log('Operation blocked by security policy');
        break;
      case AgentGuardErrorCode.NETWORK_ERROR:
        console.log('Cannot reach SSA server');
        break;
      case AgentGuardErrorCode.AUTHENTICATION_ERROR:
        console.log('Invalid API key');
        break;
      default:
        console.log('Security evaluation failed:', error.message);
    }
  }
}
```

## Getting Help

### For Agent Developers
- **SDK Documentation** - Complete API reference and examples
- **Integration Support** - Help with SDK integration
- **Security Questions** - Understanding security decisions

### For Platform Teams  
- **SSA Server Setup** - Database and infrastructure setup
- **Policy Management** - Creating and managing security policies
- **Compliance** - Audit logging and regulatory requirements

## Next Steps

1. **Request Access** - Get API key and SSA URL from your security team
2. **Try Examples** - Start with the basic examples above
3. **Read Full Docs** - Check the complete SDK documentation
4. **Join Community** - Connect with other developers using AgentGuard

---

**Remember**: As an SDK user, you focus on building great AI agents. The security infrastructure is handled by your platform team!