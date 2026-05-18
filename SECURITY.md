# Security Policy

## 🔒 Reporting a Vulnerability

Security is our top priority. We take all security vulnerabilities seriously.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Report via GitHub Security Advisories:

👉 https://github.com/agentguard-ai/tealtiger/security/advisories/new

If you get a 404 error (Security Advisories not enabled), please:
1. Open a GitHub issue with the title prefix `[SECURITY]` (do NOT include sensitive details)
2. We will contact you privately to discuss the vulnerability details

### What to Include

- **Type of vulnerability** (e.g., pattern bypass, policy evasion, evidence tampering)
- **Full paths of source file(s)** related to the vulnerability
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the vulnerability** and how an attacker might exploit it

### Response Timeline

| Severity | Initial Response | Fix Timeline |
|----------|-----------------|--------------|
| Critical | 24 hours | 1-7 days |
| High | 24 hours | 7-14 days |
| Medium | 72 hours | 14-30 days |
| Low | 72 hours | 30-90 days |

---

## 🔐 Supported Versions

| Version | Supported | Notes |
|---------|-----------|-------|
| 1.3.x | ✅ Yes | Current stable release |
| 1.2.x | ✅ Yes | Security patches only |
| 1.1.x | ✅ Yes | Security patches only |
| < 1.1.0 | ❌ No | End of life |

---

## 🛡️ What TealTiger Protects (and What It Doesn't)

### What TealTiger Governance Covers

| Threat | TealTiger Control | Module |
|--------|-------------------|--------|
| Prompt injection | Regex + conjunction pattern detection | TealGuard |
| Secret/credential leakage | 500+ pattern detection with confidence scoring | TealSecrets |
| PII in inputs/outputs | Pattern-based PII detection and redaction | TealGuard |
| Excessive cost | Budget enforcement (per-request, session, daily) | TealMonitor |
| Unauthorized tool use | Tool/model allowlisting with provenance | TealRegistry |
| Cascading failures | Circuit breaker with retry budgets | TealCircuit |
| Memory poisoning | Write governance, scope enforcement, TTL | TealMemory |
| Audit trail gaps | Versioned logging, SARIF/JUnit export | TealAudit |

### What TealTiger Does NOT Cover

| Threat | Why | Recommendation |
|--------|-----|----------------|
| Model alignment failures | Requires model internals access | Use alignment evaluation tools |
| Training data poisoning | Happens before runtime | Use data validation pipelines |
| Network-level attacks (MITM) | Infrastructure concern | Use TLS, certificate pinning |
| LLM hallucinations | Requires output factuality checking | Use grounding/RAG verification |
| Side-channel attacks (timing) | Infrastructure-layer | Use packet padding, response batching |

### Key Architectural Security Properties

- **No LLM in the governance path** — Governance decisions are deterministic regex/pattern-based. The governance layer cannot be prompt-injected.
- **Deterministic decisions** — Same input + same policy = same decision, every time. Reproducible and auditable.
- **SDK-only architecture** — No external infrastructure dependency. No data leaves the process unless explicitly configured (telemetry export).
- **Fail-closed by default** — TealEngine's parallel evaluation uses "most restrictive action wins" merge.
- **FREEZE Rules** — Immutable emergency kill switches that cannot be overridden by any policy layer. Includes tamper detection to alert on modification attempts.
- **Anti-Tamper Controls** — Ed25519-signed policy bundles, forbidden config key rejection, and workload identity binding prevent unauthorized governance modifications.
- **OWASP Agentic Top 10 Coverage (10/10)** — Zero-config policy pack covering all 10 OWASP ASI risks (ASI-01 through ASI-10).

---

## 🚨 Threat Model: Governance Bypass

TealTiger's primary threat model addresses attempts to weaken, bypass, or tamper with governance enforcement.

### Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| Curious developer | Relax enforcement for velocity | Modify app code, set env vars |
| Malicious insider | Intentionally bypass controls | Access to code, config, CI/CD |
| Compromised workload | Attacker controls runtime | Full app-level access |
| Network attacker | MITM during artifact fetch | Network-level interception |

### Key Controls (v1.3)

| Threat | Control |
|--------|---------|
| Developer disables enforcement | No bypass flags exist in SDK API |
| Local policy override | SDK does not load local policies in production mode |
| Registry impersonation | TLS + endpoint allow-listing |
| Evidence tampering | Versioned, append-only audit logs with policy version references |
| SDK removal | Detectable via missing TEEC evidence (platform-level control) |
| Policy bundle tampering | Ed25519-signed bundles with integrity verification |
| Config key injection | Forbidden config key rejection prevents unauthorized overrides |
| Workload impersonation | Workload identity binding ensures governance runs in authorized context |
| Emergency bypass attempts | FREEZE rules are immutable and trigger tamper-detection alerts |

### Residual Risks (Honest Assessment)

- A developer CAN remove the SDK from their application entirely. This is detectable (missing evidence) but not preventable at the SDK layer alone.
- Pattern-based detection has recall limitations (currently 50% on PINT benchmark). Novel attack phrasing can evade detection.
- The SDK trusts the configured registry endpoint. If the registry itself is compromised, governance artifacts could be tampered with.

For the full threat model, see: `TealTiger-SOT/diagrams/tealtiger_threat_model_policy_tampering.md`

---

## 🔍 Security Practices

### Development

- **Code Review** — All changes reviewed before merge
- **Automated Testing** — Security-focused test suite including adversarial probes
- **Dependency Scanning** — Regular audits (`npm audit`, `pip audit`)
- **Static Analysis** — Automated scanning in CI/CD
- **Red Team Benchmarking** — Garak + PINT benchmarks run on every release

### For Users

**Development checklist:**
- [ ] Store API keys in environment variables (never in code)
- [ ] Keep SDK updated to latest version
- [ ] Enable all guardrails appropriate for your use case
- [ ] Review governance decisions in REPORT_ONLY mode before enabling ENFORCE
- [ ] Set cost budgets appropriate for your workload

**Production checklist:**
- [ ] Enable ENFORCE mode for all critical guardrails
- [ ] Configure cost budgets with hard limits
- [ ] Export audit evidence to your SIEM
- [ ] Monitor for governance decision anomalies
- [ ] Rotate API keys regularly
- [ ] Use separate keys per environment

---

## 📋 Disclosure Policy

We follow coordinated disclosure:

1. **Report** — Researcher reports vulnerability privately
2. **Acknowledge** — We acknowledge within 24 hours
3. **Fix** — We develop and test a fix
4. **Release** — We release the fix
5. **Disclose** — We publicly disclose (coordinated with researcher)

### Credit Policy

We credit security researchers in:
- Security advisories
- Release notes
- Security Hall of Fame (below)

---

## 🏆 Security Hall of Fame

We recognize security researchers who help us improve:

*No vulnerabilities reported yet — be the first!*

---

## 📞 Contact

- **Security Issues**: [GitHub Security Advisories](https://github.com/agentguard-ai/tealtiger/security/advisories/new)
- **GitHub**: [agentguard-ai/tealtiger](https://github.com/agentguard-ai/tealtiger)

---

**Thank you for helping keep TealTiger secure!** 🔒
