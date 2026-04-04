# TealTiger Python SDK — Docker Images

> AI agent security SDK for Python — guardrails, cost tracking, and policy management for LLM applications.

[![PyPI](https://img.shields.io/pypi/v/tealtiger)](https://pypi.org/project/tealtiger/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Quick Start

```bash
docker pull tealtigeradmin/tealtiger-python:latest

docker run -it --rm \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-python:latest \
  python
```

```python
from tealtiger import TealOpenAI, GuardrailEngine, PIIDetectionGuardrail

engine = GuardrailEngine()
engine.register_guardrail(PIIDetectionGuardrail())

client = TealOpenAI(
    api_key="your-key",
    guardrail_engine=engine
)
```

## Available Tags

| Tag | Base | Description |
|-----|------|-------------|
| `latest`, `1.1.1` | `python:3.12-slim` | Production — minimal, secure, non-root |
| `dev` | `python:3.12` | Development — includes pytest, mypy, black, ruff, ipython |
| `alpine` | `python:3.12-alpine` | Minimal — smallest image for serverless/edge |
| `jupyter` | `python:3.12` | Jupyter Lab — interactive experimentation on port 8888 |

## Usage Examples

### Run a script
```bash
docker run --rm -v $(pwd):/app -w /app \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-python:latest \
  python my_script.py
```

### Jupyter Notebook
```bash
docker run -p 8888:8888 \
  -e OPENAI_API_KEY=your-key \
  tealtigeradmin/tealtiger-python:jupyter
# Open http://localhost:8888
```

### Development
```bash
docker run -it --rm -v $(pwd):/app \
  tealtigeradmin/tealtiger-python:dev bash
# pytest, mypy, black, ruff all available
```

### Docker Compose
```yaml
services:
  app:
    image: tealtigeradmin/tealtiger-python:latest
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./app:/app
    command: python /app/server.py
```

### Use as base image
```dockerfile
FROM tealtigeradmin/tealtiger-python:latest
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

## What's Included

- TealTiger Python SDK v1.1.1
- 7 LLM providers: OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral
- TealEngine — Policy evaluation (ENFORCE/MONITOR/REPORT_ONLY)
- TealGuard — PII detection, prompt injection, content moderation
- TealCircuit — Circuit breaker for cascading failure prevention
- TealAudit — Audit logging with PII redaction
- Cost tracking across 50+ models

## GHCR Mirror

All tags also available on GitHub Container Registry:
```bash
docker pull ghcr.io/agentguard-ai/tealtiger-python:latest
```

## Security

- Runs as non-root user (`tealtiger`)
- No unnecessary packages
- Apache 2.0 license

## Links

- **PyPI**: https://pypi.org/project/tealtiger/
- **Documentation**: https://docs.tealtiger.ai
- **GitHub**: https://github.com/agentguard-ai/tealtiger
- **Contact**: reachout@tealtiger.ai
