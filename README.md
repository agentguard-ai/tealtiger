<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo/tealtiger-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo/tealtiger-logo-light.png">
    <img alt="TealTiger Logo" src=".github/logo/tealtiger-logo-light.png" width="300">
  </picture>
  
  # TealTiger
  
  **Developer-First AI Security & Cost Governance SDK**
  
  [![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
  [![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![Documentation](https://img.shields.io/badge/docs-docs.tealtiger.ai-teal)](https://docs.tealtiger.ai)
  
  **Secure your AI. Control your costs. Zero infrastructure.**
</div>

Drop-in SDKs that add security guardrails, policy enforcement, and cost tracking to your AI applications. Works with OpenAI, Anthropic, and more.

> 📖 **[Read the introduction blog post](https://dev.to/nagasatish_chilakamarti_2/introducing-tealtiger-ai-security-cost-control-made-simple-4lma)** to learn more about TealTiger!

---

## ✨ What is TealTiger?

TealTiger is an **SDK-only AI security and governance platform** that provides:

- 🛡️ **Policy Enforcement** - ENFORCE / MONITOR / REPORT_ONLY modes for safe rollouts
- 🔒 **Security Guardrails** - PII detection, prompt injection prevention, content moderation
- 💰 **Cost Tracking** - Monitor and control AI spending across providers
- 📊 **Audit Logging** - Redaction-by-default audit trails with correlation IDs
- 🎯 **Deterministic Decisions** - Stable, typed Decision contract with reason codes
- ⚡ **Zero Infrastructure** - No servers, no deployment complexity

---

## 🚀 Quick Start

### Installation

**TypeScript/JavaScript:**
```bash
npm install tealtiger
```

**Python:**
```bash
pip install tealtiger
```

### Basic Usage

**TypeScript:**
```typescript
import { TealEngine, PolicyMode } from 'tealtiger';

const engine = new TealEngine({
  policies: {
    tools: {
      web_search: { allowed: true },
      file_delete: { allowed: false }
    }
  },
  mode: PolicyMode.ENFORCE
});

const decision = engine.evaluate({
  action: 'tool.execute',
  tool_name: 'web_search',
  context: { user_id: 'user-123' }
});

console.log(decision.action); // 'allow' or 'deny'
console.log(decision.reason_code); // e.g., 'policy.tool.allowed'
```

**Python:**
```python
from tealtiger import TealEngine, PolicyMode

engine = TealEngine(
    policies={
        "tools": {
            "web_search": {"allowed": True},
            "file_delete": {"allowed": False}
        }
    },
    mode=PolicyMode.ENFORCE
)

decision = engine.evaluate({
    "action": "tool.execute",
    "tool_name": "web_search",
    "context": {"user_id": "user-123"}
})

print(decision.action)  # 'allow' or 'deny'
print(decision.reason_code)  # e.g., 'policy.tool.allowed'
```

---

## 📦 SDK Repositories

TealTiger provides separate repositories for each SDK with full documentation:

<div align="center">

| SDK | Repository | Package | Documentation |
|-----|------------|---------|---------------|
| **TypeScript** | [tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod) | [npm](https://www.npmjs.com/package/tealtiger) | [Docs](https://docs.tealtiger.ai/api-reference/typescript/index) |
| **Python** | [tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod) | [PyPI](https://pypi.org/project/tealtiger/) | [Docs](https://docs.tealtiger.ai/api-reference/python/index) |

</div>

---

## 🌟 Key Features

### Policy Rollout Modes
Deploy policies safely with three modes:
- **ENFORCE**: Block violating actions in production
- **MONITOR**: Log violations without blocking (shadow mode)
- **REPORT_ONLY**: Collect data for policy tuning

### Core Components (v1.1.0)

- **TealEngine** - Policy evaluation engine with deterministic decisions
- **TealGuard** - Security guardrails (PII, prompt injection, content moderation)
- **TealCircuit** - Circuit breaker for cascading failure prevention
- **TealAudit** - Audit logging with redaction-by-default
- **TealMonitor** - Performance and cost monitoring

### Enterprise Features (v1.1.x)

- **Decision Contract** - Stable, typed Decision object with action, reason codes, risk scores
- **Execution Context** - Correlation IDs and traceability across components
- **Audit Redaction** - Security-by-default with configurable redaction levels
- **Policy Testing** - CLI and library test runner for CI/CD integration

### Provider Support

**Current (v1.1.0):**
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude)

**Coming in v1.1.x:**
- 🔜 Google Gemini
- 🔜 AWS Bedrock
- 🔜 Azure OpenAI
- 🔜 Cohere
- 🔜 Mistral AI

---

## 📚 Documentation

- **[Official Documentation](https://docs.tealtiger.ai)** - Complete guides and API reference
- **[Quickstart Guide](https://docs.tealtiger.ai/quickstart)** - Get started in 5 minutes
- **[Core Concepts](https://docs.tealtiger.ai/concepts/decision-lifecycle)** - Understand the decision model
- **[API Reference - TypeScript](https://docs.tealtiger.ai/api-reference/typescript/index)** - TypeScript API docs
- **[API Reference - Python](https://docs.tealtiger.ai/api-reference/python/index)** - Python API docs
- **[Migration Guide](https://docs.tealtiger.ai/guides/migration-v1.1.x)** - Upgrade to v1.1.x
- **[FAQ](https://docs.tealtiger.ai/guides/faq)** - Frequently asked questions

---

## 🛡️ OWASP Coverage

TealTiger v1.1.0 provides comprehensive coverage for **7 out of 10** OWASP Top 10 for Agentic Applications (ASI01-ASI10) vulnerabilities through its SDK-only architecture.

| ASI | Vulnerability | Coverage |
|-----|--------------|----------|
| ASI01 | Goal Hijacking & Prompt Injection | 🟡 Partial |
| ASI02 | Tool Misuse & Unauthorized Actions | 🟢 Full |
| ASI03 | Identity & Access Control Failures | 🟢 Full |
| ASI04 | Supply Chain Vulnerabilities | 🔧 Support |
| ASI05 | Unsafe Code Execution | 🟢 Full |
| ASI06 | Memory & Context Corruption | 🟢 Full |
| ASI07 | Inter-Agent Communication Security | ❌ Platform |
| ASI08 | Cascading Failures & Resource Exhaustion | 🟢 Full |
| ASI09 | Harmful Content Generation | 🔧 Support |
| ASI10 | Rogue Agent Behavior | 🟢 Full |

**Total Coverage: 7/10 ASIs (70%) with SDK alone**

Learn more: [OWASP ASI Mapping](./OWASP-AGENTIC-TOP10-TEALTIGER-MAPPING.md)

---

## 🎯 Use Cases

- **Enterprise AI Applications** - Policy enforcement and compliance
- **Customer Support Bots** - Protect customer PII and sensitive data
- **Healthcare AI** - HIPAA compliance and audit trails
- **Financial Services** - Prevent data leakage and unauthorized actions
- **E-commerce Agents** - Secure payment information and transactions
- **Education Platforms** - Content safety and moderation

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

**TypeScript SDK:**
```bash
git clone https://github.com/agentguard-ai/tealtiger-typescript-prod.git
cd tealtiger-typescript-prod
npm install
npm test
```

**Python SDK:**
```bash
git clone https://github.com/agentguard-ai/tealtiger-python-prod.git
cd tealtiger-python-prod
pip install -e ".[dev]"
pytest
```

---

## 📄 License

Apache 2.0 © TealTiger Team

TealTiger SDKs are open source and will always remain free. The future SaaS platform will be a commercial offering.

See [LICENSE](./LICENSE) for details.

---

## 🔒 Security

Security is our top priority. If you discover a security vulnerability, please see our [Security Policy](./SECURITY.md).

---

## 📞 Support & Community

- **Documentation**: [docs.tealtiger.ai](https://docs.tealtiger.ai)
- **GitHub Issues**: [Report bugs and request features](https://github.com/agentguard-ai/tealtiger/issues)
- **Email**: [reachout@tealtiger.ai](mailto:reachout@tealtiger.ai)
- **Blog**: [blogs.tealtiger.ai](https://blogs.tealtiger.ai)

---

## 🌟 Links

- **Website**: [tealtiger.ai](https://tealtiger.ai)
- **Documentation**: [docs.tealtiger.ai](https://docs.tealtiger.ai)
- **Playground**: [playground.tealtiger.ai](https://playground.tealtiger.ai)
- **NPM Package**: [npmjs.com/package/tealtiger](https://www.npmjs.com/package/tealtiger)
- **PyPI Package**: [pypi.org/project/tealtiger](https://pypi.org/project/tealtiger/)
- **TypeScript SDK**: [github.com/agentguard-ai/tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod)
- **Python SDK**: [github.com/agentguard-ai/tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod)

---

<div align="center">

**Made with ❤️ for the AI community**

[⭐ Star us on GitHub](https://github.com/agentguard-ai/tealtiger) | [📖 Read the Docs](https://docs.tealtiger.ai) | [🐦 Follow us on Twitter](https://twitter.com/tealtiger)

</div>
