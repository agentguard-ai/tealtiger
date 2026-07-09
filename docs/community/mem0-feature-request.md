## Summary

Integrate [TealTiger](https://github.com/agentguard-ai/tealtiger) as a governance layer for Mem0 memory operations — PII detection before writes, access control on reads, and audit evidence for every operation.

## Problem

Without governance, agents can store PII unintentionally, access memories across scope boundaries, exfiltrate data via memory, and leave no audit trail.

## Proposed Integration

**Pre-write governance (before memory.add):**

TealTiger intercepts content before it reaches Mem0 storage. If PII is detected (SSN, credit cards, medical info), it redacts or blocks. If secrets are found (API keys, tokens), they are stripped. Scope enforcement ensures agents can only write to authorized scopes.

**Pre-read governance (before memory.search):**

TealTiger checks whether the requesting agent/user is authorized to access the target memory scope. Unauthorized reads are denied with a structured reason.

**Audit trail:**

Every memory operation produces a governance receipt — who wrote/read what, what was detected, what action was taken, with timestamps and correlation IDs. Exportable as JSONL.

## Capabilities

- PII detection and redaction before memory.add()
- Secret detection (API keys, tokens)
- Scope enforcement (agent isolation)
- Instruction injection detection (memory poisoning defense)
- Read access control on memory.search()
- Structured audit trail (JSONL export)

## Key facts

- Deterministic, <5ms overhead, no LLM in governance path
- Apache 2.0, Python + TypeScript SDKs
- Already integrated with [AG2](https://github.com/ag2ai/ag2/pull/2962), proposed for [Portkey](https://github.com/Portkey-AI/gateway/issues/1688) and Composio
- Addresses OWASP ASI-04 (Memory Poisoning) and ASI-07 (Identity & Access Misuse)

## Links

- Source: https://github.com/agentguard-ai/tealtiger
- PyPI: https://pypi.org/project/tealtiger/

Happy to build a mem0-tealtiger middleware or contribute to cookbooks.
