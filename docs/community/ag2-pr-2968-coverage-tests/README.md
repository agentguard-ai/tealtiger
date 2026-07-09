# AG2 PR #2968 — Coverage Fix Tests

These test files should be added to the ag2 fork at:
```
test/beta/extensions/tealtiger/test_middleware_coverage.py
test/beta/extensions/tealtiger/test_init_import_guard.py
```

## Purpose

Address the Codecov report showing:
- `middleware.py`: 76.70% (35 missing + 6 partials)
- `__init__.py`: 38.46% (8 missing)

Target: raise both files to 90%+ patch coverage.

## What's Covered

### test_middleware_coverage.py (30+ tests)
- `on_turn()` freeze path — GovernanceDenyError in ENFORCE mode
- `on_turn()` normal pass-through
- `on_tool_execution()` — tool_denylist policy
- `on_tool_execution()` — secret_detection policy (OpenAI, GitHub, AWS, Slack)
- `on_tool_execution()` — cost_limit enforcement (over/under budget)
- `on_tool_execution()` — OBSERVE mode (allow + receipt)
- `on_tool_execution()` — MONITOR mode (allow + log warning)
- `on_tool_execution()` — ENFORCE mode (block + receipt)
- `on_tool_execution()` — frozen agent blocks tool call
- `freeze()`/`unfreeze()`/`is_frozen()` public API
- `_extract_tool_args()` — arguments, args, empty
- `_detect_pii()` — SSN, credit card, email, dict args, unknown category
- `_detect_secrets()` — all 4 patterns + no false positives
- `_matches_patterns()` — exact, glob, no match
- `GovernanceDenyError` — message and decision_id

### test_init_import_guard.py (4 tests)
- Successful import exposes all symbols
- __all__ matches expected exports
- Import guard uses sentinel when tealtiger is missing
- Sentinel raises on instantiation

## How to Apply

```bash
cd /path/to/agentguard-ai/ag2
git checkout feat/tealtiger-governance-middleware
cp test_middleware_coverage.py test/beta/extensions/tealtiger/
cp test_init_import_guard.py test/beta/extensions/tealtiger/
git add test/beta/extensions/tealtiger/test_middleware_coverage.py
git add test/beta/extensions/tealtiger/test_init_import_guard.py
git commit -m "test(beta/extensions): add coverage tests for TealTiger middleware"
```

Then rebase on latest main:
```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin feat/tealtiger-governance-middleware
```
