# OWASP Agentic Security Issues (ASI) — TealTiger Control Mapping

> **Framework:** OWASP Top 10 for Agentic Applications (ASI-01 through ASI-10)
> **Product:** TealTiger v1.3.0 "Autonomous Agent Governance"
> **Last updated:** May 2026

## Overview

This document maps each OWASP Agentic Security Issue to specific TealTiger modules, policy controls, and governance features. Every mapping references concrete, shipped functionality. Gaps are documented with planned mitigations where applicable.

---

## ASI-01: Prompt Injection & Manipulation

**Risk:** Malicious inputs trick the agent into overriding instructions, executing unauthorized actions, or leaking data.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealGuard** | Prompt injection detection (regex + ML ensemble), content moderation, Unicode normalization stripping | Evaluates all input against injection patterns; supports regex-only, ML-only, or ensemble modes (union/intersection) via `TealClassifier`. Strips Tag-block, zero-width, and variation-selector characters. |
| **TealClassifier** | Local ONNX ML inference for injection recall (80%+ PINT F1 in `ensemble_union` mode) | Runs ≤5ms on CPU; deterministic (no LLM in governance path). Falls back to regex-only on model failure. |
| **TealGuard** | Encoded output detection, control character sanitization | Detects base64, hex, ROT13 in outputs; strips ANSI/OSC 52/BEL/non-printable control characters. |
| **TealMemory** | Memory instruction injection detection | Scores candidate entries for imperative verb patterns, conditional triggers, role/tool references, encoded payloads. |
| **TealGuard** | Custom guardrail rules | Regex-based custom rules defined in policy for domain-specific injection patterns. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-01 | Pre-built pack at `policy-packs/owasp-agentic-top10/` with stable ASI-01 reason codes. |

**Gaps:** Sophisticated multi-step injection chains that span multiple turns may evade single-turn detection. TealDrift's behavioral baseline can flag anomalous response patterns as a secondary signal, but dedicated multi-turn injection analysis is not yet shipped (planned for v1.4).

---

## ASI-02: Compromised Agent Identity/Authentication

**Risk:** Weak identity binding allows impersonation, credential theft, or unauthorized agent operations.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **NHIGovernance** | Agent lifecycle management (active/suspended/revoked), scope enforcement, environment constraints | Every agent has a declared identity with owner, capability scope, and environment constraints. Actions outside scope denied with `NHI_SCOPE_VIOLATION`. |
| **NHIGovernance** | Zero Standing Privilege (ZSP) with JIT grants | Privileges granted just-in-time; no permanent standing permissions. Supports cryptographic attestation (JWT, mTLS, workload identity). |
| **TealEngine** | Workload identity binding | Governance bound to platform identity (K8s ServiceAccount, IAM role, workload certificate); identity cannot be forged at runtime. |
| **TealRegistry** | Tool identity and provenance | Verifies tool definition hashes; blocks MCP definition-drift attacks. Adapter composition allowlist prevents unauthorized tool chains. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-02 | Pre-built pack with ASI-02 identity controls. |

**Gaps:** No built-in support for federated identity across organizational boundaries (cross-org agent-to-agent calls). The NHI model assumes a single trust domain. Multi-party identity federation is under evaluation for v1.5.

---

## ASI-03: Excessive Agency/Autonomy

**Risk:** Agent has more capability, permission, or tool access than required for its legitimate purpose (violation of least privilege).

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealEngine** | Automation levels (`auto_deny`, `auto_sanitize`, `auto_allow`, `approval_required`) | Per-rule automation levels granularly control autonomy. High-risk actions require explicit approval. |
| **TealEngine** | FREEZE rules (immutable emergency kill switches) | Non-bypassable deny rules that persist across hot-swaps and restarts. `FREEZE_BLOCK` reason code. Tamper attempts logged as `FREEZE_TAMPER_ATTEMPT`. |
| **TealEngine** | PLAN_ONLY mode | All side-effecting actions denied while reasoning allowed. `PLAN_ONLY_BLOCK` reason code. |
| **TealEngine** | Tool permission policies | Granular allow/deny per tool, per agent. Supports `maxSize`, `maxRows`, `rateLimit`, `allowedTables` constraints. |
| **TealEngine** | Code execution controls | `allowedLanguages`, `blockedFunctions`, `blockedPatterns`, `maxLength`, `timeout`, `requireSandbox`. |
| **TealEngine** | Code Change Governance | Path/branch allowlists, two-person rule for CODE_CHANGE actions. |
| **TealTemporal** | Session TTL, cooldown periods, time-of-day restrictions | Limits agent operational window and pace of sensitive actions. |
| **TealState** | Context size governance | Token-based context limits with eviction strategies (deny, truncate). Prevents context-window exhaustion attacks. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-03 | Pre-built pack with least-privilege profiles. |

