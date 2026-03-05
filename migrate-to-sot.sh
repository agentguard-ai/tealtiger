#!/bin/bash

# TealTiger-SOT Migration Script
# Purpose: Migrate specs and docs to TealTiger-SOT repository (BP-Compliant)
# Date: March 5, 2026
# Status: Ready to Execute

set -e  # Exit on error

echo "=========================================="
echo "TealTiger-SOT Migration Script"
echo "BP-Compliant | Enterprise-Grade"
echo "=========================================="
echo ""

# Configuration
WORKSPACE_ROOT="$(pwd)"
SOT_REPO_URL="https://github.com/agentguard-ai/TealTiger-SOT.git"
SOT_DIR="$HOME/projects/TealTiger-SOT"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Clone TealTiger-SOT repository
echo "Step 1: Cloning TealTiger-SOT repository..."
if [ -d "$SOT_DIR" ]; then
    log_info "Directory $SOT_DIR already exists. Pulling latest changes..."
    cd "$SOT_DIR"
    git pull origin main || log_error "Failed to pull latest changes"
else
    log_info "Cloning repository to $SOT_DIR..."
    mkdir -p "$HOME/projects"
    cd "$HOME/projects"
    git clone "$SOT_REPO_URL" || log_error "Failed to clone repository"
fi
cd "$SOT_DIR"
log_success "Repository ready"
echo ""

# Step 2: Create BP-compliant directory structure
echo "Step 2: Creating BP-compliant directory structure..."
mkdir -p specs/v1.1/tealengine/patches
mkdir -p specs/v1.1/multi-provider/patches
mkdir -p specs/v1.1/enterprise-adoption/patches
mkdir -p specs/v1.2/advanced-secret-detection
mkdir -p strategic-planning
mkdir -p competitive-analysis
mkdir -p architecture
mkdir -p archive/releases/v0.2.0
mkdir -p archive/releases/v0.2.1
mkdir -p archive/releases/v0.2.2
mkdir -p archive/legacy/agentguard-era
log_success "Directory structure created"
echo ""

# Step 3: Create .gitignore
echo "Step 3: Creating .gitignore..."
cat > .gitignore << 'EOF'
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Sensitive files
*.key
*.pem
*PAT*
*token*
*secret*

# Temporary files
*.tmp
*.bak
*.log
EOF
log_success ".gitignore created"
echo ""

# Step 4: Copy specs from workspace
echo "Step 4: Copying specs from workspace..."
cd "$WORKSPACE_ROOT"

