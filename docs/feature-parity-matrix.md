# Cross-SDK Feature Parity Matrix

> **Last updated:** May 2026

This document tracks feature availability across the [TypeScript SDK](https://github.com/agentguard-ai/tealtiger-typescript-prod) (`tealtiger` on npm) and [Python SDK](https://github.com/agentguard-ai/tealtiger-python-prod) (`tealtiger` on PyPI).

| Legend | Meaning |
|--------|---------|
| ✅     | Supported |
| ⬜     | Partial |
| 🔄     | Planned |
| ❌     | Not applicable |

---

## Providers

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| Provider: OpenAI | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/openai.ts`](../packages/tealtiger-sdk/src/providers/openai.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_openai.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_openai.py) |
| Provider: Anthropic | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/anthropic.ts`](../packages/tealtiger-sdk/src/providers/anthropic.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_anthropic.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_anthropic.py) |
| Provider: Google Gemini | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/gemini.ts`](../packages/tealtiger-sdk/src/providers/gemini.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_gemini.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_gemini.py) |
| Provider: AWS Bedrock | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/bedrock.ts`](../packages/tealtiger-sdk/src/providers/bedrock.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_bedrock.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_bedrock.py) |
| Provider: Azure OpenAI | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/azure-openai.ts`](../packages/tealtiger-sdk/src/providers/azure-openai.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_azure_openai.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_azure_openai.py) |
| Provider: Cohere | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/cohere.ts`](../packages/tealtiger-sdk/src/providers/cohere.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_cohere.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_cohere.py) |
| Provider: Mistral AI | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/mistral.ts`](../packages/tealtiger-sdk/src/providers/mistral.ts), [`packages/tealtiger-python/src/tealtiger/clients/teal_mistral.py`](../packages/tealtiger-python/src/tealtiger/clients/teal_mistral.py) |
| Provider: DeepSeek | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/deepseek.ts`](../packages/tealtiger-sdk/src/providers/deepseek.ts), [`packages/tealtiger-python/src/tealtiger/clients/new_providers.py`](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |
| Provider: Groq | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/groq.ts`](../packages/tealtiger-sdk/src/providers/groq.ts), [`packages/tealtiger-python/src/tealtiger/clients/new_providers.py`](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |
| Provider: Together AI | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/together.ts`](../packages/tealtiger-sdk/src/providers/together.ts), [`packages/tealtiger-python/src/tealtiger/clients/new_providers.py`](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |
| Provider: xAI (Grok) | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/xai.ts`](../packages/tealtiger-sdk/src/providers/xai.ts), [`packages/tealtiger-python/src/tealtiger/clients/new_providers.py`](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |
| Provider: HuggingFace TGI | ✅ | ✅ | [`packages/tealtiger-sdk/src/providers/hf-tgi.ts`](../packages/tealtiger-sdk/src/providers/hf-tgi.ts), [`packages/tealtiger-python/src/tealtiger/clients/new_providers.py`](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |

---

## Security Guardrails

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| Guardrail: PII Detection | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/pii-detection.ts`](../packages/tealtiger-sdk/src/guardrails/pii-detection.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/pii_detection.py`](../packages/tealtiger-python/src/tealtiger/guardrails/pii_detection.py) |
| Guardrail: Prompt Injection | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/prompt-injection.ts`](../packages/tealtiger-sdk/src/guardrails/prompt-injection.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/prompt_injection.py`](../packages/tealtiger-python/src/tealtiger/guardrails/prompt_injection.py) |
| Guardrail: Content Moderation | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/content-moderation.ts`](../packages/tealtiger-sdk/src/guardrails/content-moderation.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/content_moderation.py`](../packages/tealtiger-python/src/tealtiger/guardrails/content_moderation.py) |
| Guardrail: Unicode Normalization | ✅ | 🔄 | [`packages/tealtiger-sdk/src/guardrails/unicode-normalization.ts`](../packages/tealtiger-sdk/src/guardrails/unicode-normalization.ts); Python not yet ported |
| Guardrail: Secret Detection | ✅ | 🔄 | [`packages/tealtiger-sdk/src/secrets/`](../packages/tealtiger-sdk/src/secrets/); Python has [`tests/secrets/test_secrets.py`](../packages/tealtiger-python/tests/secrets/test_secrets.py) but no implementation |
| Guardrail: Encoded Output Detection | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/detectors/v1.3/encoded-output-detector.ts`](../packages/tealtiger-sdk/src/guardrails/detectors/v1.3/encoded-output-detector.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py`](../packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py) |
| Guardrail: Control Character Sanitization | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/detectors/v1.3/control-char-sanitizer.ts`](../packages/tealtiger-sdk/src/guardrails/detectors/v1.3/control-char-sanitizer.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py`](../packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py) |
| Guardrail: Markdown Exfiltration Detection | ✅ | ✅ | [`packages/tealtiger-sdk/src/guardrails/detectors/v1.3/markdown-exfil-detector.ts`](../packages/tealtiger-sdk/src/guardrails/detectors/v1.3/markdown-exfil-detector.ts), [`packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py`](../packages/tealtiger-python/src/tealtiger/guardrails/detectors_v13.py) |
| Guardrail: Custom Rules | ✅ | ✅ | Both support custom guardrail definitions via the base `Guardrail` class |

---

## Cost Governance

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| Budget Enforcement | ✅ | ✅ | [`packages/tealtiger-sdk/src/cost/`](../packages/tealtiger-sdk/src/cost/), [`packages/tealtiger-python/src/tealtiger/cost/budget.py`](../packages/tealtiger-python/src/tealtiger/cost/budget.py) |
| Cost Tracking | ✅ | ✅ | [`packages/tealtiger-sdk/src/cost/`](../packages/tealtiger-sdk/src/cost/), [`packages/tealtiger-python/src/tealtiger/cost/tracker.py`](../packages/tealtiger-python/src/tealtiger/cost/tracker.py) |
| Cost Alerts | ✅ | ✅ | [`packages/tealtiger-sdk/src/cost/`](../packages/tealtiger-sdk/src/cost/), [`packages/tealtiger-python/src/tealtiger/cost/budget.py`](../packages/tealtiger-python/src/tealtiger/cost/budget.py) |
| Governance-Owned Cost Ceilings | ✅ | ✅ | [`packages/tealtiger-sdk/src/cost/governance-cost.ts`](../packages/tealtiger-sdk/src/cost/governance-cost.ts), [`packages/tealtiger-python/src/tealtiger/cost/governance_cost.py`](../packages/tealtiger-python/src/tealtiger/cost/governance_cost.py) |
| Cost Anomaly Detection | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/monitor/TealMonitor.ts`](../packages/tealtiger-sdk/src/core/monitor/TealMonitor.ts), [`packages/tealtiger-python/src/tealtiger/cost/governance_cost.py`](../packages/tealtiger-python/src/tealtiger/cost/governance_cost.py) |

