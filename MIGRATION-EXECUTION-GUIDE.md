# TealTiger-SOT Migration Execution Guide

**Date**: March 5, 2026  
**Status**: Ready to Execute  
**Script**: `migrate-to-sot.sh`

---

## Quick Start

```bash
# Make the script executable
chmod +x migrate-to-sot.sh

# Run the migration
./migrate-to-sot.sh
```

---

## What the Script Does

### Automated Steps

1. ✅ Clones TealTiger-SOT repository (or pulls latest if exists)
2. ✅ Creates BP-compliant directory structure
3. ✅ Creates .gitignore
4. ✅ Copies all specs from `.kiro/specs/`
5. ✅ Copies strategic planning docs
6. ✅ Copies competitive analysis
7. ✅ Copies architecture docs
8. ✅ Creates all BP-compliant files (changelog.md, traceability.md, etc.)
9. ✅ Shows git status

### What You Need to Do After

1. Review migrated files
2. Populate template files (see below)
3. Commit and push

---

## Prerequisites

Before running the script, ensure:

- [ ] You're in the TealTiger workspace root directory
- [ ] You have git installed
- [ ] You have access to https://github.com/agentguard-ai/TealTiger-SOT
- [ ] The following directories exist:
  - `.kiro/specs/sidecar-policy-engine/`
  - `.kiro/specs/multi-provider-expansion/`
  - `.kiro/specs/enterprise-adoption-features/`
  - `.kiro/specs/advanced-secret-detection/`
  - `agentguard-internal-docs/strategic-planning/`
  - `agentguard-internal-docs/competitive-analysis/`

---

## Step-by-Step Execution

### Step 1: Prepare

```bash
# Navigate to your TealTiger workspace
cd ~/projects/TealTiger

# Verify you're in the right place
ls -la .kiro/specs/
```

### Step 2: Make Script Executable

```bash
chmod +x migrate-to-sot.sh
```

### Step 3: Run Migration

```bash
./migrate-to-sot.sh
```

**Expected output**:
```
==========================================
TealTiger-SOT Migration Script
BP-Compliant | Enterprise-Grade
==========================================

Step 1: Cloning TealTiger-SOT repository...
✅ Repository ready

Step 2: Creating BP-compliant directory structure...
✅ Directory structure created

Step 3: Creating .gitignore...
✅ .gitignore created

Step 4: Copying specs from workspace...
ℹ️  Copying TealEngine spec...
✅ TealEngine spec copied
ℹ️  Copying Multi-Provider spec...
✅ Multi-Provider spec copied
ℹ️  Copying Enterprise Adoption spec...
✅ Enterprise Adoption spec copied
ℹ️  Copying Advanced Secret Detection spec...
✅ Advanced Secret Detection spec copied

Step 5: Copying strategic planning documents...
✅ Strategic planning docs copied

Step 6: Copying competitive analysis...
✅ Competitive analysis copied

Step 7: Copying architecture documents...
✅ Architecture strategy copied
✅ OWASP ASI coverage copied
✅ SDK provider matrix copied

Step 8: Creating BP-compliant documentation files...
✅ Changelog files created
✅ Traceability files created
✅ Correctness file created
✅ README files created
✅ CONTRIBUTING.md created
✅ Root README.md created

Step 9: Checking git status...
[git status output]

==========================================
Migration Complete! 🎉
==========================================
```

### Step 4: Navigate to SOT Repository

```bash
cd ~/projects/TealTiger-SOT
```

### Step 5: Review Migrated Files

```bash
# Check directory structure
tree -L 3

# Review what was copied
ls -la specs/v1.1/tealengine/
ls -la specs/v1.1/multi-provider/
ls -la specs/v1.1/enterprise-adoption/
ls -la specs/v1.2/advanced-secret-detection/
```

### Step 6: Populate Template Files

You need to populate these empty template files:

#### Root README.md
```bash
# Copy the template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "Root README.md"
vim README.md
```

#### CONTRIBUTING.md
```bash
# Copy the template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "CONTRIBUTING.md (Root)"
vim CONTRIBUTING.md
```

#### specs/README.md
```bash
# Copy the template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "specs/README.md"
vim specs/README.md
```

#### Changelog files
```bash
# For enterprise-adoption (has patches)
vim specs/v1.1/enterprise-adoption/changelog.md
# Copy template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "specs/v1.1/enterprise-adoption/changelog.md"

# For other specs, create initial entries
vim specs/v1.1/tealengine/changelog.md
vim specs/v1.1/multi-provider/changelog.md
vim specs/v1.2/advanced-secret-detection/changelog.md
```

#### Traceability files
```bash
# For enterprise-adoption (most complete)
vim specs/v1.1/enterprise-adoption/traceability.md
# Copy template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "specs/v1.1/enterprise-adoption/traceability.md"

# For other specs, create basic mappings
vim specs/v1.1/tealengine/traceability.md
vim specs/v1.1/multi-provider/traceability.md
```

