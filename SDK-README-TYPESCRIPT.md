# AgentGuard TypeScript/JavaScript SDK

[![npm version](https://badge.fury.io/js/%40agentguard%2Fsdk.svg)](https://www.npmjs.com/package/@agentguard/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Secure your AI. Control your costs.**

Drop-in SDK that adds security guardrails and cost tracking to your AI applications. Works with OpenAI, Anthropic, and Azure OpenAI.

[Main Repository](https://github.com/agentguard-ai/agentguard) • [Documentation](https://github.com/agentguard-ai/agentguard#documentation) • [Examples](https://github.com/agentguard-ai/agentguard/tree/main/examples) • [Python SDK](https://github.com/agentguard-ai/agentguard-python)

---

## 🚀 Quick Start

### Installation

```bash
npm install @agentguard/sdk
```

### Basic Usage

```typescript
import { GuardedOpenAI } from '@agentguard/sdk';

const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: true,
    promptInjection: true,
    contentModeration: true,
  },
  budget: {
    maxCostPerRequest: 0.50,
    maxCostPerDay: 10.00,
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## ✨ Features

### 🛡️ Security Guardrails

- **PII Detection** - Automatically detect and redact sensitive information (emails, phone numbers, SSNs, credit cards)
- **Prompt Injection Prevention** - Block malicious prompt injection attempts
- **Content Moderation** - Filter toxic, harmful, or inappropriate content
- **Custom Rules** - Define your own security policies

### 💰 Cost Control

- **Real-time Tracking** - Monitor AI costs as they happen
- **Budget Limits** - Set per-request, daily, and monthly spending limits
- **Cost Alerts** - Get notified before hitting budget thresholds
- **Usage Analytics** - Detailed cost breakdowns by model, user, and endpoint

### 🔌 Drop-in Integration

- **OpenAI Compatible** - Works with existing OpenAI code
- **Anthropic Support** - Claude integration included
- **Azure OpenAI** - Enterprise-ready Azure support
- **Zero Config** - Works out of the box with sensible defaults

### 🎯 Developer Experience

- **TypeScript First** - Full type safety and IntelliSense
- **Async/Await** - Modern async patterns
- **Streaming** - Full streaming support
- **Error Handling** - Detailed error messages and recovery

---

## 📖 Usage Examples

### OpenAI with Guardrails

```typescript
import { GuardedOpenAI } from '@agentguard/sdk';

const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: true,
    promptInjection: true,
    contentModeration: true,
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'My email is john@example.com' }
  ],
});

// PII automatically detected and redacted
console.log(response.choices[0].message.content);
```

### Anthropic (Claude) with Budget Limits

```typescript
import { GuardedAnthropic } from '@agentguard/sdk';

const client = new GuardedAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  budget: {
    maxCostPerRequest: 0.50,
    maxCostPerDay: 10.00,
    maxCostPerMonth: 100.00,
  },
});

const response = await client.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
});
```

### Azure OpenAI

```typescript
import { GuardedAzureOpenAI } from '@agentguard/sdk';

const client = new GuardedAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: 'gpt-4',
  guardrails: {
    piiDetection: true,
    contentModeration: true,
  },
  budget: {
    maxCostPerDay: 50.00,
  },
});

const response = await client.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Cost Tracking

```typescript
import { CostTracker, InMemoryStorage } from '@agentguard/sdk';

const storage = new InMemoryStorage();
const tracker = new CostTracker(storage);

// Track a request
await tracker.trackRequest({
  agentId: 'my-agent',
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
});

// Get costs by agent
const costs = await tracker.getCostsByAgent('my-agent');
console.log(`Total cost: $${costs.totalCost}`);

// Get costs by model
const modelCosts = await tracker.getCostsByModel('gpt-4');
console.log(`GPT-4 costs: $${modelCosts.totalCost}`);
```

### Budget Management

```typescript
import { BudgetManager, InMemoryStorage } from '@agentguard/sdk';

const storage = new InMemoryStorage();
const budgetManager = new BudgetManager(storage);

// Create a daily budget
await budgetManager.createBudget({
  agentId: 'my-agent',
  limit: 10.00,
  period: 'daily',
  action: 'block', // or 'alert'
  alertThresholds: [0.5, 0.75, 0.9], // Alert at 50%, 75%, 90%
});

// Check if request is within budget
const canProceed = await budgetManager.checkBudget('my-agent', 0.25);
if (!canProceed) {
  console.log('Budget exceeded!');
}
```

### Streaming Support

