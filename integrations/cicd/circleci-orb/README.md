# TealTiger Security Scan — CircleCI Orb

Run TealTiger AI security guardrails (PII detection, prompt injection, content moderation) and policy tests in your CircleCI pipelines.

## Quickstart

```yaml
version: 2.1

orbs:
  tealtiger: agentguard-ai/tealtiger@1.0

workflows:
  security:
    jobs:
      - tealtiger/full-scan:
          scan-path: ./prompts
```

## Executor

| Name | Image | Description |
|---|---|---|
| `tealtiger` | `tealtigeradmin/tealtiger-docker:latest` | Official TealTiger Docker image |

## Commands

### `scan`

Run TealTiger guardrail scan against a target directory or file glob.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `scan-path` | string | (required) | Directory or file glob to scan |
| `guardrails` | string | `pii,prompt-injection,content-moderation` | Comma-separated guardrails to enable |
| `sensitivity` | enum | `medium` | Sensitivity level (`low`, `medium`, `high`) |
| `fail-on-finding` | boolean | `true` | Fail step on guardrail violation |
| `report-format` | enum | `json` | Report format (`json`, `junit`, `sarif`) |

### `policy-test`

Run TealTiger policy tests against a policy configuration file.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `policy-file` | string | (required) | Path to policy configuration file |

## Jobs

### `full-scan`

Combines `scan` and `policy-test` commands into a single job using the `tealtiger` executor. Accepts all parameters from both commands.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `scan-path` | string | (required) | Directory or file glob to scan |
| `guardrails` | string | `pii,prompt-injection,content-moderation` | Comma-separated guardrails to enable |
| `sensitivity` | enum | `medium` | Sensitivity level (`low`, `medium`, `high`) |
| `fail-on-finding` | boolean | `true` | Fail job on guardrail violation |
| `report-format` | enum | `json` | Report format (`json`, `junit`, `sarif`) |
| `policy-file` | string | `""` | Path to policy configuration file (optional) |

## Usage Examples

### Basic Scan

```yaml
version: 2.1
orbs:
  tealtiger: agentguard-ai/tealtiger@1.0
workflows:
  security:
    jobs:
      - tealtiger/full-scan:
          scan-path: ./src
```

### Custom Guardrails and Sensitivity

```yaml
version: 2.1
orbs:
  tealtiger: agentguard-ai/tealtiger@1.0
workflows:
  security:
    jobs:
      - tealtiger/full-scan:
          scan-path: ./prompts
          guardrails: pii,prompt-injection
          sensitivity: high
```

### Scan with Policy Testing

```yaml
version: 2.1
orbs:
  tealtiger: agentguard-ai/tealtiger@1.0
workflows:
  security:
    jobs:
      - tealtiger/full-scan:
          scan-path: ./src
          policy-file: ./tealtiger-policy.yml
          fail-on-finding: false
```

### Using Commands Directly

```yaml
version: 2.1
orbs:
  tealtiger: agentguard-ai/tealtiger@1.0
jobs:
  custom-scan:
    executor: tealtiger/tealtiger
    steps:
      - checkout
      - tealtiger/scan:
          scan-path: ./prompts
          sensitivity: high
      - tealtiger/policy-test:
          policy-file: ./tealtiger-policy.yml
workflows:
  security:
    jobs:
      - custom-scan
```

## How It Works

This orb uses the official TealTiger Docker image (`tealtigeradmin/tealtiger-docker`) and invokes the shared `tealtiger-scan.sh` entrypoint script. Each parameter is mapped to a `TEALTIGER_*` environment variable consumed by the entrypoint. Scan results are stored as CircleCI test results and artifacts.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Scan passed — no violations found, or `fail-on-finding` is `false` |
| `1` | Scan found violations and `fail-on-finding` is `true` |
| `2` | Invalid configuration (missing scan path, invalid sensitivity, etc.) |

## License

Apache 2.0 — see [LICENSE](./LICENSE).
