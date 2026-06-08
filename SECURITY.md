# Security Policy

TealTiger is an AI agent security and governance SDK. Security reports are handled
privately, triaged by severity, and disclosed through coordinated security
updates.

## Supported Versions

| Version | Supported | Support level |
| --- | --- | --- |
| 1.3.x | Yes | Current stable release; security fixes and maintenance updates |
| 1.2.x | Yes | Security fixes only |
| 1.1.x | Yes | Critical security fixes only |
| < 1.1.0 | No | End of life |

Security support applies to the TealTiger hub repository and the published
TypeScript and Python SDK packages linked from the README. If a fix affects a
language-specific SDK, the advisory or release notes will identify the affected
package and version range.

## Reporting a Vulnerability

Do not open a public GitHub issue, pull request, or discussion for security
vulnerabilities.

Report vulnerabilities through one of these private channels:

- Email: security@tealtiger.co.in
- GitHub Security Advisories: https://github.com/agentguard-ai/tealtiger/security/advisories/new

If GitHub Security Advisories are unavailable for your account, use the email
address above. Do not include exploit details in a public issue.

### What To Include

Please include as much of the following as you can:

- Vulnerability summary and affected component.
- Affected version, package, commit, or deployment path.
- Step-by-step reproduction instructions.
- Proof of concept or exploit code, if safe to share privately.
- Impact assessment, including what an attacker could read, modify, bypass, or
  cause.
- Suggested fix or mitigation, if you have one.
- Whether you want public credit, private credit, or anonymity.

### Encryption And PGP

TealTiger does not currently publish a project PGP key. Until a key is published,
use GitHub Security Advisories or email only the minimum sensitive detail needed
to establish contact. The maintainers can coordinate a safer exchange channel for
highly sensitive reports.

## Response Timeline

| Severity | Acknowledgement | Initial assessment | Target fix window |
| --- | --- | --- | --- |
| Critical | Within 48 hours | Within 5 business days | 1-7 days |
| High | Within 48 hours | Within 5 business days | 7-14 days |
| Medium | Within 48 hours | Within 5 business days | 14-30 days |
| Low | Within 48 hours | Within 5 business days | 30-90 days |

The target fix window starts after the maintainers confirm that the report is a
valid TealTiger vulnerability and identify the affected version range. Complex
issues may require coordinated release timing, but the maintainers will keep the
reporter informed of material changes.

## Severity Classification

TealTiger uses the following severity classes for security triage:

| Severity | Examples |
| --- | --- |
| Critical | Remote code execution, unauthorized secret disclosure, governance bypass that allows unrestricted tool or model access, evidence tampering that cannot be detected by users |
| High | Reliable prompt-injection or policy-evasion bypass for documented protections, unauthorized access to governance data, signing or integrity bypass, high-impact dependency compromise |
| Medium | Limited-scope policy bypass, denial of service in normal SDK usage, incomplete audit evidence for specific flows, moderate information disclosure |
| Low | Defense-in-depth issue, documentation that could cause insecure deployment, low-impact dependency or configuration weakness |

Severity may change during triage as new evidence is gathered.

## Coordinated Disclosure Process

1. Report the vulnerability privately.
2. TealTiger acknowledges receipt within the response timeline above.
3. Maintainers validate scope, severity, affected versions, and reproduction.
4. Maintainers prepare a fix, mitigation, or advisory.
5. A security update is released for supported versions when applicable.
6. Public disclosure occurs through a GitHub Security Advisory, release notes,
   changelog entry, or other maintainer-approved channel.

Please do not publicly disclose details until a fix or advisory is available, or
until the maintainers and reporter agree on a disclosure date.

## Security Update Notifications

Security updates may be announced through:

- GitHub Security Advisories:
  https://github.com/agentguard-ai/tealtiger/security/advisories
- GitHub releases and release notes.
- `CHANGELOG.md` entries.
- Package updates on npm or PyPI for affected SDK packages.
- Project communication channels such as GitHub Discussions or Discord when a
  broad user notice is appropriate.

Users should monitor GitHub advisories and keep SDK packages on a supported
minor version.

## Recognition

TealTiger credits security reporters in advisories and release notes unless the
reporter requests anonymity. Credit may include the reporter's name, handle, and
link, subject to the reporter's preference and responsible disclosure behavior.

Reports that include unsafe public disclosure, active exploitation, extortion,
or unrelated spam may be ineligible for public credit.

## Security Scope

### In Scope

Reports are most useful when they affect TealTiger's documented security and
governance behavior, including:

- Prompt-injection prevention bypasses.
- Secret, credential, or PII detection bypasses.
- Policy evaluation or enforcement bypasses.
- Evidence, receipt, audit log, or advisory integrity issues.
- Cost-governance bypasses that can cause unexpected user spend.
- Unsafe defaults in TealTiger examples, integrations, or CI templates.
- Dependency or supply-chain issues that affect supported TealTiger packages.

### Out Of Scope

The following are usually outside the TealTiger vulnerability program unless
they directly affect TealTiger code or maintained artifacts:

- Model alignment failures in third-party LLMs.
- Training data poisoning before TealTiger is invoked.
- Infrastructure issues in a user's deployment environment.
- Social engineering or physical attacks.
- Reports that require access to secrets, private accounts, payment systems, or
  production data that you do not own or have permission to test.

## TealTiger Security Model

TealTiger's primary security goal is deterministic runtime governance for AI
agents. The SDK is designed around these properties:

- No LLM in the governance path.
- Same input plus same policy produces the same decision.
- Governance decisions should produce reconstructable evidence.
- Security and cost controls should fail closed where practical.
- Policy and evidence artifacts should be traceable to versioned configuration.

Important residual risk: a user can remove the SDK from their application. That
is detectable through missing evidence but cannot be fully prevented by an SDK
alone. Production users should pair TealTiger with platform-level controls such
as code review, CI checks, deployment policy, and audit monitoring.

## User Security Checklist

- Store API keys and credentials in environment variables or a secret manager.
- Do not commit secrets, tokens, private keys, or production data.
- Keep TealTiger packages on a supported version line.
- Enable the guardrails appropriate for your workload before production use.
- Review governance decisions in report or monitor mode before enforcing new
  policies.
- Configure cost budgets and alerting for production agents.
- Export audit evidence to your SIEM or audit system when operating in a
  regulated environment.

## Contact

- Security reports: security@tealtiger.co.in
- Security advisories:
  https://github.com/agentguard-ai/tealtiger/security/advisories
- General project contact: reachout@tealtiger.ai

Thank you for helping keep TealTiger and its users secure.