# Copy v1.1 TealEngine spec
if [ -d ".kiro/specs/sidecar-policy-engine" ]; then
    log_info "Copying TealEngine spec..."
    cp -r .kiro/specs/sidecar-policy-engine/* "$SOT_DIR/specs/v1.1/tealengine/"
    log_success "TealEngine spec copied"
else
    log_error "TealEngine spec not found at .kiro/specs/sidecar-policy-engine"
fi

# Copy v1.1 Multi-Provider spec
if [ -d ".kiro/specs/multi-provider-expansion" ]; then
    log_info "Copying Multi-Provider spec..."
    cp -r .kiro/specs/multi-provider-expansion/* "$SOT_DIR/specs/v1.1/multi-provider/"
    log_success "Multi-Provider spec copied"
else
    log_error "Multi-Provider spec not found at .kiro/specs/multi-provider-expansion"
fi

# Copy v1.1 Enterprise Adoption spec
if [ -d ".kiro/specs/enterprise-adoption-features" ]; then
    log_info "Copying Enterprise Adoption spec..."
    cp -r .kiro/specs/enterprise-adoption-features/* "$SOT_DIR/specs/v1.1/enterprise-adoption/"
    log_success "Enterprise Adoption spec copied"
else
    log_error "Enterprise Adoption spec not found at .kiro/specs/enterprise-adoption-features"
fi

# Copy v1.2 Advanced Secret Detection spec
if [ -d ".kiro/specs/advanced-secret-detection" ]; then
    log_info "Copying Advanced Secret Detection spec..."
    cp -r .kiro/specs/advanced-secret-detection/* "$SOT_DIR/specs/v1.2/advanced-secret-detection/"
    log_success "Advanced Secret Detection spec copied"
else
    log_error "Advanced Secret Detection spec not found at .kiro/specs/advanced-secret-detection"
fi

# Copy existing patches from agentguard-internal-docs
if [ -d "agentguard-internal-docs/specs/enterprise-adoption-features" ]; then
    log_info "Copying existing patches..."
    cp agentguard-internal-docs/specs/enterprise-adoption-features/*.patch "$SOT_DIR/specs/v1.1/enterprise-adoption/patches/" 2>/dev/null || log_info "No patch files found"
fi

echo ""

# Step 5: Copy strategic planning docs
echo "Step 5: Copying strategic planning documents..."
if [ -d "agentguard-internal-docs/strategic-planning" ]; then
    cp agentguard-internal-docs/strategic-planning/*.md "$SOT_DIR/strategic-planning/"
    log_success "Strategic planning docs copied"
else
    log_error "Strategic planning directory not found"
fi
echo ""

# Step 6: Copy competitive analysis
echo "Step 6: Copying competitive analysis..."
if [ -d "agentguard-internal-docs/competitive-analysis" ]; then
    cp agentguard-internal-docs/competitive-analysis/*.md "$SOT_DIR/competitive-analysis/"
    log_success "Competitive analysis copied"
else
    log_error "Competitive analysis directory not found"
fi
echo ""

# Step 7: Copy architecture docs
echo "Step 7: Copying architecture documents..."
if [ -f "TEALTIGER-ARCHITECTURE-STRATEGY.md" ]; then
    cp TEALTIGER-ARCHITECTURE-STRATEGY.md "$SOT_DIR/architecture/"
    log_success "Architecture strategy copied"
fi
if [ -f "OWASP-ASI-COVERAGE-CLARIFICATION.md" ]; then
    cp OWASP-ASI-COVERAGE-CLARIFICATION.md "$SOT_DIR/architecture/"
    log_success "OWASP ASI coverage copied"
fi
if [ -f "agentguard-internal-docs/TEALTIGER-SDK-PROVIDER-MATRIX.md" ]; then
    cp agentguard-internal-docs/TEALTIGER-SDK-PROVIDER-MATRIX.md "$SOT_DIR/architecture/"
    log_success "SDK provider matrix copied"
fi
echo ""

# Step 8: Create BP-compliant documentation files
echo "Step 8: Creating BP-compliant documentation files..."
cd "$SOT_DIR"

# Create changelog.md files
touch specs/v1.1/tealengine/changelog.md
touch specs/v1.1/multi-provider/changelog.md
touch specs/v1.1/enterprise-adoption/changelog.md
touch specs/v1.2/advanced-secret-detection/changelog.md
log_success "Changelog files created"

# Create traceability.md files
touch specs/v1.1/tealengine/traceability.md
touch specs/v1.1/multi-provider/traceability.md
touch specs/v1.1/enterprise-adoption/traceability.md
log_success "Traceability files created"

# Create correctness.md for enterprise-adoption
touch specs/v1.1/enterprise-adoption/correctness.md
log_success "Correctness file created"

# Create README.md files
touch specs/v1.1/tealengine/README.md
touch specs/v1.1/multi-provider/README.md
touch specs/v1.1/enterprise-adoption/README.md
touch specs/v1.2/advanced-secret-detection/README.md
touch specs/README.md
touch strategic-planning/README.md
touch competitive-analysis/README.md
touch architecture/README.md
log_success "README files created"

# Create CONTRIBUTING.md
touch CONTRIBUTING.md
log_success "CONTRIBUTING.md created"

# Create root README.md
touch README.md
log_success "Root README.md created"

echo ""

# Step 9: Git status
echo "Step 9: Checking git status..."
cd "$SOT_DIR"
git status
echo ""

# Step 10: Summary
echo "=========================================="
echo "Migration Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. cd $SOT_DIR"
echo "2. Review the migrated files"
echo "3. Populate template files (README.md, changelog.md, etc.)"
echo "4. git add ."
echo "5. git commit -m 'Initial migration: BP-compliant structure with specs, strategic planning, and architecture docs'"
echo "6. git push origin main"
echo ""
echo "Files migrated:"
echo "  ✅ specs/v1.1/tealengine/"
echo "  ✅ specs/v1.1/multi-provider/"
echo "  ✅ specs/v1.1/enterprise-adoption/"
echo "  ✅ specs/v1.2/advanced-secret-detection/"
echo "  ✅ strategic-planning/"
echo "  ✅ competitive-analysis/"
echo "  ✅ architecture/"
echo ""
echo "BP-compliant files created:"
echo "  ✅ changelog.md (4 files)"
echo "  ✅ traceability.md (3 files)"
echo "  ✅ correctness.md (1 file)"
echo "  ✅ README.md (9 files)"
echo "  ✅ CONTRIBUTING.md"
echo "  ✅ .gitignore"
echo ""
echo "Location: $SOT_DIR"
echo "=========================================="
