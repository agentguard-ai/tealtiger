# Changelog

All notable changes to TealTiger are documented in this file.

## [1.3.0] — 2026-06 — Autonomous Agent Governance

### Added

**Core Engine**
- TealEngine v1.3 with pre/post evaluation pipeline
- FREEZE rules — immutable, non-overridable safety controls
- Automation levels (auto_allow, auto_deny, auto_sanitize, approval_required)
- PLAN_ONLY mode — dry-run evaluation without enforcement
- Policy bundle hot-swap with Ed25519 signature verification
- Anti-tamper controls (forbidden config keys, bundle integrity, workload identity binding)

**New Governance Domains**
- **Identity (NHI)** — Non-human identity lifecycle, scope enforcement, Zero Standing Privilege, JIT grants, agent attestation
- **Workflow (FLOW)** — Declarative YAML governance workflows, job dependencies, org-level inheritance, floor enforcement
- **Temporal (TEMP)** — Session TTL, cooldown periods, time-of-day restrictions, context size governance
- **Drift (DRIFT)** — Behavioral drift detection, statistical baselines, MCP definition-drift monitoring

**New Modules**
- TealProof — Cryptographic governance receipts (Merkle tree + RFC 3161 timestamping), Governance Passport, Verification SDK
- TealFlow — YAML workflow parser, execution engine, pretty printer with round-trip guarantee
- TealClassifier — Local ONNX inference, 4 ensemble modes, confidence scoring, fallback behavior
- TealDrift — Rolling baselines, 5 drift dimensions, min_samples guard
- TealState — Token-based context limits, provenance metadata, eviction strategies
- TealTemporal — Session TTL, cooldowns, time-of-day restrictions, rate limiting
- TealMonitor v2 — Governance-owned cost ceilings, reasoning-token budgets, anomaly detection, per-agent attribution
- NHI Governance — Agent lifecycle states, scope enforcement, JIT grants, attestation

**Platform Adapters**
- AWS Bedrock Agents adapter (Lambda Layer / sidecar)
- AWS AgentCore plugin (lifecycle governance hooks)
- Azure AI Agent Service middleware (tool-call pipeline)

**Governance Features**
- OWASP Agentic Top 10 Policy Pack (zero-config, ASI-01 through ASI-10)
- SOC/IR evidence pipeline (SIEM export in JSON/CEF/LEEF, OpenTelemetry spans, response hooks)
- Code change governance (CODE_CHANGE action class, path/branch allowlists, two-person rule)

**Providers**
- DeepSeek
- Groq
- Together AI
- xAI (Grok)
- HuggingFace TGI

**Evidence**
- TEEC v2.0.0 envelope (NHI identity, proof, provenance, verification level, cost evidence, control ID, OWASP category)
- Governance Event Schema v1.0.0

### Enhanced
- TealGuard — Unicode normalization, encoded output detection, control character sanitization, markdown exfiltration detection
- TealMemory — Write provenance tagging (5-tier trust), instruction injection detection, exfiltration detection
- TealRegistry — MCP definition-drift monitoring, tool description injection scanning, adapter composition allowlist

### Fixed
- Version string assertions in TealCircuit and TealEngine tests (1.1.1 → 1.2.0)
- Stripe secret key detection regex threshold (24+ chars)
- TealMemory secret detection in SUMMARY_ONLY policy path

### Compatibility
- Backward-compatible with v1.2.x — no breaking changes
- `evaluateV12()` preserved for existing code
- All v1.2 policy configurations produce identical behavior

---

## [1.2.0] — 2026-05 — Governance Bundle

### Added
- TealEngineV12 — Parallel module evaluation with "most restrictive action wins" merge
- TealSecrets — Secret detection (500+ patterns, 9 categories, confidence scoring)
- TealRegistry — Model/tool allowlisting with provenance verification
- TealReliability — Retry budgets, circuit breakers, fallback chains
- TealMemory — Memory governance (5 scopes, 4 classifications)
- GovernanceDashboard — Governance visibility UI
- BundleExporter — SARIF v2.1.0, JUnit XML, JSON evidence export
- Docker governance sidecar (language-agnostic HTTP API)
- TEEC v1.0 evidence contract (32 reason codes, 18 event types, 12 decision actions)

---

## [1.1.1] — 2026-04 — Stability & Multi-Provider Parity

### Added
- Python SDK feature parity with TypeScript (7/7 providers)
- Documentation fixes and Apache 2.0 license update

---

## [1.1.0] — 2026-03 — Foundation Release

### Added
- TealEngine — Deterministic policy evaluation
- TealGuard — PII detection, prompt injection, content moderation
- TealMonitor — Cost tracking and budget management
- TealCircuit — Circuit breaker for failure isolation
- TealAudit — Audit logging with correlation IDs
- 7 LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral)
- Policy test harness with JUnit XML export
- Three policy modes (ENFORCE, MONITOR, REPORT_ONLY)
