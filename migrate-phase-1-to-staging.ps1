# Phase 1 Migration Script
# Migrates Phase 1 implementation files to proper locations in packages/tealtiger-sdk

Write-Host "Starting Phase 1 Migration..." -ForegroundColor Green

# Step 1: Create context directory
Write-Host "`n[1/6] Creating context directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "packages/tealtiger-sdk/src/core/context" | Out-Null
New-Item -ItemType Directory -Force -Path "packages/tealtiger-sdk/src/core/context/__tests__" | Out-Null
Write-Host "✓ Context directory created" -ForegroundColor Green

# Step 2: Backup existing types.ts
Write-Host "`n[2/6] Backing up existing types.ts..." -ForegroundColor Cyan
Copy-Item "packages/tealtiger-sdk/src/core/engine/types.ts" "packages/tealtiger-sdk/src/core/engine/types.backup.ts"
Write-Host "✓ Backup created: types.backup.ts" -ForegroundColor Green

# Step 3: Merge types.ts files
Write-Host "`n[3/6] Merging types.ts files..." -ForegroundColor Cyan
$existingTypes = Get-Content "packages/tealtiger-sdk/src/core/engine/types.ts" -Raw
$newTypes = Get-Content "task-1.1-types.ts" -Raw

# Create merged types.ts with both old and new content
$mergedTypes = @"
/**
 * TealEngine - Core Policy Framework Types
 * 
 * Defines all policy types and interfaces for TealTiger's embedded policy engine.
 * Part of TealTiger v1.1.0 - Zero Infrastructure AI Security
 * 
 * @module core/engine/types
 */

// ============================================================================
// PART 1: Enterprise Adoption Features (v1.1.x)
// P0.1: Policy Rollout Modes & P0.2: Deterministic Decision Contract
// ============================================================================

$newTypes

// ============================================================================
// PART 2: TealEngine Policy Types (existing)
// ============================================================================

$($existingTypes -replace '\/\*\*[\s\S]*?\*\/\s*', '' -replace '^\s*$', '' | Select-Object -Skip 8)
"@

Set-Content "packages/tealtiger-sdk/src/core/engine/types.ts" $mergedTypes
Write-Host "✓ Types merged successfully" -ForegroundColor Green

# Step 4: Copy implementation files
Write-Host "`n[4/6] Copying implementation files..." -ForegroundColor Cyan

# Context files
Copy-Item "task-1.2-ExecutionContext.ts" "packages/tealtiger-sdk/src/core/context/ExecutionContext.ts"
Copy-Item "task-1.2-ContextManager.ts" "packages/tealtiger-sdk/src/core/context/ContextManager.ts"
Write-Host "  ✓ ExecutionContext.ts" -ForegroundColor Gray
Write-Host "  ✓ ContextManager.ts" -ForegroundColor Gray

# Engine files
Copy-Item "task-1.3-ModeResolver.ts" "packages/tealtiger-sdk/src/core/engine/ModeResolver.ts"
Copy-Item "task-1.4-TealEngineConfig.ts" "packages/tealtiger-sdk/src/core/engine/TealEngineConfig.ts"
Write-Host "  ✓ ModeResolver.ts" -ForegroundColor Gray
Write-Host "  ✓ TealEngineConfig.ts" -ForegroundColor Gray

Write-Host "✓ Implementation files copied" -ForegroundColor Green

# Step 5: Copy test files
Write-Host "`n[5/6] Copying test files..." -ForegroundColor Cyan

Copy-Item "task-1.1-types.test.ts" "packages/tealtiger-sdk/src/core/engine/__tests__/types.test.ts"
Copy-Item "task-1.2-context.test.ts" "packages/tealtiger-sdk/src/core/context/__tests__/context.test.ts"
Copy-Item "task-1.3-ModeResolver.test.ts" "packages/tealtiger-sdk/src/core/engine/__tests__/ModeResolver.test.ts"
Copy-Item "task-1.4-TealEngineConfig.test.ts" "packages/tealtiger-sdk/src/core/engine/__tests__/TealEngineConfig.test.ts"

Write-Host "  ✓ types.test.ts" -ForegroundColor Gray
Write-Host "  ✓ context.test.ts" -ForegroundColor Gray
Write-Host "  ✓ ModeResolver.test.ts" -ForegroundColor Gray
Write-Host "  ✓ TealEngineConfig.test.ts" -ForegroundColor Gray

Write-Host "✓ Test files copied" -ForegroundColor Green

# Step 6: Update import paths in copied files
Write-Host "`n[6/6] Updating import paths..." -ForegroundColor Cyan

