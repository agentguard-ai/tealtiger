# AgentGuard Python SDK

[![PyPI version](https://badge.fury.io/py/agentguard.svg)](https://pypi.org/project/agentguard/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)

**Secure your AI. Control your costs.**

Drop-in SDK that adds security guardrails and cost tracking to your AI applications. Works with OpenAI, Anthropic, and Azure OpenAI.

[Main Repository](https://github.com/agentguard-ai/agentguard) • [Documentation](https://github.com/agentguard-ai/agentguard#documentation) • [Examples](https://github.com/agentguard-ai/agentguard/tree/main/examples) • [TypeScript SDK](https://github.com/agentguard-ai/agentguard-typescript)

---

## 🚀 Quick Start

### Installation

```bash
pip install agentguard
```

### Basic Usage

```python
from agentguard import GuardedOpenAI
import os

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
    },
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 10.00,
    },
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
)
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

- **Pythonic API** - Idiomatic Python design
- **Async Support** - Full async/await support
- **Type Hints** - Complete type annotations
- **Error Handling** - Detailed error messages and recovery

---

## 📖 Usage Examples

### OpenAI with Guardrails

```python
from agentguard import GuardedOpenAI
import os

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
    },
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "My email is john@example.com"}
    ],
)

# PII automatically detected and redacted
print(response.choices[0].message.content)
```

### Anthropic (Claude) with Budget Limits

```python
from agentguard import GuardedAnthropic
import os

client = GuardedAnthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 10.00,
        "max_cost_per_month": 100.00,
    },
)

response = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ],
)
```

### Azure OpenAI

```python
from agentguard import GuardedAzureOpenAI
import os

client = GuardedAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    deployment="gpt-4",
    guardrails={
        "pii_detection": True,
        "content_moderation": True,
    },
    budget={
        "max_cost_per_day": 50.00,
    },
)

response = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### Cost Tracking

```python
from agentguard import CostTracker, InMemoryStorage

storage = InMemoryStorage()
tracker = CostTracker(storage)

# Track a request
await tracker.track_request({
    "agent_id": "my-agent",
    "model": "gpt-4",
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150,
})

# Get costs by agent
costs = await tracker.get_costs_by_agent("my-agent")
print(f"Total cost: ${costs.total_cost}")

# Get costs by model
model_costs = await tracker.get_costs_by_model("gpt-4")
print(f"GPT-4 costs: ${model_costs.total_cost}")
```

### Budget Management

```python
from agentguard import BudgetManager, InMemoryStorage

storage = InMemoryStorage()
budget_manager = BudgetManager(storage)

# Create a daily budget
await budget_manager.create_budget({
    "agent_id": "my-agent",
    "limit": 10.00,
    "period": "daily",
    "action": "block",  # or 'alert'
    "alert_thresholds": [0.5, 0.75, 0.9],  # Alert at 50%, 75%, 90%
})

# Check if request is within budget
can_proceed = await budget_manager.check_budget("my-agent", 0.25)
if not can_proceed:
    print("Budget exceeded!")
```

### Async Support

```python
from agentguard import GuardedOpenAI
import asyncio
import os

async def main():
    client = GuardedOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        guardrails={"pii_detection": True},
    )
    
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    
    print(response.choices[0].message.content)

asyncio.run(main())
```

### Streaming Support

