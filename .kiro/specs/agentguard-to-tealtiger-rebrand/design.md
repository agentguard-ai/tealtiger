# Design Document: AgentGuard to TealTiger Rebrand

## Overview

This design document outlines the comprehensive approach for rebranding AgentGuard to TealTiger across all codebases, documentation, infrastructure, and brand assets. The rebrand addresses market positioning challenges by establishing a unique, memorable brand identity with no trademark conflicts.

### Scope

The rebrand encompasses:
- **TypeScript SDK** (packages/agent-guard-sdk/) → tealtiger-typescript
- **Python SDK** (packages/agentguard-python/) → tealtiger-python  
- **Landing Page** (agentguard-landing/) → tealtiger-landing
- **Main Repository** (agentguard-main-repo/) → tealtiger
- **Package Registries** (NPM and PyPI)
- **GitHub Organization and Repositories**
- **Documentation and Examples**
- **Brand Assets and Visual Identity**

### Key Design Decisions

Based on the requirements and user context, the following key decisions have been made:

1. **Class Naming Convention**: Use "Teal" prefix (TealOpenAI, TealAnthropic, TealAzureOpenAI)
   - Rationale: Shorter, cleaner, and maintains the "guarded" semantic through the brand name itself
   - Alternative considered: TealTigerOpenAI (too verbose), GuardedOpenAI (minimal change, misses rebrand opportunity)

2. **Package Naming**: Use unscoped packages
   - NPM: `tealtiger` (not @tealtiger/sdk)
   - PyPI: `tealtiger`
   - Rationale: Simpler, more memorable, easier to type, no organization scope needed initially

3. **Organization Strategy**: Keep existing "agentguard-ai" organization, rename repositories
   - Rationale: Avoids GitHub organization migration complexity, maintains stars/forks/issues
   - Repository names will clearly indicate TealTiger brand

4. **Backward Compatibility**: Clean break with migration guide
   - No deprecated aliases (keeps codebase clean)
   - Comprehensive migration documentation
   - Major version bump (1.0.0) to signal breaking change

5. **Rollout Strategy**: Phased approach with validation gates
   - Phase 1: Code and configuration
   - Phase 2: Documentation and examples
   - Phase 3: Infrastructure and deployment

## Architecture

### Repository Structure

```
agentguard-ai/                    (GitHub Organization - kept as-is)
├── tealtiger/                    (Main repo - renamed from agentguard)
│   ├── README.md
│   ├── CONTRIBUTING.md
│   ├── examples/
│   └── docs/
├── tealtiger-typescript/         (TypeScript SDK - renamed from agentguard-typescript)
│   ├── packages/
│   │   └── tealtiger-sdk/       (renamed from agent-guard-sdk)
│   │       ├── src/
│   │       │   ├── clients/
│   │       │   │   ├── TealOpenAI.ts      (renamed from GuardedOpenAI.ts)
│   │       │   │   ├── TealAnthropic.ts   (renamed from GuardedAnthropic.ts)
│   │       │   │   └── TealAzureOpenAI.ts (renamed from GuardedAzureOpenAI.ts)
│   │       │   ├── core/
│   │       │   ├── guardrails/
│   │       │   └── index.ts
│   │       ├── package.json
│   │       └── README.md
│   └── tealtiger-landing/       (renamed from agentguard-landing)
│       ├── app/
│       ├── components/
│       └── public/
└── tealtiger-python/            (Python SDK - renamed from agentguard-python)
    ├── src/
    │   └── tealtiger/           (renamed from agentguard)
    │       ├── clients/
    │       │   ├── teal_openai.py      (renamed from guarded_openai.py)
    │       │   ├── teal_anthropic.py   (renamed from guarded_anthropic.py)
    │       │   └── teal_azure_openai.py (renamed from guarded_azure_openai.py)
    │       ├── core/
    │       └── guardrails/
    ├── pyproject.toml
    └── README.md
```

### Naming Convention Mapping

#### Package Names
| Old Name | New Name | Registry |
|----------|----------|----------|
| agentguard-sdk | tealtiger | NPM |
| @agentguard/sdk | tealtiger | NPM |
| agentguard-sdk (Python) | tealtiger | PyPI |