---

## Governance Architecture

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| TealEngine v1.3 | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/`](../packages/tealtiger-sdk/src/core/engine/v1.3/), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/) |
| FREEZE Rules (immutable kill switches) | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/anti-tamper.ts`](../packages/tealtiger-sdk/src/core/engine/v1.3/anti-tamper.ts), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py) |
| PLAN_ONLY Mode | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/automation-levels.ts`](../packages/tealtiger-sdk/src/core/engine/v1.3/automation-levels.ts), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py) |
| Non-Human Identity (NHI) | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/`](../packages/tealtiger-sdk/src/core/engine/v1.3/), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/types.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/types.py) |
| Zero Standing Privilege (ZSP) | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/`](../packages/tealtiger-sdk/src/core/engine/v1.3/), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py) |
| Agent Attestation | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/`](../packages/tealtiger-sdk/src/core/engine/v1.3/), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py) |
| Policy Hot-Swap | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/engine/v1.3/policy-hotswap.ts`](../packages/tealtiger-sdk/src/core/engine/v1.3/policy-hotswap.ts), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/engine.py) |
| OWASP Agentic Top 10 | ✅ | ✅ | [`docs/owasp-asi-mapping.md`](../docs/owasp-asi-mapping.md), [`packages/tealtiger-python/src/tealtiger/core/engine/v1_3/types.py`](../packages/tealtiger-python/src/tealtiger/core/engine/v1_3/types.py) |
| TealProof (cryptographic receipts) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealproof/`](../packages/tealtiger-sdk/src/modules/tealproof/), [`packages/tealtiger-python/src/tealtiger/modules/tealproof.py`](../packages/tealtiger-python/src/tealtiger/modules/tealproof.py) |
| TealFlow (governance workflows) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealflow/`](../packages/tealtiger-sdk/src/modules/tealflow/), [`packages/tealtiger-python/src/tealtiger/modules/tealflow.py`](../packages/tealtiger-python/src/tealtiger/modules/tealflow.py) |
| TealClassifier (ONNX ML inference) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealclassifier/`](../packages/tealtiger-sdk/src/modules/tealclassifier/), [`packages/tealtiger-python/src/tealtiger/modules/tealclassifier.py`](../packages/tealtiger-python/src/tealtiger/modules/tealclassifier.py) |
| TealCircuit (circuit breakers) | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/circuit/`](../packages/tealtiger-sdk/src/core/circuit/), [`packages/tealtiger-python/src/tealtiger/core/circuit/teal_circuit.py`](../packages/tealtiger-python/src/tealtiger/core/circuit/teal_circuit.py) |
| TealAudit (audit logging) | ✅ | ✅ | [`packages/tealtiger-sdk/src/core/audit/`](../packages/tealtiger-sdk/src/core/audit/), [`packages/tealtiger-python/src/tealtiger/core/audit/`](../packages/tealtiger-python/src/tealtiger/core/audit/) |
| TealMonitor (behavioral monitoring) | ✅ | ⬜ | [`packages/tealtiger-sdk/src/core/monitor/TealMonitor.ts`](../packages/tealtiger-sdk/src/core/monitor/TealMonitor.ts); Python has `GovernanceCostEnforcer` in [`governance_cost.py`](../packages/tealtiger-python/src/tealtiger/cost/governance_cost.py) for cost-specific monitoring |
| TealMemory (memory governance) | ✅ | ✅ | [`packages/tealtiger-sdk/src/memory/`](../packages/tealtiger-sdk/src/memory/), [`packages/tealtiger-python/src/tealtiger/memory/`](../packages/tealtiger-python/src/tealtiger/memory/) |
| TealDrift (behavioral drift) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealdrift/TealDrift.ts`](../packages/tealtiger-sdk/src/modules/tealdrift/TealDrift.ts), [`packages/tealtiger-python/src/tealtiger/modules/governance_modules.py`](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealState (context governance) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealstate/TealState.ts`](../packages/tealtiger-sdk/src/modules/tealstate/TealState.ts), [`packages/tealtiger-python/src/tealtiger/modules/governance_modules.py`](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealTemporal (session governance) | ✅ | ✅ | [`packages/tealtiger-sdk/src/modules/tealtemporal/TealTemporal.ts`](../packages/tealtiger-sdk/src/modules/tealtemporal/TealTemporal.ts), [`packages/tealtiger-python/src/tealtiger/modules/governance_modules.py`](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealRegistry (MCP registry) | ✅ | ⬜ | [`packages/tealtiger-sdk/src/registry/TealRegistry.ts`](../packages/tealtiger-sdk/src/registry/TealRegistry.ts); Python has [`registry/detectors.py`](../packages/tealtiger-python/src/tealtiger/registry/detectors.py) (partial) |
| TealReliability (retry/fallback chains) | ✅ | 🔄 | [`packages/tealtiger-sdk/src/reliability/`](../packages/tealtiger-sdk/src/reliability/); Python not yet ported |
| TealSecrets | ✅ | 🔄 | [`packages/tealtiger-sdk/src/secrets/TealSecrets.ts`](../packages/tealtiger-sdk/src/secrets/TealSecrets.ts); Python has tests only |
| Policy Framework | ✅ | ✅ | [`packages/tealtiger-sdk/src/policy/`](../packages/tealtiger-sdk/src/policy/), [`packages/tealtiger-python/src/tealtiger/policy.py`](../packages/tealtiger-python/src/tealtiger/policy.py) |

---

## Platform Adapters

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| AWS Bedrock Agents | ✅ | ✅ | [`packages/tealtiger-sdk/src/adapters/bedrock-adapter.ts`](../packages/tealtiger-sdk/src/adapters/bedrock-adapter.ts), [`packages/tealtiger-python/src/tealtiger/adapters/bedrock.py`](../packages/tealtiger-python/src/tealtiger/adapters/bedrock.py) |
| AWS AgentCore | ✅ | ✅ | [`packages/tealtiger-sdk/src/adapters/agentcore-adapter.ts`](../packages/tealtiger-sdk/src/adapters/agentcore-adapter.ts), [`packages/tealtiger-python/src/tealtiger/adapters/agentcore.py`](../packages/tealtiger-python/src/tealtiger/adapters/agentcore.py) |
| Azure AI Agent Service | ✅ | ✅ | [`packages/tealtiger-sdk/src/adapters/azure-adapter.ts`](../packages/tealtiger-sdk/src/adapters/azure-adapter.ts), [`packages/tealtiger-python/src/tealtiger/adapters/azure.py`](../packages/tealtiger-python/src/tealtiger/adapters/azure.py) |

---

## Integrations

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| LangChain Integration | ✅ | ✅ | [`examples/typescript/langchain-integration.ts`](../examples/typescript/langchain-integration.ts), [`examples/python/langchain_integration.py`](../examples/python/langchain_integration.py) |
| CrewAI Integration | 🔄 | ✅ | Python: [`examples/python/crewai_integration.py`](../examples/python/crewai_integration.py); TS not yet ported |
| MCP Governance | ✅ | 🔄 | [`examples/mcp-governance/`](../examples/mcp-governance/); Python not yet ported |

---

## Infrastructure

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| CLI | ✅ | ✅ | [`packages/tealtiger-sdk/src/cli/`](../packages/tealtiger-sdk/src/cli/), [`packages/tealtiger-python/src/tealtiger/cli/`](../packages/tealtiger-python/src/tealtiger/cli/) |
| Sidecar | ✅ | ✅ | [`packages/tealtiger-sdk/src/sidecar/`](../packages/tealtiger-sdk/src/sidecar/), [`packages/tealtiger-python/src/tealtiger/sidecar/`](../packages/tealtiger-python/src/tealtiger/sidecar/) |
| Governance Dashboard | ✅ | 🔄 | [`packages/tealtiger-sdk/src/dashboard/GovernanceDashboard.ts`](../packages/tealtiger-sdk/src/dashboard/GovernanceDashboard.ts); Python not yet ported |
| Serverless Optimization | ✅ | 🔄 | [`packages/tealtiger-sdk/src/serverless/`](../packages/tealtiger-sdk/src/serverless/); Python not yet ported |
| Configuration Management | ✅ | 🔄 | [`packages/tealtiger-sdk/src/config/Configuration.ts`](../packages/tealtiger-sdk/src/config/Configuration.ts); Python not yet ported |
| Testing / Verification Harness | ✅ | ⬜ | TS: [`packages/tealtiger-sdk/src/verify/`](../packages/tealtiger-sdk/src/verify/); Python has [`core/engine/testing/`](../packages/tealtiger-python/src/tealtiger/core/engine/testing/) (partial) |
| CI/CD Integrations | ✅ | ✅ | [`integrations/`](../integrations/) (GitHub Action, GitLab CI, CircleCI Orb, Terraform) — platform-level, language-agnostic |

---

## Examples

| Feature | TypeScript | Python | Notes |
|---------|-----------|--------|-------|
| Quickstart | ✅ | ✅ | [`examples/advanced-usage.ts`](../examples/advanced-usage.ts), [`examples/python/quickstart.py`](../examples/python/quickstart.py) |
| Guardrails Demo | ✅ | 🔄 | [`examples/guardrails-demo.ts`](../examples/guardrails-demo.ts); Python not yet ported |
| Cost Comparison | ✅ | 🔄 | [`examples/cost-comparison.ts`](../examples/cost-comparison.ts); Python not yet ported |
| Policy Testing | ✅ | 🔄 | [`examples/policy-testing.ts`](../examples/policy-testing.ts); Python not yet ported |
| Multi-Provider Failover | ✅ | 🔄 | [`examples/multi-provider-failover.ts`](../examples/multi-provider-failover.ts); Python not yet ported |
| Monitoring & Alerting | ✅ | 🔄 | [`examples/monitoring-alerting.ts`](../examples/monitoring-alerting.ts); Python not yet ported |
| Audit Log Analysis | ✅ | 🔄 | [`examples/audit-log-analysis.ts`](../examples/audit-log-analysis.ts); Python not yet ported |
| Custom Policies | ✅ | 🔄 | [`examples/custom-policies.ts`](../examples/custom-policies.ts); Python not yet ported |
| Anthropic Quickstart | ✅ | ✅ | [`examples/typescript/anthropic-quickstart.ts`](../examples/typescript/anthropic-quickstart.ts), [`examples/python/anthropic_quickstart.py`](../examples/python/anthropic_quickstart.py) |
| Redis Memory Adapter | ✅ | ✅ | [`examples/typescript/redis-memory-adapter.ts`](../examples/typescript/redis-memory-adapter.ts), [`examples/python/redis_memory_adapter.py`](../examples/python/redis_memory_adapter.py) |
| Streaming | ✅ | 🔄 | [`examples/typescript/streaming.ts`](../examples/typescript/streaming.ts); Python not yet ported |

---

## Summary

| Category | TypeScript | Python |
|----------|-----------|--------|
| **Providers** | 12/12 ✅ | 12/12 ✅ |
| **Security Guardrails** | 9/9 ✅ | 6/9 ✅, 2/9 🔄, 1/9 🔄 |
| **Cost Governance** | 5/5 ✅ | 5/5 ✅ |
| **Governance Architecture** | 20/20 ✅ | 17/20 ✅, 2/20 ⬜, 1/20 🔄 |
| **Platform Adapters** | 3/3 ✅ | 3/3 ✅ |
| **Integrations** | 2/3 ✅ | 2/3 ✅ |
| **Infrastructure** | 6/6 ✅ | 3/6 ✅, 2/6 🔄, 1/6 ⬜ |
| **Examples** | 12/12 ✅ | 4/12 ✅, 8/12 🔄 |

The Python SDK has strong parity on providers, cost governance, and core governance architecture. Areas still in progress include secret detection, TealReliability, dashboard, serverless optimization, and several example ports.
