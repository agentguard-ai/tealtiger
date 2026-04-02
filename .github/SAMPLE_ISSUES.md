# Sample Issues to Create

These are sample issues you can create manually on GitHub to populate the repository and demonstrate the issue templates.

## Issue 1: Feature Request - Azure OpenAI Support Enhancement

**Title:** [Feature]: Add streaming support for Azure OpenAI

**Labels:** enhancement, azure-openai

**Body:**
```
**Which SDK is this for?**
Both

**Feature Type**
API Enhancement

**Problem Statement**
Currently, TealTiger supports Azure OpenAI but doesn't support streaming responses. Many applications need real-time streaming for better UX.

**Proposed Solution**
Add streaming support to the Azure OpenAI client wrapper, similar to how it works with the standard OpenAI client.

**Use Case**
In my chatbot application, I need to stream responses to users in real-time to provide a better experience. Currently, I have to wait for the entire response before displaying it.

**Example Code**
```typescript
const client = new TealAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  enableGuardrails: true,
});

const stream = await client.chat.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true, // Enable streaming
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

**Would you like to contribute this feature?**
- [x] I'm willing to submit a PR to implement this feature
```

---

## Issue 2: Bug Report - Cost Tracking

**Title:** [Bug]: Cost tracking not working with GPT-4 Turbo

**Labels:** bug, cost-tracking

**Body:**
```
**Which SDK are you using?**
TypeScript/JavaScript

**SDK Version**
0.2.2

**AI Provider**
OpenAI

**Bug Description**
Cost tracking returns $0.00 for GPT-4 Turbo (gpt-4-turbo-preview) model calls.

**Steps to Reproduce**
1. Initialize TealOpenAI with enableCostTracking: true
2. Make a call using gpt-4-turbo-preview model
3. Check the cost tracking data
4. Cost shows as $0.00

**Expected Behavior**
Cost should be calculated based on GPT-4 Turbo pricing ($0.01/1K input tokens, $0.03/1K output tokens)

**Actual Behavior**
Cost shows as $0.00 for all GPT-4 Turbo calls

**Code Sample**
```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  enableCostTracking: true,
});

const response = await client.chat.create({
  model: 'gpt-4-turbo-preview',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.cost); // Shows $0.00
```

**Environment**
- OS: macOS 14.0
- Node.js version: 20.10.0
- Package manager: npm
```

---

## Issue 3: Documentation

**Title:** [Docs]: Missing Python async/await examples

**Labels:** documentation, python

**Body:**
```
**Documentation Type**
Code Examples

**Documentation Location**
https://github.com/agentguard-ai/tealtiger-python

**Issue Type**
Missing information

**Issue Description**
The Python SDK documentation only shows synchronous examples, but the SDK supports async/await. New users might not realize they can use async operations.

**Suggested Fix**
Add async/await examples to the README, showing:
1. How to use async client initialization
2. How to make async API calls
3. How to use async context managers

Example:
```python
import asyncio
from tealtiger.clients import TealOpenAI, TealOpenAIConfig

async def main():
    config = TealOpenAIConfig(
        api_key="your-api-key",
        enable_guardrails=True,
    )
    
    async with TealOpenAI(config) as client:
        response = await client.chat.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response)

asyncio.run(main())
```
```

---

## Issue 4: Feature Request - Custom Guardrails

**Title:** [Feature]: Support for custom guardrail rules

**Labels:** enhancement, guardrails

**Body:**
```
**Which SDK is this for?**
Both

**Feature Type**
New Guardrail

**Problem Statement**
The built-in guardrails (PII detection, prompt injection, content moderation) are great, but I need to add custom rules specific to my domain (e.g., blocking certain industry-specific terms).

**Proposed Solution**
Add a plugin system that allows developers to register custom guardrail functions that run alongside the built-in ones.

**Use Case**
In my healthcare application, I need to block certain medical terms and ensure HIPAA compliance beyond standard PII detection. I want to define custom rules without forking the SDK.

**Example Code**
```typescript
import { TealOpenAI, CustomGuardrail } from 'tealtiger';

const medicalTermsGuardrail: CustomGuardrail = {
  name: 'medical-terms-blocker',
  check: async (input: string) => {
    const blockedTerms = ['diagnosis', 'prescription', 'treatment'];
    const found = blockedTerms.find(term => input.toLowerCase().includes(term));
    
    return {
      passed: !found,
      reason: found ? `Blocked medical term: ${found}` : undefined,
    };
  },
};

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  enableGuardrails: true,
  customGuardrails: [medicalTermsGuardrail],
});
```

**Would you like to contribute this feature?**
- [ ] I'm willing to submit a PR to implement this feature
- [x] I need help implementing this feature
```

---

## Issue 5: Good First Issue

**Title:** [Good First Issue]: Add TypeScript examples for Anthropic Claude

**Labels:** good-first-issue, documentation, examples

**Body:**
```
**Description**
We need more examples showing how to use TealTiger with Anthropic's Claude models. Currently, most examples focus on OpenAI.

**What needs to be done:**
1. Create a new file `examples/anthropic-claude.ts`
2. Add examples showing:
   - Basic Claude usage with TealTiger
   - Using guardrails with Claude
   - Cost tracking with Claude
   - Streaming responses (if supported)

**Acceptance Criteria:**
- [ ] New example file created
- [ ] Code is well-commented
- [ ] Examples run without errors
- [ ] README updated to reference the new example

**Resources:**
- Anthropic Claude docs: https://docs.anthropic.com/
- Existing OpenAI examples: `examples/basic-usage.js`

**Estimated effort:** 1-2 hours

This is a great first contribution! If you're interested, comment below and we'll assign it to you.
```

---

## How to Create These Issues

1. Go to https://github.com/agentguard-ai/tealtiger/issues/new/choose
2. Select the appropriate template
3. Copy the content from above
4. Fill in the template fields
5. Submit the issue

These sample issues will help demonstrate the issue templates and provide initial content for the repository.