#### Import Paths
| Old Import | New Import | Language |
|------------|------------|----------|
| `import { GuardedOpenAI } from 'agentguard-sdk'` | `import { TealOpenAI } from 'tealtiger'` | TypeScript |
| `from agentguard import GuardedOpenAI` | `from tealtiger import TealOpenAI` | Python |
| `from agentguard.clients import GuardedAnthropic` | `from tealtiger.clients import TealAnthropic` | Python |

#### Class Names
| Old Class Name | New Class Name | Purpose |
|----------------|----------------|---------|
| GuardedOpenAI | TealOpenAI | OpenAI client wrapper |
| GuardedAnthropic | TealAnthropic | Anthropic client wrapper |
| GuardedAzureOpenAI | TealAzureOpenAI | Azure OpenAI client wrapper |
| GuardedOpenAIConfig | TealOpenAIConfig | OpenAI configuration |
| GuardedAnthropicConfig | TealAnthropicConfig | Anthropic configuration |
| GuardedAzureOpenAIConfig | TealAzureOpenAIConfig | Azure OpenAI configuration |

#### File Names
| Old File Name | New File Name | Location |
|---------------|---------------|----------|
| GuardedOpenAI.ts | TealOpenAI.ts | TypeScript SDK clients |
| GuardedAnthropic.ts | TealAnthropic.ts | TypeScript SDK clients |
| GuardedAzureOpenAI.ts | TealAzureOpenAI.ts | TypeScript SDK clients |
| guarded_openai.py | teal_openai.py | Python SDK clients |
| guarded_anthropic.py | teal_anthropic.py | Python SDK clients |
| guarded_azure_openai.py | teal_azure_openai.py | Python SDK clients |

#### Directory Names
| Old Directory | New Directory | Purpose |
|---------------|---------------|---------|
| packages/agent-guard-sdk/ | packages/tealtiger-sdk/ | TypeScript SDK package |
| packages/agentguard-python/ | packages/tealtiger-python/ | Python SDK package |
| agentguard-landing/ | tealtiger-landing/ | Landing page |
| agentguard-main-repo/ | tealtiger/ | Main repository |
| src/agentguard/ | src/tealtiger/ | Python package source |

#### Repository Names
| Old Repository | New Repository | Purpose |
|----------------|----------------|---------|
| agentguard | tealtiger | Main documentation and examples |
| agentguard-typescript | tealtiger-typescript | TypeScript SDK |
| agentguard-python | tealtiger-python | Python SDK |

## Components and Interfaces

### Search and Replace Patterns

The rebrand requires systematic search and replace operations across all files. The following patterns must be applied:

#### Pattern 1: Package Names in Configuration Files

**Files**: package.json, pyproject.toml, tsconfig.json

| Search Pattern | Replace With | Context |
|----------------|--------------|---------|
| `"name": "agentguard-sdk"` | `"name": "tealtiger"` | package.json |
| `"name": "@agentguard/sdk"` | `"name": "tealtiger"` | package.json |
| `name = "agentguard-sdk"` | `name = "tealtiger"` | pyproject.toml |
| `agentguard-ai/agentguard-sdk` | `agentguard-ai/tealtiger-typescript` | Repository URLs |
| `agentguard-ai/agentguard-python` | `agentguard-ai/tealtiger-python` | Repository URLs |
| `agentguard-ai/agentguard` | `agentguard-ai/tealtiger` | Repository URLs |

#### Pattern 2: Import Statements

**Files**: All .ts, .tsx, .js, .jsx, .py files

| Search Pattern | Replace With | Language |
|----------------|--------------|----------|
| `from 'agentguard-sdk'` | `from 'tealtiger'` | TypeScript/JavaScript |
| `from "agentguard-sdk"` | `from "tealtiger"` | TypeScript/JavaScript |
| `require('agentguard-sdk')` | `require('tealtiger')` | JavaScript |
| `from agentguard import` | `from tealtiger import` | Python |
| `from agentguard.` | `from tealtiger.` | Python |
| `import agentguard` | `import tealtiger` | Python |

#### Pattern 3: Class Names

**Files**: All .ts, .tsx, .py files

| Search Pattern | Replace With | Notes |
|----------------|--------------|-------|
| `GuardedOpenAI` | `TealOpenAI` | Class name and references |
| `GuardedAnthropic` | `TealAnthropic` | Class name and references |
| `GuardedAzureOpenAI` | `TealAzureOpenAI` | Class name and references |
| `GuardedOpenAIConfig` | `TealOpenAIConfig` | Configuration class |
| `GuardedAnthropicConfig` | `TealAnthropicConfig` | Configuration class |
| `GuardedAzureOpenAIConfig` | `TealAzureOpenAIConfig` | Configuration class |