```python
from agentguard import GuardedOpenAI
import os

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"pii_detection": True},
)

stream = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

---

## 🔧 Configuration

### Guardrails Configuration

```python
from agentguard import GuardedOpenAI

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        # PII Detection
        "pii_detection": True,
        "pii_types": ["email", "phone", "ssn", "credit_card"],
        "pii_action": "redact",  # 'redact', 'block', or 'alert'
        
        # Prompt Injection Prevention
        "prompt_injection": True,
        "prompt_injection_action": "block",
        
        # Content Moderation
        "content_moderation": True,
        "content_moderation_categories": ["hate", "violence", "sexual"],
        "content_moderation_action": "block",
        
        # Custom Rules
        "custom_rules": [
            {
                "name": "block-competitors",
                "pattern": r"competitor-name",
                "action": "block",
            },
        ],
    },
)
```

### Budget Configuration

```python
from agentguard import GuardedOpenAI

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    budget={
        # Per-request limits
        "max_cost_per_request": 0.50,
        
        # Time-based limits
        "max_cost_per_hour": 5.00,
        "max_cost_per_day": 10.00,
        "max_cost_per_week": 50.00,
        "max_cost_per_month": 100.00,
        
        # Alert thresholds (0-1)
        "alert_thresholds": [0.5, 0.75, 0.9],
        
        # Action when budget exceeded
        "on_budget_exceeded": "block",  # 'block' or 'alert'
        
        # Callback for alerts
        "on_alert": lambda alert: print(f"Budget alert: {alert['percentage']}% used"),
    },
)
```

### Storage Options

```python
# In-memory storage (default, for development)
from agentguard import InMemoryStorage
storage = InMemoryStorage()

# File-based storage (for production)
from agentguard import FileStorage
storage = FileStorage("./agentguard-data")

# Custom storage (implement your own)
from agentguard import StorageInterface

class CustomStorage(StorageInterface):
    # Implement required methods
    pass
```

---

## 📚 API Reference

### GuardedOpenAI

Drop-in replacement for OpenAI client with security and cost tracking.

```python
class GuardedOpenAI:
    def __init__(
        self,
        api_key: str,
        guardrails: Optional[Dict] = None,
        budget: Optional[Dict] = None,
        storage: Optional[StorageInterface] = None,
    ):
        ...
    
    @property
    def chat(self) -> ChatCompletions:
        ...
    
    @property
    def completions(self) -> Completions:
        ...
```

### GuardedAnthropic

Drop-in replacement for Anthropic client.

```python
class GuardedAnthropic:
    def __init__(
        self,
        api_key: str,
        guardrails: Optional[Dict] = None,
        budget: Optional[Dict] = None,
        storage: Optional[StorageInterface] = None,
    ):
        ...
    
    @property
    def messages(self) -> Messages:
        ...
```

### GuardedAzureOpenAI

Drop-in replacement for Azure OpenAI client.

```python
class GuardedAzureOpenAI:
    def __init__(
        self,
        api_key: str,
        endpoint: str,
        deployment: str,
        guardrails: Optional[Dict] = None,
        budget: Optional[Dict] = None,
        storage: Optional[StorageInterface] = None,
    ):
        ...
    
    @property
    def chat(self) -> ChatCompletions:
        ...
```

### CostTracker

Track AI costs across models and agents.

```python
class CostTracker:
    def __init__(self, storage: StorageInterface):
        ...
    
    async def track_request(self, request: Dict) -> None:
        ...
    
    async def get_costs_by_agent(self, agent_id: str) -> CostSummary:
        ...
    
    async def get_costs_by_model(self, model: str) -> CostSummary:
        ...
    
    async def get_costs_by_time_range(
        self, start: datetime, end: datetime
    ) -> CostSummary:
        ...
```

### BudgetManager

Manage and enforce spending budgets.

```python
class BudgetManager:
    def __init__(self, storage: StorageInterface):
        ...
    
    async def create_budget(self, budget: Dict) -> None:
        ...
    
    async def check_budget(self, agent_id: str, cost: float) -> bool:
        ...
    
    async def get_budget_status(self, agent_id: str) -> BudgetStatus:
        ...
    
    async def reset_budget(self, agent_id: str) -> None:
        ...
```

---

## 🧪 Testing

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=agentguard

# Run tests in watch mode
pytest-watch
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
git clone https://github.com/agentguard-ai/agentguard-python.git
cd agentguard-python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run linting
ruff check .
mypy agentguard
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
- **[TypeScript SDK](https://github.com/agentguard-ai/agentguard-typescript)** - TypeScript/JavaScript implementation

---

<div align="center">

**[⬆ back to top](#agentguard-python-sdk)**

Made with ❤️ for the AI community

</div>
