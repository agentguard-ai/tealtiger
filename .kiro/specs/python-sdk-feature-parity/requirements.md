# Requirements Document

## Introduction

This specification defines the requirements for porting all missing features from the TypeScript SDK (agentguard-sdk v0.2.2) to the Python SDK (agentguard-sdk v0.2.1) to achieve 100% feature parity. The TypeScript SDK currently includes comprehensive cost tracking, budget management, and guarded client wrappers that are missing from the Python SDK.

## Glossary

- **Cost_Tracker**: Component that calculates and tracks AI model costs based on token usage
- **Budget_Manager**: Component that enforces spending limits and generates alerts
- **Cost_Storage**: Interface for persisting cost records for analytics
- **Guarded_Client**: Drop-in replacement for AI provider clients with integrated security and cost tracking
- **Model_Pricing**: Database of pricing information for AI models across providers
- **Token_Usage**: Record of input/output tokens consumed by an AI model request
- **Cost_Record**: Persistent record of actual costs incurred by a request
- **Budget_Config**: Configuration defining spending limits and enforcement rules
- **Guardrail_Engine**: Component that executes security checks on AI inputs/outputs
- **Provider**: AI model provider (OpenAI, Anthropic, Google, Cohere, Azure)

## Requirements

### Requirement 1: Cost Tracking System

**User Story:** As a developer, I want to track AI model costs automatically, so that I can monitor spending across different models and providers.

#### Acceptance Criteria

1. THE Cost_Tracker SHALL calculate estimated costs before API calls using token estimates
2. THE Cost_Tracker SHALL calculate actual costs after API calls using real token usage
3. THE Cost_Tracker SHALL support pricing for OpenAI models (GPT-4, GPT-3.5, etc.)
4. THE Cost_Tracker SHALL support pricing for Anthropic models (Claude 3, Claude 2, etc.)
5. THE Cost_Tracker SHALL support pricing for Google models (Gemini, PaLM)
6. THE Cost_Tracker SHALL support pricing for Cohere models
7. WHEN custom pricing is provided, THE Cost_Tracker SHALL use custom pricing instead of defaults
8. WHEN a model has no pricing data, THE Cost_Tracker SHALL return zero cost and log a warning
9. THE Cost_Tracker SHALL break down costs into input cost and output cost components
10. THE Cost_Tracker SHALL support vision models with per-image pricing
11. THE Cost_Tracker SHALL support audio models with per-second pricing

### Requirement 2: Cost Storage

**User Story:** As a developer, I want to persist cost records, so that I can analyze spending patterns and generate reports.

#### Acceptance Criteria

1. THE Cost_Storage SHALL provide an abstract interface for storage implementations
2. THE InMemory_Cost_Storage SHALL store cost records in memory
3. WHEN a cost record is stored, THE Cost_Storage SHALL persist it with a unique ID
4. WHEN querying by request ID, THE Cost_Storage SHALL return all matching cost records
5. WHEN querying by agent ID, THE Cost_Storage SHALL return all records for that agent
6. WHEN querying by date range, THE Cost_Storage SHALL return records within the range
7. THE Cost_Storage SHALL generate cost summaries with totals by model, provider, and agent
8. WHEN deleting old records, THE Cost_Storage SHALL remove records older than the specified date
9. THE Cost_Storage SHALL support clearing all records

### Requirement 3: Budget Management

**User Story:** As a developer, I want to enforce spending budgets, so that I can prevent unexpected costs and control AI spending.

#### Acceptance Criteria

