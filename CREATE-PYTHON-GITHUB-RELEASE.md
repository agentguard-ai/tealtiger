# Create GitHub Release for Python SDK v0.2.2

## 📋 Instructions

Since the GitHub CLI (`gh`) is not available, you'll need to create the release manually through the GitHub web interface.

## 🔗 Quick Link

**Go directly to create release page:**
https://github.com/nagasatish007/ai-agent-security-platform/releases/new?tag=python-v0.2.2

## 📝 Step-by-Step Instructions

### 1. Navigate to Releases
1. Go to: https://github.com/nagasatish007/ai-agent-security-platform
2. Click on "Releases" (on the right sidebar)
3. Click "Draft a new release" button

### 2. Select Tag
- **Choose a tag**: Select `python-v0.2.2` from the dropdown
  - (The tag already exists and was pushed earlier)

### 3. Release Title
```
Python SDK v0.2.2 - Feature Parity Achieved
```

### 4. Release Description

Copy and paste the content below:

---

# AgentGuard Python SDK v0.2.2

## 🎉 Feature Parity Achieved!

We're excited to announce **AgentGuard Python SDK v0.2.2**, achieving 100% feature parity with the TypeScript SDK!

## 🚀 What's New

### 💰 Cost Tracking & Budget Management

Track AI costs across multiple providers and enforce spending limits:

- **CostTracker** - Real-time cost calculation for 20+ AI models
- **BudgetManager** - Create and enforce budgets with alerts
- **InMemoryCostStorage** - Store and query cost records
- **Multi-Provider Support** - OpenAI, Anthropic, Azure OpenAI
- **Custom Pricing** - Override pricing for proprietary models

### 🔒 Guarded AI Clients

Drop-in replacements for AI provider clients with integrated security:

- **GuardedOpenAI** - Secure OpenAI client with guardrails + cost tracking
- **GuardedAnthropic** - Secure Anthropic client with guardrails + cost tracking
- **GuardedAzureOpenAI** - Secure Azure OpenAI with deployment mapping
- **Automatic Security** - Input/output guardrail execution
- **Budget Enforcement** - Pre-request budget checking
- **Security Metadata** - Full visibility into security decisions

## 📦 Installation

```bash
pip install agentguard-sdk==0.2.2
```

## 🔥 Quick Start

### Guarded OpenAI Client

```python
import asyncio
from agentguard import (
    GuardedOpenAI,
    GuardrailEngine,
    PIIDetectionGuardrail,
    CostTracker,
    BudgetManager,
    InMemoryCostStorage,
)

async def main():
    # Set up guardrails
    engine = GuardrailEngine()
    engine.register_guardrail(PIIDetectionGuardrail())
    
    # Set up cost tracking
    storage = InMemoryCostStorage()
    tracker = CostTracker()
    budget_manager = BudgetManager(storage)
    
    # Create daily budget
    budget_manager.create_budget({
        "name": "Daily Budget",
        "limit": 10.0,
        "period": "daily",
        "alert_thresholds": [50, 75, 90],
    })
    
    # Create guarded client
    client = GuardedOpenAI(
        api_key="your-openai-key",
        agent_id="my-agent",
        guardrail_engine=engine,
        cost_tracker=tracker,
        budget_manager=budget_manager,
        cost_storage=storage,
    )
    
    # Make secure, cost-tracked request
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    
    print(f"Response: {response.choices[0].message.content}")
    print(f"Cost: ${response.security.cost_record.actual_cost:.4f}")
    print(f"Guardrails passed: {response.security.guardrail_result.passed}")

asyncio.run(main())
```

### Cost Tracking

```python
from agentguard import CostTracker, BudgetManager, InMemoryCostStorage

# Initialize
storage = InMemoryCostStorage()
tracker = CostTracker()
budget_manager = BudgetManager(storage)

# Estimate cost before request
estimate = tracker.estimate_cost(
    model="gpt-4",
    usage={"input_tokens": 1000, "output_tokens": 500},
    provider="openai"
)
print(f"Estimated cost: ${estimate.estimated_cost:.4f}")

# Calculate actual cost after request
cost = tracker.calculate_actual_cost(
    request_id="req-123",
    agent_id="agent-456",
    model="gpt-4",
    usage={"input_tokens": 1050, "output_tokens": 480},
    provider="openai"
)

# Store and query costs
await storage.store(cost)
agent_costs = await storage.get_by_agent_id("agent-456")
summary = await storage.get_summary()
```

### Budget Management

