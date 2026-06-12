# TealTiger × Portkey Gateway — Webhook Guardrail Integration

Deploy TealTiger as a guardrails webhook for [Portkey AI Gateway](https://github.com/Portkey-AI/gateway).

Portkey routes and observes. TealTiger governs — deterministically, in <5ms, with no LLM in the governance path.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Your App    │────▶│  Portkey Gateway  │────▶│  LLM Provider│
│              │     │                  │     │  (OpenAI,    │
│              │     │  beforeRequest ──┼──┐  │   Anthropic, │
│              │◀────│  afterRequest  ──┼──┤  │   etc.)      │
└──────────────┘     └──────────────────┘  │  └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  TealTiger   │
                                    │  Webhook     │
                                    │              │
                                    │  • PII       │
                                    │  • Injection │
                                    │  • Secrets   │
                                    │  • Cost      │
                                    │  • Policy    │
                                    └──────────────┘
```

## How It Works

1. Your app sends a request through Portkey Gateway
2. Portkey fires a `beforeRequestHook` to the TealTiger webhook
3. TealTiger evaluates all configured guardrails (PII, prompt injection, secrets, cost)
4. Returns `verdict: true/false` with optional `transformedData` (e.g., PII-redacted messages)
5. Portkey enforces the verdict — blocks or passes through

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the webhook server

```bash
# Development
python server.py

# Production (with uvicorn)
uvicorn server:app --host 0.0.0.0 --port 8000
```

### 3. Configure Portkey

In your Portkey guardrail config, add a webhook guardrail:

- **Webhook URL:** `http://your-host:8000/guardrail`
- **Headers:** `{"Authorization": "Bearer YOUR_WEBHOOK_SECRET"}`
- **Timeout:** `3000` (ms)

### 4. Use with Portkey client

```python
from portkey_ai import Portkey

client = Portkey(
    provider="openai",
    Authorization="sk-...",
    config={
        "input_guardrails": [{
            "type": "webhook",
            "url": "http://localhost:8000/guardrail",
            "headers": {"Authorization": "Bearer my-secret"},
            "deny": True
        }],
        "output_guardrails": [{
            "type": "webhook",
            "url": "http://localhost:8000/guardrail",
            "headers": {"Authorization": "Bearer my-secret"},
            "deny": True
        }]
    }
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Features

| Guardrail | What it does | Hook |
|-----------|-------------|------|
| PII Detection | Detects SSN, credit cards, emails, phone numbers — redacts before LLM | `beforeRequest` |
| Prompt Injection | Blocks injection attempts deterministically | `beforeRequest` |
| Secret Detection | Catches API keys, tokens, passwords in prompts | `beforeRequest` |
| Content Moderation | Filters toxic/harmful output | `afterRequest` |
| Cost Governance | Enforces per-request budget ceilings | `beforeRequest` |

## Configuration

Environment variables (`.env`):

```env
WEBHOOK_SECRET=your-secret-here
TEALTIGER_MODE=enforce          # observe | monitor | enforce
TEALTIGER_PII_ENABLED=true
TEALTIGER_INJECTION_ENABLED=true
TEALTIGER_SECRETS_ENABLED=true
TEALTIGER_COST_LIMIT=0.50       # Max cost per request in USD
PORT=8000
```

## Response Format

TealTiger returns Portkey-compatible webhook responses:

```json
{
  "verdict": false,
  "data": {
    "reason": "PII detected: SSN found in user message",
    "guardrails_triggered": ["pii_detection"],
    "risk_score": 85,
    "execution_time_ms": 2.3,
    "tealtiger_decision_id": "dec_abc123"
  }
}
```

With PII redaction (transforms the request):

```json
{
  "verdict": true,
  "transformedData": {
    "request": {
      "json": {
        "messages": [
          {"role": "user", "content": "My SSN is [REDACTED_SSN]"}
        ],
        "model": "gpt-4o-mini"
      }
    }
  },
  "data": {
    "reason": "PII redacted: 1 SSN removed",
    "action": "redact"
  }
}
```

## Links

- [Portkey Webhook Guardrails Docs](https://portkey.ai/docs/integrations/guardrails/bring-your-own-guardrails)
- [TealTiger SDK](https://github.com/agentguard-ai/tealtiger)
- [Feature Request on Portkey](https://github.com/Portkey-AI/gateway/issues/1688)
- [PyPI: tealtiger](https://pypi.org/project/tealtiger/)

## License

Apache-2.0
