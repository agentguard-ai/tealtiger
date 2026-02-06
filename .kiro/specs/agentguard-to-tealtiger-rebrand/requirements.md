# Requirements Document: AgentGuard to TealTiger Rebrand

## Introduction

This document specifies the requirements for rebranding the AgentGuard AI security platform to TealTiger. The rebrand addresses market positioning challenges, including name conflicts with competitors (Aeonic Labs, AppOmni, Akto, CyberArk all have AgentGuard products) and aims to establish a unique, memorable brand identity with better SEO and trademark positioning.

The rebrand encompasses all code repositories, package names, documentation, infrastructure, and branding materials across the TypeScript SDK, Python SDK, landing page, and main repository.

## Glossary

- **System**: The complete AgentGuard codebase including all repositories, SDKs, documentation, and infrastructure
- **TypeScript_SDK**: The TypeScript/JavaScript SDK package located in packages/agent-guard-sdk/
- **Python_SDK**: The Python SDK package located in packages/agentguard-python/
- **Landing_Page**: The marketing website located in agentguard-landing/
- **Main_Repository**: The primary documentation and examples repository
- **Package_Registry**: NPM for TypeScript packages and PyPI for Python packages
- **Guarded_Client**: The wrapper classes (GuardedOpenAI, GuardedAnthropic, GuardedAzureOpenAI)
- **Import_Path**: The module path used in import statements
- **Repository_Name**: The GitHub repository identifier
- **Organization_Name**: The GitHub organization identifier
- **Domain_Name**: The web domain for the landing page and documentation
- **Brand_Asset**: Logos, color schemes, taglines, and visual identity elements

## Requirements

### Requirement 1: Package Name Migration

**User Story:** As a developer, I want to install the TealTiger SDK using the new package name, so that I can use the rebranded product with clear, unique naming.

#### Acceptance Criteria

1. WHEN a developer installs the TypeScript SDK, THE System SHALL provide the package under the name "tealtiger" or "@tealtiger/sdk" on NPM
2. WHEN a developer installs the Python SDK, THE System SHALL provide the package under the name "tealtiger" on PyPI
3. WHEN package.json or pyproject.toml files are updated, THE System SHALL reflect the new package name in all metadata fields
4. WHEN repository URLs are referenced in package metadata, THE System SHALL point to the new TealTiger repository locations
5. WHERE the package is published to a registry, THE System SHALL use the new TealTiger package name

### Requirement 2: Code Import Path Updates

**User Story:** As a developer, I want to import TealTiger modules using the new package name, so that my code reflects the current brand identity.

#### Acceptance Criteria

1. WHEN a developer imports the TypeScript SDK, THE Import_Path SHALL use "tealtiger" or "@tealtiger/sdk" instead of "agentguard-sdk"
2. WHEN a developer imports the Python SDK, THE Import_Path SHALL use "tealtiger" instead of "agentguard"
3. WHEN internal imports reference the package, THE System SHALL use the new TealTiger import paths
4. WHEN example code demonstrates usage, THE System SHALL show imports using the new TealTiger package name
5. WHEN documentation shows code samples, THE System SHALL use the new TealTiger import paths

### Requirement 3: Client Class Naming Updates

**User Story:** As a developer, I want clear, consistent class names that reflect the TealTiger brand, so that my code is self-documenting and aligned with the product identity.

#### Acceptance Criteria

1. WHEN a developer instantiates an OpenAI client, THE Guarded_Client SHALL be named according to the chosen naming convention
2. WHEN a developer instantiates an Anthropic client, THE Guarded_Client SHALL be named according to the chosen naming convention
3. WHEN a developer instantiates an Azure OpenAI client, THE Guarded_Client SHALL be named according to the chosen naming convention
4. WHEN configuration classes are defined, THE System SHALL use names consistent with the client naming convention
5. WHEN type definitions reference client classes, THE System SHALL use the new TealTiger-based names

### Requirement 4: Repository Naming and Organization

**User Story:** As a contributor or user, I want to find TealTiger repositories under clear, consistent names, so that I can easily locate and reference the correct codebase.

#### Acceptance Criteria