#### Correctness file
```bash
# For enterprise-adoption (has PBT)
vim specs/v1.1/enterprise-adoption/correctness.md
# Copy template from TEALTIGER-SOT-MIGRATION-PLAN.md
# Section: "specs/v1.1/enterprise-adoption/correctness.md"
```

#### Spec README files
```bash
# Create overview for each spec
vim specs/v1.1/tealengine/README.md
vim specs/v1.1/multi-provider/README.md
vim specs/v1.1/enterprise-adoption/README.md
vim specs/v1.2/advanced-secret-detection/README.md
```

#### Directory README files
```bash
vim strategic-planning/README.md
vim competitive-analysis/README.md
vim architecture/README.md
```

### Step 7: Commit and Push

```bash
# Check what's staged
git status

# Add all files
git add .

# Commit with descriptive message
git commit -m "Initial migration: BP-compliant structure with specs, strategic planning, and architecture docs

- Migrated v1.1 specs (tealengine, multi-provider, enterprise-adoption)
- Migrated v1.2 spec (advanced-secret-detection)
- Added strategic planning documents
- Added competitive analysis
- Added architecture documentation
- Created BP-compliant structure (patches/, changelog.md, traceability.md)
- Added CONTRIBUTING.md with versioning rules
- Added comprehensive README files"

# Push to GitHub
git push origin main
```

---

## Verification Checklist

After migration, verify:

### Directory Structure
- [ ] `specs/v1.1/tealengine/` exists with requirements.md, design.md, tasks.md
- [ ] `specs/v1.1/multi-provider/` exists with requirements.md, design.md, tasks.md
- [ ] `specs/v1.1/enterprise-adoption/` exists with requirements.md, design.md, tasks.md
- [ ] `specs/v1.2/advanced-secret-detection/` exists with requirements.md
- [ ] All specs have `patches/` directories
- [ ] All specs have `changelog.md`
- [ ] All v1.1 specs have `traceability.md`
- [ ] Enterprise-adoption has `correctness.md`

### Strategic Planning
- [ ] `strategic-planning/` contains all .md files
- [ ] TEALTIGER-STRATEGIC-DOCS-SUMMARY.md exists
- [ ] TEALTIGER-PRODUCT-ROADMAP-2026-2027.md exists
- [ ] TEALTIGER-MONETIZATION-STRATEGY.md exists

### Competitive Analysis
- [ ] `competitive-analysis/` contains ENTERPRISE-FEATURES-COMPETITIVE-ADVANTAGE.md

### Architecture
- [ ] `architecture/` contains TEALTIGER-ARCHITECTURE-STRATEGY.md
- [ ] `architecture/` contains OWASP-ASI-COVERAGE-CLARIFICATION.md
- [ ] `architecture/` contains TEALTIGER-SDK-PROVIDER-MATRIX.md

### Root Files
- [ ] README.md exists and is populated
- [ ] CONTRIBUTING.md exists and is populated
- [ ] .gitignore exists

---

## Troubleshooting

### Issue: "Permission denied" when running script

**Solution**:
```bash
chmod +x migrate-to-sot.sh
```

### Issue: "Directory not found" errors

**Solution**: Ensure you're running the script from the TealTiger workspace root:
```bash
cd ~/projects/TealTiger
pwd  # Should show .../TealTiger
./migrate-to-sot.sh
```

### Issue: "Failed to clone repository"

**Solution**: Check your GitHub access:
```bash
# Test SSH access
ssh -T git@github.com

# Or use HTTPS with token
git config --global credential.helper store
```

### Issue: "No such file or directory" for specific specs

**Solution**: Check if the source directories exist:
```bash
ls -la .kiro/specs/
ls -la agentguard-internal-docs/
```

---

## Post-Migration Tasks

### Immediate (Day 1)
1. ✅ Run migration script
2. ✅ Populate template files
3. ✅ Commit and push to GitHub
4. ✅ Verify repository on GitHub

### Short-Term (Week 1)
5. ✅ Update workspace .kiro/specs/ README files to point to SOT
6. ✅ Update agentguard-internal-docs README to reference SOT
7. ✅ Share SOT repository link with team
8. ✅ Set up branch protection rules on GitHub

### Medium-Term (Month 1)
9. ✅ Establish sync process between SOT and implementation repos
10. ✅ Train team on BP-compliant workflow
11. ✅ Set up automated changelog generation
12. ✅ Create PR templates for spec changes

---

## Success Criteria

Migration is successful when:

- ✅ All specs migrated to SOT repository
- ✅ BP-compliant structure in place
- ✅ All template files populated
- ✅ Changes committed and pushed to GitHub
- ✅ Team has access to repository
- ✅ Documentation is complete and accurate

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review TEALTIGER-SOT-MIGRATION-PLAN.md for detailed steps
3. Review TEALTIGER-SOT-MIGRATION-ANALYSIS.md for BP compliance details
4. Contact: TealTiger Product Team

---

**Script Location**: `migrate-to-sot.sh`  
**Documentation**: `TEALTIGER-SOT-MIGRATION-PLAN.md`  
**Analysis**: `TEALTIGER-SOT-MIGRATION-ANALYSIS.md`  
**Status**: Ready to Execute ✅
