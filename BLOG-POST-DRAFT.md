# Introducing AgentGuard v0.2.2: Stop AI Costs from Spiraling Out of Control (While Keeping Your Data Safe)

**TL;DR**: AgentGuard v0.2.2 combines cost tracking, budget enforcement, and security guardrails in drop-in AI client replacements. Control spending AND protect sensitive data automatically. Available now for TypeScript and Python.

---

## The Problem: AI Costs Are Out of Control (And So Are Security Risks)

If you're building AI applications, you've probably experienced this:

### The Cost Problem 💸
- **Unexpected bills**: Your AI costs doubled overnight
- **No visibility**: You don't know which agents or features are expensive
- **No control**: Can't enforce spending limits
- **Budget anxiety**: Afraid to scale because costs might explode

### The Security Problem 🔒
- **Data leaks**: Users accidentally share PII (emails, SSNs, credit cards)
- **No guardrails**: Harmful content slips through
- **Prompt injection**: Agents get jailbroken or manipulated
- **Compliance risk**: Can't prove you're protecting sensitive data

Sound familiar? You're not alone. Most AI tools force you to choose between cost control OR security. AgentGuard gives you both.

## The Solution: Cost Control + Security in One SDK

AgentGuard v0.2.2 introduces three powerful features that work together:

### 1. 💰 Cost Tracking & Budget Enforcement

Track AI costs in real-time and enforce spending limits across OpenAI, Anthropic, and Azure OpenAI:

```typescript
import { CostTracker } from 'agentguard-sdk';

const tracker = new CostTracker();

// Estimate cost before making request
const estimate = tracker.estimateCost({
  model: 'gpt-4',
  usage: { inputTokens: 1000, outputTokens: 500 },
  provider: 'openai'
});

console.log(`Estimated cost: $${estimate.estimatedCost}`);
// Output: Estimated cost: $0.045
```

**Supports 20+ models** with accurate, up-to-date pricing.

### 2. 🛡️ Security Guardrails (The Game Changer)

Here's what makes AgentGuard different: **security is built-in, not bolted on**.

Protect sensitive data automatically with client-side guardrails:

```typescript
import { 
  GuardrailEngine, 
  PIIDetectionGuardrail,
  ContentModerationGuardrail,
  PromptInjectionGuardrail 
} from 'agentguard-sdk';

// Set up security guardrails
const engine = new GuardrailEngine();

// Detect and block PII (emails, SSNs, credit cards, phone numbers)
engine.registerGuardrail(new PIIDetectionGuardrail({
  action: 'block',  // or 'redact' or 'mask'
  patterns: ['email', 'ssn', 'credit_card', 'phone']
}));

// Block harmful content (hate speech, violence, harassment)
engine.registerGuardrail(new ContentModerationGuardrail({
  threshold: 0.7,
  categories: ['hate', 'violence', 'harassment']
}));

// Prevent prompt injection attacks
engine.registerGuardrail(new PromptInjectionGuardrail({
  action: 'block'
}));
```

**Why this matters:**
- ✅ **Automatic PII detection** - No more data leaks
- ✅ **Content moderation** - Block harmful outputs
- ✅ **Prompt injection prevention** - Stop jailbreak attempts
- ✅ **Client-side** - No server required, data never leaves your control
- ✅ **Configurable** - Block, redact, or mask sensitive data

### 3. 📊 Budget Management

Set spending limits and get alerts before you exceed them:

```typescript
import { BudgetManager, InMemoryCostStorage } from 'agentguard-sdk';

const storage = new InMemoryCostStorage();
const budgetManager = new BudgetManager(storage);

// Create daily budget
const budget = budgetManager.createBudget({
  name: 'Daily GPT-4 Budget',
  limit: 10.0,
  period: 'daily',
  alertThresholds: [50, 75, 90, 100],
  action: 'block' // Automatically block requests when limit exceeded
});

// Check budget before request
const check = await budgetManager.checkBudget('agent-id', estimatedCost);
if (!check.allowed) {
  console.log(`Budget exceeded: ${check.blockedBy.name}`);
  return; // Don't make the request
}
```

**Features:**
- Multiple budget periods (hourly, daily, weekly, monthly, total)
- Alert thresholds with severity levels
- Automatic blocking when limits exceeded
- Agent-scoped budgets for multi-agent systems

### 4. 🔒 Guarded AI Clients (Cost + Security Together)

Drop-in replacements for AI provider clients with **integrated security AND cost tracking**:

```typescript
import { 
  GuardedOpenAI, 
  GuardrailEngine, 
  PIIDetectionGuardrail,
  CostTracker,
  BudgetManager 
} from 'agentguard-sdk';

// Set up guardrails
const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail());

// Set up cost tracking
const tracker = new CostTracker();
const budgetManager = new BudgetManager(storage);

// Create guarded client
const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
  guardrailEngine: engine,
  costTracker: tracker,
  budgetManager: budgetManager,
  costStorage: storage
});

// Make secure, cost-tracked request
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Access security and cost metadata
console.log(`Cost: $${response.security.costRecord.actualCost}`);
console.log(`Guardrails passed: ${response.security.guardrailResult.passed}`);
console.log(`Budget allowed: ${response.security.budgetCheck.allowed}`);
```