# Update ContextManager.ts imports
$contextManager = Get-Content "packages/tealtiger-sdk/src/core/context/ContextManager.ts" -Raw
$contextManager = $contextManager -replace "from './ExecutionContext'", "from './ExecutionContext'"
Set-Content "packages/tealtiger-sdk/src/core/context/ContextManager.ts" $contextManager

# Update ModeResolver.ts imports
$modeResolver = Get-Content "packages/tealtiger-sdk/src/core/engine/ModeResolver.ts" -Raw
$modeResolver = $modeResolver -replace "from './task-1.1-types'", "from './types'"
Set-Content "packages/tealtiger-sdk/src/core/engine/ModeResolver.ts" $modeResolver

# Update TealEngineConfig.ts imports
$tealEngineConfig = Get-Content "packages/tealtiger-sdk/src/core/engine/TealEngineConfig.ts" -Raw
$tealEngineConfig = $tealEngineConfig -replace "from './task-1.1-types'", "from './types'"
$tealEngineConfig = $tealEngineConfig -replace "from './task-1.3-ModeResolver'", "from './ModeResolver'"
Set-Content "packages/tealtiger-sdk/src/core/engine/TealEngineConfig.ts" $tealEngineConfig

# Update test file imports
$typesTest = Get-Content "packages/tealtiger-sdk/src/core/engine/__tests__/types.test.ts" -Raw
$typesTest = $typesTest -replace "from './types'", "from '../types'"
Set-Content "packages/tealtiger-sdk/src/core/engine/__tests__/types.test.ts" $typesTest

$contextTest = Get-Content "packages/tealtiger-sdk/src/core/context/__tests__/context.test.ts" -Raw
$contextTest = $contextTest -replace "from './ExecutionContext'", "from '../ExecutionContext'"
$contextTest = $contextTest -replace "from './ContextManager'", "from '../ContextManager'"
Set-Content "packages/tealtiger-sdk/src/core/context/__tests__/context.test.ts" $contextTest

$modeResolverTest = Get-Content "packages/tealtiger-sdk/src/core/engine/__tests__/ModeResolver.test.ts" -Raw
$modeResolverTest = $modeResolverTest -replace "from './task-1.3-ModeResolver'", "from '../ModeResolver'"
Set-Content "packages/tealtiger-sdk/src/core/engine/__tests__/ModeResolver.test.ts" $modeResolverTest

$tealEngineConfigTest = Get-Content "packages/tealtiger-sdk/src/core/engine/__tests__/TealEngineConfig.test.ts" -Raw
$tealEngineConfigTest = $tealEngineConfigTest -replace "from './task-1.4-TealEngineConfig'", "from '../TealEngineConfig'"
Set-Content "packages/tealtiger-sdk/src/core/engine/__tests__/TealEngineConfig.test.ts" $tealEngineConfigTest

Write-Host "✓ Import paths updated" -ForegroundColor Green

# Step 7: Create/update index files
Write-Host "`n[7/7] Creating index files..." -ForegroundColor Cyan

# Create context/index.ts
$contextIndex = @"
/**
 * TealTiger SDK - Execution Context Module
 * 
 * Provides ExecutionContext and ContextManager for request tracing and correlation.
 * Part of Enterprise Adoption Features (P0.3)
 * 
 * @module core/context
 */

export * from './ExecutionContext';
export * from './ContextManager';
"@
Set-Content "packages/tealtiger-sdk/src/core/context/index.ts" $contextIndex

# Update engine/index.ts
$engineIndex = @"
/**
 * TealTiger SDK - Policy Engine Module
 * 
 * Core policy engine with mode support, decision contract, and policy evaluation.
 * 
 * @module core/engine
 */

export * from './types';
export * from './ModeResolver';
export * from './TealEngineConfig';
export * from './TealEngine';
export * from './PolicyEvaluator';
export * from './PolicyValidator';
export * from './PolicyTester';
export * from './PolicyCache';
"@
Set-Content "packages/tealtiger-sdk/src/core/engine/index.ts" $engineIndex

# Update core/index.ts
$coreIndex = @"
/**
 * TealTiger SDK - Core Module
 * 
 * Core components: Engine, Guard, Circuit, Monitor, Audit, Context
 * 
 * @module core
 */

export * from './engine';
export * from './context';
export * from './guard';
export * from './circuit';
export * from './monitor';
export * from './audit';
"@
Set-Content "packages/tealtiger-sdk/src/core/index.ts" $coreIndex

Write-Host "✓ Index files created" -ForegroundColor Green

Write-Host "`n✅ Phase 1 Migration Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. cd packages/tealtiger-sdk" -ForegroundColor Gray
Write-Host "  2. npm test" -ForegroundColor Gray
Write-Host "  3. npm run build" -ForegroundColor Gray
Write-Host "  4. Review changes and commit" -ForegroundColor Gray
