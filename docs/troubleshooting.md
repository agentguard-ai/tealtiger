# Troubleshooting

Use this guide for common setup and runtime errors. Each entry includes the
error message, likely cause, and a short fix.

## Missing API key

**Error message**

```text
Missing API key
```

**Cause:** The provider key was not set, or the environment variable name does
not match the provider client.

**Fix:** Export the expected key before running the app, for example
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or the provider-specific key used by your
example. Never commit real keys to source control.

## Budget exceeded

**Error message**

```text
Budget exceeded
```

**Cause:** The request would exceed the configured per-request, session, or
daily budget.

**Fix:** Lower the prompt size or `maxTokens`, choose a cheaper model, or raise
the budget limit in the policy after confirming the spend is expected.

## Guardrail blocked request

**Error message**

```text
Guardrail blocked request: PII detected
```

**Cause:** A PII guardrail found sensitive data such as an email, phone number,
token, or other protected identifier.

**Fix:** Remove the sensitive value, use test placeholders, or configure the
guardrail to redact instead of block when redaction is appropriate.

## Provider timeout or connection error

**Error message**

```text
Provider timeout
Connection error
```

**Cause:** The provider endpoint is unreachable, overloaded, blocked by network
settings, or configured with the wrong base URL.

**Fix:** Check the provider status page, verify the endpoint and region, retry
with backoff, and confirm local firewall or proxy settings allow the request.

## Invalid policy configuration

**Error message**

```text
Invalid policy configuration
```

**Cause:** The policy file is missing required fields, uses an unsupported
value, or does not match the TealTiger policy schema.

**Fix:** Validate the file with the policy validator:

```bash
npm run validate:policy -- ./my-policy.json
```

## Unknown provider type

**Error message**

```text
Unknown provider type
```

**Cause:** The configured provider name does not match a supported provider or
the provider package was not installed/exported.

**Fix:** Check the provider name for typos, confirm the SDK version supports the
provider, and use the matching client or provider adapter from the examples.