```python
from agentguard import BudgetManager

budget_manager = BudgetManager(storage)

# Create budget
budget = budget_manager.create_budget({
    "name": "Daily GPT-4 Budget",
    "limit": 10.0,
    "period": "daily",  # hourly, daily, weekly, monthly, total
    "alert_thresholds": [50, 75, 90, 100],
    "action": "block",  # or "alert"
    "enabled": True,
})

# Check budget before request
check = await budget_manager.check_budget("agent-id", estimated_cost)
if not check.allowed:
    print(f"Budget exceeded: {check.blocked_by.name}")

# Get budget status
status = await budget_manager.get_budget_status(budget.id)
print(f"Spent: ${status.current_spending:.2f} / ${status.limit:.2f}")
print(f"Usage: {status.percentage_used:.1f}%")
```

## ✨ Key Features

### Cost Tracking
- 💰 **20+ Models** - GPT-4, Claude 3, GPT-3.5, and more
- 📊 **Accurate Pricing** - Real-time cost calculation
- 🎯 **Multi-Provider** - OpenAI, Anthropic, Azure OpenAI
- 🔧 **Custom Pricing** - Override for proprietary models
- 📈 **Cost Queries** - By agent, date range, request ID

### Budget Management
- 📊 **Multiple Periods** - Hourly, daily, weekly, monthly, total
- 🚨 **Alert System** - Configurable thresholds with severity
- 🛑 **Automatic Blocking** - Enforce spending limits
- 👥 **Agent-Scoped** - Separate budgets per agent
- 📈 **Status Tracking** - Real-time budget monitoring

### Guarded Clients
- 🔒 **GuardedOpenAI** - Secure OpenAI integration
- 🔒 **GuardedAnthropic** - Secure Anthropic integration
- 🔒 **GuardedAzureOpenAI** - Secure Azure OpenAI integration
- 🛡️ **Integrated Guardrails** - Automatic security checks
- 💰 **Cost Tracking** - Automatic cost calculation
- 📊 **Budget Enforcement** - Pre-request checking
- 📈 **Security Metadata** - Full visibility

## 📊 Test Coverage

- **186 tests passing** (4 xfailed - pre-existing timezone bugs)
- **84% code coverage**
- **71+ new tests** for cost tracking and guarded clients
- **Property-based tests** for correctness validation
- **Integration tests** for end-to-end workflows

## 🔄 Migration from v0.2.0

No breaking changes! All existing code continues to work. Simply upgrade:

```bash
pip install --upgrade agentguard-sdk
```

## 📚 Examples

Check out the new example scripts:

- `examples/cost_tracking_demo.py` - Cost estimation and tracking
- `examples/budget_management_demo.py` - Budget creation and enforcement
- `examples/guarded_openai_demo.py` - GuardedOpenAI usage
- `examples/guarded_anthropic_demo.py` - GuardedAnthropic usage
- `examples/guarded_azure_openai_demo.py` - GuardedAzureOpenAI usage

## 🔗 Links

- **PyPI**: https://pypi.org/project/agentguard-sdk/
- **Documentation**: https://github.com/nagasatish007/ai-agent-security-platform/tree/main/packages/agentguard-python#readme
- **TypeScript SDK**: https://www.npmjs.com/package/agentguard-sdk
- **Changelog**: https://github.com/nagasatish007/ai-agent-security-platform/blob/main/packages/agentguard-python/CHANGELOG.md

## 🎯 What's Next?

- Enhanced cost analytics and reporting
- Additional AI provider support
- Advanced budget policies
- Cost optimization recommendations
- Real-time cost dashboards

## 🙏 Thank You

Thank you to everyone who contributed to this release! We've achieved 100% feature parity between TypeScript and Python SDKs.

## 📄 Full Changelog

See [CHANGELOG.md](https://github.com/nagasatish007/ai-agent-security-platform/blob/main/packages/agentguard-python/CHANGELOG.md) for complete details.

---

**Made with ❤️ by the AgentGuard team**

---

### 5. Additional Settings

- **Set as the latest release**: ✅ Check this box
- **Set as a pre-release**: ⬜ Leave unchecked
- **Create a discussion for this release**: ⬜ Optional

### 6. Publish

Click the **"Publish release"** button

## ✅ Verification

After publishing, verify the release at:
https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/python-v0.2.2

## 📋 Summary

Once published, you'll have:
- ✅ Python SDK v0.2.2 published to PyPI
- ✅ Git tag `python-v0.2.2` pushed to GitHub
- ✅ GitHub release created with full documentation
- ✅ 100% feature parity with TypeScript SDK v0.2.2

---

**Note**: The release content is also available in `GITHUB-RELEASE-PYTHON-v0.2.2.md` if you need to reference it later.
