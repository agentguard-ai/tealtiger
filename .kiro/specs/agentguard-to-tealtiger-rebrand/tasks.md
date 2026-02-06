# Implementation Plan: AgentGuard to TealTiger Rebrand

## Overview

This implementation plan breaks down the comprehensive rebrand from AgentGuard to TealTiger into discrete, executable tasks. The rebrand follows a phased approach: (1) Code and Configuration, (2) Documentation and Examples, (3) Infrastructure and Deployment. Each task builds incrementally and includes validation steps to ensure correctness.

## Tasks

### Phase 1: Code and Configuration Changes

- [x] 1. Rename TypeScript SDK directories and files
  - Rename `packages/agent-guard-sdk/` to `packages/tealtiger-sdk/`
  - Rename `GuardedOpenAI.ts` to `TealOpenAI.ts`
  - Rename `GuardedAnthropic.ts` to `TealAnthropic.ts`
  - Rename `GuardedAzureOpenAI.ts` to `TealAzureOpenAI.ts`
  - _Requirements: 6.1_

- [x] 2. Update TypeScript SDK class names and exports
  - [x] 2.1 Update TealOpenAI class and configuration
    - Rename `GuardedOpenAI` class to `TealOpenAI`
    - Rename `GuardedOpenAIConfig` interface to `TealOpenAIConfig`
    - Update all internal references and imports
    - Update comments and docstrings
    - _Requirements: 3.1, 3.4_
  
  - [x] 2.2 Update TealAnthropic class and configuration
    - Rename `GuardedAnthropic` class to `TealAnthropic`
    - Rename `GuardedAnthropicConfig` interface to `TealAnthropicConfig`
    - Update all internal references and imports
    - Update comments and docstrings
    - _Requirements: 3.2, 3.4_
  
  - [x] 2.3 Update TealAzureOpenAI class and configuration
    - Rename `GuardedAzureOpenAI` class to `TealAzureOpenAI`
    - Rename `GuardedAzureOpenAIConfig` interface to `TealAzureOpenAIConfig`
    - Update all internal references and imports
    - Update comments and docstrings
    - _Requirements: 3.3, 3.4_
  
  - [x] 2.4 Update TypeScript SDK index.ts exports
    - Update all export statements to use new class names
    - Update module-level comments
    - _Requirements: 3.5_

- [x] 3. Update TypeScript SDK package configuration
  - [x] 3.1 Update package.json
    - Change `name` field to "tealtiger"
    - Update `repository.url` to new GitHub URL
    - Update `bugs.url` to new GitHub URL
    - Update `homepage` to new domain
    - Update `author` to "TealTiger Team"
    - Bump version to "1.0.0"
    - _Requirements: 1.1, 1.3, 1.4, 9.3_
  
  - [x] 3.2 Update tsconfig.json
    - Update any path mappings that reference old directory names
    - _Requirements: 7.3_
  
  - [x] 3.3 Write property test for TypeScript import paths
    - **Property 1: Import Path Consistency**
    - **Validates: Requirements 2.1, 2.3, 2.4**
  
  - [x] 3.4 Write property test for TypeScript class naming
    - **Property 2: Class Naming Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 4. Update TypeScript SDK tests
  - Update all test imports to use "tealtiger"
  - Update all class instantiations to use new class names
  - Update test descriptions and comments
  - Run test suite to verify all tests pass
  - _Requirements: 11.2_

- [x] 5. Rename Python SDK directories and files
  - Rename `packages/agentguard-python/` to `packages/tealtiger-python/`
  - Rename `src/agentguard/` to `src/tealtiger/`
  - Rename `guarded_openai.py` to `teal_openai.py`
  - Rename `guarded_anthropic.py` to `teal_anthropic.py`
  - Rename `guarded_azure_openai.py` to `teal_azure_openai.py`
  - _Requirements: 6.2, 6.5_

- [x] 6. Update Python SDK class names and exports
  - [x] 6.1 Update TealOpenAI class and configuration
    - Rename `GuardedOpenAI` class to `TealOpenAI`
    - Rename `GuardedOpenAIConfig` class to `TealOpenAIConfig`
    - Update all internal references and imports
    - Update docstrings and comments
    - _Requirements: 3.1, 3.4_
  
  - [x] 6.2 Update TealAnthropic class and configuration
    - Rename `GuardedAnthropic` class to `TealAnthropic`
    - Rename `GuardedAnthropicConfig` class to `TealAnthropicConfig`
    - Update all internal references and imports
    - Update docstrings and comments
    - _Requirements: 3.2, 3.4_
  
  - [x] 6.3 Update TealAzureOpenAI class and configuration
    - Rename `GuardedAzureOpenAI` class to `TealAzureOpenAI`
    - Rename `GuardedAzureOpenAIConfig` class to `TealAzureOpenAIConfig`
    - Update all internal references and imports
    - Update docstrings and comments
    - _Requirements: 3.3, 3.4_
  
  - [x] 6.4 Update Python SDK __init__.py
    - Update all imports to use new class names
    - Update `__all__` exports
    - Update module docstring
    - _Requirements: 3.5_