**Available for:**
- OpenAI (GuardedOpenAI)
- Anthropic (GuardedAnthropic)
- Azure OpenAI (GuardedAzureOpenAI)

---

## Real-World Use Cases

### 1. Prevent Budget Overruns

**Problem**: Your AI agent made 10,000 GPT-4 calls overnight, costing $500.

**Solution**: Set a daily budget of $50. After that, requests are automatically blocked.

```typescript
budgetManager.createBudget({
  name: 'Daily Budget',
  limit: 50.0,
  period: 'daily',
  action: 'block'
});
```

### 2. Track Costs by Agent

**Problem**: You have 10 agents, but don't know which ones are expensive.

**Solution**: Track costs per agent and see breakdowns.

```typescript
// Query costs by agent
const agentCosts = await storage.getByAgentId('agent-123');
const summary = await storage.getSummary();

console.log(`Agent spent: $${summary.totalCost}`);
console.log(`Total requests: ${summary.totalRequests}`);
```

### 3. Protect Sensitive Data

**Problem**: Users might accidentally share PII (emails, phone numbers, SSNs).

**Solution**: Guardrails automatically detect and block PII.

```typescript
const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail({ action: 'block' }));

// PII is automatically detected and blocked
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'My email is john@example.com' }]
});
// Throws: GuardrailViolationError
```

---

## Python Support

Everything works in Python too! 100% feature parity:

```python
from agentguard import (
    GuardedOpenAI,
    GuardrailEngine,
    PIIDetectionGuardrail,
    CostTracker,
    BudgetManager,
    InMemoryCostStorage
)

# Same API, same features
client = GuardedOpenAI(
    api_key="your-key",
    agent_id="my-agent",
    guardrail_engine=engine,
    cost_tracker=tracker,
    budget_manager=budget_manager
)

response = await client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## What's Included

### Cost Tracking
- ✅ 20+ AI models with accurate pricing
- ✅ Real-time cost estimation
- ✅ Actual cost calculation
- ✅ Custom pricing support
- ✅ Cost queries by agent, date range, request ID

### Budget Management
- ✅ Multiple budget periods (hourly, daily, weekly, monthly, total)
- ✅ Alert thresholds (50%, 75%, 90%, 100%)
- ✅ Automatic enforcement (block or alert)
- ✅ Agent-scoped budgets
- ✅ Budget status tracking

### Guarded Clients
- ✅ GuardedOpenAI
- ✅ GuardedAnthropic
- ✅ GuardedAzureOpenAI
- ✅ Integrated guardrails (PII, content moderation, prompt injection)
- ✅ Automatic cost tracking
- ✅ Budget enforcement
- ✅ Security metadata in responses

### Client-Side Guardrails
- ✅ PII detection (emails, phones, SSNs, credit cards)
- ✅ Content moderation (hate, violence, harassment)
- ✅ Prompt injection prevention (jailbreaks, attacks)
- ✅ Configurable actions (block, redact, mask)
- ✅ Parallel execution
- ✅ No server required

---

## Installation

### TypeScript/JavaScript
```bash
npm install agentguard-sdk
```

### Python
```bash
pip install agentguard-sdk
```

---

## Getting Started

Check out the examples:

- [Cost Tracking Demo](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agent-guard-sdk/examples/cost-tracking-demo.ts)
- [Budget Management Demo](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agent-guard-sdk/examples/budget-management-demo.ts)
- [GuardedOpenAI Demo](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agent-guard-sdk/examples/guarded-openai-demo.ts)
- [GuardedAnthropic Demo](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agent-guard-sdk/examples/guarded-anthropic-demo.ts)
- [GuardedAzureOpenAI Demo](https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agent-guard-sdk/examples/guarded-azure-openai-demo.ts)

---

## Performance

- **Cost calculation**: < 1ms overhead
- **Budget checking**: < 5ms overhead
- **Guardrail execution**: < 50ms (parallel mode)
- **Total overhead**: < 10ms for typical requests

---

## What's Next

We're working on:
- Cost analytics and forecasting
- Cost optimization recommendations
- Additional AI provider support
- Advanced budget policies
- Real-time cost dashboards

---

## Try It Today

AgentGuard v0.2.2 is available now:

- **npm**: https://www.npmjs.com/package/agentguard-sdk
- **PyPI**: https://pypi.org/project/agentguard-sdk/
- **GitHub**: https://github.com/nagasatish007/ai-agent-security-platform
- **Documentation**: Full guides and API reference

---

## We'd Love Your Feedback

- ⭐ Star us on GitHub
- 💬 Open an issue or discussion
- 🐦 Follow us on Twitter
- 📧 Email us at agentguard@proton.me

---

**Made with ❤️ by the AgentGuard team**

*Stop worrying about AI costs. Start building with confidence.*
