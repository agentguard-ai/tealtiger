# Incident Response Plan

Status: readiness groundwork. This document supports TealTiger's security and
compliance preparation; it is not a claim of SOC 2, ISO 27001, or other formal
certification.

## Purpose

TealTiger is an AI agent security and governance SDK. Security incidents must be
handled consistently, privately when needed, and with enough evidence to support
future audit, user communication, and post-incident learning.

This plan defines how maintainers triage, contain, remediate, communicate, and
review security incidents affecting TealTiger repositories, published packages,
examples, integrations, CI templates, or security documentation.

## Scope

This plan applies to incidents involving:

- vulnerabilities reported through `SECURITY.md` channels;
- suspected compromise of TealTiger source code, release artifacts, packages, or
  CI/CD workflows;
- governance, policy, evidence, receipt, or audit-log integrity issues;
- secret, credential, or PII exposure in repository content, examples, logs, or
  release artifacts;
- dependency or supply-chain issues that affect supported TealTiger packages;
- public disclosure of a vulnerability before coordinated remediation is ready.

This plan does not authorize testing against third-party systems, user
production environments, private accounts, payment systems, or secrets that the
reporter does not own or have permission to test.

## Incident Roles

| Role | Default owner | Responsibilities |
| --- | --- | --- |
| Incident Lead | Project owner or delegated maintainer | Owns severity, response timeline, containment decisions, and closure |
| Technical Lead | Maintainer closest to affected component | Reproduces, scopes, fixes, validates, and documents technical findings |
| Communications Lead | Project owner or delegated maintainer | Coordinates reporter updates, advisories, release notes, and public messaging |
| Scribe | Any delegated maintainer/contributor | Maintains timeline, decisions, evidence references, and action items |

For small incidents, one person may hold multiple roles. Security-sensitive
details should be shared only with people who need them to respond.

## Severity Levels

Use the severity definitions in `SECURITY.md` as the source of truth. During an
incident, assign the highest reasonable severity first, then downgrade only after
evidence proves lower impact.

| Severity | Incident examples | Target response posture |
| --- | --- | --- |
| Critical | active exploit, release artifact compromise, secret disclosure, undetectable governance evidence tampering | immediate maintainer coordination, urgent containment, expedited advisory |
| High | reliable documented-protection bypass, CI/CD integrity weakness, signing or policy integrity bypass | same-day maintainer coordination, prioritized fix and release |
| Medium | limited-scope policy bypass, incomplete audit evidence, denial of service in normal SDK use | normal maintainer coordination, fix in planned patch window |
| Low | documentation weakness, low-impact dependency issue, hardening gap | track and resolve through normal maintenance |

## Response Phases

### 1. Intake

- Receive the report through the private channels documented in `SECURITY.md`.
- Acknowledge receipt within the documented response timeline.
- Record the reporter's preferred contact, credit preference, and disclosure
  expectations.
- Create a private tracking record or draft security advisory if the report
  contains sensitive details.
- Do not copy exploit details into public issues, public PRs, chat screenshots,
  or non-private docs.

### 2. Triage

- Confirm whether the report affects TealTiger-maintained code, docs, packages,
  CI/CD, examples, or integrations.
- Assign severity and incident roles.
- Identify affected versions, branches, packages, and artifacts.
- Decide whether immediate containment is needed before a full fix.
- If the report is out of scope, explain why and redirect the reporter when
  appropriate.

### 3. Containment

Containment actions depend on the incident type:

- revoke or rotate exposed credentials;
- remove or quarantine affected release artifacts;
- disable or restrict affected CI/CD workflows;
- pause a vulnerable package release path;
- temporarily document a safe workaround;
- limit access to sensitive investigation details;
- add temporary monitoring for exploit indicators when applicable.

Containment should minimize user risk without making unsupported claims about
certification status or total protection.

### 4. Remediation

- Prepare the smallest fix that closes the verified risk.
- Add regression tests or documentation checks when practical.
- Preserve enough evidence to explain why the fix addresses the issue.
- Review the fix with the project owner or delegated maintainer.
- Coordinate release timing with the reporter when the issue was privately
  disclosed.

### 5. Recovery

- Release the fix or mitigation for supported versions.
- Publish a GitHub Security Advisory when the issue meets advisory criteria.
- Update release notes, `CHANGELOG.md`, package metadata, or docs as needed.
- Confirm that affected CI checks, package publishing, or examples are operating
  normally again.

### 6. Post-Incident Review

Within 10 business days of closure for Critical or High incidents, complete a
short review:

- What happened?
- How was it detected?
- What was the impact?
- What was the timeline from report to containment and fix?
- What prevented faster detection, response, or recovery?
- What documentation, CI, testing, access control, or release process changes
  should be made?
- Who owns each follow-up and by when?

For Medium or Low incidents, the same review can be lighter and tracked through
the normal issue or PR process.

## Communication Rules

- Keep vulnerability details private until a fix, mitigation, or advisory is
  ready.
- Give reporters status updates when timelines change materially.
- Avoid speculative public statements about impact before technical validation.
- Public updates should identify affected versions, risk, mitigation, and fixed
  versions when known.
- Do not publish secrets, exploit payloads, private reporter data, or user data.
- Clearly distinguish readiness groundwork from formal certification claims.

## Evidence Handling

Maintain enough evidence to support auditability and later learning:

- report receipt timestamp;
- reporter contact and credit preference;
- severity decision and rationale;
- affected version/package/artifact list;
- reproduction notes or proof-of-concept references;
- containment decisions;
- fix PR, commit, release, and advisory links;
- validation evidence;
- post-incident review notes and follow-up owners.

Sensitive evidence should remain private. Public docs should link to advisories,
release notes, or sanitized summaries rather than raw exploit details.

## SOC 2 Groundwork Mapping

| Trust Services Criteria area | Incident response evidence |
| --- | --- |
| CC2 Communication and Information | private intake, reporter updates, public advisories, release notes |
| CC3 Risk Assessment | severity assignment, affected-version analysis, scope decision |
| CC4 Monitoring Activities | detection source, CI/security scan findings, follow-up tracking |
| CC7 System Operations | containment, remediation, recovery, post-incident review |
| CC8 Change Management | fix PRs, reviews, release notes, validation evidence |
| CC9 Risk Mitigation | dependency updates, vulnerability disclosure, user mitigation guidance |

This mapping is a readiness aid only. Formal certification requires auditor
review, operating evidence over time, and organization-approved controls.

## Incident Record Template

Use this template for private tracking or sanitized post-incident notes.

```md
# Incident Record

## Summary
- Title:
- Severity:
- Status:
- Incident Lead:
- Technical Lead:
- Communications Lead:
- Reporter credit preference:

## Timeline
- Report received:
- Acknowledged:
- Triage completed:
- Containment completed:
- Fix released:
- Advisory/update published:

## Scope
- Affected packages/versions:
- Affected repositories/files:
- User impact:
- Out-of-scope findings:

## Response
- Containment actions:
- Remediation actions:
- Validation:
- User communication:

## Follow-Up
- Action item:
- Owner:
- Due date:
```

## Related Documents

- `SECURITY.md` for vulnerability reporting, supported versions, response
  timeline, and disclosure policy.
- `GOVERNANCE.md` for maintainer roles, decision making, and review process.
- `CONTRIBUTING.md` for contributor expectations and PR workflow.
- `CHANGELOG.md` for release communication.
