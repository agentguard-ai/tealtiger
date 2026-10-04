# Changelog

All notable changes to `tealtiger-mcp` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-10-04

First release since `1.0.0` (2026-09-10). Three user-visible changes had been
merged to `main` without a version bump, so PyPI served a package missing two
tools and a bug fix while both version strings still read `1.0.0`. This release
publishes them and removes the duplicate version string that allowed the drift.

### Added
- **`detect_secrets` tool and `redact_secrets` utility** — merged 2026-09-12
  (`4f2c92a`), never published.
- **Cumulative budget reporting** — merged 2026-09-18 (`c3e7207`), never
  published. Makes `check_budget` meaningful across calls within a process.

### Fixed
- **`list_supported_models` now filters by provider** — merged 2026-09-13
  (`98a3b12`), never published. Previously returned the full model list
  regardless of the provider argument.
- **`__version__` can no longer disagree with the published version.** It was
  hardcoded in `src/tealtiger_mcp/__init__.py` as a second copy of the
  `version` field in `pyproject.toml`; it now derives from
  `importlib.metadata`. This is the same defect, and the same fix, as the
  `tealtiger` core in 1.5.0, where PyPI served 1.4.1 while the package
  reported 1.4.0.
- Removed two unused `typing` imports (`Dict`, `Optional`) from
  `secret_detection.py`. These were the sole reason the package's `ruff` CI step
  ran as `ruff check . || true`; the step is now blocking again.

### Changed
- **Core dependency floor raised to `tealtiger>=1.5.0`** (from `>=1.4.0`).

  Verified against 1.5.0 before raising: the 35-test suite passes, and neither
  behaviour change in that release reaches this server.
  `PIIDetectionGuardrail` is constructed without `detect_types`, so 1.5.0's new
  `ValueError` on unknown types cannot fire here, and `PolicyTester` — whose
  stub now raises `NotImplementedError` instead of returning an unconditional
  `allow` — is not imported by this package.

  1.5.0 also makes `tealtiger.integrations` importable at all, which 1.4.x did
  not.

### Release process
- Added `.github/workflows/publish-tealtiger-mcp.yml`. `1.0.0` was published by
  hand with no tests, no lint, and no check that the tag matched the package
  version — the same gap that let the core's PyPI version drift away from its
  repository. Releases now run lint and tests, verify the tag against
  `pyproject.toml`, check README rendering with `twine check --strict`, and
  confirm the built wheel reports the version being released before uploading.

### Known limitations
- Governance coverage is a subset of the `tealtiger` core. Policy evaluation
  (`TealEngine`), policy authoring/validation, audit, circuit breaking and
  governed provider clients are not exposed as tools. See
  `mcp-server-feasibility.md` for the capability assessment; two of the seven
  core capabilities are not reachable through a stateless request/response
  protocol at all.
- Cost tracking uses `InMemoryCostStorage`, so accumulated spend does not
  survive process restart and is not shared between clients.
- Secret detection is implemented locally in this package rather than taken
  from the core, which has its own implementation, as does the TypeScript SDK.
  Three implementations of one idea, free to drift.
- `mcp` is pinned `>=1.0.0,<2`. The 2.x line renamed `FastMCP` to `MCPServer`
  and dropped `mcp.server.fastmcp`; that migration is tracked separately.

## [1.0.0] - 2026-09-10

Initial release. MCP server exposing TealTiger guardrails, cost estimation and
budget checks as tools, with 9 tools published.
