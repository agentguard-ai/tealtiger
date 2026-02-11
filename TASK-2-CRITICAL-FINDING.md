# Task 2 - Critical Finding: Type Structure Mismatch

## Date
February 10, 2026

## Status
🚨 **CRITICAL ISSUE DISCOVERED**

## Summary
While implementing Task 2 (Unit Tests for TealEngine), I discovered a fundamental mismatch between the implemented types in `types.ts` and what the design specification requires.

## The Problem

### What Was Implemented (Task 1.1)
The current `types.ts` file has this structure:

```typescript
export interface ToolPolicy {
  [toolName: string]: {
    allowed: boolean;
    maxSize?: string;
    rateLimit?: { max: number; window: string; };
    // ... more fields
  };
}

export interface IdentityPolicy {
  agentId: string;
  role: string;
  permissions: string[];
  forbidden?: string[];
  costLimit?: { daily?: number; hourly?: number; monthly?: number; };
}

export interface TealPolicy {
  tools?: ToolPolicy;
  identity?: IdentityPolicy;
  codeExecution?: CodeExecutionPolicy;
  behavioral?: BehavioralPolicy;
  memory?: MemoryPolicy;
  content?: ContentPolicy;
}
```

### What The Design Spec Requires
Based on the design document and the PolicyEvaluator implementation, the spec expects:

```typescript
export interface TealPolicy {
  name: string;
  description?: string;
  version?: string;
  enabled?: boolean;
  tools?: {
    allowedTools?: string[];
    blockedTools?: string[];
    maxToolCalls?: number;
    requireApproval?: string[];
    toolSpecificRules?: Record<string, any>;
  };
  identity?: {
    allowedIdentities?: string[];
    blockedIdentities?: string[];
    requireAuthentication?: boolean;
    forbiddenActions?: string[];
    permissions?: Record<string, string[]>;
  };
  // ... etc
}
```

## Impact

### Files Affected
1. ✅ `types.ts` - Implemented with wrong structure
2. ✅ `TealEngine.ts` - Uses the wrong types
3. ✅ `PolicyEvaluator.ts` - Expects different structure
4. ✅ `PolicyCache.ts` - Works with wrong types
5. ✅ `PolicyValidator.ts` - Validates wrong structure
6. ✅ `PolicyTester.ts` - Tests wrong structure
7. ❌ `__tests__/generators.ts` - Created for wrong structure
8. ❌ `__tests__/helpers.ts` - Created for wrong structure
9. ❌ `__tests__/TealEngine.test.ts` - Tests wrong structure

### Build Status
- TypeScript compilation: ✅ PASSES (but with wrong types)
- Tests: ❌ FAIL (45+ type errors)

## Root Cause Analysis

The issue occurred in Task 1.1 when I created the types without carefully reading the design specification. I implemented a more "enterprise-like" structure with:
- Dictionary-based tool policies (`[toolName: string]: {...}`)
- Single identity per policy
- More complex nested structures

But the design spec clearly requires:
- Array-based allow/block lists
- Multiple identities support
- Simpler, flatter structure
- Policy metadata (name, description, version, enabled)

## Options to Fix

### Option 1: Rewrite All of Task 1 (RECOMMENDED)
**Pros:**
- Matches design spec exactly
- Clean implementation
- Tests will work correctly

**Cons:**
- Loses all Task 1 work
- Takes 2-3 hours to redo
- Need to re-test everything

**Effort:** 2-3 hours

### Option 2: Update Design Spec to Match Implementation
**Pros:**
- Keeps current code
- No rework needed

**Cons:**
- Changes agreed-upon design
- May not meet requirements
- Breaks spec-driven development process

**Effort:** 1 hour (update docs)

### Option 3: Create Adapter Layer
**Pros:**
- Keeps both structures
- Backward compatible

**Cons:**
- Added complexity
- Performance overhead
- Confusing for users

**Effort:** 3-4 hours

## Recommendation

**I STRONGLY RECOMMEND OPTION 1: Rewrite Task 1**

### Reasoning:
1. **Spec-Driven Development**: We committed to following the spec
2. **Clean Code**: Starting fresh is better than patching
3. **Testing**: Tests need to match the design
4. **Future Work**: All future tasks depend on correct types

### Implementation Plan:
1. **Backup Current Work**: Save current files to `_backup/` folder
2. **Read Design Spec Carefully**: Review requirements.md and design.md
3. **Rewrite types.ts**: Match spec exactly
4. **Rewrite TealEngine.ts**: Use correct types
5. **Rewrite PolicyEvaluator.ts**: Match spec logic
6. **Rewrite PolicyCache.ts**: Update for new types
7. **Rewrite PolicyValidator.ts**: Validate correct structure
8. **Rewrite PolicyTester.ts**: Test correct structure
9. **Update Tests**: Fix all test files
10. **Verify Build**: Ensure TypeScript compiles
11. **Run Tests**: Ensure all tests pass

**Estimated Time:** 2-3 hours

## Decision Required

**USER INPUT NEEDED:**

Which option should we proceed with?

1. **Option 1**: Rewrite Task 1 to match design spec (RECOMMENDED)
2. **Option 2**: Update design spec to match current implementation
3. **Option 3**: Create adapter layer between structures

Please respond with the option number (1, 2, or 3).

## Next Steps (After Decision)

### If Option 1 (Rewrite):
1. Create backup of current implementation
2. Start fresh with types.ts based on design spec
3. Implement all Task 1 sub-tasks correctly
4. Write tests that match the spec
5. Document the corrected implementation

### If Option 2 (Update Spec):
1. Update requirements.md with new type structure
2. Update design.md with new interfaces
3. Update tasks.md if needed
4. Fix test files to match current implementation
5. Document the changes

### If Option 3 (Adapter):
1. Create adapter interfaces
2. Implement conversion functions
3. Update TealEngine to use adapter
4. Write tests for both structures
5. Document the adapter pattern

## Files to Review

Before making a decision, please review:
1. `.kiro/specs/sidecar-policy-engine/design.md` - Section 4.2 (Type Definitions)
2. `.kiro/specs/sidecar-policy-engine/requirements.md` - User Stories
3. `packages/tealtiger-sdk/src/core/engine/types.ts` - Current implementation

## Conclusion

This is a critical finding that blocks Task 2 progress. We need a decision on how to proceed before continuing with test implementation.

**Status:** ⏸️ PAUSED - Awaiting user decision

---

**Document Version:** 1.0  
**Created:** February 10, 2026  
**Author:** Kiro AI Assistant  
**Priority:** 🚨 CRITICAL