1. WHEN a user searches for the main repository, THE Repository_Name SHALL be "tealtiger" or "tealtiger-main"
2. WHEN a user searches for the TypeScript SDK, THE Repository_Name SHALL be "tealtiger-typescript" or "tealtiger-ts"
3. WHEN a user searches for the Python SDK, THE Repository_Name SHALL be "tealtiger-python"
4. WHEN repositories are organized, THE Organization_Name SHALL be either "tealtiger-ai" or the repositories SHALL exist under a personal/company account
5. WHEN repository URLs are referenced in documentation, THE System SHALL use the new TealTiger repository paths

### Requirement 5: Documentation Content Updates

**User Story:** As a user reading documentation, I want all references to AgentGuard replaced with TealTiger, so that the documentation is consistent and reflects the current brand.

#### Acceptance Criteria

1. WHEN a user reads README files, THE System SHALL display "TealTiger" instead of "AgentGuard" in all product references
2. WHEN a user reads code comments, THE System SHALL use "TealTiger" in all brand references
3. WHEN a user reads docstrings, THE System SHALL use "TealTiger" in all product descriptions
4. WHEN a user views example code, THE System SHALL demonstrate TealTiger usage with updated names
5. WHEN a user reads API documentation, THE System SHALL reference TealTiger classes and modules
6. WHEN a user views the landing page, THE System SHALL display TealTiger branding throughout
7. WHEN a user reads contributing guidelines, THE System SHALL reference TealTiger repositories and processes

### Requirement 6: File and Directory Naming

**User Story:** As a developer navigating the codebase, I want file and directory names to reflect TealTiger, so that the project structure is consistent with the brand.

#### Acceptance Criteria

1. WHEN the TypeScript SDK directory is named, THE System SHALL use "tealtiger-sdk" or "tealtiger-typescript" instead of "agent-guard-sdk"
2. WHEN the Python SDK directory is named, THE System SHALL use "tealtiger-python" or "tealtiger" instead of "agentguard-python"
3. WHEN the landing page directory is named, THE System SHALL use "tealtiger-landing" instead of "agentguard-landing"
4. WHEN the main repository directory is named, THE System SHALL use "tealtiger" or "tealtiger-main" instead of "agentguard-main-repo"
5. WHEN Python package directories are named, THE System SHALL use "tealtiger" instead of "agentguard"

### Requirement 7: Configuration File Updates

**User Story:** As a developer or CI/CD system, I want configuration files to reference TealTiger resources, so that builds, tests, and deployments work correctly with the new brand.

#### Acceptance Criteria

1. WHEN package.json is read, THE System SHALL contain TealTiger package names and repository URLs
2. WHEN pyproject.toml is read, THE System SHALL contain TealTiger package names and repository URLs
3. WHEN tsconfig.json references paths, THE System SHALL use TealTiger directory names
4. WHEN GitHub Actions workflows reference repositories, THE System SHALL use TealTiger repository names
5. WHEN environment variables are documented, THE System SHALL use TEALTIGER_ prefixes where appropriate

### Requirement 8: Brand Asset Updates

**User Story:** As a marketer or user, I want visual and textual brand assets to reflect TealTiger identity, so that the product has a cohesive, professional appearance.

#### Acceptance Criteria

1. WHEN the landing page displays branding, THE System SHALL use TealTiger name, tagline, and color scheme
2. WHEN README badges are displayed, THE System SHALL reference TealTiger package names
3. WHEN the tagline is shown, THE System SHALL display "Powerful protection for AI agents" or approved alternative
4. WHEN color schemes are applied, THE System SHALL use teal/turquoise as primary color with orange/black accents
5. WHERE logos are displayed, THE System SHALL use TealTiger logo assets (when available)

### Requirement 9: Backward Compatibility and Migration

**User Story:** As an existing AgentGuard user, I want clear migration guidance and optional backward compatibility, so that I can transition to TealTiger smoothly.

#### Acceptance Criteria

1. WHEN migration documentation is provided, THE System SHALL include step-by-step instructions for updating imports and package names
2. WHEN breaking changes are introduced, THE System SHALL document all required code changes
3. WHEN version numbers are assigned, THE System SHALL use semantic versioning to indicate breaking changes
4. IF backward compatibility is maintained, THEN THE System SHALL provide deprecated aliases for AgentGuard classes
5. WHEN deprecation warnings are shown, THE System SHALL guide users to the new TealTiger equivalents

