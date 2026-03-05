<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo/tealtiger-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo/tealtiger-logo-light.png">
    <img alt="TealTiger Logo" src=".github/logo/tealtiger-logo-light.png" width="200">
  </picture>
  
<<<<<<< HEAD
  # TealTiger
  
  **AI Security & Cost Control Platform**
  
  [![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
  [![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  
  **Secure your AI. Control your costs.**
</div>

Drop-in SDKs that add security guardrails and cost tracking to your AI applications. Works with OpenAI, Anthropic, and Azure OpenAI.

> 📖 **[Read the introduction blog post](https://dev.to/nagasatish_chilakamarti_2/introducing-tealtiger-ai-security-cost-control-made-simple-4lma)** to learn more about TealTiger!

---

## 🚀 Quick Start

### For Users (Install from Package Registries)

**TypeScript/JavaScript:**
=======
  # TealTiger SDK
  
  > The first open-source AI agent security SDK with **client-side guardrails** 🛡️
  
  [![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
  [![npm downloads](https://img.shields.io/npm/dm/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
  [![Tests](https://github.com/agentguard-ai/tealtiger-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/agentguard-ai/tealtiger-sdk/actions/workflows/test.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
</div>

> 📖 **[Read the introduction blog post](https://dev.to/nagasatish_chilakamarti_2/introducing-tealtiger-ai-security-cost-control-made-simple-4lma)** to learn more about TealTiger!

## ✨ What's New in v1.1.0

**Multi-Provider Support** - 95%+ market coverage with 7 LLM providers!

- 🔌 **TealOpenAI** - Drop-in replacement for OpenAI client
- 🔌 **TealAnthropic** - Drop-in replacement for Anthropic client
- 🔌 **TealGemini** - Google Gemini with multimodal support
- 🔌 **TealBedrock** - AWS Bedrock (Claude, Titan, Jurassic, Command, Llama)
- 🔌 **TealAzureOpenAI** - Azure OpenAI with deployment support
- 🔌 **TealMistral** - Mistral AI with European data residency
- 🔌 **TealCohere** - Cohere with RAG and embeddings
- 🌐 **TealMultiProvider** - Multi-provider orchestration with failover
- 💰 **Cost Tracking** - Monitor costs across 50+ models
- 💵 **Budget Management** - Enforce spending limits automatically
- 🛡️ **Automatic Security** - Guardrails run on every request
- ⚡ **100% Compatible** - No migration needed

## 🚀 Quick Start

### Installation

>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
```bash
npm install tealtiger
```

<<<<<<< HEAD
**Python:**
```bash
pip install tealtiger
```

### For Contributors (Clone & Develop)

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/agentguard-ai/tealtiger.git
cd tealtiger

# If you already cloned without --recurse-submodules, initialize them:
git submodule update --init --recursive

# TypeScript SDK
cd packages/tealtiger-sdk
npm install
npm test
npm run build

# Python SDK
cd packages/tealtiger-python
pip install -e .
pytest
```

---

## 📦 Repository Structure

```
tealtiger/
├── packages/
│   ├── tealtiger-sdk/          # TypeScript/JavaScript SDK
│   │   ├── src/                # Source code
│   │   ├── tests/              # Test files
│   │   └── package.json        # NPM package config
│   │
│   └── tealtiger-python/       # Python SDK
│       ├── src/tealtiger/      # Source code
│       ├── tests/              # Test files
│       └── pyproject.toml      # PyPI package config
│
├── examples/                   # Usage examples
└── README.md                   # This file
```

---

## 💻 Usage

### TypeScript/JavaScript

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  enableGuardrails: true,
  enableCostTracking: true,
});

const response = await client.chat.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Python

```python
from tealtiger.clients import TealOpenAI, TealOpenAIConfig

config = TealOpenAIConfig(
    api_key="your-api-key",
    enable_guardrails=True,
    enable_cost_tracking=True
)

client = TealOpenAI(config)

response = await client.chat.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## ✨ Features

### 🛡️ Security Guardrails
- **PII Detection** - Automatically detect and redact sensitive information
- **Prompt Injection Prevention** - Block malicious prompt injection attempts
- **Content Moderation** - Filter toxic, harmful, or inappropriate content

### 💰 Cost Control
- **Real-time Tracking** - Monitor AI costs as they happen
- **Budget Limits** - Set spending limits and get alerts
- **Usage Analytics** - Detailed cost breakdowns

### 🔌 Provider Support
- **OpenAI** - GPT-4, GPT-3.5, and all OpenAI models
- **Anthropic** - Claude 3 Opus, Sonnet, and Haiku
- **Azure OpenAI** - Enterprise-ready Azure integration

---

## 📚 Documentation

- **[Introduction Blog Post](https://dev.to/nagasatish_chilakamarti_2/introducing-tealtiger-ai-security-cost-control-made-simple-4lma)** - Learn about TealTiger
- **[TypeScript SDK](https://github.com/agentguard-ai/tealtiger-typescript)** - Full TypeScript documentation
- **[Python SDK](https://github.com/agentguard-ai/tealtiger-python)** - Full Python documentation
- **[Examples](./examples/)** - Working code examples

---

## 🧪 Testing

### TypeScript SDK
```bash
cd packages/tealtiger-sdk
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
```

### Python SDK
```bash
cd packages/tealtiger-python
pytest                      # Run all tests
pytest --cov=tealtiger      # Run with coverage
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/tealtiger.git
   cd tealtiger
   ```

3. **Install dependencies**
   ```bash
   # TypeScript
   cd packages/tealtiger-sdk && npm install
   
   # Python
   cd packages/tealtiger-python && pip install -e ".[dev]"
   ```

4. **Make your changes**
5. **Run tests**
6. **Submit a pull request**

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 📦 Publishing (Maintainers Only)

### TypeScript SDK
```bash
cd packages/tealtiger-sdk
npm version patch  # or minor, major
npm run build
npm test
npm publish
```

### Python SDK
```bash
cd packages/tealtiger-python
# Update version in pyproject.toml
python -m build
python -m twine upload dist/*
```

---

## 📄 License

MIT © TealTiger Team

See [LICENSE](./LICENSE) for details.

---

## 🔒 Security

Security is our top priority. If you discover a security vulnerability, please see our [Security Policy](./SECURITY.md).

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/agentguard-ai/tealtiger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/agentguard-ai/tealtiger/discussions)

---

## 🌟 Links

- **NPM Package**: [npmjs.com/package/tealtiger](https://www.npmjs.com/package/tealtiger)
- **PyPI Package**: [pypi.org/project/tealtiger](https://pypi.org/project/tealtiger/)
- **GitHub**: [github.com/agentguard-ai/tealtiger](https://github.com/agentguard-ai/tealtiger)

---

<div align="center">

Made with ❤️ for the AI community

</div>
=======
### Client-Side Guardrails (New!)

```typescript
import { GuardrailEngine, PIIDetectionGuardrail, PromptInjectionGuardrail } from 'tealtiger';

// Create guardrail engine
const engine = new GuardrailEngine();

// Register guardrails
engine.registerGuardrail(new PIIDetectionGuardrail());
engine.registerGuardrail(new PromptInjectionGuardrail());

// Evaluate user input
const result = await engine.execute("Contact me at john@example.com");

if (!result.passed) {
  console.log('Security check failed:', result.message);
  console.log('Risk score:', result.riskScore);
}
```

### Server-Side Security

```typescript
import { TealTiger } from 'tealtiger';

// Initialize the SDK
const guard = new TealTiger({
  apiKey: 'your-api-key',
  ssaUrl: 'https://ssa.TealTiger.io'
});

// Secure tool execution
const result = await guard.executeTool(
  'web-search',
  { query: 'AI agent security' },
  { sessionId: 'user-session-123' }
);
```

## 🌐 Supported Providers

TealTiger supports 7 major LLM providers with 95%+ market coverage:

| Provider | Client | Models | Features |
|----------|--------|--------|----------|
| **OpenAI** | `TealOpenAI` | GPT-4, GPT-3.5 Turbo | Chat, Completions, Embeddings |
| **Anthropic** | `TealAnthropic` | Claude 3, Claude 2 | Chat, Streaming |
| **Google** | `TealGemini` | Gemini Pro, Ultra | Multimodal, Safety Settings |
| **AWS** | `TealBedrock` | Claude, Titan, Jurassic, Command, Llama | Multi-model, Regional |
| **Azure** | `TealAzureOpenAI` | GPT-4, GPT-3.5 | Deployment-based, Azure AD |
| **Mistral** | `TealMistral` | Large, Medium, Small, Mixtral | EU Data Residency, GDPR |
| **Cohere** | `TealCohere` | Command, Embed | RAG, Citations, Connectors |

### Multi-Provider Orchestration

```typescript
import { TealMultiProvider, TealOpenAI, TealAnthropic } from 'tealtiger';

const multiProvider = new TealMultiProvider({
  strategy: 'priority',      // or 'round-robin', 'cost', 'use-case'
  enableFailover: true,
  maxFailoverAttempts: 3
});

// Register providers with priorities
multiProvider.registerProvider({
  type: 'openai',
  name: 'openai-primary',
  client: new TealOpenAI({ apiKey: 'key' }),
  priority: 1
});

multiProvider.registerProvider({
  type: 'anthropic',
  name: 'anthropic-backup',
  client: new TealAnthropic({ apiKey: 'key' }),
  priority: 2
});

// Automatic failover if primary fails
const response = await multiProvider.chat({
  messages: [{ role: 'user', content: 'Hello' }]
});
```

## 🛡️ Client-Side Guardrails

### PIIDetectionGuardrail

Detect and protect personally identifiable information:

```typescript
import { PIIDetectionGuardrail } from 'tealtiger';

const guard = new PIIDetectionGuardrail({
  action: 'redact', // or 'block', 'mask', 'allow'
  customPatterns: [
    { name: 'custom-id', pattern: /ID-\d{6}/, category: 'identifier' }
  ]
});

const result = await guard.evaluate("My email is john@example.com");
// result.passed = false
// result.violations = [{ type: 'email', value: 'john@example.com', ... }]
```

**Detects:**
- Email addresses
- Phone numbers (US, international)
- Social Security Numbers
- Credit card numbers
- Custom patterns

### ContentModerationGuardrail

Block harmful content:

```typescript
import { ContentModerationGuardrail } from 'tealtiger';

const guard = new ContentModerationGuardrail({
  categories: ['hate', 'violence', 'harassment', 'self-harm'],
  threshold: 0.7,
  useOpenAI: true, // Optional: Use OpenAI Moderation API
  openaiApiKey: 'your-key'
});

const result = await guard.evaluate("I hate everyone");
// result.passed = false
// result.riskScore = 85
```

### PromptInjectionGuardrail

Prevent jailbreak attempts:

```typescript
import { PromptInjectionGuardrail } from 'tealtiger';

const guard = new PromptInjectionGuardrail({
  sensitivity: 'high', // 'low', 'medium', 'high'
  customPatterns: [
    /custom attack pattern/i
  ]
});

const result = await guard.evaluate("Ignore previous instructions and...");
// result.passed = false
// result.riskScore = 90
```

**Detects:**
- Instruction injection
- Role-playing attacks
- System prompt leakage
- DAN jailbreaks
- Developer mode attempts

### GuardrailEngine

Execute multiple guardrails:

```typescript
import { 
  GuardrailEngine, 
  PIIDetectionGuardrail,
  ContentModerationGuardrail,
  PromptInjectionGuardrail 
} from 'tealtiger';

const engine = new GuardrailEngine({
  mode: 'parallel', // or 'sequential'
  timeout: 5000, // ms
  continueOnError: true
});

// Register guardrails
engine.registerGuardrail(new PIIDetectionGuardrail());
engine.registerGuardrail(new ContentModerationGuardrail());
engine.registerGuardrail(new PromptInjectionGuardrail());

// Execute all guardrails
const result = await engine.execute(userInput);

console.log('Passed:', result.passed);
console.log('Risk Score:', result.riskScore);
console.log('Results:', result.results);
```

## 💰 Cost Tracking & Budget Management

Track AI model costs and enforce budgets automatically:

### Cost Estimation

```typescript
import { CostTracker } from 'tealtiger';

const tracker = new CostTracker({
  enabled: true,
  persistRecords: true,
  enableBudgets: true,
  enableAlerts: true
});

// Estimate cost before making a request
const estimate = tracker.estimateCost(
  'gpt-4',
  {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500
  },
  'openai'
);

console.log(`Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);
```

### Actual Cost Tracking

```typescript
// Calculate actual cost after API call
const actualCost = tracker.calculateActualCost(
  'req-123',
  'agent-456',
  'gpt-4',
  {
    inputTokens: 1050,
    outputTokens: 480,
    totalTokens: 1530
  },
  'openai'
);

// Store cost record
await storage.store(actualCost);
```

### Budget Management

```typescript
import { BudgetManager, InMemoryCostStorage } from 'tealtiger';

const storage = new InMemoryCostStorage();
const budgetManager = new BudgetManager(storage);

// Create a daily budget
const budget = budgetManager.createBudget({
  name: 'Daily GPT-4 Budget',
  limit: 10.0,
  period: 'daily',
  alertThresholds: [50, 75, 90, 100],
  action: 'block', // or 'alert'
  enabled: true
});

// Check budget before making a request
const budgetCheck = await budgetManager.checkBudget('agent-123', estimatedCost);

if (!budgetCheck.allowed) {
  console.log('Request blocked - budget exceeded');
  console.log(`Blocked by: ${budgetCheck.blockedBy?.name}`);
}

// Get budget status
const status = await budgetManager.getBudgetStatus(budget.id);
console.log(`Current spending: $${status?.currentSpending.toFixed(2)}`);
console.log(`Remaining: $${status?.remaining.toFixed(2)}`);
console.log(`Percentage used: ${status?.percentageUsed.toFixed(1)}%`);
```

### Agent-Scoped Budgets

```typescript
// Create budget for specific agent
const agentBudget = budgetManager.createBudget({
  name: 'Agent 1 Budget',
  limit: 5.0,
  period: 'daily',
  alertThresholds: [80, 100],
  action: 'block',
  scope: {
    type: 'agent',
    id: 'agent-1'
  },
  enabled: true
});
```

### Supported Models

**30+ models across 4 providers:**
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, GPT-4 Vision
- **Anthropic**: Claude 3 Opus, Sonnet, Haiku
- **Google**: Gemini Pro, Gemini Pro Vision
- **Cohere**: Command, Command Light

## 🔌 Drop-in Client Wrappers

### TealOpenAI

Drop-in replacement for the OpenAI client with integrated security and cost tracking:

```typescript
import {
  TealOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  PromptInjectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'tealtiger';

// Set up guardrails
const guardrailEngine = new GuardrailEngine();
guardrailEngine.registerGuardrail(new PIIDetectionGuardrail());
guardrailEngine.registerGuardrail(new PromptInjectionGuardrail());

// Set up cost tracking
const storage = new InMemoryCostStorage();
const costTracker = new CostTracker({ enabled: true });
const budgetManager = new BudgetManager(storage);

budgetManager.createBudget({
  name: 'Daily Budget',
  limit: 10.0,
  period: 'daily',
  action: 'block',
  enabled: true
});

// Create TealOpenAI client (100% API compatible with OpenAI)
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage
});

// Use exactly like OpenAI client
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  max_tokens: 100
});

// Response includes security metadata
console.log('Response:', response.choices[0].message.content);
console.log('Guardrails passed:', response.security?.guardrailResult?.passed);
console.log('Cost:', `$${response.security?.costRecord?.actualCost.toFixed(4)}`);
console.log('Budget check:', response.security?.budgetCheck?.allowed);
```

**Features:**
- ✅ **100% API Compatible** - Drop-in replacement for OpenAI client
- 🛡️ **Automatic Guardrails** - Input and output validation
- 💰 **Cost Tracking** - Automatic cost calculation and storage
- 🚫 **Budget Enforcement** - Blocks requests when budget exceeded
- 📊 **Security Metadata** - Detailed security info in responses
- ⚙️ **Configurable** - Enable/disable features as needed

**Configuration Options:**

```typescript
const client = new TealOpenAI({
  apiKey: 'your-api-key',           // Required: OpenAI API key
  agentId: 'my-agent',               // Optional: Agent identifier
  enableGuardrails: true,            // Optional: Enable guardrails (default: true)
  enableCostTracking: true,          // Optional: Enable cost tracking (default: true)
  guardrailEngine,                   // Optional: Custom guardrail engine
  costTracker,                       // Optional: Custom cost tracker
  budgetManager,                     // Optional: Budget manager
  costStorage,                       // Optional: Cost storage
  baseURL: 'https://api.openai.com', // Optional: Custom base URL
  organization: 'org-id'             // Optional: Organization ID
});

// Update configuration at runtime
client.updateConfig({
  enableGuardrails: false,
  agentId: 'new-agent-id'
});
```

**Error Handling:**

```typescript
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  if (error.message.includes('Guardrail check failed')) {
    console.log('Request blocked by guardrails');
  } else if (error.message.includes('Budget exceeded')) {
    console.log('Budget limit reached');
  } else {
    console.log('Other error:', error.message);
  }
}
```

### TealAnthropic

Drop-in replacement for the Anthropic client with integrated security and cost tracking:

```typescript
import {
  TealAnthropic,
  GuardrailEngine,
  PIIDetectionGuardrail,
  PromptInjectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'tealtiger';

// Set up guardrails
const guardrailEngine = new GuardrailEngine();
guardrailEngine.registerGuardrail(new PIIDetectionGuardrail());
guardrailEngine.registerGuardrail(new PromptInjectionGuardrail());

// Set up cost tracking
const storage = new InMemoryCostStorage();
const costTracker = new CostTracker({ enabled: true });
const budgetManager = new BudgetManager(storage);

budgetManager.createBudget({
  name: 'Daily Budget',
  limit: 10.0,
  period: 'daily',
  action: 'block',
  enabled: true
});

// Create TealAnthropic client (100% API compatible with Anthropic)
const client = new TealAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage
});

// Use exactly like Anthropic client
const response = await client.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ]
});

// Response includes security metadata
console.log('Response:', response.content[0].text);
console.log('Guardrails passed:', response.security?.guardrailResult?.passed);
console.log('Cost:', `$${response.security?.costRecord?.actualCost.toFixed(4)}`);
console.log('Budget check:', response.security?.budgetCheck?.allowed);
```

**Features:**
- ✅ **100% API Compatible** - Drop-in replacement for Anthropic client
- 🛡️ **Automatic Guardrails** - Input and output validation
- 💰 **Cost Tracking** - Automatic cost calculation for Claude models
- 🚫 **Budget Enforcement** - Blocks requests when budget exceeded
- 📊 **Security Metadata** - Detailed security info in responses
- ⚙️ **Configurable** - Enable/disable features as needed

**Configuration Options:**

```typescript
const client = new TealAnthropic({
  apiKey: 'your-api-key',           // Required: Anthropic API key
  agentId: 'my-agent',               // Optional: Agent identifier
  enableGuardrails: true,            // Optional: Enable guardrails (default: true)
  enableCostTracking: true,          // Optional: Enable cost tracking (default: true)
  guardrailEngine,                   // Optional: Custom guardrail engine
  costTracker,                       // Optional: Custom cost tracker
  budgetManager,                     // Optional: Budget manager
  costStorage,                       // Optional: Cost storage
  baseURL: 'https://api.anthropic.com' // Optional: Custom base URL
});

// Update configuration at runtime
client.updateConfig({
  enableGuardrails: false,
  agentId: 'new-agent-id'
});
```

**Supported Models:**
- Claude 3 Opus (`claude-3-opus-20240229`)
- Claude 3 Sonnet (`claude-3-sonnet-20240229`)
- Claude 3 Haiku (`claude-3-haiku-20240307`)
- Claude 2.1 (`claude-2.1`)
- Claude 2.0 (`claude-2.0`)
- Claude Instant (`claude-instant-1.2`)

### TealAzureOpenAI

Drop-in replacement for the Azure OpenAI client with integrated security and cost tracking:

```typescript
import {
  TealAzureOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  PromptInjectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'tealtiger';

// Set up guardrails
const guardrailEngine = new GuardrailEngine();
guardrailEngine.registerGuardrail(new PIIDetectionGuardrail());
guardrailEngine.registerGuardrail(new PromptInjectionGuardrail());

// Set up cost tracking
const storage = new InMemoryCostStorage();
const costTracker = new CostTracker({ enabled: true });
const budgetManager = new BudgetManager(storage);

budgetManager.createBudget({
  name: 'Daily Budget',
  limit: 10.0,
  period: 'daily',
  action: 'block',
  enabled: true
});

// Create TealAzureOpenAI client (100% API compatible with Azure OpenAI)
const client = new TealAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT, // e.g., https://your-resource.openai.azure.com
  apiVersion: '2024-02-15-preview',
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage
});

// Use exactly like Azure OpenAI client
const response = await client.chat.completions.create({
  deployment: 'gpt-4-deployment', // Your Azure deployment name
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  max_tokens: 100
});

// Or use the deployments API (Azure-specific)
const response2 = await client.deployments.chat.completions.create({
  deployment: 'gpt-35-turbo-deployment',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  max_tokens: 50
});

// Response includes security metadata
console.log('Response:', response.choices[0].message.content);
console.log('Guardrails passed:', response.security?.guardrailResult?.passed);
console.log('Cost:', `${response.security?.costRecord?.actualCost.toFixed(4)}`);
console.log('Budget check:', response.security?.budgetCheck?.allowed);
```

**Features:**
- ✅ **100% API Compatible** - Drop-in replacement for Azure OpenAI client
- 🛡️ **Automatic Guardrails** - Input and output validation
- 💰 **Cost Tracking** - Automatic cost calculation with deployment mapping
- 🚫 **Budget Enforcement** - Blocks requests when budget exceeded
- 📊 **Security Metadata** - Detailed security info in responses
- ⚙️ **Configurable** - Enable/disable features as needed
- 🔑 **Azure AD Support** - Azure Active Directory authentication

**Configuration Options:**

```typescript
const client = new TealAzureOpenAI({
  apiKey: 'your-api-key',                    // Required: Azure OpenAI API key
  endpoint: 'https://your-resource.openai.azure.com', // Required: Azure endpoint
  apiVersion: '2024-02-15-preview',          // Optional: API version (default: 2024-02-15-preview)
  agentId: 'my-agent',                       // Optional: Agent identifier
  enableGuardrails: true,                    // Optional: Enable guardrails (default: true)
  enableCostTracking: true,                  // Optional: Enable cost tracking (default: true)
  guardrailEngine,                           // Optional: Custom guardrail engine
  costTracker,                               // Optional: Custom cost tracker
  budgetManager,                             // Optional: Budget manager
  costStorage,                               // Optional: Cost storage
  azureADToken: 'your-token'                 // Optional: Azure AD token for authentication
});

// Update configuration at runtime
client.updateConfig({
  enableGuardrails: false,
  agentId: 'new-agent-id'
});
```

**Deployment Name Mapping:**

Azure OpenAI uses deployment names instead of model names. TealAzureOpenAI automatically maps deployment names to model names for accurate cost tracking:

```typescript
// Deployment name → Model name mapping
'my-gpt-4-deployment'        → 'gpt-4'
'my-gpt-4-32k-deployment'    → 'gpt-4-32k'
'my-gpt-4-turbo-deployment'  → 'gpt-4-turbo'
'my-gpt-35-turbo-deployment' → 'gpt-3.5-turbo'
'my-gpt-35-turbo-16k-deployment' → 'gpt-3.5-turbo-16k'
```

The mapping is intelligent and works with common naming patterns. If your deployment name doesn't match, it defaults to `gpt-3.5-turbo` pricing.

**Azure-Specific Features:**

```typescript
// Both APIs are supported:
// 1. Standard chat API
await client.chat.completions.create({ deployment: 'my-deployment', ... });

// 2. Deployments API (Azure-specific)
await client.deployments.chat.completions.create({ deployment: 'my-deployment', ... });

// Azure AD authentication
const client = new TealAzureOpenAI({
  endpoint: 'https://your-resource.openai.azure.com',
  azureADToken: 'your-azure-ad-token',
  apiVersion: '2024-02-15-preview'
});
```

### Custom Pricing

```typescript
// Add custom pricing for your models
tracker.addCustomPricing('custom-model-v1', {
  model: 'custom-model-v1',
  provider: 'custom',
  inputCostPer1K: 0.01,
  outputCostPer1K: 0.02,
  lastUpdated: new Date().toISOString()
});
```

## 📋 Features

### Client-Side (Offline)
- 🔍 **PII Detection** - Protect sensitive data
- 🛡️ **Content Moderation** - Block harmful content
- 🚫 **Prompt Injection Prevention** - Prevent attacks
- 💰 **Cost Tracking** - Monitor AI model costs
- 💵 **Budget Management** - Enforce spending limits
- ⚡ **Fast** - Millisecond latency
- 🔒 **Private** - No data leaves your server

### Server-Side (Platform)
- 🔐 **Runtime Security Enforcement** - Mediate all agent tool/API calls
- 📜 **Policy-Based Access Control** - Define and enforce security policies
- 🔍 **Comprehensive Audit Trails** - Track every agent action
- ⚡ **High Performance** - <100ms latency for security decisions
- 🔄 **Request Transformation** - Automatically transform risky requests
- 📊 **Real-time Monitoring** - Track agent behavior and security events

## 🛡️ OWASP Top 10 for Agentic Applications Coverage

TealTiger v1.1.0 provides comprehensive coverage for **7 out of 10** OWASP Top 10 for Agentic Applications (ASI01-ASI10) vulnerabilities through its SDK-only architecture.

### Coverage Summary

| ASI | Vulnerability | Coverage | Components |
|-----|--------------|----------|------------|
| ASI01 | Goal Hijacking & Prompt Injection | 🟡 Partial | TealGuard, TealEngine |
| ASI02 | Tool Misuse & Unauthorized Actions | 🟢 Full | TealEngine |
| ASI03 | Identity & Access Control Failures | 🟢 Full | TealEngine |
| ASI04 | Supply Chain Vulnerabilities | 🔧 Support | TealAudit |
| ASI05 | Unsafe Code Execution | 🟢 Full | TealEngine |
| ASI06 | Memory & Context Corruption | 🟢 Full | TealEngine, TealGuard |
| ASI07 | Inter-Agent Communication Security | ❌ Platform | N/A |
| ASI08 | Cascading Failures & Resource Exhaustion | 🟢 Full | TealCircuit, TealMonitor |
| ASI09 | Harmful Content Generation | 🔧 Support | TealGuard |
| ASI10 | Rogue Agent Behavior | 🟢 Full | TealMonitor, TealAudit |

**Total Coverage: 7/10 ASIs (70%) with SDK alone**

### Legend
- 🟢 **Full Coverage**: Comprehensive protection via SDK
- 🟡 **Partial Coverage**: Basic protection, advanced features require ML/platform
- 🔧 **Support**: Logging/monitoring support, external tools recommended
- ❌ **Platform Required**: Requires centralized infrastructure

### Learn More
- [Complete OWASP ASI Mapping](../../OWASP-AGENTIC-TOP10-TEALTIGER-MAPPING.md)
- [OWASP Coverage Diagram](../../TEALTIGER-OWASP-COVERAGE-DIAGRAM.md)
- [OWASP Top 10 for Agentic Applications](https://owasp.org/www-project-top-10-for-agentic-applications/)

---

## 🎯 Use Cases

- **Customer Support Bots** - Protect customer PII
- **Healthcare AI** - HIPAA compliance
- **Financial Services** - Prevent data leakage
- **E-commerce** - Secure payment information
- **Enterprise AI** - Policy enforcement
- **Education Platforms** - Content safety

## 📚 Documentation

- [Getting Started Guide](https://github.com/agentguard-ai/tealtiger#readme)
- [API Reference](https://github.com/agentguard-ai/tealtiger/blob/main/docs/API.md)
- [Examples](https://github.com/agentguard-ai/tealtiger/tree/main/examples)
- [Changelog](https://github.com/agentguard-ai/tealtiger/blob/main/CHANGELOG.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/agentguard-ai/tealtiger/blob/main/CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](https://github.com/agentguard-ai/tealtiger/blob/main/LICENSE)

## 🔗 Links

- **npm**: https://www.npmjs.com/package/tealtiger
- **GitHub**: https://github.com/agentguard-ai/tealtiger
- **Python SDK**: https://pypi.org/project/tealtiger/
- **Issues**: https://github.com/agentguard-ai/tealtiger/issues

## 🌟 Star Us!

If you find TealTiger useful, please give us a star on GitHub! ⭐

---

**Made with ❤️ by the TealTiger team**


>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
