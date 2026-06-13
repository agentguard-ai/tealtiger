---
title: Change Management Process
description: PR → Review → Merge → Release process for TealTiger
---

# Change Management Process (PR → Review → Merge → Release)

TealTiger uses a lightweight, auditable process for all code and documentation
changes. Follow this workflow for all contributions to keep security and quality
barriers predictable.

## 1) PR Requirements

- A clear description of what changed and why.
- Scope statement: what is included and what is intentionally out of scope.
- Link to a tracking issue (or a brief justification if no issue exists).
- Testing evidence:
  - commands run, expected output, and results
  - screenshots or logs for manual verification where applicable
- Any breaking changes called out explicitly.
- Security impact assessment for auth, policy, network, or governance-related changes.

## 2) Review Requirements

- At least one review is required before merge.
- All review comments must be addressed or explicitly acknowledged with rationale.
- For security-sensitive changes:
  - owner review is required before merge.
- For documentation and example changes, one reviewer is sufficient.
- For code changes:
  - maintainer review must confirm test coverage and scope fit before merge.
- PR author must respond to all "request changes" before resubmitting.

## 3) CI Gates

The following checks must pass before a PR is considered merge-ready:

- Lint and test suites pass for changed surfaces.
- Coverage checks (where configured) are green.
- Type checks/build checks pass.
- Dependency/security scans pass for changed dependencies.

If CI is flaky and unrelated to the change, include a clear rationale and
maintainer acknowledgment before merge.

## 4) Merge and Release Process

1. PR approved per review rules.
2. Branch is up-to-date with target branch to avoid stale merge conflicts.
3. PR is merged using the repository’s merge policy.
4. A release note/changelog update is prepared for user-impacting changes.
5. Versioning and publishing follow maintainers’ release playbook.

### Release checklist

Before tagging or publishing a release, confirm:

- All release-blocking PRs are merged and associated issues are closed or
  explicitly deferred.
- CI, test, build, coverage, dependency, and security gates are green for the
  release commit.
- Version numbers, package metadata, and release notes/changelog entries match
  the intended release contents.
- Artifacts are built from the approved release commit, not from a local dirty
  checkout.
- A post-release smoke test owner is identified for each published package or
  integration surface.

## 5) Release and Rollback Procedure

### Standard release

- Tag/release from a validated branch.
- Publish artifacts to the relevant distribution channels.
- Validate post-release behavior in a smoke test environment.

### Rollback

If a release introduces a regression:

1. Identify impacted functionality and affected environments.
2. Revert the release commit(s) with clear rollback reasoning.
3. Re-publish the previous good version.
4. Open a follow-up issue for root-cause correction and corrective release.

### Rollback verification

Rollback readiness is tested through a dry-run or documented rehearsal before a
release that changes user-facing behavior, package publishing, security policy,
or governance enforcement. The rehearsal should record:

- the release identifier or commit that would be reverted,
- the previous known-good version or commit,
- the command or GitHub action used to revert or re-publish,
- smoke checks used to confirm the rollback,
- and the owner responsible for communicating rollback status.

## 6) Emergency Hotfix Process

For critical issues (security/data-loss/regression affecting production):

- Raise priority in the issue/triage channel.
- Create a focused hotfix PR with minimal blast radius.
- Require maintainer approval with expedited review.
- Run required checks, deploy to production quickly once verified.
- Add a post-release note explaining root cause and prevention steps.

## 7) Compliance Tie-In

This process supports SOC 2 CC8 (Change Management) by:

- documenting approvals and tests,
- requiring review and merge controls,
- enforcing release checkpoints,
- and defining rollback discipline.