#### Pattern 4: File Names

**Action**: Rename files (not search/replace)

| Old File Name | New File Name | Location |
|---------------|---------------|----------|
| GuardedOpenAI.ts | TealOpenAI.ts | packages/tealtiger-sdk/src/clients/ |
| GuardedAnthropic.ts | TealAnthropic.ts | packages/tealtiger-sdk/src/clients/ |
| GuardedAzureOpenAI.ts | TealAzureOpenAI.ts | packages/tealtiger-sdk/src/clients/ |
| guarded_openai.py | teal_openai.py | packages/tealtiger-python/src/tealtiger/clients/ |
| guarded_anthropic.py | teal_anthropic.py | packages/tealtiger-python/src/tealtiger/clients/ |
| guarded_azure_openai.py | teal_azure_openai.py | packages/tealtiger-python/src/tealtiger/clients/ |

#### Pattern 5: Directory Names

**Action**: Rename directories (not search/replace)

| Old Directory | New Directory |
|---------------|---------------|
| packages/agent-guard-sdk/ | packages/tealtiger-sdk/ |
| packages/agentguard-python/ | packages/tealtiger-python/ |
| agentguard-landing/ | tealtiger-landing/ |
| agentguard-main-repo/ | tealtiger/ |
| src/agentguard/ | src/tealtiger/ |

#### Pattern 6: Documentation and Comments

**Files**: All .md, .ts, .py files (comments and docstrings)

| Search Pattern | Replace With | Context |
|----------------|--------------|---------|
| `AgentGuard` | `TealTiger` | Product name in prose |
| `agentguard` | `tealtiger` | Lowercase product references |
| `AGENTGUARD` | `TEALTIGER` | Uppercase product references |
| `agent-guard` | `tealtiger` | Hyphenated references |
| `Agent Guard` | `TealTiger` | Spaced references |
| `agentguard.dev` | `tealtiger.ai` | Domain references |
| `support@agentguard.dev` | `support@tealtiger.ai` | Email addresses |

#### Pattern 7: Brand Assets

**Files**: README.md, landing page, marketing materials

| Search Pattern | Replace With | Context |
|----------------|--------------|---------|
| `AI Agent Security Platform` | `TealTiger` | Product name |
| `Secure your AI. Control your costs.` | `Powerful protection for AI agents` | Tagline |
| Badge URLs with agentguard | Badge URLs with tealtiger | NPM/PyPI badges |

### File-by-File Change Plan

#### TypeScript SDK (packages/tealtiger-sdk/)

**package.json**
- Update `name` field to "tealtiger"
- Update `repository.url` to new GitHub URL
- Update `bugs.url` to new GitHub URL
- Update `homepage` to new GitHub URL or domain
- Update `author` to "TealTiger Team"

**src/index.ts**
- Update export statements to use new class names
- Update comments to reference TealTiger

**src/clients/TealOpenAI.ts** (renamed from GuardedOpenAI.ts)
- Rename class from GuardedOpenAI to TealOpenAI
- Rename interface from GuardedOpenAIConfig to TealOpenAIConfig
- Update all comments and docstrings
- Update internal references

**src/clients/TealAnthropic.ts** (renamed from GuardedAnthropic.ts)
- Rename class from GuardedAnthropic to TealAnthropic
- Rename interface from GuardedAnthropicConfig to TealAnthropicConfig
- Update all comments and docstrings
- Update internal references

**src/clients/TealAzureOpenAI.ts** (renamed from GuardedAzureOpenAI.ts)
- Rename class from GuardedAzureOpenAI to TealAzureOpenAI
- Rename interface from GuardedAzureOpenAIConfig to TealAzureOpenAIConfig
- Update all comments and docstrings
- Update internal references

**README.md**
- Replace all "AgentGuard" with "TealTiger"
- Update package installation instructions
- Update import examples
- Update class instantiation examples
- Update repository URLs
- Update badge URLs
- Update tagline

**tsconfig.json**
- Update path mappings if they reference old names

**All test files**
- Update imports to use "tealtiger"
- Update class names in tests
- Update test descriptions and comments

#### Python SDK (packages/tealtiger-python/)

**pyproject.toml**
- Update `name` field to "tealtiger"
- Update `authors` to TealTiger Team
- Update all repository URLs
- Update package paths from "src/agentguard" to "src/tealtiger"

