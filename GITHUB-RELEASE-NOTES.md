# AgentGuard v0.2.0 - Client-Side Guardrails

We're excited to announce **AgentGuard v0.2.0**, featuring the industry's first **client-side guardrails** for offline AI agent security!

---

## 🛡️ What's New

### Client-Side Guardrails
Run security checks directly in your application without server calls:

- **PIIDetectionGuardrail**: Detect and redact PII (emails, phones, SSNs, credit cards)
- **ContentModerationGuardrail**: Block harmful content (hate, violence, harassment)
- **PromptInjectionGuardrail**: Prevent jailbreak and injection attempts

### GuardrailEngine
Execute multiple guardrails in parallel with timeout protection and error handling.

---

## 🚀 Quick Start

**TypeScript:**
```typescript
import { GuardrailEngine, PIIDetectionGuardrail } from 'agentguard-sdk';

const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail());

const result = await engine.execute("Contact me at john@example.com");
console.log(result.passed); // false - PII detected!
```

**Python:**
```python
from agentguard import GuardrailEngine, PIIDetectionGuardrail

engine = GuardrailEngine()
engine.register_guardrail(PIIDetectionGuardrail())

result = await engine.execute("Contact me at john@example.com")
print(result.passed)  # False - PII detected!
```

---

## 📦 Installation

```bash
# TypeScript/JavaScript
npm install agentguard-sdk

# Python
pip install agentguard-sdk
```

---

## 📊 Release Statistics

### TypeScript SDK
- **Tests**: 199 passing ✅
- **Package Size**: 62.4 kB (301.3 kB unpacked)
- **Files**: 72
- **npm**: https://www.npmjs.com/package/agentguard-sdk

### Python SDK
- **Tests**: 57 passing ✅
- **Coverage**: 66%
- **Package Size**: 32.6 kB wheel + 47.6 kB source
- **PyPI**: https://pypi.org/project/agentguard-sdk/0.2.0/

---

## 🎯 Key Features

### PIIDetectionGuardrail
- Detects emails, phone numbers, SSNs, credit cards
- Actions: block, redact, mask, allow
- Risk scoring (0-100)
- Configurable patterns

### ContentModerationGuardrail
- Detects hate speech, violence, harassment, self-harm
- OpenAI Moderation API integration
- Pattern-based fallback
- Configurable thresholds

### PromptInjectionGuardrail
- Detects instruction injection attacks
- Role-playing and jailbreak detection
- System prompt leakage prevention
- Configurable sensitivity levels

### GuardrailEngine
- Parallel or sequential execution
- Timeout protection (configurable)
- Error handling with continue-on-error
- Result aggregation and risk scoring
- Register/unregister guardrails dynamically

---

## 📚 Documentation

- [Getting Started Guide](https://github.com/agentguard-ai/agentguard-sdk#readme)
- [API Reference](https://github.com/agentguard-ai/agentguard-sdk/blob/main/docs/API.md)
- [Examples](https://github.com/agentguard-ai/agentguard-sdk/tree/main/examples)
- [TypeScript Changelog](https://github.com/agentguard-ai/agentguard-sdk/blob/main/CHANGELOG.md)
- [Python Changelog](https://github.com/agentguard-ai/agentguard-python/blob/main/CHANGELOG.md)

---

## 🔧 Breaking Changes

None - this is a feature release with full backward compatibility.

---

## 🐛 Bug Fixes

- Improved error handling in policy evaluation
- Fixed timeout handling in async operations
- Enhanced validation for tool parameters

---

## 🙏 Thank You

Special thanks to our early adopters and contributors who helped shape this release!

---

## 🔗 Links

- **npm Package**: https://www.npmjs.com/package/agentguard-sdk
- **PyPI Package**: https://pypi.org/project/agentguard-sdk/
- **TypeScript SDK**: https://github.com/agentguard-ai/agentguard-sdk
- **Python SDK**: https://github.com/agentguard-ai/agentguard-python
- **Documentation**: https://github.com/agentguard-ai/agentguard-sdk#readme

---

**Full Changelog**: https://github.com/agentguard-ai/agentguard-sdk/blob/main/CHANGELOG.md

**Let's make AI agents safer! 🚀**
