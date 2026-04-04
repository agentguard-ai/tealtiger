# TealTiger TypeScript SDK — Docker Images

> AI agent security SDK for TypeScript/Node.js — guardrails, cost tracking, and policy management for LLM applications.

[![npm](https://img.shields.io/npm/v/tealtiger)](https://www.npmjs.com/package/tealtiger)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Quick Start

```bash
docker pull tealtigeradmin/tealtiger-typescript:latest

docker run -it --rm \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-typescript:latest \
  node
```

```javascript
const { TealOpenAI, GuardrailEngine, PIIDetectionGuardrail } = require('tealtiger');

const engine = new GuardrailEngine();
engine.registerGuardrail(new PIIDetectionGuardrail());

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrailEngine: engine
});
```

## Available Tags

| Tag | Base | Description |
|-----|------|-------------|
| `latest`, `1.1.1` | `node:20-alpine` | Production — minimal Alpine, non-root |
| `dev` | `node:20` | Development — includes TypeScript, Jest, ESLint, fast-check |

## Usage Examples

### Run a script
```bash
docker run --rm -v $(pwd):/app -w /app \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-typescript:latest \
  node my_script.js
```

### Development
```bash
docker run -it --rm -v $(pwd):/app \
  tealtigeradmin/tealtiger-typescript:dev bash
# typescript, jest, eslint, prettier all available
```

### Docker Compose
```yaml
services:
  app:
    image: tealtigeradmin/tealtiger-typescript:latest
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./app:/app
    command: node /app/server.js
```

### Use as base image
```dockerfile
FROM tealtigeradmin/tealtiger-typescript:latest
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

## What's Included

- TealTiger TypeScript SDK v1.1.1
- 7 LLM providers: OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral
- TealEngine — Policy evaluation (ENFORCE/MONITOR/REPORT_ONLY)
- TealGuard — PII detection, prompt injection, content moderation
- TealCircuit — Circuit breaker for cascading failure prevention
- TealAudit — Audit logging with PII redaction
- Cost tracking across 50+ models

## GHCR Mirror

All tags also available on GitHub Container Registry:
```bash
docker pull ghcr.io/agentguard-ai/tealtiger-typescript:latest
```

## Security

- Runs as non-root user (`node`)
- Alpine Linux base for minimal attack surface
- Apache 2.0 license

## Links

- **npm**: https://www.npmjs.com/package/tealtiger
- **Documentation**: https://docs.tealtiger.ai
- **GitHub**: https://github.com/agentguard-ai/tealtiger
- **Contact**: reachout@tealtiger.ai
