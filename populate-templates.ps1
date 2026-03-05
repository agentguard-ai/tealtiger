# Populate TealTiger-SOT Template Files
# Date: March 5, 2026

$SOT_DIR = "C:\Users\satis\projects\TealTiger-SOT"

Write-Host "Populating template files in TealTiger-SOT..." -ForegroundColor Cyan

# Root README.md
$rootReadme = @"
# TealTiger Source of Truth (SOT)

**Purpose**: Single source of truth for all TealTiger product requirements, designs, and strategic planning.  
**Visibility**: Private  
**Owner**: agentguard-ai organization  
**Compliance**: Enterprise-grade, auditor-ready documentation

---

## Repository Structure

- **specs/** - Product specifications organized by semantic version
- **strategic-planning/** - Long-term strategy and roadmaps
- **competitive-analysis/** - Competitive intelligence
- **architecture/** - System architecture documentation
- **archive/** - Historical documents and completed releases

---

## Active Specifications

### v1.1 - TealEngine
**Status**: Implementation In Progress  
**Location**: ``specs/v1.1/tealengine/``  
**Components**: TealEngine, TealGuard, TealMonitor, TealCircuit, TealAudit

### v1.1 - Multi-Provider Expansion
**Status**: Spec Complete - Ready for Implementation  
**Location**: ``specs/v1.1/multi-provider/``  
**Providers**: Gemini, Bedrock, Azure OpenAI, Cohere, Mistral AI

### v1.1 - Enterprise Adoption Features
**Status**: Spec Complete - Ready for Implementation  
**Location**: ``specs/v1.1/enterprise-adoption/``  
**Features**: Policy Rollout Modes, Decision Contract, Correlation IDs, Audit Schema, Policy Testing, Cost Governance

---

## Strategic Documents

- [Strategic Docs Summary](strategic-planning/TEALTIGER-STRATEGIC-DOCS-SUMMARY.md)
- [Product Roadmap 2026-2027](strategic-planning/TEALTIGER-PRODUCT-ROADMAP-2026-2027.md)
- [Monetization Strategy](strategic-planning/TEALTIGER-MONETIZATION-STRATEGY.md)
- [Industry Intelligence Report](strategic-planning/INDUSTRY-INTELLIGENCE-AGENTIC-AI-SECURITY-2026.md)
- [OWASP ASI Mapping](strategic-planning/OWASP-AGENTIC-TOP10-TEALTIGER-MAPPING.md)

---

## Versioning Rules

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- When to create new spec directories
- How to handle patch versions
- Changelog and traceability requirements

---

## Contributing

This repository is the source of truth. All spec changes must be:
1. Reviewed by product team
2. Committed to this repository
3. Synced to implementation repositories
4. Documented in changelog.md

---

**Last Updated**: March 5, 2026  
**Maintainer**: TealTiger Product Team
"@

Set-Content -Path "$SOT_DIR\README.md" -Value $rootReadme
Write-Host "[SUCCESS] Root README.md populated" -ForegroundColor Green

# CONTRIBUTING.md
$contributing = @"
# Contributing to TealTiger-SOT

**Purpose**: Guidelines for maintaining the Source of Truth repository  
**Audience**: Product team, engineering team, auditors  
**Status**: Active

---

## Versioning Rules (BP-Compliant)

### When to Create New Spec Directory

Create new directory for:

| Version Type | Example | Reason |
|--------------|---------|--------|
| **Major** | v1.x to v2.0 | Breaking changes, new threat model, incompatible API |
| **Minor** | v1.1 to v1.2 | New features, new requirements, backward-compatible |

Do NOT create new directory for:

| Version Type | Example | Reason |
|--------------|---------|--------|
| **Patch** | v1.1.1 to v1.1.2 | Bug fixes, clarifications, documentation updates |

---

## Patch Version Workflow

For patch versions (v1.1.1, v1.1.2, etc.), follow this workflow:

### 1. Edit Canonical Documents

Edit requirements.md and design.md directly in the spec directory.

### 2. Create Patch File

Create patch showing what changed:
``````
git diff requirements.md > patches/v1.1.2-description-requirements.patch
git diff design.md > patches/v1.1.2-description-design.patch
``````

### 3. Update Changelog

Add entry to changelog.md with version, date, changes, and traceability.

### 4. Update Traceability (if needed)

Update traceability.md if requirements, design, or implementation changed.

### 5. Commit Changes

``````
git add .
git commit -m "v1.1.2: Brief description of changes"
git push origin main
``````

---

## File Structure Requirements

Every spec directory MUST contain:

| File | Required | Purpose |
|------|----------|---------|
| requirements.md | Yes | Canonical requirements |
| design.md | Yes | Canonical technical design |
| tasks.md | Yes | Implementation breakdown |
| changelog.md | Yes | Version history |
| traceability.md | Yes | Req to Design to Code mapping |
| README.md | Yes | Spec overview |
| patches/ | Yes | Directory for patch files |
| correctness.md | Optional | For specs with PBT |

---

## Best Practices

### DO

- Keep canonical docs up-to-date
- Create patch files for all changes
- Update changelog with every change
- Maintain traceability matrix
- Use semantic versioning correctly
- Write clear commit messages

### DON'T

- Fork docs for patch versions
- Skip changelog updates
- Break traceability links
- Make undocumented changes
- Use inconsistent versioning

---

**Document Version**: 1.0  
**Last Updated**: March 5, 2026  
**Status**: Active
"@

Set-Content -Path "$SOT_DIR\CONTRIBUTING.md" -Value $contributing
Write-Host "[SUCCESS] CONTRIBUTING.md populated" -ForegroundColor Green

# specs/README.md
$specsReadme = @"
# TealTiger Specifications

This directory contains all product specifications organized by semantic version.

## Active Specs

- [v1.1/tealengine](v1.1/tealengine/) - Core policy engine and branded components
- [v1.1/multi-provider](v1.1/multi-provider/) - Support for 7+ LLM providers
- [v1.1/enterprise-adoption](v1.1/enterprise-adoption/) - Enterprise-ready features

## Spec Structure (BP-Compliant)

Each spec directory contains:
- requirements.md - Canonical requirements for minor version
- design.md - Canonical technical design
- tasks.md - Implementation task breakdown
- patches/ - Patch files for incremental changes (v1.1.1, v1.1.2, etc.)
- changelog.md - Version history and change summary
- traceability.md - Requirement to Design to Implementation mapping
- correctness.md - Correctness properties (for PBT specs)
- README.md - Spec overview and status

## Versioning Rules

Create new directory for:
- Major version (v1.x to v2.0): Breaking changes, new threat model
- Minor version (v1.1 to v1.2): New features, new requirements

Do NOT create new directory for:
- Patch version (v1.1.1 to v1.1.2): Bug fixes, clarifications

For patch versions, use:
1. Update canonical docs (requirements.md, design.md)
2. Create patch file in patches/v1.1.x.patch
3. Update changelog.md
4. Update traceability.md if needed

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed workflow.
"@

Set-Content -Path "$SOT_DIR\specs\README.md" -Value $specsReadme
Write-Host "[SUCCESS] specs/README.md populated" -ForegroundColor Green

# Strategic Planning README
$strategicReadme = @"
# TealTiger Strategic Planning

This directory contains long-term strategy documents, product roadmaps, and competitive intelligence.

## Documents

- [Strategic Docs Summary](TEALTIGER-STRATEGIC-DOCS-SUMMARY.md) - Overview of all strategic documents
- [Product Roadmap 2026-2027](TEALTIGER-PRODUCT-ROADMAP-2026-2027.md) - 18-month product roadmap
- [Monetization Strategy](TEALTIGER-MONETIZATION-STRATEGY.md) - Revenue and pricing strategy
- [Industry Intelligence Report](INDUSTRY-INTELLIGENCE-AGENTIC-AI-SECURITY-2026.md) - Market analysis
- [OWASP ASI Mapping](OWASP-AGENTIC-TOP10-TEALTIGER-MAPPING.md) - OWASP Top 10 coverage

---

**Last Updated**: March 5, 2026  
**Owner**: TealTiger Product Team
"@

Set-Content -Path "$SOT_DIR\strategic-planning\README.md" -Value $strategicReadme
Write-Host "[SUCCESS] strategic-planning/README.md populated" -ForegroundColor Green

# Competitive Analysis README
$competitiveReadme = @"
# TealTiger Competitive Analysis

This directory contains competitive intelligence and market positioning analysis.

## Documents

- [Enterprise Features Competitive Advantage](ENTERPRISE-FEATURES-COMPETITIVE-ADVANTAGE.md) - How TealTiger differentiates

---

**Last Updated**: March 5, 2026  
**Owner**: TealTiger Product Team
"@

Set-Content -Path "$SOT_DIR\competitive-analysis\README.md" -Value $competitiveReadme
Write-Host "[SUCCESS] competitive-analysis/README.md populated" -ForegroundColor Green

# Architecture README
$architectureReadme = @"
# TealTiger Architecture

This directory contains system architecture documentation and technical strategy.

## Documents

- [Architecture Strategy](TEALTIGER-ARCHITECTURE-STRATEGY.md) - Overall architecture approach
- [OWASP ASI Coverage](OWASP-ASI-COVERAGE-CLARIFICATION.md) - Security framework coverage
- [SDK Provider Matrix](TEALTIGER-SDK-PROVIDER-MATRIX.md) - LLM provider support matrix

---

**Last Updated**: March 5, 2026  
**Owner**: TealTiger Engineering Team
"@

Set-Content -Path "$SOT_DIR\architecture\README.md" -Value $architectureReadme
Write-Host "[SUCCESS] architecture/README.md populated" -ForegroundColor Green

Write-Host ""
Write-Host "Template population complete!" -ForegroundColor Green
Write-Host "Next: Populate spec-specific README and changelog files" -ForegroundColor Yellow
