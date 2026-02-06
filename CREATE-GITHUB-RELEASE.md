# Create GitHub Release - Quick Guide

## Step-by-Step Instructions

### 1. Go to GitHub Releases Page
Open this URL in your browser:
```
https://github.com/nagasatish007/ai-agent-security-platform/releases/new
```

### 2. Fill in Release Details

**Choose a tag**: Select `v0.2.0` from dropdown (already created)

**Release title**:
```
v0.2.0 - Client-Side Guardrails
```

**Description**: Copy and paste the content below:

---

# AgentGuard v0.2.0 - Client-Side Guardrails

We're excited to announce **AgentGuard v0.2.0**, featuring the industry's first **client-side guardrails** for offline AI agent security!

## 🛡️ What's New

### Client-Side Guardrails
Run security checks directly in your application without server calls:

- **PIIDetectionGuardrail**: Detect and redact PII (emails, phones, SSNs, credit cards)
- **ContentModerationGuardrail**: Block harmful content (hate, violence, harassment)
- **PromptInjectionGuardrail**: Prevent jailbreak and injection attempts

### GuardrailEngine
Execute multiple guardrails in parallel with timeout protection and error handling.

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

## 📦 Installation

```bash
# TypeScript/JavaScript
npm install agentguard-sdk

# Python
pip install agentguard-sdk
```

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

## 📚 Documentation

- [Getting Started Guide](https://github.com/agentguard-ai/agentguard-sdk#readme)
- [Examples](https://github.com/agentguard-ai/agentguard-sdk/tree/main/examples)
- [TypeScript Changelog](https://github.com/agentguard-ai/agentguard-sdk/blob/main/CHANGELOG.md)
- [Python Changelog](https://github.com/agentguard-ai/agentguard-python/blob/main/CHANGELOG.md)

## 🔧 Breaking Changes

None - this is a feature release with full backward compatibility.

## 🙏 Thank You

Special thanks to our early adopters and contributors who helped shape this release!

## 🔗 Links

- **npm Package**: https://www.npmjs.com/package/agentguard-sdk
- **PyPI Package**: https://pypi.org/project/agentguard-sdk/
- **TypeScript SDK**: https://github.com/agentguard-ai/agentguard-sdk
- **Python SDK**: https://github.com/agentguard-ai/agentguard-python

**Let's make AI agents safer! 🚀**

---

### 3. Options

- [x] Set as the latest release
- [ ] Set as a pre-release (leave unchecked)
- [ ] Create a discussion for this release (optional)

### 4. Publish

Click the green **"Publish release"** button

---

## Verification

After publishing, verify:
1. Release appears at: https://github.com/nagasatish007/ai-agent-security-platform/releases
2. Tag v0.2.0 is visible
3. Release notes are formatted correctly
4. Links work properly

---

## Next: Social Media Announcements

### Twitter Thread
```
🚀 Excited to announce AgentGuard v0.2.0!

The first AI agent security SDK with CLIENT-SIDE GUARDRAILS 🛡️

✅ Detect PII (emails, SSNs, credit cards)
✅ Block harmful content
✅ Prevent prompt injection
✅ Works OFFLINE - no server calls!

npm install agentguard-sdk
pip install agentguard-sdk

🔗 https://github.com/agentguard-ai/agentguard-sdk

#AI #Security #OpenSource #LangChain
```

### LinkedIn Post
```
I'm thrilled to announce the release of AgentGuard v0.2.0! 🎉

AgentGuard is the first AI agent security SDK with client-side guardrails that run directly in your application - no server calls required.

🛡️ What's New:
• PIIDetectionGuardrail - Protect sensitive data
• ContentModerationGuardrail - Block harmful content
• PromptInjectionGuardrail - Prevent jailbreak attacks
• GuardrailEngine - Execute multiple guardrails in parallel

📦 Available now:
• npm: agentguard-sdk
• PyPI: agentguard-sdk

This is a major milestone in making AI agents safer and more secure. Check it out and let me know what you think!

🔗 https://github.com/agentguard-ai/agentguard-sdk

#ArtificialIntelligence #Security #OpenSource #SoftwareDevelopment
```

### Reddit Post (r/LangChain)
**Title**: [Release] AgentGuard v0.2.0 - First SDK with Client-Side Guardrails

**Body**:
```
Hey r/LangChain! 👋

I just released AgentGuard v0.2.0, the first AI agent security SDK with client-side guardrails.

**What makes it unique:**
- Runs OFFLINE - no server calls required
- Works with any LLM framework (LangChain, CrewAI, etc.)
- Open source (MIT license)

**Built-in Guardrails:**
1. PII Detection (emails, SSNs, credit cards)
2. Content Moderation (hate speech, violence)
3. Prompt Injection Prevention (jailbreaks, instruction attacks)

**Quick Start:**
```typescript
import { GuardrailEngine, PIIDetectionGuardrail } from 'agentguard-sdk';

const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail());

const result = await engine.execute("Contact me at john@example.com");
console.log(result.passed); // false - PII detected!
```

**Links:**
- npm: https://www.npmjs.com/package/agentguard-sdk
- PyPI: https://pypi.org/project/agentguard-sdk/
- GitHub: https://github.com/agentguard-ai/agentguard-sdk

Would love to hear your feedback! 🚀
```

---

**Ready to launch!** 🎉
