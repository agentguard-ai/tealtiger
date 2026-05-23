# Troubleshooting Guide

Common issues when installing, configuring, and running TealTiger across both the TypeScript and Python SDKs.

## Table of Contents

1. [Installation and Setup Errors](#installation-and-setup-errors)
2. [API Key Configuration Issues](#api-key-configuration-issues)
3. [Provider Connection Problems](#provider-connection-problems)
4. [Guardrail Configuration Mistakes](#guardrail-configuration-mistakes)
5. [Budget and Cost Tracking Issues](#budget-and-cost-tracking-issues)
6. [TypeScript SDK Specific Problems](#typescript-sdk-specific-problems)
7. [Python SDK Specific Problems](#python-sdk-specific-problems)
8. [CI/CD Integration Issues](#cicd-integration-issues)
9. [Enabling Debug Logging](#enabling-debug-logging)
10. [Getting Help](#getting-help)

---

## Installation and Setup Errors

### npm install fails with permission errors

**Symptom:**
```
npm ERR! Error: EACCES: permission denied, access '/usr/local/lib/node_modules'
```

**Root cause:** Global npm install without sufficient permissions.

**Solution:** Use a local install or fix permissions:

```bash
# Option 1: Install locally (recommended)
npm install tealtiger

# Option 2: Fix npm permissions
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g tealtiger
```

### pip install fails with build errors

**Symptom:**
```
ERROR: Failed building wheel for tealtiger
```

**Root cause:** Missing build dependencies or incompatible Python version.

**Solution:**

```bash
# Ensure Python 3.10+
python --version

# Upgrade pip and setuptools
pip install --upgrade pip setuptools wheel

# Install with their dependencies
pip install tealtiger

# On Debian/Ubuntu systems, install build tools
sudo apt-get install python3-dev build-essential
```

### Version mismatch between hub and SDK repos

**Symptom:**
```
Error: TealTiger SDK version 1.2.0 does not match registry version 1.3.0
```

**Root cause:** The hub repo version differs from the SDK source submodule.

**Solution:** Ensure you are using compatible releases:

```bash
# Check installed version
npm list tealtiger       # TypeScript
pip show tealtiger       # Python

# Align with the hub release tag
# See https://github.com/agentguard-ai/tealtiger/releases
```

### Node.js or Python version not supported

**Symptom:**
```
TypeScript: Error: The engine "node" is incompatible with this module
Python: RuntimeError: Python 3.9 or higher is required
```

**Root cause:** Incompatible runtime version.

**Solution:**

| SDK | Minimum Version | Recommended Version |
|-----|----------------|-------------------|
| TypeScript | Node.js 18 | Node.js 20 LTS |
| Python | Python 3.10 | Python 3.12 |

```bash
# Use nvm for Node.js
nvm install 20 && nvm use 20

# Use pyenv for Python
pyenv install 3.12 && pyenv global 3.12
```

---

## API Key Configuration Issues

### "No API key provided" error

**Symptom:**
```
TealConfigError: No API key provided for provider 'openai'
```

**Root cause:** API key not set in environment or constructor.

**Solution:**

```typescript
// TypeScript
import { TealOpenAI } from 'tealtiger';

// Option 1: Environment variable
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Option 2: Explicit key
const client = new TealOpenAI({
  apiKey: 'sk-...',
});
```

```python
# Python
from tealtiger import TealOpenAI

# Option 1: Environment variable
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
)

# Option 2: Explicit key
client = TealOpenAI(
    api_key="sk-...",
)
```

### Invalid API key format

**Symptom:**
```
Error: 401 Authentication error
```

**Root cause:** The API key is malformed, expired, or belongs to a different provider.

**Solution:**

Verify the key format matches the provider:

| Provider | Key Prefix | Expected Length |
|----------|-----------|----------------|
| OpenAI | `sk-` | 51 or 164 chars |
| Anthropic | `sk-ant-` | 108 chars |
| Azure OpenAI | — | 32 chars (alphanumeric) |
| Gemini | `AIza` | 39 chars |

```bash
# Check key format
echo $OPENAI_API_KEY | head -c 20

# Verify key length
echo $OPENAI_API_KEY | wc -c
```

### Azure OpenAI requires endpoint + deployment name

**Symptom:**
```
Error: Azure OpenAI requires both 'endpoint' and 'deployment' or 'deploymentId'
```

**Root cause:** Missing required Azure-specific configuration fields.

**Solution:**

```typescript
// TypeScript
const client = new TealAzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: 'gpt-4',       // or use deploymentId
  apiKey: process.env.AZURE_OPENAI_KEY,
});
```

```python
# Python
client = TealAzureOpenAI(
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    deployment="gpt-4",
    api_key=os.getenv("AZURE_OPENAI_KEY"),
)
```

The endpoint format is: `https://<resource>.openai.azure.com/`

---

## Provider Connection Problems

### Connection timeout

**Symptom:**
```
Error: Timeout: request to https://api.openai.com/v1/chat/completions timed out
```

**Root cause:** Network connectivity issues, firewall rules, or proxy configuration.

**Solution:**

```bash
# Test connectivity
curl -I https://api.openai.com/v1/models
curl -I https://api.anthropic.com/v1/messages

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
echo $NO_PROXY
```

Configure a custom timeout:

```typescript
// TypeScript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,  // 30 seconds
});
```

```python
# Python
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=30.0,
)
```

### Rate limited by provider

**Symptom:**
```
Error: 429 Too Many Requests
```

**Root cause:** Exceeded the provider's rate limit.

**Solution:**

```typescript
// TypeScript - enable circuit breaker
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  circuitBreaker: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,  // 1 second base delay
  },
});
```

```python
# Python
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    circuit_breaker={
        "enabled": True,
        "max_retries": 3,
        "retry_delay": 1.0,
    },
)
```

The SDK uses exponential backoff with jitter. If rate limits persist, reduce request concurrency or upgrade your provider tier.

### Invalid model name

**Symptom:**
```
Error: 404 - The model `gpt-5` does not exist
```

**Root cause:** Model name does not match the provider's available models.

**Solution:** Check the model identifier against the provider's model list:

```bash
# List available OpenAI models
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

For Azure OpenAI, the model is determined by the deployment name, not the model name parameter.

### AWS Bedrock credential errors

**Symptom:**
```
Error: Unable to locate credentials for Bedrock
```

**Root cause:** AWS credentials not configured for Bedrock access.

**Solution:**

```bash
# Configure AWS credentials
aws configure

# Verify
aws sts get-caller-identity

# Ensure the IAM role has bedrock:InvokeModel permission
```

```typescript
// TypeScript
const client = new TealBedrock({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

---

## Guardrail Configuration Mistakes

### PII detection not catching known patterns

**Symptom:** PII like email addresses or phone numbers pass through without redaction.

**Root cause:** PII detection is disabled or configured with insufficient sensitivity.

**Solution:**

```typescript
// TypeScript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: {
      enabled: true,
      sensitivity: 'high',              // low, medium, high
      redactMode: 'hash',               // hash, mask, remove
      customPatterns: [                  // optional custom regex
        { name: 'employee-id', pattern: /E-\d{6}/ },
      ],
    },
  },
});
```

```python
# Python
client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": {
            "enabled": True,
            "sensitivity": "high",
            "redact_mode": "hash",
        },
    },
)
```

### Prompt injection detection blocking legitimate input

**Symptom:** Valid user prompts are incorrectly flagged as injection attacks.

**Root cause:** Sensitivity set too high, or custom rules are too broad.

**Solution:**

```typescript
// Lower sensitivity or switch to MONITOR mode for guardrails
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    promptInjection: {
      enabled: true,
      sensitivity: 'medium',  // Try 'medium' before 'high'
    },
  },
});
```

Use MONITOR mode initially to observe guardrail behavior without blocking:

```typescript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    promptInjection: {
      enabled: true,
      mode: 'MONITOR',       // Log violations but don't block
      sensitivity: 'high',
    },
  },
});
```

### `InvalidConfigurationError: Invalid guardrail configuration`

**Symptom:**
```
InvalidConfigurationError: Invalid guardrail configuration
```

**Root cause:** Guardrail configuration structure is incorrect or contains unknown fields.

**Solution:** Validate the guardrail config structure:

```typescript
// Correct structure
const guardrails = {
  piiDetection: true,           // boolean enables with defaults
  promptInjection: true,
  contentModeration: {
    enabled: true,
    sensitivity: 'medium',
  },
  secretDetection: true,
};

// Incorrect - unknown field names
const wrong = {
  pii_detection: true,          // use camelCase in TS
  'prompt-injection': true,     // use camelCase
};
```

```python
# Correct structure
guardrails = {
    "pii_detection": True,              # snake_case in Python
    "prompt_injection": True,
    "content_moderation": {
        "enabled": True,
        "sensitivity": "medium",
    },
    "secret_detection": True,
}
```

### Custom rules not being evaluated

**Symptom:** Custom guardrail rules have no effect or are silently ignored.

**Root cause:** Custom rules incorrectly registered or using wrong API.

**Solution:**

```typescript
// TypeScript
import { TealGuard, CustomGuardrailRule } from 'tealtiger';

const rule: CustomGuardrailRule = {
  name: 'block-internal-urls',
  enabled: true,
  evaluate: (input) => {
    if (input.content?.includes('internal.company.com')) {
      return {
        passed: false,
        reason: 'Internal URL detected',
        riskScore: 0.9,
      };
    }
    return { passed: true, reason: '', riskScore: 0 };
  },
};

const guard = new TealGuard({
  customRules: [rule],
});
```

Ensure `enabled` is not set to `false` and the `evaluate` function returns the correct result shape.

---

## Budget and Cost Tracking Issues

### Budget exceeded errors

**Symptom:**
```
Error: Budget exceeded: maxCostPerRequest
```

**Root cause:** Request cost exceeds the configured per-request limit.

**Solution:**

```typescript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  budget: {
    maxCostPerRequest: 0.50,    // Increase if needed
    maxCostPerDay: 10.00,
    maxCostPerSession: 5.00,
  },
});
```

### Costs not being tracked

**Symptom:** Cost records show zero for all requests.

**Root cause:** Cost tracking is disabled or model pricing is missing.

**Solution:**

```typescript
// TypeScript - ensure cost tracking is enabled
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  tracking: {
    costTracking: true,
  },
});
```

```python
# Python
from tealtiger.cost import CostTracker

tracker = CostTracker({
    "enabled": True,
    "persist_records": True,
})
```

For custom models or self-hosted endpoints, provide pricing information:

```typescript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  customPricing: {
    'my-custom-model': {
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
    },
  },
});
```

### Budget alerts not firing

**Symptom:** Budget exceeded, but no alert was triggered.

**Root cause:** Alert thresholds not configured or alerts not checked.

**Solution:**

```python
# Python - configure alert thresholds
budget = budget_manager.create_budget(
    name="daily-limit",
    limit=10.00,
    period="daily",
    alert_thresholds=[50, 75, 90, 100],  # Alert at each threshold
    action="block",
)
```

Check alerts programmatically:

```python
alerts = budget_manager.get_alerts(budget.id)
for alert in alerts:
    print(f"{alert.severity}: {alert.message}")
```

### Circuit breaker tripping unexpectedly

**Symptom:**
```
CircuitBreakerError: Circuit breaker is OPEN
```

**Root cause:** Too many failed requests in a short period.

**Solution:** Adjust circuit breaker thresholds:

```typescript
const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,         // Number of failures to open
    successThreshold: 5,          // Number of successes to close
    halfOpenMaxRequests: 3,       // Requests in half-open state
    timeout: 30000,               // Milliseconds before half-open
  },
});
```

---

## TypeScript SDK Specific Problems

### TypeScript compilation errors

**Symptom:**
```
node_modules/tealtiger/dist/index.d.ts:5:41 - error TS2307: Cannot find module 'tealtiger/guardrails'
```

**Root cause:** Missing `skipLibCheck` or incompatible TypeScript version.

**Solution:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "target": "ES2020",
    "module": "commonjs"
  }
}
```

### `Cannot find module 'tealtiger'` after install

**Symptom:**
```
Error: Cannot find module 'tealtiger'
```

**Root cause:** Module resolution path not configured. The SDK uses `module` field in `package.json` for ESM/CJS dual format.

**Solution:**

```json
// For CommonJS projects
{
  "type": "commonjs"
}

// For ESM projects
{
  "type": "module"
}
```

Ensure the import path is correct:

```typescript
import { TealOpenAI } from 'tealtiger';  // Correct
import { TealOpenAI } from 'tealtiger/src';  // Wrong
```

### Bundle size too large

**Symptom:** Large bundle size in webpack/Vite builds.

**Root cause:** The entire SDK is being imported instead of specific modules.

**Solution:** Import only what you need:

```typescript
// Instead of importing everything
import { TealGuard } from 'tealtiger/core/guard';
import { TealEngine } from 'tealtiger/core/engine';
```

### `Cannot read properties of undefined` on ExecutionContext

**Symptom:**
```
TypeError: Cannot read properties of undefined (reading 'correlation_id')
```

**Root cause:** ExecutionContext not passed to a method that requires it.

**Solution:**

```typescript
import { ContextManager } from 'tealtiger';

// Create context
const ctx = ContextManager.createContext();

// Always pass context
const decision = engine.evaluate({
  agentId: 'my-agent',
  action: 'tool.execute',
  context: ctx,
});
```

---

## Python SDK Specific Problems

### `ModuleNotFoundError: No module named 'tealtiger'`

**Symptom:**
```
ModuleNotFoundError: No module named 'tealtiger'
```

**Root cause:** Package not installed or installed in a different environment.

**Solution:**

```bash
# Verify installation
pip list | grep tealtiger

# Install if missing
pip install tealtiger

# Check which Python environment
which python
python -c "import tealtiger; print(tealtiger.__version__)"
```

### `ImportError` with Pydantic v2

**Symptom:**
```
ImportError: cannot import name 'BaseModel' from 'pydantic'
```

**Root cause:** TealTiger requires Pydantic v2.

**Solution:**

```bash
pip install "pydantic>=2.0"
```

### Type hint mismatches in Python 3.10

**Symptom:**
```
TypeError: 'type' object is not subscriptable
```

**Root cause:** Using `list[str]` syntax in Python < 3.9, or `X | Y` union syntax in Python < 3.10.

**Solution:**

```bash
python --version
# Ensure Python 3.10+ for modern type hints
```

### Async client not awaiting

**Symptom:**
```
RuntimeWarning: coroutine '...' was never awaited
```

**Root cause:** Async method called without `await`.

**Solution:**

```python
# Correct
response = await client.chat.completions.create(...)

# Wrong
response = client.chat.completions.create(...)  # Missing await
```

### `TealTigerError` during sidecar connection

**Symptom:**
```
TealTigerError: Failed to connect to SSA at http://localhost:8080
```

**Root cause:** Security Sidecar Agent (SSA) is not running or unreachable.

**Solution:**

```bash
# Check if SSA is running
curl http://localhost:8080/health

# Start the sidecar
docker run -d -p 8080:8080 tealtigeradmin/tealtiger-docker:latest
```

---

## CI/CD Integration Issues

### GitHub Action fails with exit code 2

**Symptom:**
```
Error: Invalid configuration (exit code 2)
```

**Root cause:** Missing required input `scan-path` or invalid sensitivity value.

**Solution:**

```yaml
- name: Run TealTiger Scan
  uses: agentguard-ai/tealtiger-action@v1
  with:
    scan-path: ./prompts              # Required
    guardrails: pii,prompt-injection  # Optional
    sensitivity: medium               # Must be: low, medium, or high
    fail-on-finding: "true"           # String, not boolean
```

### SARIF report not uploading to GitHub Code Scanning

**Symptom:** No results appear in the Security tab.

**Root cause:** SARIF upload action requires `GITHUB_TOKEN` permissions.

**Solution:**

```yaml
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ./tealtiger-report/scan-report.sarif
  permissions:
    security-events: write   # Required for SARIF upload
```

### GitLab CI job hangs indefinitely

**Symptom:** The `tealtiger-scan` job never completes.

**Root cause:** Docker image pull timeout or insufficient CI runner resources.

**Solution:**

```yaml
variables:
  TEALTIGER_SCAN_PATH: ./prompts
  DOCKER_IMAGE: tealtigeradmin/tealtiger-docker:latest

# Set a job timeout
tealtiger-scan:
  timeout: 10m
```

### Policy test failures in CI that pass locally

**Symptom:** Tests pass on your machine but fail in the CI pipeline.

**Root cause:** Environment differences — missing environment variables, different SDK version, or different working directory.

**Solution:**

```bash
# Check SDK version in CI
npm list tealtiger
pip show tealtiger

# Verify environment variables are set
echo $TEALTIGER_API_KEY  # Will be masked in CI logs

# Use explicit paths
npx tealtiger test ./policies/*.test.json --verbose
```

For GitHub Actions, set environment variables in the workflow:

```yaml
- name: Run Policy Tests
  run: npx tealtiger test ./policies/*.test.json
  env:
    TEAL_MODE: ENFORCE
```

### CircleCI Orb not found

**Symptom:**
```
Error: Orb agentguard-ai/tealtiger@volatile not found
```

**Root cause:** Using the `volatile` version which is not published.

**Solution:** Pin to a specific version:

```yaml
orbs:
  tealtiger: agentguard-ai/tealtiger@1.0.0
```

---

## Enabling Debug Logging

### TypeScript SDK

Set `DEBUG=tealtiger:*` environment variable before starting your application:

```bash
DEBUG=tealtiger:* node app.js
DEBUG=tealtiger:* npm start
```

For more granular control:

```bash
# All tealtiger modules
DEBUG=tealtiger:* node app.js

# Specific modules
DEBUG=tealtiger:guard,*:engine,*:audit node app.js

# Include provider request/response logging
DEBUG=tealtiger:*,-tealtiger:verbose node app.js
```

Programmatic debug logging:

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  debug: true,  // Enables verbose logging
});
```

### Python SDK

```python
import logging

# Enable debug logging for all tealtiger modules
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('tealtiger')
logger.setLevel(logging.DEBUG)

# Or via environment variable
import os
os.environ['TEALTIGER_LOG_LEVEL'] = 'DEBUG'
```

```python
# Per-module logging
logging.getLogger('tealtiger.cost').setLevel(logging.DEBUG)
logging.getLogger('tealtiger.guardrails').setLevel(logging.DEBUG)
logging.getLogger('tealtiger.clients').setLevel(logging.DEBUG)
```

### Diagnostic Commands

```bash
# TypeScript - check installed version
npm list tealtiger

# Python - check installed version
pip show tealtiger

# Check environment variables
env | grep -i tealtiger
env | grep -i TEAL

# Test provider connectivity
node -e "
const { TealOpenAI } = require('tealtiger');
const client = new TealOpenAI({ apiKey: process.env.OPENAI_API_KEY, debug: true });
client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 10,
}).then(r => console.log('OK')).catch(e => console.error(e));
"

# Check audit logs
tail -f ./logs/audit.log

# Validate configuration
node -e "
const { TealEngine, PolicyMode } = require('tealtiger');
const engine = new TealEngine({}, { mode: { default: PolicyMode.ENFORCE } });
console.log('Configuration valid');
"
```

---

## Getting Help

### Before Opening an Issue

1. Check this troubleshooting guide for your problem
2. Search [existing GitHub issues](https://github.com/agentguard-ai/tealtiger/issues)
3. Enable debug logging and collect the output
4. Verify you are on the latest SDK version

### Information to Include

When reporting an issue, provide:

- **SDK version**: `npm list tealtiger` or `pip show tealtiger`
- **Runtime version**: `node --version` or `python --version`
- **Provider**: OpenAI, Anthropic, Azure, Bedrock, etc.
- **Error message and stack trace**: Full output, not truncated
- **Configuration**: Minimal reproducible config (redact API keys)
- **Debug output**: Logs with `DEBUG=tealtiger:*` enabled
- **Environment**: OS, package manager, CI system if applicable

### Support Channels

| Channel | Purpose | Link |
|---------|---------|------|
| GitHub Issues | Bug reports, feature requests | https://github.com/agentguard-ai/tealtiger/issues |
| GitHub Discussions | Questions, best practices | https://github.com/agentguard-ai/tealtiger/discussions |
| Discord | Community support | https://discord.gg/X2ePf8QAj |
| Documentation | API reference, guides | https://docs.tealtiger.ai |

---

## Related Documentation

- [SDK Troubleshooting Guide (TypeScript)](../packages/tealtiger-sdk/docs/TROUBLESHOOTING.md)
- [SDK Troubleshooting Guide (Python)](../packages/tealtiger-python/TROUBLESHOOTING.md)
- [Best Practices Guide](../packages/tealtiger-sdk/docs/BEST-PRACTICES.md)
- [Migration Guide](../packages/tealtiger-sdk/docs/MIGRATION-GUIDE-v1.1.x.md)
- [API Documentation](../packages/tealtiger-sdk/docs/API-DOCUMENTATION.md)
- [Cost Comparison Reference](./cost-comparison.md)