**src/tealtiger/__init__.py** (renamed from src/agentguard/)
- Update imports to use new class names
- Update __all__ exports
- Update module docstring

**src/tealtiger/clients/teal_openai.py** (renamed from guarded_openai.py)
- Rename class from GuardedOpenAI to TealOpenAI
- Rename config class from GuardedOpenAIConfig to TealOpenAIConfig
- Update all docstrings and comments
- Update internal references

**src/tealtiger/clients/teal_anthropic.py** (renamed from guarded_anthropic.py)
- Rename class from GuardedAnthropic to TealAnthropic
- Rename config class from GuardedAnthropicConfig to TealAnthropicConfig
- Update all docstrings and comments
- Update internal references

**src/tealtiger/clients/teal_azure_openai.py** (renamed from guarded_azure_openai.py)
- Rename class from GuardedAzureOpenAI to TealAzureOpenAI
- Rename config class from GuardedAzureOpenAIConfig to TealAzureOpenAIConfig
- Update all docstrings and comments
- Update internal references

**README.md**
- Replace all "AgentGuard" with "TealTiger"
- Update package installation instructions
- Update import examples
- Update class instantiation examples
- Update repository URLs
- Update badge URLs

**All test files**
- Update imports to use "tealtiger"
- Update class names in tests
- Update test descriptions and comments

#### Landing Page (tealtiger-landing/)

**All component files**
- Replace "AgentGuard" with "TealTiger" in all text content
- Update tagline to "Powerful protection for AI agents"
- Update color scheme to teal/turquoise primary with orange/black accents
- Update any hardcoded package names in code examples

**package.json**
- Update name to "tealtiger-landing"
- Update repository URLs

**README.md**
- Update all references to TealTiger

#### Main Repository (tealtiger/)

**README.md**
- Replace all "AgentGuard" with "TealTiger"
- Update repository structure documentation
- Update links to SDK repositories
- Update installation instructions
- Update all code examples

**CONTRIBUTING.md**
- Update repository references
- Update package names in contribution guidelines

**All example files**
- Update imports to use "tealtiger"
- Update class names
- Update comments

**docs/ directory**
- Update all documentation files
- Replace AgentGuard references with TealTiger
- Update code examples
- Update repository links

#### Root Configuration Files

**package.json** (root)
- Update name if applicable
- Update repository URLs in dependencies

