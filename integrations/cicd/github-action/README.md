# TealTiger Security Scan — GitHub Action

Run TealTiger AI security guardrails (PII detection, prompt injection, content moderation) and policy tests directly in your GitHub Actions workflow.

## Quickstart

```yaml
name: TealTiger Security Scan
on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run TealTiger Scan
        uses: agentguard-ai/tealtiger-action@v1
        with:
          scan-path: ./prompts
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `scan-path` | **Yes** | — | Directory or file glob containing prompts or text to scan |
| `guardrails` | No | `pii,prompt-injection,content-moderation` | Comma-separated list of guardrails to enable |
| `sensitivity` | No | `medium` | Scan sensitivity level (`low`, `medium`, `high`) |
| `policy-file` | No | `""` | Path to a TealTiger policy configuration file |
| `fail-on-finding` | No | `true` | Fail the workflow when a guardrail violation is detected |
| `report-format` | No | `json` | Report output format (`json`, `junit`, `sarif`) |

## Outputs

| Output | Description |
|---|---|
| `report` | Path to the generated scan report file |
| `findings-count` | Number of guardrail violations found |
| `passed` | Whether the scan passed (`true` or `false`) |

## Usage Examples

### Basic Scan

```yaml
- name: Run TealTiger Scan
  uses: agentguard-ai/tealtiger-action@v1
  with:
    scan-path: ./src
```

### Custom Guardrails and Sensitivity

```yaml
- name: Run TealTiger Scan
  uses: agentguard-ai/tealtiger-action@v1
  with:
    scan-path: ./prompts
    guardrails: pii,prompt-injection
    sensitivity: high
```

### Policy Testing with SARIF Upload

```yaml
- name: Run TealTiger Scan
  id: tealtiger
  uses: agentguard-ai/tealtiger-action@v1
  with:
    scan-path: ./prompts
    policy-file: ./tealtiger-policy.yml
    report-format: sarif
    fail-on-finding: "false"

- name: Upload SARIF to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ./tealtiger-report/scan-report.sarif
```

### Non-Blocking Scan

```yaml
- name: Run TealTiger Scan (non-blocking)
  uses: agentguard-ai/tealtiger-action@v1
  with:
    scan-path: ./src
    fail-on-finding: "false"
```

## How It Works

This action uses the official TealTiger Docker image (`tealtigeradmin/tealtiger-docker`) and delegates scan execution to the shared `tealtiger-scan.sh` entrypoint script. Each input is mapped to a `TEALTIGER_*` environment variable consumed by the entrypoint.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Scan passed — no violations found, or `fail-on-finding` is `false` |
| `1` | Scan found violations and `fail-on-finding` is `true` |
| `2` | Invalid configuration (missing scan path, invalid sensitivity, etc.) |

## License

Apache 2.0 — see [LICENSE](./LICENSE).