**Gaps:** Dynamic scope expansion (agent requesting additional permissions mid-session) is not supported — all permissions must be pre-declared. Session-level dynamic permission grants are planned for v1.5.

---

## ASI-04: Insecure Communication

**Risk:** Agent communication channels lack encryption, integrity protection, or mutual authentication.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealGuard** | Markdown exfiltration detection | Blocks outputs with markdown image URLs, iframe references, link-preview triggers to non-allowlisted domains. Flags data-bearing query parameters. |
| **TealMemory** | Memory exfiltration prevention | Detects URLs with data-bearing parameters, webhook-formatted strings pointing to non-allowlisted domains. `MEMORY_EXFILTRATION_RISK` reason code. |
| **TealRegistry** | Adapter composition allowlist | Restricts which tool/adapter combinations can be loaded together, preventing insecure composite channels. |
| **SDK Design** | Provider-agnostic governance layer | Governance enforced at SDK level, not dependent on provider transport security. All provider clients share same evaluation pipeline. |

**Gaps:** TealTiger does not enforce TLS/mTLS configuration for underlying provider connections — that responsibility remains with the platform/network layer. Wire-level encryption enforcement (e.g., certificate pinning, protocol downgrade detection) is outside the SDK's scope and considered a platform concern. Future versions may add transport security assertions in the Governance Passport.

---

## ASI-05: Insecure Resource Consumption

**Risk:** Agent consumes excessive computational, financial, or API resources (cost abuse, resource exhaustion).

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealMonitor** | Governance-owned budget ceilings | Hard limits per request, session, agent, and day. Cannot be raised by application code. Governance floor enforcement. |
| **TealMonitor** | Cost anomaly detection | Rolling baseline cost-per-request per agent/provider. Flags >10x anomalies with `COST_ANOMALY_DETECTED`. Session cost spikes detected via growth rate thresholds. |
| **TealMonitor** | Reasoning-token budgets | Separate limits for thinking/reasoning tokens (o1/o3 models). `REASONING_TOKEN_BUDGET_EXCEEDED` reason code. |
| **TealMonitor** | Per-agent and per-workflow cost attribution | Cost tracked at agent and workflow level; data exportable to FinOps platforms. |
| **TealCircuit** | Circuit breaker | Prevents cascading failure from runaway cost or retry loops. |
| **TealReliability** | Retry budgets, fallback chains | Limits retry attempts; degrades gracefully instead of consuming unbounded resources. |
| **TealEngine** | Rate limiting | Per-tool and per-agent rate limits configurable in policy. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-05 | Pre-built pack with cost and rate controls. |

**Gaps:** No hard token budget enforcement at the provider API level (TealTiger cannot prevent the provider from streaming tokens beyond a configured limit — it can only block the request before it starts or after output is received). Provider-level token capping is provider-dependent. Real-time mid-stream cost enforcement is a known limitation.

---

## ASI-06: Information Leakage

**Risk:** Sensitive data (PII, secrets, internal context) is exposed through agent inputs, outputs, memory, or logs.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealGuard** | PII detection | Detects email, phone, SSN, credit card, address, IP, username, password, API key. Actions: block, redact, mask, alert. |
| **TealSecrets** | Secret detection | 500+ patterns across 9 categories with confidence scoring. |
| **TealMemory** | Memory write provenance tagging | 5-tier trust classification (direct_user, model_inference, tool_output_internal, tool_output_external, untrusted_document) with transitive propagation. Untrusted sources blocked or require confirmation. |
| **TealGuard** | Content moderation | Blocks toxic, harmful, or inappropriate content in both directions. Pattern-based or OpenAI moderation API. |
| **TealGuard** | Unicode normalization, encoded output detection | Prevents data obfuscation via Unicode tricks or encoding. |
| **TealAudit** | PII-redacted audit logging | Reasoning traces and audit logs have PII/secret patterns redacted before reaching log sinks. |
| **TealGuard** | Multimodal input governance | Extracts text from images/audio/via OCR/transcription; strips metadata; applies text guardrails. |
| **TealState** | Provenance metadata on context entries | Every context entry tracked with source, timestamp, trust tier. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-06 | Pre-built pack with data leak prevention controls. |

