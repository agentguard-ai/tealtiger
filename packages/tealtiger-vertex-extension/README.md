# TealTiger Vertex AI Extension

OpenAPI specification and reference implementation for the TealTiger Governance API, designed for deployment as a [Vertex AI Extension](https://cloud.google.com/vertex-ai/docs/extensions/overview).

## What This Is

An OpenAPI 3.0.3 spec that defines TealTiger's governance capabilities as a structured API. This spec can be:

1. **Imported as a Vertex AI Extension** — Gemini agents in Agent Builder can call TealTiger to check budgets or scrub PII before taking actions
2. **Listed on Google Cloud Marketplace** — enterprises can purchase TealTiger using committed Google Cloud credits
3. **Deployed as a standalone API** — run anywhere as a REST service

## Endpoints

### Guardrails
| Endpoint | Description |
|----------|-------------|
| `POST /guardrails/pii` | PII detection (regex, sub-millisecond) |
| `POST /guardrails/injection` | Prompt injection detection |
| `POST /guardrails/content` | Content moderation |
| `POST /guardrails/evaluate` | Run all guardrails at once |
| `POST /guardrails/redact` | Redact PII and return cleaned text |

### Cost
| Endpoint | Description |
|----------|-------------|
| `POST /cost/estimate` | Pre-call cost estimation (7 providers) |
| `POST /cost/compare` | Cross-model cost comparison |
| `POST /cost/check-budget` | Deterministic budget enforcement |
| `GET /models` | List supported providers and models |

### Combined
| Endpoint | Description |
|----------|-------------|
| `POST /preflight` | All guardrails + cost estimate in one call |

## Vertex AI Extension Setup

1. Deploy the TealTiger API (Cloud Run, GKE, or any host)
2. Import `openapi.yaml` as a Vertex AI Extension
3. In Agent Builder, add the TealTiger extension to your agent
4. Gemini will automatically route queries through TealTiger before executing actions

## Quick Test

```bash
# Validate the spec
npx @redocly/cli lint openapi.yaml

# Preview the docs
npx @redocly/cli preview-docs openapi.yaml
```

## License

MIT
