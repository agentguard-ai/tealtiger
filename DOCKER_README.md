# TealTiger SDK — Docker Image

> AI agent security SDK with guardrails, cost tracking, and policy management for LLM applications.

[![npm](https://img.shields.io/npm/v/tealtiger)](https://www.npmjs.com/package/tealtiger)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Quick Start

```bash
docker pull tealtigeradmin/tealtiger-docker:latest
```

```bash
# Interactive Node.js REPL with TealTiger pre-installed
docker run -it --rm \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-docker:latest \
  node
```

```javascript
// Inside the container
const { TealOpenAI, GuardrailEngine, PIIDetectionGuardrail } = require('tealtiger');

const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail());

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrailEngine: engine
});
```

## What's Included

This image comes with the TealTiger TypeScript SDK pre-installed on Node.js 20 Alpine.

### Core Components
- **TealEngine** — Policy evaluation with ENFORCE/MONITOR/REPORT_ONLY modes
- **TealGuard** — Client-side guardrails (PII detection, prompt injection, content moderation)
- **TealCircuit** — Circuit breaker for cascading failure prevention
- **TealAudit** — Audit logging with security-by-default PII redaction
- **Cost Tracking** — Monitor costs across 50+ models with budget enforcement

### 7 LLM Providers (95%+ market coverage)
| Provider | Client | Features |
|----------|--------|----------|
| OpenAI | `TealOpenAI` | Chat, Completions, Embeddings |
| Anthropic | `TealAnthropic` | Chat, Streaming |
| Google Gemini | `TealGemini` | Multimodal, Safety Settings |
| AWS Bedrock | `TealBedrock` | Claude, Titan, Jurassic, Command, Llama |
| Azure OpenAI | `TealAzureOpenAI` | Deployment-based, Azure AD |
| Mistral AI | `TealMistral` | EU Data Residency, GDPR |
| Cohere | `TealCohere` | RAG, Citations, Connectors |

## Usage Examples

### Run a script
```bash
docker run --rm \
  -v $(pwd)/app:/app \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-docker:latest \
  node /app/my-script.js
```

### Use in Docker Compose
```yaml
services:
  ai-agent:
    image: tealtigeradmin/tealtiger-docker:latest
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NODE_ENV=production
    volumes:
      - ./app:/app
    command: node /app/server.js
```

### Use as base image
```dockerfile
FROM tealtigeradmin/tealtiger-docker:latest
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

## Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `1.1.0` | v1.1.0 release |

## Image Details

- **Base**: `node:20-alpine`
- **Architecture**: `linux/amd64`
- **Size**: ~62 MB compressed
- **User**: Runs as non-root `node` user
- **License**: Apache 2.0

## Links

- **Documentation**: https://docs.tealtiger.ai
- **npm**: https://www.npmjs.com/package/tealtiger
- **PyPI**: https://pypi.org/project/tealtiger/
- **GitHub**: https://github.com/agentguard-ai/tealtiger
- **Contact**: reachout@tealtiger.ai

---

**Made with ❤️ by the TealTiger team**
