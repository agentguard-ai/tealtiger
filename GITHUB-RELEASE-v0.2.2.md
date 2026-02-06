# v0.2.2 - Complete GuardedAzureOpenAI Documentation

**Release Date**: January 31, 2026  
**npm Package**: https://www.npmjs.com/package/agentguard-sdk  
**Version**: 0.2.2

---

## 🎉 What's New

This release completes the documentation for our **GuardedAzureOpenAI** client wrapper and ensures all three drop-in client wrappers are fully documented and ready for production use.

### 📚 Documentation Improvements

- **Complete GuardedAzureOpenAI Documentation** - Added comprehensive documentation in README including:
  - Full usage examples with guardrails and cost tracking
  - Configuration options and Azure-specific features
  - Deployment name mapping explanation
  - Azure AD authentication support
  - Both standard and deployments API examples

- **Updated "What's New" Section** - Now highlights v0.2.2 features and all three client wrappers

- **Version Consistency** - All files now properly reference v0.2.2

### 🔌 Drop-in Client Wrappers (Fully Documented)

All three client wrappers are now production-ready with complete documentation:

1. **GuardedOpenAI** - Drop-in replacement for OpenAI client
2. **GuardedAnthropic** - Drop-in replacement for Anthropic client  
3. **GuardedAzureOpenAI** - Drop-in replacement for Azure OpenAI client

Each wrapper provides:
- ✅ 100% API compatibility with original clients
- 🛡️ Automatic guardrails on input and output
- 💰 Cost tracking and budget enforcement
- 📊 Security metadata in responses
- ⚙️ Configurable features

---

## 📦 Installation

```bash
npm install agentguard-sdk
```

---

## 🚀 Quick Start - GuardedAzureOpenAI

```typescript
import {
  GuardedAzureOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'agentguard-sdk';

// Set up guardrails
const guardrailEngine = new GuardrailEngine();
guardrailEngine.registerGuardrail(new PIIDetectionGuardrail());

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

// Create GuardedAzureOpenAI client
const client = new GuardedAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-15-preview',
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage
});

// Use exactly like Azure OpenAI client
const response = await client.chat.completions.create({
  deployment: 'gpt-4-deployment',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  max_tokens: 100
});

console.log('Response:', response.choices[0].message.content);
console.log('Cost:', response.security?.costRecord?.actualCost);
```

---

## ✨ Key Features

### Client-Side (Offline)
- 🔍 **PII Detection** - Protect sensitive data
- 🛡️ **Content Moderation** - Block harmful content
- 🚫 **Prompt Injection Prevention** - Prevent attacks
- 💰 **Cost Tracking** - Monitor AI model costs (30+ models)
- 💵 **Budget Management** - Enforce spending limits
- ⚡ **Fast** - Millisecond latency
- 🔒 **Private** - No data leaves your server

### Drop-in Client Wrappers
- 🔌 **GuardedOpenAI** - Secure OpenAI client
- 🔌 **GuardedAnthropic** - Secure Anthropic client
- 🔌 **GuardedAzureOpenAI** - Secure Azure OpenAI client
- ⚡ **100% Compatible** - No migration needed
- 🛡️ **Automatic Security** - Guardrails run on every request
- 💰 **Cost Visibility** - See costs in real-time

---

## 🧪 Test Coverage

**318 tests passing** ✅

- GuardedOpenAI: 16 tests
- GuardedAnthropic: 17 tests
- GuardedAzureOpenAI: 18 tests
- Cost Tracking: 81 tests
- Budget Management: 27 tests
- Guardrails: 78 tests
- Other Components: 81 tests

---

## 📋 What's Included

### Client Wrappers
- `GuardedOpenAI` - OpenAI client with security
- `GuardedAnthropic` - Anthropic client with security
- `GuardedAzureOpenAI` - Azure OpenAI client with security

### Cost Management
- `CostTracker` - Track costs across 30+ models
- `BudgetManager` - Enforce spending limits
- `InMemoryCostStorage` - In-memory cost storage
- Support for OpenAI, Anthropic, Google, Cohere models

### Guardrails
- `GuardrailEngine` - Execute multiple guardrails
- `PIIDetectionGuardrail` - Detect PII (emails, phones, SSNs, credit cards)
- `ContentModerationGuardrail` - Detect harmful content
- `PromptInjectionGuardrail` - Prevent jailbreak attempts

### Core SDK
- `AgentGuard` - Main SDK client for server-side security
- Policy management and validation
- Audit trail functionality

---

## 🎯 Use Cases

- **Enterprise AI** - Azure OpenAI integration with security
- **Customer Support Bots** - Protect customer PII
- **Healthcare AI** - HIPAA compliance
- **Financial Services** - Prevent data leakage
- **E-commerce** - Secure payment information
- **Education Platforms** - Content safety

---

## 🔗 Links

- **npm Package**: https://www.npmjs.com/package/agentguard-sdk
- **GitHub Repository**: https://github.com/agentguard-ai/agentguard-sdk
- **Documentation**: https://github.com/agentguard-ai/agentguard-sdk#readme
- **Python SDK**: https://pypi.org/project/agentguard-sdk/
- **Issues**: https://github.com/agentguard-ai/agentguard-sdk/issues

---

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/agentguard-ai/agentguard-sdk/blob/main/CHANGELOG.md) for complete details.

### Added
- Complete GuardedAzureOpenAI documentation in README
- Updated "What's New" section to highlight v0.2.2 features

### Fixed
- README now properly showcases all three client wrappers
- Version consistency across all files

---

## 🙏 Thank You

Thank you to everyone who has supported this project! If you find AgentGuard useful, please:

- ⭐ Star us on GitHub
- 📢 Share with your network
- 🐛 Report issues or suggest features
- 🤝 Contribute to the project

---

## 📄 License

MIT License - see [LICENSE](https://github.com/agentguard-ai/agentguard-sdk/blob/main/LICENSE)

---

**Made with ❤️ by the AgentGuard team**
