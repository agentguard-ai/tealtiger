# Changelog

All notable changes to TealTiger will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-05-04

### Added — Governance Bundle
- **TealEngineV12** — Parallel module evaluation with "most restrictive action wins" merge and fail-closed defaults
- **TealSecrets** — Secret detection with 500+ patterns across 9 categories with confidence scoring
- **TealRegistry** — Model/tool allowlisting with provenance verification
- **TealReliability** — Retry budgets, circuit breakers, and fallback chains
- **TealMemory** — Memory governance (5 scopes, 4 classifications)
- **GovernanceDashboard** — Governance visibility UI
- **BundleExporter** — Evidence export (SARIF v2.1.0, JUnit XML, JSON)
- **TEECValidator** — Typed Evidence & Evidence Contract validation
- **Docker Sidecar** — Language-agnostic HTTP governance API for TypeScript and Python

### Added — Infrastructure
- Serverless optimizations (lazy loading, cold start optimization, config caching)
- Rollup build with tree-shakeable ESM + CJS bundles
- Helm chart v1.2.0 with governance module configuration
- v1.2.0 launch workflow (npm, PyPI, Docker, Helm, GitHub Release)

### Changed
- README rewritten with v1.2 features, Docker sidecar quick start, and integrations table
- SDK Repositories table expanded to include Helm Charts and GitHub Action

### Distribution
- npm: `tealtiger@1.2.0`
- PyPI: `tealtiger==1.2.0`
- Docker Hub: `tealtigeradmin/tealtiger-typescript:1.2.0-governance`, `tealtigeradmin/tealtiger-python:1.2.0-sidecar`
- GHCR: `ghcr.io/agentguard-ai/tealtiger-typescript:1.2.0-governance`
- Helm: `tealtiger` chart v1.2.0

## [1.1.1] - 2026-04-03

### Fixed
- README rewritten to accurately reflect all features included in v1.1.0
- Removed misleading enterprise comparison tables
- License updated from MIT to Apache 2.0

### Notes
- No code changes — documentation and metadata only

## [1.1.0] - 2026-03-15

### Added
- **TealEngine** — Deterministic policy evaluation (ENFORCE, MONITOR, REPORT_ONLY)
- **TealGuard** — Client-side security guardrails (PII, prompt injection, content moderation)
- **TealCircuit** — Circuit breaker for cascading failure prevention
- **TealAudit** — Versioned audit logging with PII redaction
- **Correlation IDs** — Auto-generated UUID v4 with OpenTelemetry-compatible trace IDs
- **Decision Contract** — Typed Decision object with risk scores and reason codes
- **Policy Test Harness** — CLI/library test runner with JUnit XML export
- **Multi-Provider Support** — 7 providers (OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral)
- **OWASP Coverage** — 7/10 ASIs covered with SDK-only architecture

## [0.2.2] - 2026-01-31

### Added
- Cost tracking and budget management
- Guarded AI clients (OpenAI, Anthropic, Azure OpenAI)
- Azure OpenAI deployment-based routing

## [0.2.0] - 2026-01-30

### Added
- Client-side guardrails (PII detection, prompt injection, content moderation)

## [0.1.0] - 2026-01-28

### Added
- Initial release (as AgentGuard)
- Core security evaluation, policy enforcement, audit trail

[Unreleased]: https://github.com/agentguard-ai/tealtiger/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/agentguard-ai/tealtiger/releases/tag/v1.2.0
[1.1.1]: https://github.com/agentguard-ai/tealtiger/releases/tag/v1.1.1
[1.1.0]: https://github.com/agentguard-ai/tealtiger/releases/tag/v1.1.0
[0.2.2]: https://github.com/agentguard-ai/tealtiger/releases/tag/v0.2.2
[0.2.0]: https://github.com/agentguard-ai/tealtiger/releases/tag/v0.2.0
[0.1.0]: https://github.com/agentguard-ai/tealtiger/releases/tag/v0.1.0
