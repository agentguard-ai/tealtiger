# Changelog

All notable changes to `langchain-tealtiger` will be documented in this file.

## [0.1.0] — 2026-06-05

### Added

- `TealTigerMiddleware` class implementing LangChain's `AgentMiddleware` interface
- `wrap_tool_call` hook for deterministic governance at every tool boundary
- Tool allowlist/blocklist policy enforcement
- FREEZE rules (immutable deny, always enforced regardless of mode)
- Cost limit tracking (per-session)
- Rate limit enforcement (max calls per window)
- Three governance modes: ENFORCE, MONITOR, REPORT_ONLY
- Session summary with decision counts and cost tracking
- Full evidence trail with correlation IDs and evaluation timing
- `before_agent` / `after_agent` lifecycle hooks for session management
- `after_model` hook placeholder for PII detection (v0.2.0)
- Type-safe API with full type annotations
- Comprehensive test suite