- [ ] 7. Update Python SDK package configuration
  - [x] 7.1 Update pyproject.toml
    - Change `name` field to "tealtiger"
    - Update `authors` to "TealTiger Team"
    - Update all repository URLs
    - Update package paths from "src/agentguard" to "src/tealtiger"
    - Bump version to "1.0.0"
    - _Requirements: 1.2, 1.3, 1.4, 9.3_
  
  - [ ] 7.2 Write property test for Python import paths
    - **Property 1: Import Path Consistency**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  
  - [ ] 7.3 Write property test for Python class naming
    - **Property 2: Class Naming Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 8. Update Python SDK tests
  - Update all test imports to use "tealtiger"
  - Update all class instantiations to use new class names
  - Update test descriptions and comments
  - Run test suite to verify all tests pass
  - _Requirements: 11.2_

- [x] 9. Checkpoint - Verify code changes
  - Ensure all TypeScript tests pass
  - Ensure all Python tests pass
  - Run static analysis to check for remaining old brand references
  - Ask the user if questions arise

### Phase 2: Documentation and Examples

- [x] 10. Update TypeScript SDK documentation
  - [x] 10.1 Update TypeScript SDK README.md
    - Replace all "AgentGuard" with "TealTiger"
    - Update package installation instructions to use "tealtiger"
    - Update import examples to use new package name
    - Update class instantiation examples to use new class names
    - Update repository URLs
    - Update badge URLs
    - Update tagline to "Powerful protection for AI agents"
    - _Requirements: 5.1, 2.4, 8.2, 8.3_
  
  - [x] 10.2 Write property test for documentation text correctness
    - **Property 3: Documentation Text Correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [ ] 11. Update Python SDK documentation
  - [x] 11.1 Update Python SDK README.md
    - Replace all "AgentGuard" with "TealTiger"
    - Update package installation instructions to use "tealtiger"
    - Update import examples to use new package name
    - Update class instantiation examples to use new class names
    - Update repository URLs
    - Update badge URLs
    - _Requirements: 5.1, 2.4, 8.2_
  
  - [ ] 11.2 Write property test for badge URL correctness
    - **Property 7: Badge URL Correctness**
    - **Validates: Requirements 8.2**

- [x] 12. Update main repository documentation
  - [x] 12.1 Rename main repository directory
    - Rename `agentguard-main-repo/` to `tealtiger/`
    - _Requirements: 6.4_
  
  - [x] 12.2 Update main repository README.md
    - Replace all "AgentGuard" with "TealTiger"
    - Update repository structure documentation
    - Update links to SDK repositories
    - Update installation instructions
    - Update all code examples
    - _Requirements: 5.1, 4.5_
  
  - [x] 12.3 Update CONTRIBUTING.md
    - Update repository references
    - Update package names in contribution guidelines
    - _Requirements: 5.7_

- [x] 13. Update code examples
  - [x] 13.1 Update TypeScript examples
    - Update all imports to use "tealtiger"
    - Update all class names to use Teal* prefix
    - Update comments and descriptions
    - _Requirements: 2.4, 5.4_
  
  - [x] 13.2 Update Python examples
    - Update all imports to use "tealtiger"
    - Update all class names to use Teal* prefix
    - Update comments and descriptions
    - _Requirements: 2.4, 5.4_
  
  - [x] 13.3 Write property test for example execution
    - **Property 13: Example Execution Success**
    - **Validates: Requirements 11.5**

- [x] 14. Update API documentation
  - Update all API docs to reference TealTiger classes and modules
  - Update all code samples in API docs
  - _Requirements: 5.5_

- [x] 15. Create migration guide
  - [x] 15.1 Write TypeScript migration section
    - Document package.json changes
    - Document import changes
    - Document class name changes
    - Provide before/after code examples
    - _Requirements: 9.1, 9.2_
  
  - [x] 15.2 Write Python migration section
    - Document requirements.txt/pyproject.toml changes
    - Document import changes
    - Document class name changes
    - Provide before/after code examples
    - _Requirements: 9.1, 9.2_
  
  - [x] 15.3 Document breaking changes
    - List all breaking changes
    - Explain version strategy
    - Note lack of backward compatibility
    - _Requirements: 9.2_