### Requirement 10: Domain and Infrastructure

**User Story:** As a user or administrator, I want TealTiger to be accessible via appropriate domains and infrastructure, so that the product has a professional web presence.

#### Acceptance Criteria

1. WHEN a domain is selected, THE Domain_Name SHALL be either "tealtiger.ai" or "tealtiger.dev"
2. WHEN the landing page is deployed, THE System SHALL be accessible via the TealTiger domain
3. WHEN documentation links are provided, THE System SHALL reference the TealTiger domain
4. WHEN package homepages are configured, THE System SHALL point to the TealTiger domain
5. WHEN email addresses are used, THE System SHALL use the TealTiger domain (e.g., support@tealtiger.ai)

### Requirement 11: Testing and Validation

**User Story:** As a developer, I want comprehensive tests to validate the rebrand, so that I can be confident the changes are complete and correct.

#### Acceptance Criteria

1. WHEN tests are run, THE System SHALL verify all package imports work with new names
2. WHEN tests are run, THE System SHALL verify all client classes instantiate correctly with new names
3. WHEN tests are run, THE System SHALL verify no AgentGuard references remain in public-facing code
4. WHEN tests are run, THE System SHALL verify all documentation links are valid
5. WHEN tests are run, THE System SHALL verify all examples execute successfully with new imports

### Requirement 12: Internal Documentation Handling

**User Story:** As a team member, I want clarity on whether internal documentation should be rebranded, so that I can maintain appropriate historical context.

#### Acceptance Criteria

1. WHEN internal documentation is reviewed, THE System SHALL identify which documents are internal-only
2. WHEN a decision is made about internal docs, THE System SHALL either rebrand them or mark them as historical
3. IF internal docs are kept as AgentGuard, THEN THE System SHALL clearly label them as historical/archived
4. WHEN new internal documentation is created, THE System SHALL use TealTiger naming
5. WHEN internal docs reference code, THE System SHALL update code references to use TealTiger names

### Requirement 13: Search and Replace Validation

**User Story:** As a developer executing the rebrand, I want validated search patterns, so that I can systematically replace all AgentGuard references without errors.

#### Acceptance Criteria

1. WHEN search patterns are defined, THE System SHALL identify all case variations (AgentGuard, agentguard, AGENTGUARD, agent-guard)
2. WHEN search patterns are defined, THE System SHALL identify all naming patterns (agentguard-sdk, @agentguard/sdk, GuardedOpenAI)
3. WHEN replacements are performed, THE System SHALL preserve code formatting and structure
4. WHEN replacements are performed, THE System SHALL maintain correct capitalization for different contexts
5. WHEN replacements are validated, THE System SHALL verify no unintended changes were made

### Requirement 14: Rollout Phases

**User Story:** As a project manager, I want a phased rollout plan, so that the rebrand can be executed systematically with minimal disruption.

#### Acceptance Criteria

1. WHEN the rollout plan is defined, THE System SHALL specify which changes happen in which phase
2. WHEN Phase 1 is executed, THE System SHALL complete code and configuration changes
3. WHEN Phase 2 is executed, THE System SHALL complete documentation and example updates
4. WHEN Phase 3 is executed, THE System SHALL complete infrastructure and deployment changes
5. WHEN each phase completes, THE System SHALL provide validation that the phase succeeded

### Requirement 15: Rollback Capability

**User Story:** As a developer, I want the ability to rollback the rebrand if critical issues are discovered, so that the product remains functional during the transition.

#### Acceptance Criteria

1. WHEN a rollback is needed, THE System SHALL provide instructions for reverting package names
2. WHEN a rollback is needed, THE System SHALL provide instructions for reverting repository names
3. WHEN a rollback is needed, THE System SHALL maintain access to pre-rebrand versions
4. WHEN a rollback is needed, THE System SHALL document which changes can be reverted safely
5. WHEN a rollback is performed, THE System SHALL verify functionality is restored