```typescript
import { GuardedOpenAI } from '@agentguard/sdk';

const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: { piiDetection: true },
});

const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

## 🔧 Configuration

### Guardrails Configuration

```typescript
const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    // PII Detection
    piiDetection: true,
    piiTypes: ['email', 'phone', 'ssn', 'credit_card'],
    piiAction: 'redact', // 'redact', 'block', or 'alert'
    
    // Prompt Injection Prevention
    promptInjection: true,
    promptInjectionAction: 'block',
    
    // Content Moderation
    contentModeration: true,
    contentModerationCategories: ['hate', 'violence', 'sexual'],
    contentModerationAction: 'block',
    
    // Custom Rules
    customRules: [
      {
        name: 'block-competitors',
        pattern: /competitor-name/i,
        action: 'block',
      },
    ],
  },
});
```

### Budget Configuration

```typescript
const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  budget: {
    // Per-request limits
    maxCostPerRequest: 0.50,
    
    // Time-based limits
    maxCostPerHour: 5.00,
    maxCostPerDay: 10.00,
    maxCostPerWeek: 50.00,
    maxCostPerMonth: 100.00,
    
    // Alert thresholds (0-1)
    alertThresholds: [0.5, 0.75, 0.9],
    
    // Action when budget exceeded
    onBudgetExceeded: 'block', // 'block' or 'alert'
    
    // Callback for alerts
    onAlert: (alert) => {
      console.log(`Budget alert: ${alert.percentage}% used`);
    },
  },
});
```

### Storage Options

```typescript
// In-memory storage (default, for development)
import { InMemoryStorage } from '@agentguard/sdk';
const storage = new InMemoryStorage();

// File-based storage (for production)
import { FileStorage } from '@agentguard/sdk';
const storage = new FileStorage('./agentguard-data');

// Custom storage (implement your own)
import { StorageInterface } from '@agentguard/sdk';
class CustomStorage implements StorageInterface {
  // Implement required methods
}
```

---

## 📚 API Reference

### GuardedOpenAI

Drop-in replacement for OpenAI client with security and cost tracking.

```typescript
class GuardedOpenAI {
  constructor(options: GuardedOpenAIOptions);
  
  chat: {
    completions: {
      create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
    };
  };
  
  completions: {
    create(params: CompletionCreateParams): Promise<Completion>;
  };
}
```

### GuardedAnthropic

Drop-in replacement for Anthropic client.

```typescript
class GuardedAnthropic {
  constructor(options: GuardedAnthropicOptions);
  
  messages: {
    create(params: MessageCreateParams): Promise<Message>;
  };
}
```

### GuardedAzureOpenAI

Drop-in replacement for Azure OpenAI client.

```typescript
class GuardedAzureOpenAI {
  constructor(options: GuardedAzureOpenAIOptions);
  
  chat: {
    completions: {
      create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
    };
  };
}
```

### CostTracker

Track AI costs across models and agents.

```typescript
class CostTracker {
  constructor(storage: StorageInterface);
  
  trackRequest(request: CostRequest): Promise<void>;
  getCostsByAgent(agentId: string): Promise<CostSummary>;
  getCostsByModel(model: string): Promise<CostSummary>;
  getCostsByTimeRange(start: Date, end: Date): Promise<CostSummary>;
}
```

### BudgetManager

Manage and enforce spending budgets.

```typescript
class BudgetManager {
  constructor(storage: StorageInterface);
  
  createBudget(budget: Budget): Promise<void>;
  checkBudget(agentId: string, cost: number): Promise<boolean>;
  getBudgetStatus(agentId: string): Promise<BudgetStatus>;
  resetBudget(agentId: string): Promise<void>;
}
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

---

## 💡 Examples

Check out the [examples directory](https://github.com/agentguard-ai/agentguard/tree/main/examples) in the main repository for complete working examples:

- [Basic Usage](https://github.com/agentguard-ai/agentguard/blob/main/examples/simple-agent.js)
- [Guardrails Demo](https://github.com/agentguard-ai/agentguard/blob/main/examples/guardrails-demo.js)
- [Budget Management](https://github.com/agentguard-ai/agentguard/blob/main/examples/budget-management-demo.js)
- [Cost Tracking](https://github.com/agentguard-ai/agentguard/blob/main/examples/cost-tracking-demo.js)
- [GuardedOpenAI Demo](https://github.com/agentguard-ai/agentguard/blob/main/examples/guarded-openai-demo.js)
- [GuardedAnthropic Demo](https://github.com/agentguard-ai/agentguard/blob/main/examples/guarded-anthropic-demo.js)
- [GuardedAzureOpenAI Demo](https://github.com/agentguard-ai/agentguard/blob/main/examples/guarded-azure-demo.js)

---

## 🤝 Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/agentguard-ai/agentguard/blob/main/CONTRIBUTING.md) in the main repository.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/agentguard-ai/agentguard-typescript.git
cd agentguard-typescript

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

---

## 📄 License

MIT © AgentGuard

See [LICENSE](./LICENSE) for details.

---

## 🔒 Security

Security is our top priority. If you discover a security vulnerability, please see our [Security Policy](https://github.com/agentguard-ai/agentguard/blob/main/SECURITY.md).

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/agentguard-ai/agentguard/issues)
- **Documentation**: [Main Repository](https://github.com/agentguard-ai/agentguard)
- **Email**: support@agentguard.dev

---

## 🌟 Related Projects

- **[Main Repository](https://github.com/agentguard-ai/agentguard)** - Documentation, examples, and guides
- **[Python SDK](https://github.com/agentguard-ai/agentguard-python)** - Python implementation

---

<div align="center">

**[⬆ back to top](#agentguard-typescriptjavascript-sdk)**

Made with ❤️ for the AI community

</div>