- [x] 16. Checkpoint - Verify documentation changes
  - Run grep search for any remaining "AgentGuard" references
  - Run all example code to verify execution
  - Manually review key documentation files
  - Ask the user if questions arise

### Phase 3: Infrastructure and Deployment

- [-] 17. Update landing page
  - [x] 17.1 Rename landing page directory
    - Rename `agentguard-landing/` to `tealtiger-landing/`
    - _Requirements: 6.3_
  
  - [x] 17.2 Update landing page content
    - Replace all "AgentGuard" with "TealTiger" in all components
    - Update tagline to "Powerful protection for AI agents"
    - Update any hardcoded package names in code examples
    - _Requirements: 5.6, 8.1, 8.3_
  
  - [x] 17.3 Update landing page package.json
    - Update name to "tealtiger-landing"
    - Update repository URLs
    - _Requirements: 1.3_
  
  - [ ] 17.4 Write property test for tagline consistency
    - **Property 8: Tagline Consistency**
    - **Validates: Requirements 8.3**

- [x] 18. Update GitHub Actions workflows
  - Update all workflow files to reference new package names
  - Update repository URLs in workflows
  - Update environment variable names if needed
  - _Requirements: 7.4, 7.5_

- [-] 19. Update root configuration files
  - [x] 19.1 Update root package.json (if applicable)
    - Update repository URLs in dependencies
    - _Requirements: 1.4_
  
  - [ ] 19.2 Write property test for configuration file correctness
    - **Property 6: Configuration File Correctness**
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 20. Prepare package publication
  - [x] 20.1 Verify NPM credentials and permissions
    - Ensure access to publish "tealtiger" package
    - _Requirements: 1.1_
  
  - [x] 20.2 Verify PyPI credentials and permissions
    - Ensure access to publish "tealtiger" package
    - _Requirements: 1.2_
  
  - [x] 20.3 Write property test for package metadata correctness
    - **Property 4: Package Metadata Correctness**
    - **Validates: Requirements 1.3, 1.4, 7.1, 7.2, 10.4**

- [x] 21. Create rollback documentation
  - [x] 21.1 Document rollback triggers
    - List conditions that would require rollback
    - _Requirements: 15.4_
  
  - [x] 21.2 Document rollback procedure
    - Provide step-by-step rollback instructions for code
    - Provide step-by-step rollback instructions for packages
    - Provide step-by-step rollback instructions for repositories
    - _Requirements: 15.1, 15.2_
  
  - [x] 21.3 Document rollback limitations
    - Explain time windows for package unpublishing
    - Explain GitHub redirect behavior
    - _Requirements: 15.4_
  
  - [x] 21.4 Tag pre-rebrand version in Git
    - Create Git tag for rollback reference
    - _Requirements: 15.3_

- [-] 22. Final validation and testing
  - [x] 22.1 Run comprehensive static analysis
    - Search for all variations of "AgentGuard" across all files
    - Verify no old brand references remain in public-facing code
    - _Requirements: 11.3, 13.1, 13.2_
  
  - [x] 22.2 Run full test suites
    - Run TypeScript SDK tests
    - Run Python SDK tests
    - Verify all tests pass
    - _Requirements: 11.1, 11.2_
  
  - [ ] 22.3 Write property test for repository URL consistency
    - **Property 5: Repository URL Consistency**
    - **Validates: Requirements 1.4, 4.5, 10.3**
  
  - [ ] 22.4 Write property test for domain reference consistency
    - **Property 9: Domain Reference Consistency**
    - **Validates: Requirements 10.3, 10.5**
  
  - [ ] 22.5 Write property test for semantic versioning compliance
    - **Property 10: Semantic Versioning Compliance**
    - **Validates: Requirements 9.3**
  
  - [ ] 22.6 Write property test for code formatting preservation
    - **Property 11: Code Formatting Preservation**
    - **Validates: Requirements 13.3, 13.4**
  
  - [ ] 22.7 Write property test for link validity
    - **Property 12: Link Validity**
    - **Validates: Requirements 11.4**

- [x] 23. Final checkpoint - Ready for deployment
  - Ensure all tests pass
  - Ensure all documentation is updated
  - Ensure migration guide is complete
  - Ensure rollback plan is documented
  - Ask the user for final approval before proceeding with deployment

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all files
- The actual deployment steps (publishing packages, renaming repositories, deploying landing page) are intentionally excluded as they require manual execution with proper credentials and cannot be fully automated by a coding agent
- This plan focuses on code changes that can be executed programmatically
