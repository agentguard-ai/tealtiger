# Cross-SDK Feature Parity Matrix

Last verified: June 20, 2026.

This matrix tracks feature parity between the TypeScript and Python SDKs in this repository. It should be updated whenever a provider, module, or example changes in either SDK.

## Status Legend

| Status | Meaning |
| --- | --- |
| Supported | Implemented in the SDK and covered by code, tests, or examples. |
| Partial | Only part of the capability is implemented, or the other SDK still lags behind. |
| Planned | Documented in the roadmap or spec, but not yet present in both SDKs. |
| Not applicable | Deliberately absent for that SDK. |

## Capability Matrix

| Capability | TypeScript SDK | Python SDK | Evidence |
| --- | --- | --- | --- |
| Core provider clients | Supported | Supported | [TypeScript clients](../packages/tealtiger-sdk/src/client/), [Python clients](../packages/tealtiger-python/src/tealtiger/clients/) |
| Additional v1.3 providers (Groq, DeepSeek, Together AI, Hugging Face TGI, xAI) | Supported | Supported | [TypeScript provider clients](../packages/tealtiger-sdk/src/providers/), [TypeScript provider tests](../packages/tealtiger-sdk/src/providers/__tests__/new-providers.test.ts), [TypeScript parity example](../packages/tealtiger-sdk/examples/v1.3-provider-parity.ts), [Python new providers](../packages/tealtiger-python/src/tealtiger/clients/new_providers.py) |
| Guardrails | Supported | Supported | [TypeScript guardrails](../packages/tealtiger-sdk/src/guardrails/), [Python guardrails](../packages/tealtiger-python/src/tealtiger/guardrails/) |
| Custom guardrails | Supported | Supported | [TypeScript guardrail tests](../packages/tealtiger-sdk/src/guardrails/__tests__/engine.test.ts), [Python guardrail tests](../packages/tealtiger-python/tests/test_guardrail_engine.py) |
| Cost tracking and budgets | Supported | Supported | [TypeScript cost modules](../packages/tealtiger-sdk/src/cost/), [Python cost demo](../packages/tealtiger-python/examples/cost_tracking_demo.py) |
| Audit and redaction | Supported | Supported | [TypeScript audit module](../packages/tealtiger-sdk/src/core/audit/), [Python audit module](../packages/tealtiger-python/src/tealtiger/core/audit/) |
| Governance and policy evaluation | Supported | Supported | [TypeScript client](../packages/tealtiger-sdk/src/client/TealTiger.ts), [Python engine](../packages/tealtiger-python/src/tealtiger/core/engine/) |
| Examples and quickstarts | Supported | Supported | [TypeScript examples](../packages/tealtiger-sdk/examples/), [Python examples](../packages/tealtiger-python/examples/), [LlamaIndex Python example](../examples/python/llamaindex_integration.py) |

## v1.3 Module Snapshot

| Module | TypeScript SDK | Python SDK | Evidence |
| --- | --- | --- | --- |
| TealProof | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python module](../packages/tealtiger-python/src/tealtiger/modules/tealproof.py) |
| TealFlow | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python module](../packages/tealtiger-python/src/tealtiger/modules/tealflow.py) |
| TealClassifier | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python module](../packages/tealtiger-python/src/tealtiger/modules/tealclassifier.py) |
| TealDrift | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python governance modules](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealState | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python governance modules](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealTemporal | Supported | Supported | [TypeScript standalone exports](../packages/tealtiger-sdk/src/standalone/index.ts), [Python governance modules](../packages/tealtiger-python/src/tealtiger/modules/governance_modules.py) |
| TealMonitor v2 | Supported | Supported | [TypeScript cost governance](../packages/tealtiger-sdk/src/cost/governance-cost.ts), [Python cost governance](../packages/tealtiger-python/src/tealtiger/cost/governance_cost.py) |

## Notes

- TypeScript-only extras such as the governance dashboard and bundle exporter are intentionally excluded from the parity baseline tracked here.
- If a row becomes disputed, prefer the source tree, tests, and examples over README marketing bullets.
- Keep this matrix in sync with new providers, module exports, and example coverage on both SDKs.