1. THE Budget_Manager SHALL create budgets with configurable limits and time periods
2. THE Budget_Manager SHALL support hourly, daily, weekly, monthly, and total budget periods
3. WHEN checking a budget, THE Budget_Manager SHALL calculate current spending for the period
4. WHEN estimated cost would exceed budget, THE Budget_Manager SHALL block the request
5. THE Budget_Manager SHALL generate alerts at configurable thresholds (50%, 75%, 90%, 100%)
6. WHEN a threshold is crossed, THE Budget_Manager SHALL create an alert with severity level
7. THE Budget_Manager SHALL support agent-scoped budgets
8. THE Budget_Manager SHALL support updating existing budgets
9. THE Budget_Manager SHALL support deleting budgets
10. THE Budget_Manager SHALL provide budget status with current spending and remaining amount
11. WHEN recording costs, THE Budget_Manager SHALL update budget tracking
12. THE Budget_Manager SHALL support acknowledging alerts

### Requirement 4: GuardedOpenAI Client

**User Story:** As a developer, I want a drop-in replacement for the OpenAI client with integrated security, so that I can add guardrails and cost tracking without changing my code.

#### Acceptance Criteria

1. THE GuardedOpenAI SHALL provide a chat.completions.create method matching OpenAI's API
2. WHEN guardrails are enabled, THE GuardedOpenAI SHALL execute input guardrails before API calls
3. WHEN input guardrails fail, THE GuardedOpenAI SHALL block the request and raise an error
4. WHEN cost tracking is enabled, THE GuardedOpenAI SHALL estimate costs before API calls
5. WHEN budget checking is enabled, THE GuardedOpenAI SHALL verify budget before API calls
6. WHEN budget is exceeded, THE GuardedOpenAI SHALL block the request and raise an error
7. THE GuardedOpenAI SHALL make the actual OpenAI API call after all checks pass
8. WHEN guardrails are enabled, THE GuardedOpenAI SHALL execute output guardrails after API calls
9. WHEN output guardrails fail, THE GuardedOpenAI SHALL raise an error
10. WHEN cost tracking is enabled, THE GuardedOpenAI SHALL calculate actual costs after API calls
11. THE GuardedOpenAI SHALL store cost records when storage is configured
12. THE GuardedOpenAI SHALL record costs with budget manager when configured
13. THE GuardedOpenAI SHALL return security metadata in the response
14. THE GuardedOpenAI SHALL support all OpenAI chat completion parameters
15. THE GuardedOpenAI SHALL use async/await for all operations

### Requirement 5: GuardedAnthropic Client

**User Story:** As a developer, I want a drop-in replacement for the Anthropic client with integrated security, so that I can add guardrails and cost tracking to Claude API calls.

#### Acceptance Criteria

1. THE GuardedAnthropic SHALL provide a messages.create method matching Anthropic's API
2. WHEN guardrails are enabled, THE GuardedAnthropic SHALL execute input guardrails before API calls
3. WHEN input guardrails fail, THE GuardedAnthropic SHALL block the request and raise an error
4. WHEN cost tracking is enabled, THE GuardedAnthropic SHALL estimate costs before API calls
5. WHEN budget checking is enabled, THE GuardedAnthropic SHALL verify budget before API calls
6. WHEN budget is exceeded, THE GuardedAnthropic SHALL block the request and raise an error
7. THE GuardedAnthropic SHALL make the actual Anthropic API call after all checks pass
8. WHEN guardrails are enabled, THE GuardedAnthropic SHALL execute output guardrails after API calls
9. WHEN output guardrails fail, THE GuardedAnthropic SHALL raise an error
10. WHEN cost tracking is enabled, THE GuardedAnthropic SHALL calculate actual costs after API calls
11. THE GuardedAnthropic SHALL store cost records when storage is configured
12. THE GuardedAnthropic SHALL record costs with budget manager when configured
13. THE GuardedAnthropic SHALL return security metadata in the response
14. THE GuardedAnthropic SHALL support all Anthropic message parameters
15. THE GuardedAnthropic SHALL handle both string and array message content formats
16. THE GuardedAnthropic SHALL use async/await for all operations

### Requirement 6: GuardedAzureOpenAI Client

**User Story:** As a developer, I want a drop-in replacement for the Azure OpenAI client with integrated security, so that I can add guardrails and cost tracking to Azure deployments.

#### Acceptance Criteria