**.github/workflows/**
- Update any references to package names
- Update repository URLs
- Update environment variable names if needed

## Data Models

### Migration Metadata

To track the rebrand progress and enable rollback, we define a migration metadata structure:

```typescript
interface RebrandMigration {
  version: string;              // "1.0.0"
  timestamp: Date;              // When migration was performed
  phase: 'code' | 'docs' | 'infra' | 'complete';
  filesChanged: string[];       // List of modified files
  directoriesRenamed: {
    old: string;
    new: string;
  }[];
  repositoriesRenamed: {
    old: string;
    new: string;
  }[];
  packagesPublished: {
    name: string;
    version: string;
    registry: 'npm' | 'pypi';
  }[];
  rollbackAvailable: boolean;
  validationResults: {
    testsPass: boolean;
    importsWork: boolean;
    docsValid: boolean;
    examplesRun: boolean;
  };
}
```

### Configuration Schema Updates

**TypeScript Configuration (TealOpenAIConfig)**
```typescript
interface TealOpenAIConfig {
  apiKey: string;
  guardrails?: {
    piiDetection?: boolean;
    promptInjection?: boolean;
    contentModeration?: boolean;
  };
  budget?: {
    maxCostPerRequest?: number;
    maxCostPerDay?: number;
    maxCostPerMonth?: number;
  };
  // ... other options
}
```

**Python Configuration (TealOpenAIConfig)**
```python
class TealOpenAIConfig(BaseModel):
    """Configuration for TealOpenAI client."""
    api_key: str
    guardrails: Optional[GuardrailsConfig] = None
    budget: Optional[BudgetConfig] = None
    # ... other options
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

For this rebrand, correctness properties focus on completeness and consistency of the name changes across all artifacts. These properties can be validated through automated scripts that scan the codebase.

### Property 1: Import Path Consistency

*For any* source code file (TypeScript, JavaScript, or Python), all import statements SHALL use the new package name "tealtiger" instead of any variation of "agentguard" (including "agentguard-sdk", "@agentguard/sdk", "agentguard").

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: Class Naming Consistency

*For any* class definition or class reference in the codebase, all client classes SHALL use the "Teal" prefix (TealOpenAI, TealAnthropic, TealAzureOpenAI) and all configuration classes SHALL use the corresponding "Teal*Config" pattern (TealOpenAIConfig, TealAnthropicConfig, TealAzureOpenAIConfig).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 3: Documentation Text Correctness

*For any* documentation file (README, markdown, comments, docstrings), all product references SHALL use "TealTiger" instead of "AgentGuard" in all case variations (AgentGuard, agentguard, AGENTGUARD, agent-guard, Agent Guard).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

### Property 4: Package Metadata Correctness

*For any* package configuration file (package.json, pyproject.toml), all metadata fields (name, repository, homepage, bugs) SHALL reference "tealtiger" package names and TealTiger repository URLs.

**Validates: Requirements 1.3, 1.4, 7.1, 7.2, 10.4**

### Property 5: Repository URL Consistency

*For any* file containing repository URLs (documentation, configuration, code comments), all GitHub repository URLs SHALL point to the new TealTiger repository locations under the agentguard-ai organization.

**Validates: Requirements 1.4, 4.5, 10.3**

### Property 6: Configuration File Correctness

*For any* configuration file (tsconfig.json, GitHub Actions workflows, environment variable documentation), all references to package names, directory names, and repository names SHALL use the new TealTiger naming conventions.

**Validates: Requirements 7.3, 7.4, 7.5**

### Property 7: Badge URL Correctness

*For any* README file containing package badges, all badge URLs SHALL reference the new "tealtiger" package name on NPM or PyPI registries.

**Validates: Requirements 8.2**

### Property 8: Tagline Consistency

*For any* file displaying the product tagline, the tagline SHALL be "Powerful protection for AI agents" instead of the old "Secure your AI. Control your costs."

**Validates: Requirements 8.3**

### Property 9: Domain Reference Consistency

*For any* file containing domain references or email addresses, all domains SHALL use "tealtiger.ai" or "tealtiger.dev" instead of "agentguard.dev".

**Validates: Requirements 10.3, 10.5**

### Property 10: Semantic Versioning Compliance

*For any* package being published, the version number SHALL be 1.0.0 or higher to indicate the breaking change from the rebrand.

**Validates: Requirements 9.3**

### Property 11: Code Formatting Preservation

*For any* file that undergoes search-and-replace operations, the code SHALL maintain valid syntax and formatting after the replacements are applied.

**Validates: Requirements 13.3, 13.4**

### Property 12: Link Validity

*For any* documentation file containing hyperlinks, all links SHALL resolve to valid, accessible resources (no 404 errors).

**Validates: Requirements 11.4**

### Property 13: Example Execution Success

*For any* example code file in the examples directory, the code SHALL execute successfully without errors when run with the new TealTiger package imports.

**Validates: Requirements 11.5**

## Error Handling

The rebrand process must handle several error scenarios:

### File System Errors

**Scenario**: File or directory rename operations fail due to permissions or locks
- **Handling**: Validate write permissions before starting operations
- **Recovery**: Provide clear error messages indicating which files/directories failed
- **Rollback**: Maintain a log of successful operations to enable partial rollback

### Package Registry Errors

**Scenario**: Package publication to NPM or PyPI fails
- **Handling**: Validate credentials and package metadata before publishing
- **Recovery**: Retry with exponential backoff
- **Rollback**: Unpublish packages if critical issues are discovered (within 72-hour window)

### Git Repository Errors

**Scenario**: Repository rename or organization transfer fails
- **Handling**: Ensure admin permissions before attempting operations
- **Recovery**: GitHub provides automatic redirects from old repository names
- **Rollback**: Repository names can be changed back if needed

### Broken References

**Scenario**: Some references to old names are missed during search-and-replace
- **Handling**: Run comprehensive validation scripts after each phase
- **Detection**: Use grep/ripgrep to search for all variations of old names
- **Recovery**: Manual fix of missed references

### Test Failures

**Scenario**: Tests fail after rebrand due to incorrect imports or class names
- **Handling**: Run full test suite after code changes
- **Detection**: CI/CD pipeline catches failures
- **Recovery**: Fix failing tests before proceeding to next phase

### Dependency Conflicts

**Scenario**: External dependencies or tools reference old package names
- **Handling**: Update all dependency references in package.json and pyproject.toml
- **Detection**: Dependency resolution errors during installation
- **Recovery**: Update lock files and re-install dependencies

### Documentation Link Rot

**Scenario**: External links to old domain or repository URLs become invalid
- **Handling**: Set up redirects from old domain to new domain
- **Detection**: Link checker tools in CI/CD
- **Recovery**: Update external documentation and notify users

## Testing Strategy

The rebrand requires a dual testing approach combining automated validation scripts and manual verification.

### Automated Testing

**Static Analysis Tests**:
- Grep-based searches for old brand names across all files
- Package metadata validation (JSON/TOML parsing)
- Import statement validation (AST parsing)
- Link validation (HTTP requests to all URLs)
- Badge URL validation

**Unit Tests**:
- Test that all client classes instantiate correctly with new names
- Test that imports work from the new package names
- Test that configuration objects use new class names
- Test specific examples of correct naming

**Property-Based Tests**:
- Generate random file paths and verify naming conventions
- Generate random code samples and verify import patterns
- Test that all variations of old names are replaced

**Integration Tests**:
- Install packages from registries and verify functionality
- Run all example code to ensure it executes successfully
- Build and deploy landing page to verify branding
- Run full SDK test suites with new package names

### Manual Verification

**Visual Inspection**:
- Review landing page for correct branding and color scheme
- Check logo assets are correctly placed
- Verify tagline appears correctly across all pages

**Documentation Review**:
- Read through README files for consistency
- Check that migration guide is clear and complete
- Verify contributing guidelines are updated

**Repository Verification**:
- Confirm repository names are correct on GitHub
- Verify repository descriptions are updated
- Check that repository topics/tags are updated

### Test Execution Plan

**Phase 1: Code and Configuration**
1. Run static analysis to find all old brand references
2. Execute search-and-replace operations
3. Run unit tests to verify code still works
4. Run property-based tests for naming consistency
5. Validate all configuration files parse correctly

**Phase 2: Documentation and Examples**
1. Run grep searches for old brand names in docs
2. Execute link validation on all documentation
3. Run all example code to verify execution
4. Manual review of key documentation files

**Phase 3: Infrastructure and Deployment**
1. Verify package publication to registries
2. Test package installation from registries
3. Verify landing page deployment
4. Run full integration test suite
5. Manual verification of deployed assets

### Property-Based Test Configuration

All property-based tests should be configured with:
- **Minimum 100 iterations** per test (to ensure comprehensive coverage)
- **Seed-based randomization** (for reproducibility)
- **Shrinking enabled** (to find minimal failing cases)

Each property test must include a comment tag:
```typescript
// Feature: agentguard-to-tealtiger-rebrand, Property 1: Import Path Consistency
```

### Test Tools and Libraries

**TypeScript/JavaScript**:
- Jest for unit testing
- fast-check for property-based testing
- ESLint for static analysis
- TypeScript compiler for type checking

**Python**:
- pytest for unit testing
- Hypothesis for property-based testing
- mypy for type checking
- ruff for linting

**Cross-Language**:
- ripgrep for text searching
- jq for JSON validation
- yq for YAML validation
- markdown-link-check for link validation

## Migration Guide

A comprehensive migration guide must be created for existing AgentGuard users. The guide should include:

### For TypeScript Users

**Step 1: Update package.json**
```json
{
  "dependencies": {
    "tealtiger": "^1.0.0"  // was "agentguard-sdk": "^0.x.x"
  }
}
```

**Step 2: Update imports**
```typescript
// Old
import { GuardedOpenAI } from 'agentguard-sdk';

// New
import { TealOpenAI } from 'tealtiger';
```

**Step 3: Update class instantiation**
```typescript
// Old
const client = new GuardedOpenAI({ apiKey: '...' });

// New
const client = new TealOpenAI({ apiKey: '...' });
```

### For Python Users

**Step 1: Update requirements.txt or pyproject.toml**
```
tealtiger>=1.0.0  # was agentguard>=0.x.x
```

**Step 2: Update imports**
```python
# Old
from agentguard import GuardedOpenAI

# New
from tealtiger import TealOpenAI
```

**Step 3: Update class instantiation**
```python
# Old
client = GuardedOpenAI(api_key="...")

# New
client = TealOpenAI(api_key="...")
```

### Breaking Changes Summary

1. **Package name changed**: `agentguard-sdk` → `tealtiger` (NPM), `agentguard` → `tealtiger` (PyPI)
2. **Class names changed**: `GuardedOpenAI` → `TealOpenAI`, `GuardedAnthropic` → `TealAnthropic`, `GuardedAzureOpenAI` → `TealAzureOpenAI`
3. **Configuration classes changed**: `GuardedOpenAIConfig` → `TealOpenAIConfig`, etc.
4. **Repository URLs changed**: All GitHub URLs now point to `agentguard-ai/tealtiger-*` repositories
5. **Domain changed**: `agentguard.dev` → `tealtiger.ai`

### No Backward Compatibility

**Important**: There are no deprecated aliases or backward compatibility layers. This is a clean break requiring code changes.

### Version Strategy

- Old packages (`agentguard-sdk`, `agentguard`) will be marked as deprecated on registries
- Deprecation notice will point to migration guide
- Old packages will remain available but will not receive updates
- New packages start at version 1.0.0

## Rollout Phases

### Phase 1: Code and Configuration (Week 1)

**Objectives**:
- Rename all directories and files
- Update all package configuration files
- Update all import statements
- Rename all classes and types
- Update all code comments

**Deliverables**:
- All code files updated with new names
- All configuration files updated
- All tests passing with new names
- Git commits with clear rebrand messages

**Validation**:
- Run full test suite
- Run static analysis for old brand names
- Verify no compilation errors
- Manual code review of critical files

### Phase 2: Documentation and Examples (Week 1-2)

**Objectives**:
- Update all README files
- Update all markdown documentation
- Update all code examples
- Update contributing guidelines
- Create migration guide

**Deliverables**:
- All documentation updated
- All examples working with new imports
- Migration guide published
- Rollback guide created

**Validation**:
- Run example code to verify execution
- Run link validation on all docs
- Manual review of key documentation
- Grep search for old brand names

### Phase 3: Infrastructure and Deployment (Week 2)

**Objectives**:
- Rename GitHub repositories
- Publish packages to NPM and PyPI
- Deploy landing page to new domain
- Set up domain redirects
- Update CI/CD pipelines

**Deliverables**:
- Repositories renamed on GitHub
- Packages published to registries
- Landing page live on new domain
- Old domain redirecting to new domain
- CI/CD working with new names

**Validation**:
- Verify package installation from registries
- Test landing page functionality
- Verify domain redirects work
- Run full integration tests
- Manual verification of all infrastructure

### Phase 4: Communication and Cleanup (Week 2-3)

**Objectives**:
- Announce rebrand to users
- Update external references
- Monitor for issues
- Deprecate old packages
- Archive old documentation

**Deliverables**:
- Announcement blog post
- Social media updates
- Email to existing users
- Deprecation notices on old packages
- Updated external documentation

**Validation**:
- Monitor user feedback
- Track package download metrics
- Monitor error rates
- Verify deprecation notices visible

## Rollback Plan

In case critical issues are discovered, a rollback plan is essential:

### Rollback Triggers

- Critical bugs that break core functionality
- Widespread user complaints or confusion
- Package registry issues preventing installation
- Security vulnerabilities introduced by rebrand
- Legal issues with new brand name

### Rollback Procedure

**Step 1: Assess Impact**
- Determine which phase to roll back to
- Identify which changes can be safely reverted
- Communicate with team about rollback decision

**Step 2: Code Rollback**
- Revert Git commits to pre-rebrand state
- Restore old class names and imports
- Restore old package names in configuration
- Run full test suite to verify functionality

**Step 3: Package Rollback**
- Unpublish new packages from registries (if within 72 hours)
- Or publish new versions with old names restored
- Update deprecation notices

**Step 4: Infrastructure Rollback**
- Rename repositories back to old names (GitHub provides redirects)
- Restore old domain as primary
- Update CI/CD to use old names

**Step 5: Communication**
- Announce rollback to users
- Explain reasons for rollback
- Provide timeline for re-attempting rebrand

### Rollback Limitations

- **Package registry**: Can only unpublish within 72 hours of publication
- **Repository names**: GitHub provides automatic redirects, so rollback is low-risk
- **Domain names**: DNS changes take time to propagate
- **User code**: Users who already migrated will need to migrate back

### Rollback Testing

Before executing rollback:
- Test rollback procedure in staging environment
- Verify old code still compiles and runs
- Verify old packages can be republished
- Verify old domain still accessible

