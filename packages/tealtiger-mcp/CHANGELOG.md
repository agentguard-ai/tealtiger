# Changelog

All notable changes to `tealtiger-mcp` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

## [1.2.0] - 2026-11-27

Adds policy decisions — the capability the governance capability floor calls G1, and the
largest gap between this server and the SDK it wraps. Coverage goes from roughly 1.5 of 7
capabilities to 2.5.

### Added

- **`evaluate_action`** — evaluate an action against the server's configured
  **tool-allowlist** policy. Returns the decision, the standardized reason codes, and
  `triggering_clause`: the policy clause that produced it. The clause is the field worth
  reading, because it separates a decision that was reasoned from one that merely
  coincided. A tool absent from the policy denies as `tools.<name>.absent`; a tool
  configured `allowed: false` denies as `tools.<name>.allowed`. Same verdict, different
  policy facts.

- **`policy_status`** — which rule types this server enforces, and whether its policy
  loaded. Answerable **without evaluating anything**, so a client can discover the limits
  of the governance on offer before depending on them, rather than on the first request
  that mattered.

### Three design decisions worth stating plainly

**The policy comes from the server, never from the tool call.** Configure it with
`TEALTIGER_MCP_POLICY_FILE`, pointing at a JSON policy document. There is no `policy`
argument, deliberately: in an MCP deployment the client is the agent being governed, so a
per-call policy would let it choose the rules it is judged by. That is not a more flexible
form of governance, it is the absence of governance wearing its shape.

Note that the MCP layer *silently discards* arguments a tool does not declare, so a
smuggled `policy` produces no error. The server's policy governs regardless — verified by
test, because "the framework ignores it" is the kind of claim that quietly stops being
true on a dependency upgrade. Every decision also reports `policy_source` and
`policy_file`, so a caller that passed its own policy and got an `ALLOW` cannot mistake it
for its own policy having been applied.

**Tool allowlist only, and a policy we cannot enforce is refused.** Every other rule type
is UNSPECIFIED in v0.1 of the policy conformance specification, so none is implemented and
none is claimed. A policy configuring one means the server **will not start** and
`evaluate_action` **will not answer**. Enforcing the sections we understand while ignoring
the rest would return an `ALLOW` the policy did not earn — the defect the SDK removed in
1.6.0 and 1.7.0, reintroduced one layer out.

**The decision is advisory, and the tools say so.** This server returns verdicts; it
cannot intercept the client's actions. A caller that ignores a `DENY` proceeds anyway. The
feasibility assessment used exactly this reasoning to rule out exposing circuit breaking
over MCP — "weak governance wearing the costume of governance" — and the same limit applies
here in weaker form. Both tools carry `enforcement_is_advisory: true` rather than leaving a
caller to infer a control point that does not exist.

### Changed

- **Core dependency floor raised to `tealtiger>=1.7.0`**, and this one is a hard
  requirement rather than a verified-compatible bump. `evaluate_action` reads
  `Decision.triggering_clause` and calls `TealEngine.rule_type_support()` and
  `unenforceable_sections()`, none of which exist before 1.7.0 — and on 1.6.x the engine
  raises for every policy, so the tool could not work at all.

  Tool-allowlist enforcement in the Python SDK arrived in 1.7.0 and is verified 16/16
  against the shared conformance corpus. This server inherits that result; it adds no
  evaluation logic of its own.

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
