# TealTiger Security Scan — GitLab CI Template

Run TealTiger AI security guardrails (PII detection, prompt injection, content moderation) and policy tests in your GitLab CI/CD pipelines.

## Quickstart

Add the following to your `.gitlab-ci.yml`:

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/integrations/cicd/gitlab-ci/.gitlab-ci.yml'

variables:
  TEALTIGER_SCAN_PATH: ./prompts
```

This adds two jobs to the `test` stage:

- `tealtiger-scan` — runs guardrail scans and produces JUnit + Code Quality reports
- `tealtiger-policy-test` — runs policy tests (only when `TEALTIGER_POLICY_FILE` is set)

## CI/CD Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TEALTIGER_SCAN_PATH` | **Yes** | — | Directory or file glob containing prompts or text to scan |
| `TEALTIGER_GUARDRAILS` | No | `pii,prompt-injection,content-moderation` | Comma-separated list of guardrails to enable |
| `TEALTIGER_SENSITIVITY` | No | `medium` | Scan sensitivity level (`low`, `medium`, `high`) |
| `TEALTIGER_POLICY_FILE` | No | `""` | Path to a TealTiger policy configuration file |
| `TEALTIGER_FAIL_ON_FINDING` | No | `true` | Fail the job when a guardrail violation is detected |

## Artifacts

### JUnit Report

The `tealtiger-scan` and `tealtiger-policy-test` jobs produce JUnit XML reports that integrate with GitLab's test reporting UI. Results appear in the merge request **Tests** tab.

### Code Quality Report

The `tealtiger-scan` job produces a Code Quality JSON report compatible with GitLab Code Quality. Findings appear as inline annotations in merge request diffs.

## Usage Examples

### Basic Scan

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/integrations/cicd/gitlab-ci/.gitlab-ci.yml'

variables:
  TEALTIGER_SCAN_PATH: ./src
```

### Custom Guardrails and Sensitivity

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/integrations/cicd/gitlab-ci/.gitlab-ci.yml'

variables:
  TEALTIGER_SCAN_PATH: ./prompts
  TEALTIGER_GUARDRAILS: pii,prompt-injection
  TEALTIGER_SENSITIVITY: high
```

### Policy Testing with Code Quality

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/integrations/cicd/gitlab-ci/.gitlab-ci.yml'

variables:
  TEALTIGER_SCAN_PATH: ./src
  TEALTIGER_POLICY_FILE: ./tealtiger-policy.yml
  TEALTIGER_FAIL_ON_FINDING: "false"
```

### Non-Blocking Scan

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/agentguard-ai/tealtiger/main/integrations/cicd/gitlab-ci/.gitlab-ci.yml'

variables:
  TEALTIGER_SCAN_PATH: ./src
  TEALTIGER_FAIL_ON_FINDING: "false"
```

## How It Works

This template uses the official TealTiger Docker image (`tealtigeradmin/tealtiger-docker:latest`) and invokes the shared `tealtiger-scan.sh` entrypoint script. Each CI/CD variable is mapped to a `TEALTIGER_*` environment variable consumed by the entrypoint.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Scan passed — no violations found, or `TEALTIGER_FAIL_ON_FINDING` is `false` |
| `1` | Scan found violations and `TEALTIGER_FAIL_ON_FINDING` is `true` |
| `2` | Invalid configuration (missing scan path, invalid sensitivity, etc.) |

## License

Apache 2.0 — see [LICENSE](./LICENSE).