1. THE GuardedAzureOpenAI SHALL provide a chat.completions.create method matching Azure OpenAI's API
2. THE GuardedAzureOpenAI SHALL provide a deployments.chat.completions.create method for Azure-specific API
3. WHEN guardrails are enabled, THE GuardedAzureOpenAI SHALL execute input guardrails before API calls
4. WHEN input guardrails fail, THE GuardedAzureOpenAI SHALL block the request and raise an error
5. WHEN cost tracking is enabled, THE GuardedAzureOpenAI SHALL map deployment names to model names for pricing
6. WHEN cost tracking is enabled, THE GuardedAzureOpenAI SHALL estimate costs before API calls
7. WHEN budget checking is enabled, THE GuardedAzureOpenAI SHALL verify budget before API calls
8. WHEN budget is exceeded, THE GuardedAzureOpenAI SHALL block the request and raise an error
9. THE GuardedAzureOpenAI SHALL make the actual Azure OpenAI API call after all checks pass
10. WHEN guardrails are enabled, THE GuardedAzureOpenAI SHALL execute output guardrails after API calls
11. WHEN output guardrails fail, THE GuardedAzureOpenAI SHALL raise an error
12. WHEN cost tracking is enabled, THE GuardedAzureOpenAI SHALL calculate actual costs after API calls
13. THE GuardedAzureOpenAI SHALL store cost records when storage is configured
14. THE GuardedAzureOpenAI SHALL record costs with budget manager when configured
15. THE GuardedAzureOpenAI SHALL return security metadata in the response
16. THE GuardedAzureOpenAI SHALL support Azure AD token authentication
17. THE GuardedAzureOpenAI SHALL use async/await for all operations

### Requirement 7: Type Safety and Validation

**User Story:** As a developer, I want type-safe APIs with validation, so that I can catch errors early and have good IDE support.

#### Acceptance Criteria

1. THE Python_SDK SHALL use Pydantic models for all configuration objects
2. THE Python_SDK SHALL use Pydantic models for all request/response objects
3. THE Python_SDK SHALL use type hints throughout the codebase
4. WHEN invalid configuration is provided, THE Python_SDK SHALL raise validation errors
5. THE Python_SDK SHALL provide clear error messages for validation failures

### Requirement 8: Testing and Quality

**User Story:** As a developer, I want comprehensive tests, so that I can trust the SDK works correctly.

#### Acceptance Criteria

1. THE Python_SDK SHALL include pytest tests for all cost tracking functionality
2. THE Python_SDK SHALL include pytest tests for all budget management functionality
3. THE Python_SDK SHALL include pytest tests for all guarded client functionality
4. THE Python_SDK SHALL include integration tests demonstrating end-to-end workflows
5. THE Python_SDK SHALL maintain test coverage above 80%
6. THE Python_SDK SHALL include example scripts demonstrating all features

### Requirement 9: Documentation

**User Story:** As a developer, I want clear documentation, so that I can quickly understand and use the new features.

#### Acceptance Criteria

1. THE Python_SDK SHALL include README documentation for cost tracking
2. THE Python_SDK SHALL include README documentation for budget management
3. THE Python_SDK SHALL include README documentation for guarded clients
4. THE Python_SDK SHALL include code examples for each feature
5. THE Python_SDK SHALL include API reference documentation
6. THE Python_SDK SHALL update CHANGELOG with all new features

### Requirement 10: API Compatibility

**User Story:** As a developer, I want the Python SDK to match the TypeScript SDK's API, so that I can use either SDK with the same patterns.

#### Acceptance Criteria

1. THE Python_SDK SHALL provide equivalent functionality to TypeScript SDK v0.2.2
2. THE Python_SDK SHALL use similar naming conventions to TypeScript SDK
3. THE Python_SDK SHALL provide similar configuration options to TypeScript SDK
4. THE Python_SDK SHALL follow Python idioms (snake_case, async/await, context managers)
5. THE Python_SDK SHALL maintain backward compatibility with existing guardrail features
