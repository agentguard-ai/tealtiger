# TealTiger Project Governance

This document describes how the TealTiger project is governed, how decisions are made, and how contributors can grow into leadership roles.

## Principles

- **Meritocracy** — Roles are earned through consistent, quality contributions
- **Transparency** — Decisions are made in public (issues, PRs, Discord)
- **Inclusivity** — Everyone is welcome to contribute regardless of experience level
- **Trust is earned gradually** — Permissions expand as trust is demonstrated over time

## Contributor Ladder

### 1. Contributor

**How to become one**: Submit 1 merged PR.

**Permissions**:
- Submit pull requests
- Comment on issues and PRs
- Participate in Discussions

**Expectations**:
- Follow the [Contributing Guide](./CONTRIBUTING.md)
- Be respectful and constructive
- Respond to review feedback

---

### 2. Trusted Contributor

**How to become one**: 5+ quality PRs merged over 2+ weeks of consistent activity.

**Permissions**:
- Self-assign up to 3 open issues at a time
- Leave review comments on PRs (advisory, non-binding)
- Help triage issues (suggest labels, ask for details, identify duplicates)
- Mentioned in CONTRIBUTORS.md with a special badge

**Expectations**:
- Leave room for new contributors on good-first-issues
- Help newcomers with their first PRs
- Follow project conventions without being reminded

---

### 3. Reviewer

**How to become one**: 10+ quality PRs + demonstrated good judgment in reviews + 1 month of consistent activity.

**Permissions**:
- Approve and merge documentation/example PRs without owner sign-off
- Request changes on code PRs (owner still merges code)
- Triage and label issues
- Close duplicate issues
- Listed in CODEOWNERS for their area of expertise

**Expectations**:
- Review PRs within 2-3 business days
- Provide constructive, specific feedback
- Ensure PRs include documentation (our "docs at merge time" rule)
- Flag security concerns to the owner

---

### 4. Co-Maintainer

**How to become one**: Reviewer for 1+ month + deep understanding of SDK architecture + demonstrated trust.

**Permissions**:
- Merge any PR (including core code changes)
- Cut patch releases
- Manage CI/CD configuration
- Triage security reports
- Participate in roadmap discussions

**Expectations**:
- Maintain code quality standards
- Ensure backward compatibility
- Coordinate with the owner on breaking changes
- Mentor reviewers and contributors

---

### 5. Owner

**Who**: @nagasatish007 (Naga Satish)

**Responsibilities**:
- Final authority on architecture decisions
- Roadmap and release planning
- Security incident response
- Community health and Code of Conduct enforcement
- Veto power on any merge (used sparingly)

---

## Decision Making

| Decision Type | Who Decides |
|---------------|-------------|
| Merge docs/examples PR | Reviewer or above |
| Merge code PR | Co-Maintainer or Owner |
| Architecture changes | Owner (with community input) |
| New feature direction | Owner (with community input) |
| Release timing | Co-Maintainer or Owner |
| Code of Conduct enforcement | Owner |
| Promotion decisions | Owner |

## Issue Etiquette

- **Check before you start** — Look at the "Development" section of an issue to see if a PR already exists
- **Claim before you code** — Comment "I'd like to work on this" on the issue and **wait for a maintainer to assign you** before starting work. Do not open a PR for an issue you haven't been assigned to.
- **3 issue limit** — Don't self-assign more than 3 open issues simultaneously

### Good First Issues Policy

`good first issue` labeled issues are **reserved for new contributors only**. The rules are:

1. **New contributors only** — If you have 3 or more merged PRs on this project, you are no longer eligible for `good first issue` tasks. Move on to intermediate or advanced issues.
2. **Claim and wait** — Comment on the issue expressing interest. A maintainer will assign it to you. Do not start work until assigned.
3. **One at a time** — You may only be assigned one `good first issue` at a time.
4. **7-day timeout** — If a `good first issue` is unclaimed after 7 days, any contributor may request it.
5. **Graduation** — After 3 merged `good first issue` PRs, you graduate to regular issues. Congratulations — you're ready for bigger challenges!

> **Why?** We want to keep the onboarding pipeline open for newcomers. Experienced contributors taking easy issues blocks new people from getting started.

## PR Review Process

1. All PRs require at least 1 review before merge
2. **One PR per issue** — Each PR must address a single issue. Do not bundle commits for multiple issues into one PR. PRs mixing unrelated changes will be asked to split.
3. Documentation/example PRs: Reviewer can approve and merge
4. Code PRs: Owner or Co-Maintainer must approve
5. Security-sensitive PRs: Owner must approve
6. PRs must include documentation (code without docs is not shippable)

## Promotion Process

Promotions are not automatic. The owner evaluates candidates based on:

- **Consistency** — Active over weeks, not just a single burst
- **Quality** — PRs are clean, tested, and well-documented
- **Judgment** — Reviews show good technical taste
- **Community** — Helps others, doesn't monopolize issues
- **Communication** — Responsive, clear, constructive

To request consideration for promotion, reach out on Discord or open a Discussion.

## Current Roster

| Role | People |
|------|--------|
| Owner | @nagasatish007 |
| Co-Maintainer | — |
| Reviewer | — |
| Trusted Contributor | @lleonardo-franco |
| Contributor | @mvanhorn, @tmchow, @pntech20, @resolvicomai, @dagangtj, @aprv10, @MD-Mushfiqur123, @CleanDev-Fix |

---

## Changes to This Document

This governance model may evolve as the project grows. Changes are proposed via PR and require owner approval.
