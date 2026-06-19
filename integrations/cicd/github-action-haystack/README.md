# TealTiger Haystack Pipeline Security Scan — GitHub Action

AST-scans Haystack pipeline Python files in pull requests for un-guarded LLM generators
and unbounded agent loops that can cause runaway API costs.
Findings are posted as a PR comment with specific fix suggestions.

## Quickstart

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: agentguard-ai/tealtiger/integrations/cicd/github-action-haystack@main
```

The action scans all Python files in the repository, detects Haystack pipelines
that lack TealTiger governance, and posts a comment on the PR if any warnings are found.

## What it detects

| Check | What it finds | Default |
|---|---|---|
| `unguarded-generator` | `OpenAIGenerator`, `AnthropicChatGenerator`, or any Haystack LLM generator used without a TealTiger guard (`TealGovernance`, `BudgetManager`, `PIIDetectionGuardrail`, ...) | enabled |
| `agent-loop` | `while True:` loops that call `pipeline.run()` without a budget guard or circuit breaker — a common source of runaway API spend | enabled |

### Example PR comment

> **Potential unguarded LLM generator** at line 42: `OpenAIGenerator` is used
> without a TealTiger governance component. This pipeline has no cost cap, PII protection,
> or prompt-injection defence.
>
> **Fix:** Wrap `OpenAIGenerator` with a `TealGovernance` component, or add `BudgetManager`
> + `PIIDetectionGuardrail` before the generator.
> See recipe: [examples/haystack-governance/main.py](../../../examples/haystack-governance/main.py)

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | File or directory to scan |
| `checks` | `all` | Comma-separated checks to run (`unguarded-generator`, `agent-loop`), or `all` |
| `fail-on-warning` | `false` | Exit code 1 when warnings are found |
| `post-comment` | `true` | Post findings as a PR comment (requires `pull-requests: write` permission) |

## Outputs

| Output | Description |
|---|---|
| `warnings` | Number of warnings found (`0` means clean) |
| `report` | JSON array of all findings (file, line, check, message, fix) |

## Full example workflow

```yaml
name: TealTiger Haystack Security Scan

on:
  pull_request:
    branches: [main]
    paths: ['**.py']

permissions:
  contents: read
  pull-requests: write

jobs:
  haystack-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - uses: agentguard-ai/tealtiger/integrations/cicd/github-action-haystack@main
        id: scan
        with:
          path: '.'
          checks: 'all'
          fail-on-warning: 'false'

      - run: echo "Warnings found ${{ steps.scan.outputs.warnings }}"
```

## Disabling a specific check

```yaml
- uses: agentguard-ai/tealtiger/integrations/cicd/github-action-haystack@main
  with:
    checks: 'unguarded-generator'   # skip agent-loop
```

## Running locally

```bash
# Human-readable (default)
python integrations/cicd/github-action-haystack/scan.py --path ./src

# Machine-parseable JSON
python integrations/cicd/github-action-haystack/scan.py --path ./src --output-format json

# SARIF for GitHub code scanning upload
python integrations/cicd/github-action-haystack/scan.py --path ./src --output-format sarif
```

## Running tests

```bash
cd integrations/cicd/github-action-haystack
python -m pytest tests/ -v
```