**Gaps:** Redaction is pattern-based and may miss novel PII formats or context-specific sensitive data. ML-assisted context-aware redaction is being explored. Cross-agent memory leakage (agent A reads agent B's data via shared memory stores) is not yet governed — scope isolation at the memory adapter layer is planned for v1.5.

---

## ASI-07: Supply Chain Vulnerabilities

**Risk:** Compromised third-party models, tools, MCP servers, or dependencies introduce vulnerabilities.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealRegistry** | MCP definition-drift detection | Stores cryptographic hash of approved tool definitions; blocks invocations where live hash differs from approved hash. `MCP_DEFINITION_DRIFT` reason code. |
| **TealRegistry** | Tool description injection scanning | Scans tool description fields for instruction-injection patterns (Unicode manipulation, imperative verbs, conditional logic). |
| **TealRegistry** | Model/tool allowlisting | `allowedModels`, `blockedModels`, `allowedProviders` in policy. Only approved models and providers can be used. |
| **TealRegistry** | Adapter composition allowlist | Restricts which adapter combinations can be loaded together. `UNAPPROVED_ADAPTER_COMPOSITION` reason code. |
| **TealEngine** | Bundle integrity validation | SHA-256 hash + Ed25519 signature verification on every policy load. Refuses tampered bundles. |
| **TealEngine** | Anti-tamper controls | Rejects forbidden config keys (`disable_enforcement`, `bypass`, `allow_all`, `permissive_mode`). Capability negotiation prevents loading bundles that require unsupported features. |
| **TealEngine** | Capability negotiation | Exports capabilities manifest; refuses bundles requiring features the SDK version does not support. Prevents downgrade attacks. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-07 | Pre-built pack with supply chain controls. |

**Gaps:** No software bill of materials (SBOM) generation or dependency scanning for the agent's runtime environment. Supply chain security for model weights or RAG data sources is not in scope. Integration with external SBOM tooling is planned for v1.5+.

---

## ASI-08: Privilege Escalation & Lateral Movement

**Risk:** Agent exploits permissions or vulnerabilities to gain unauthorized access to systems, data, or other agents.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **NHIGovernance** | Scope enforcement with environment constraints | Agents restricted to declared environments (production/staging/development). `NHI_ENVIRONMENT_VIOLATION` blocks cross-environment movement. |
| **NHIGovernance** | Zero Standing Privilege | JIT grants minimize the window for privilege abuse. Revoked or suspended agents are immediately blocked. |
| **TealEngine** | Identity-based policy rules | Per-agent and per-identity policies with glob matching. Rules evaluated in priority order. |
| **TealMemory** | Trust-tier propagation | Memory from untrusted sources cannot pollute trusted memory stores. `untrusted_document` and `tool_output_external` provenance prevents injection into high-trust contexts. |
| **TealDrift** | Behavioral drift detection | Detects anomalous behavior patterns that may indicate compromised or escalating agents. 5 drift dimensions: actions, tools, content, temporal, errors. |
| **TealEngine** | FREEZE rules | Immutable kill switches can quarantine agents attempting escalation. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-08 | Pre-built pack with privilege escalation prevention. |

**Gaps:** No inter-agent communication governance for multi-agent systems. If agent A delegates a task to agent B, TealTiger cannot yet enforce that B's capabilities are a subset of A's (delegation depth control). Cross-agent delegation governance is planned for v1.5.

---

## ASI-09: Data & Model Integrity

**Risk:** Agent data, model behavior, or training pipeline is tampered with or poisoned.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealProof** | Cryptographic governance receipts | SHA-256 Merkle tree of every decision; RFC 3161 timestamping anchor; Governance Passport with rolling coverage attestation. Tampering detected via `PROOF_CHAIN_INTEGRITY_VIOLATION`. |
| **TealProof** | Verification SDK | Three verification levels: integrity (receipt valid), sufficiency (receipt + trace + policy), appropriateness (all + business context). Negative cases explicitly handled (policy mismatch, stale policy, incomplete coverage). |
| **TealMemory** | Write provenance tagging | 5-tier trust classification prevents untrusted data from corrupting agent memory. |
| **TealMemory** | Memory exfiltration detection | Prevents data-bearing URLs and webhook patterns from being stored. |
| **TealEngine** | Policy integrity validation | Bundle signed with Ed25519; integrity verified on every load; tampered bundles refused. |
| **TealEngine** | Anti-tamper controls | Forbidden config keys rejected. Separation of duties: developers cannot override governance policy. |
| **TealDrift** | Behavioral drift detection | Statistical baselines detect model output regression or behavioral anomalies that may indicate data/model poisoning. |
| **TealGuard** | Encoded output detection | Catches attempts to exfiltrate data via encoding before model output is returned. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-09 | Pre-built pack with integrity controls. |

**Gaps:** TealProof attests to the governance decision chain but not to the model's training data or weights integrity. Model provenance verification (e.g., verifying a model was trained on uncorrupted data) is outside the SDK's scope. For input data integrity, TealTiger relies on the provenance tagging system, which is only as trustworthy as the upstream tool that declares its source class.

---

## ASI-10: Audit & Accountability Gaps

**Risk:** Insufficient logging, monitoring, or evidence prevents detection, investigation, or attribution of agent incidents.

| TealTiger Module | Controls | Mechanism |
|---|---|---|
| **TealAudit** | Structured audit logging | Versioned, PII-redacted governance logs with correlation IDs. TEEC-compatible evidence envelopes. |
| **TealProof** | Cryptographic evidence chain | Every decision has a reconstructable Merkle tree leaf. Periodic RFC 3161 anchoring provides tamper-evident audit trail. Governance Passport per agent. |
| **TealProof** | Verification SDK | Third parties can verify decisions without TealTiger installation. Three verification levels with explicit negative-case results. |
| **SOC Pipeline** | SIEM export (JSON/CEF/LEEF), OTel spans, response hooks | Governance decisions exportable to any SIEM. OpenTelemetry spans for integration with observability platforms. Response hooks with dedup and rate limiting. |
| **TealEngine** | Correlation IDs | End-to-end traceability across the decision chain. Links governance decisions to originating agent request traces. |
| **TealEngine** | Policy traceability | Every verdict traces to the human policy author, policy version, and bundle hash. Policy stalenes warnings if bundle timestamp is too old. |
| **TealFlow** | Workflow audit trails | YAML governance workflows produce structured evidence artifacts for each job/step execution. |
| **TealMonitor** | Cost evidence in TEEC envelopes | Every cost decision (allow/deny/anomaly) produces TEEC evidence with policy version, budget limit, actual cost, remaining budget. |
| **OWASP Policy Pack** | Zero-config policy covering ASI-10 | Pre-built pack with audit and evidence requirements. |

**Gaps:** No built-in support for regulatory compliance packs (PCI-DSS, SOC2, ISO 27001, HIPAA, GDPR) — these are explicitly deferred to v1.4+. Auditors currently need to map TealTiger evidence to specific regulatory controls manually. No automated incident response playbook generation — the SOC pipeline delivers signals but does not orchestrate response actions.

---

## Coverage Summary

| ASI | TealTiger Coverage | Primary Modules | Gaps |
|---|---|---|---|
| ASI-01: Prompt Injection | **Strong** — regex + ML ensemble, Unicode normalization, output encoding detection, custom rules | TealGuard, TealClassifier, TealMemory | Multi-turn injection chains (v1.4) |
| ASI-02: Agent Identity | **Strong** — NHI lifecycle, ZSP, workload identity binding, cryptographic attestation | NHIGovernance, TealEngine, TealRegistry | Cross-org federated identity (v1.5) |
| ASI-03: Excessive Agency | **Strong** — automation levels, FREEZE rules, PLAN_ONLY, granular tool/code/change policies | TealEngine, TealTemporal, TealState | Dynamic scope expansion (v1.5) |
| ASI-04: Insecure Comm. | **Moderate** — exfiltration detection, adapter allowlists | TealGuard, TealMemory, TealRegistry | TLS enforcement outside scope |
| ASI-05: Resource Consumption | **Strong** — governance-owned budgets, anomaly detection, circuit breakers, rate limits | TealMonitor, TealCircuit, TealReliability | Mid-stream provider-level token capping |
| ASI-06: Info Leakage | **Strong** — PII/secrets detection, memory provenance, multimodal guardrails, redacted audit logs | TealGuard, TealSecrets, TealMemory, TealAudit | ML-aware context-sensitive redaction (exploring) |
| ASI-07: Supply Chain | **Strong** — MCP drift detection, model/tool allowlisting, bundle integrity, anti-tamper | TealRegistry, TealEngine | SBOM generation (v1.5+) |
| ASI-08: Privilege Escalation | **Moderate** — scope enforcement, ZSP, drift detection | NHIGovernance, TealDrift, TealEngine | Cross-agent delegation governance (v1.5) |
| ASI-09: Data & Model Integrity | **Strong** — cryptographic receipts, memory provenance, policy integrity | TealProof, TealMemory, TealEngine, TealDrift | Model training data provenance outside scope |
| ASI-10: Audit & Accountability | **Strong** — structured audit, cryptographic evidence chain, SIEM export, correlation IDs | TealAudit, TealProof, SOC Pipeline, TealFlow | Regulatory compliance packs (v1.4+) |

## Key

| Rating | Meaning |
|---|---|
| **Strong** | Multiple dedicated controls; no significant gaps; production-ready |
| **Moderate** | Controls exist but have identified gaps with planned mitigations |
| **Partial** | Some controls available; significant gaps remain |
