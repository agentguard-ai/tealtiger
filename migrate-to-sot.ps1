# TealTiger-SOT Migration Script (PowerShell)
# Purpose: Migrate specs and docs to TealTiger-SOT repository (BP-Compliant)
# Date: March 5, 2026
# Status: Ready to Execute

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TealTiger-SOT Migration Script" -ForegroundColor Cyan
Write-Host "BP-Compliant | Enterprise-Grade" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$WORKSPACE_ROOT = Get-Location
$SOT_REPO_URL = "https://github.com/agentguard-ai/TealTiger-SOT.git"
$SOT_DIR = "$HOME\projects\TealTiger-SOT"

# Helper functions
function Log-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Log-Info {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Log-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Step 1: Clone TealTiger-SOT repository
Write-Host "Step 1: Cloning TealTiger-SOT repository..." -ForegroundColor Cyan
if (Test-Path $SOT_DIR) {
    Log-Info "Directory $SOT_DIR already exists. Pulling latest changes..."
    Set-Location $SOT_DIR
    try {
        git pull origin main
    } catch {
        Log-Error "Failed to pull latest changes: $_"
    }
} else {
    Log-Info "Cloning repository to $SOT_DIR..."
    New-Item -ItemType Directory -Path "$HOME\projects" -Force | Out-Null
    Set-Location "$HOME\projects"
    try {
        git clone $SOT_REPO_URL
    } catch {
        Log-Error "Failed to clone repository: $_"
        exit 1
    }
}
Set-Location $SOT_DIR
Log-Success "Repository ready"
Write-Host ""

# Step 2: Create BP-compliant directory structure
Write-Host "Step 2: Creating BP-compliant directory structure..." -ForegroundColor Cyan
$directories = @(
    "specs\v1.1\tealengine\patches",
    "specs\v1.1\multi-provider\patches",
    "specs\v1.1\enterprise-adoption\patches",
    "specs\v1.2\advanced-secret-detection",
    "strategic-planning",
    "competitive-analysis",
    "architecture",
    "archive\releases\v0.2.0",
    "archive\releases\v0.2.1",
    "archive\releases\v0.2.2",
    "archive\legacy\agentguard-era"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
Log-Success "Directory structure created"
Write-Host ""

# Step 3: Create .gitignore
Write-Host "Step 3: Creating .gitignore..." -ForegroundColor Cyan
$gitignoreLines = @(
    "# OS files",
    ".DS_Store",
    "Thumbs.db",
    "",
    "# Editor files",
    ".vscode/",
    ".idea/",
    "*.swp",
    "*.swo",
    "*~",
    "",
    "# Sensitive files",
    "*.key",
    "*.pem",
    "*PAT*",
    "*token*",
    "*secret*",
    "",
    "# Temporary files",
    "*.tmp",
    "*.bak",
    "*.log"
)
$gitignoreLines | Out-File -FilePath ".gitignore" -Encoding utf8
Log-Success ".gitignore created"
Write-Host ""

# Step 4: Copy specs from workspace
Write-Host "Step 4: Copying specs from workspace..." -ForegroundColor Cyan
Set-Location $WORKSPACE_ROOT

# Copy v1.1 TealEngine spec
if (Test-Path ".kiro\specs\sidecar-policy-engine") {
    Log-Info "Copying TealEngine spec..."
    Copy-Item -Path ".kiro\specs\sidecar-policy-engine\*" -Destination "$SOT_DIR\specs\v1.1\tealengine\" -Recurse -Force
    Log-Success "TealEngine spec copied"
} else {
    Log-Error "TealEngine spec not found at .kiro\specs\sidecar-policy-engine"
}

# Copy v1.1 Multi-Provider spec
if (Test-Path ".kiro\specs\multi-provider-expansion") {
    Log-Info "Copying Multi-Provider spec..."
    Copy-Item -Path ".kiro\specs\multi-provider-expansion\*" -Destination "$SOT_DIR\specs\v1.1\multi-provider\" -Recurse -Force
    Log-Success "Multi-Provider spec copied"
} else {
    Log-Error "Multi-Provider spec not found at .kiro\specs\multi-provider-expansion"
}

# Copy v1.1 Enterprise Adoption spec
if (Test-Path ".kiro\specs\enterprise-adoption-features") {
    Log-Info "Copying Enterprise Adoption spec..."
    Copy-Item -Path ".kiro\specs\enterprise-adoption-features\*" -Destination "$SOT_DIR\specs\v1.1\enterprise-adoption\" -Recurse -Force
    Log-Success "Enterprise Adoption spec copied"
} else {
    Log-Error "Enterprise Adoption spec not found at .kiro\specs\enterprise-adoption-features"
}

# Copy v1.2 Advanced Secret Detection spec
if (Test-Path ".kiro\specs\advanced-secret-detection") {
    Log-Info "Copying Advanced Secret Detection spec..."
    Copy-Item -Path ".kiro\specs\advanced-secret-detection\*" -Destination "$SOT_DIR\specs\v1.2\advanced-secret-detection\" -Recurse -Force
    Log-Success "Advanced Secret Detection spec copied"
} else {
    Log-Error "Advanced Secret Detection spec not found at .kiro\specs\advanced-secret-detection"
}

# Copy existing patches from agentguard-internal-docs
if (Test-Path "agentguard-internal-docs\specs\enterprise-adoption-features") {
    Log-Info "Copying existing patches..."
    try {
        Copy-Item -Path "agentguard-internal-docs\specs\enterprise-adoption-features\*.patch" -Destination "$SOT_DIR\specs\v1.1\enterprise-adoption\patches\" -Force -ErrorAction SilentlyContinue
    } catch {
        Log-Info "No patch files found"
    }
}

Write-Host ""

# Step 5: Copy strategic planning docs
Write-Host "Step 5: Copying strategic planning documents..." -ForegroundColor Cyan
if (Test-Path "agentguard-internal-docs\strategic-planning") {
    Copy-Item -Path "agentguard-internal-docs\strategic-planning\*.md" -Destination "$SOT_DIR\strategic-planning\" -Force
    Log-Success "Strategic planning docs copied"
} else {
    Log-Error "Strategic planning directory not found"
}
Write-Host ""

# Step 6: Copy competitive analysis
Write-Host "Step 6: Copying competitive analysis..." -ForegroundColor Cyan
if (Test-Path "agentguard-internal-docs\competitive-analysis") {
    Copy-Item -Path "agentguard-internal-docs\competitive-analysis\*.md" -Destination "$SOT_DIR\competitive-analysis\" -Force
    Log-Success "Competitive analysis copied"
} else {
    Log-Error "Competitive analysis directory not found"
}
Write-Host ""

# Step 7: Copy architecture docs
Write-Host "Step 7: Copying architecture documents..." -ForegroundColor Cyan
if (Test-Path "TEALTIGER-ARCHITECTURE-STRATEGY.md") {
    Copy-Item -Path "TEALTIGER-ARCHITECTURE-STRATEGY.md" -Destination "$SOT_DIR\architecture\" -Force
    Log-Success "Architecture strategy copied"
}
if (Test-Path "OWASP-ASI-COVERAGE-CLARIFICATION.md") {
    Copy-Item -Path "OWASP-ASI-COVERAGE-CLARIFICATION.md" -Destination "$SOT_DIR\architecture\" -Force
    Log-Success "OWASP ASI coverage copied"
}
if (Test-Path "agentguard-internal-docs\TEALTIGER-SDK-PROVIDER-MATRIX.md") {
    Copy-Item -Path "agentguard-internal-docs\TEALTIGER-SDK-PROVIDER-MATRIX.md" -Destination "$SOT_DIR\architecture\" -Force
    Log-Success "SDK provider matrix copied"
}
Write-Host ""

# Step 8: Create BP-compliant documentation files
Write-Host "Step 8: Creating BP-compliant documentation files..." -ForegroundColor Cyan
Set-Location $SOT_DIR

# Create changelog.md files
New-Item -ItemType File -Path "specs\v1.1\tealengine\changelog.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\multi-provider\changelog.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\enterprise-adoption\changelog.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.2\advanced-secret-detection\changelog.md" -Force | Out-Null
Log-Success "Changelog files created"

# Create traceability.md files
New-Item -ItemType File -Path "specs\v1.1\tealengine\traceability.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\multi-provider\traceability.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\enterprise-adoption\traceability.md" -Force | Out-Null
Log-Success "Traceability files created"

# Create correctness.md for enterprise-adoption
New-Item -ItemType File -Path "specs\v1.1\enterprise-adoption\correctness.md" -Force | Out-Null
Log-Success "Correctness file created"

# Create README.md files
New-Item -ItemType File -Path "specs\v1.1\tealengine\README.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\multi-provider\README.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.1\enterprise-adoption\README.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\v1.2\advanced-secret-detection\README.md" -Force | Out-Null
New-Item -ItemType File -Path "specs\README.md" -Force | Out-Null
New-Item -ItemType File -Path "strategic-planning\README.md" -Force | Out-Null
New-Item -ItemType File -Path "competitive-analysis\README.md" -Force | Out-Null
New-Item -ItemType File -Path "architecture\README.md" -Force | Out-Null
Log-Success "README files created"

# Create CONTRIBUTING.md
New-Item -ItemType File -Path "CONTRIBUTING.md" -Force | Out-Null
Log-Success "CONTRIBUTING.md created"

# Create root README.md
New-Item -ItemType File -Path "README.md" -Force | Out-Null
Log-Success "Root README.md created"

Write-Host ""

# Step 9: Git status
Write-Host "Step 9: Checking git status..." -ForegroundColor Cyan
Set-Location $SOT_DIR
git status
Write-Host ""

# Step 10: Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. cd $SOT_DIR"
Write-Host "2. Review the migrated files"
Write-Host "3. Populate template files"
Write-Host "4. git add ."
Write-Host "5. git commit -m 'Initial migration'"
Write-Host "6. git push origin main"
Write-Host ""
Write-Host "Files migrated:" -ForegroundColor Yellow
Write-Host "  - specs/v1.1/tealengine/"
Write-Host "  - specs/v1.1/multi-provider/"
Write-Host "  - specs/v1.1/enterprise-adoption/"
Write-Host "  - specs/v1.2/advanced-secret-detection/"
Write-Host "  - strategic-planning/"
Write-Host "  - competitive-analysis/"
Write-Host "  - architecture/"
Write-Host ""
Write-Host "BP-compliant files created:" -ForegroundColor Yellow
Write-Host "  - changelog.md files"
Write-Host "  - traceability.md files"
Write-Host "  - correctness.md file"
Write-Host "  - README.md files"
Write-Host "  - CONTRIBUTING.md"
Write-Host "  - .gitignore"
Write-Host ""
Write-Host "Location: $SOT_DIR" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
