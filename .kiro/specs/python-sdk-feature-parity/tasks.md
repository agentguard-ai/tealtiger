# Implementation Plan: Python SDK Feature Parity

## Overview

This plan implements cost tracking, budget management, and guarded client wrappers for the Python SDK to achieve feature parity with TypeScript SDK v0.2.2. The implementation follows an incremental approach, building from core cost tracking through storage, budgets, and finally the guarded clients.

## Tasks

- [x] 1. Set up cost tracking module structure
  - Create `src/agentguard/cost/` directory
  - Create `__init__.py` with exports
  - Create `utils.py` with `generate_id()` function
  - _Requirements: 1.1-1.11_

- [x] 2. Implement cost tracking types and pricing
  - [x] 2.1 Create cost/types.py with Pydantic models
    - Define ModelProvider, BudgetPeriod, BudgetAction, AlertSeverity literals
    - Define ModelPricing, TokenUsage, CostBreakdown models
    - Define CostEstimate, CostRecord models
    - Define BudgetConfig, BudgetStatus, CostAlert models
    - Define CostSummary model
    - _Requirements: 1.1, 1.2, 7.1, 7.2_
  
  - [x] 2.2 Create cost/pricing.py with model pricing database
    - Define MODEL_PRICING dictionary with 30+ models
    - Implement get_model_pricing() with fuzzy matching
    - Implement get_provider_models()
    - Implement is_model_supported()
    - Implement get_supported_models() and get_supported_providers()
    - _Requirements: 1.3, 1.4, 1.5, 1.6_
  
  - [x] 2.3 Write property test for pricing lookup
    - **Property 1: Cost estimation accuracy**
    - **Validates: Requirements 1.1**

- [x] 3. Implement CostTracker class
  - [x] 3.1 Create cost/tracker.py with CostTracker
    - Implement __init__ with CostTrackerConfig
    - Implement estimate_cost() method
    - Implement calculate_actual_cost() method
    - Implement add_custom_pricing() and remove_custom_pricing()
    - Implement get_pricing() method
    - Implement private helper methods (_get_pricing, _calculate_breakdown, etc.)
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 1.10, 1.11_
  
  - [x] 3.2 Write property test for cost estimation
    - **Property 1: Cost estimation accuracy**
    - **Validates: Requirements 1.1**
  
  - [x] 3.3 Write property test for actual cost calculation
    - **Property 2: Actual cost calculation accuracy**
    - **Validates: Requirements 1.2**
  
  - [x] 3.4 Write property test for custom pricing override
    - **Property 3: Custom pricing override**
    - **Validates: Requirements 1.7**
  
  - [x] 3.5 Write property test for cost breakdown consistency
    - **Property 4: Cost breakdown consistency**
    - **Validates: Requirements 1.9**
  
  - [x] 3.6 Write unit tests for edge cases
    - Test missing pricing data (returns zero cost)
    - Test vision models with image costs
    - Test audio models with audio costs
    - _Requirements: 1.8, 1.10, 1.11_

- [x] 4. Checkpoint - Ensure cost tracking tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Implement CostStorage interface and implementation
  - [x] 5.1 Create cost/storage.py with CostStorage abstract class
    - Define CostStorage ABC with all abstract methods
    - Implement InMemoryCostStorage class
    - Implement store(), get(), get_by_request_id() methods
    - Implement get_by_agent_id(), get_by_date_range() methods
    - Implement get_summary() method
    - Implement delete_older_than() and clear() methods
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [x] 5.2 Write property test for unique ID assignment
    - **Property 5: Unique ID assignment**
    - **Validates: Requirements 2.3**
  
  - [x] 5.3 Write property test for request ID queries
    - **Property 6: Request ID query correctness**
    - **Validates: Requirements 2.4**
  
  - [x] 5.4 Write property test for agent ID queries
    - **Property 7: Agent ID query correctness**
    - **Validates: Requirements 2.5**
  
  - [x] 5.5 Write property test for date range queries
    - **Property 8: Date range query correctness**
    - **Validates: Requirements 2.6**
  
  - [x] 5.6 Write property test for cost summary accuracy
    - **Property 9: Cost summary accuracy**
    - **Validates: Requirements 2.7**
  
  - [x] 5.7 Write property test for old record deletion
    - **Property 10: Old record deletion**
    - **Validates: Requirements 2.8**
  
  - [x] 5.8 Write unit test for clear operation
    - Test clearing all records
    - _Requirements: 2.9_

- [x] 6. Implement BudgetManager class
  - [x] 6.1 Create cost/budget.py with BudgetManager
    - Implement __init__ with storage parameter
    - Implement create_budget(), update_budget(), delete_budget() methods
    - Implement get_budget(), get_all_budgets(), get_budgets_by_scope() methods
    - Implement check_budget() async method
    - Implement record_cost() async method
    - Implement get_budget_status() async method
    - Implement get_alerts(), acknowledge_alert(), clear_alerts() methods
    - Implement private helper methods (_get_relevant_budgets, _get_period_dates, etc.)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_
  
  - [x] 6.2 Write property test for budget period calculation
    - **Property 11: Budget period calculation**
    - **Validates: Requirements 3.3**
  
  - [x] 6.3 Write property test for budget blocking
    - **Property 12: Budget blocking**
    - **Validates: Requirements 3.4**
  
  - [x] 6.4 Write property test for alert threshold generation
    - **Property 13: Alert threshold generation**
    - **Validates: Requirements 3.5**
  
  - [x] 6.5 Write property test for agent-scoped budget isolation
    - **Property 14: Agent-scoped budget isolation**
    - **Validates: Requirements 3.7**
  
  - [x] 6.6 Write property test for budget status calculation
    - **Property 15: Budget status calculation**
    - **Validates: Requirements 3.10**
  
  - [x] 6.7 Write property test for cost recording updates budget
    - **Property 16: Cost recording updates budget**
    - **Validates: Requirements 3.11**
  
  - [x] 6.8 Write unit tests for budget CRUD and alerts
    - Test budget creation, update, deletion
    - Test period types (hourly, daily, weekly, monthly, total)
    - Test alert acknowledgment
    - _Requirements: 3.2, 3.8, 3.9, 3.12_

- [x] 7. Checkpoint - Ensure budget management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement GuardedOpenAI client
  - [x] 8.1 Create clients/ directory and clients/guarded_openai.py
    - Define GuardedOpenAIConfig Pydantic model
    - Define ChatCompletionMessage, ChatCompletionRequest models
    - Define SecurityMetadata, ChatCompletionResponse models
    - Implement GuardedOpenAI class with __init__
    - Implement chat property returning ChatCompletions instance
    - _Requirements: 4.1, 4.14, 7.1, 7.2_
  
  - [x] 8.2 Implement GuardedOpenAI.chat.completions.create() method
    - Implement input guardrail execution
    - Implement cost estimation and budget checking
    - Implement actual OpenAI API call using AsyncOpenAI
    - Implement output guardrail execution
    - Implement actual cost calculation and storage
    - Implement budget manager cost recording
    - Return response with security metadata
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.15_
  
  - [x] 8.3 Write property test for input guardrail execution
    - **Property 17: Input guardrail execution**
    - **Validates: Requirements 4.2**
  
  - [x] 8.4 Write property test for input guardrail blocking
    - **Property 18: Input guardrail blocking**
    - **Validates: Requirements 4.3**
  
  - [x] 8.5 Write property test for cost estimation before API call
    - **Property 19: Cost estimation before API call**
    - **Validates: Requirements 4.4**
  
  - [x] 8.6 Write property test for budget verification
    - **Property 20: Budget verification before API call**
    - **Validates: Requirements 4.5**
  
  - [x] 8.7 Write property test for budget exceeded blocking
    - **Property 21: Budget exceeded blocking**
    - **Validates: Requirements 4.6**
  
  - [x] 8.8 Write property test for output guardrail execution
    - **Property 22: Output guardrail execution**
    - **Validates: Requirements 4.8**
  
  - [x] 8.9 Write property test for output guardrail blocking
    - **Property 23: Output guardrail blocking**
    - **Validates: Requirements 4.9**
  
  - [x] 8.10 Write property test for actual cost calculation
    - **Property 24: Actual cost calculation after API call**
    - **Validates: Requirements 4.10**
  
  - [x] 8.11 Write property test for cost record storage
    - **Property 25: Cost record storage**
    - **Validates: Requirements 4.11**
  
  - [x] 8.12 Write property test for budget manager recording
    - **Property 26: Cost recording with budget manager**
    - **Validates: Requirements 4.12**
  
  - [x] 8.13 Write property test for security metadata presence
    - **Property 27: Security metadata presence**
    - **Validates: Requirements 4.13**
  
  - [x] 8.14 Write unit tests for GuardedOpenAI
    - Test with mocked OpenAI API responses
    - Test error handling
    - Test configuration options
    - _Requirements: 4.1, 4.14_

- [x] 9. Implement GuardedAnthropic client
  - [x] 9.1 Create clients/guarded_anthropic.py
    - Define GuardedAnthropicConfig Pydantic model
    - Define MessageCreateRequest, MessageCreateResponse models
    - Implement GuardedAnthropic class with __init__
    - Implement messages property returning Messages instance
    - Implement message content extraction helper
    - _Requirements: 5.1, 5.14, 5.15, 7.1, 7.2_
  
  - [x] 9.2 Implement GuardedAnthropic.messages.create() method
    - Implement input guardrail execution
    - Implement cost estimation and budget checking with 'anthropic' provider
    - Implement actual Anthropic API call using AsyncAnthropic
    - Implement output guardrail execution
    - Implement actual cost calculation and storage
    - Implement budget manager cost recording
    - Return response with security metadata
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.16_
  
  - [x] 9.3 Write property tests for GuardedAnthropic
    - **Property 28: Anthropic input guardrail execution**
    - **Property 29: Anthropic input guardrail blocking**
    - **Property 30: Anthropic cost estimation**
    - **Property 31: Anthropic budget verification**
    - **Property 32: Anthropic budget blocking**
    - **Property 33: Anthropic output guardrail execution**
    - **Property 34: Anthropic output guardrail blocking**
    - **Property 35: Anthropic actual cost calculation**
    - **Property 36: Anthropic message content extraction**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10, 5.15**
  
  - [x] 9.4 Write unit tests for GuardedAnthropic
    - Test with mocked Anthropic API responses
    - Test string and array message content formats
    - Test error handling
    - _Requirements: 5.1, 5.14, 5.15_

- [x] 10. Implement GuardedAzureOpenAI client
  - [x] 10.1 Create clients/guarded_azure_openai.py
    - Define GuardedAzureOpenAIConfig Pydantic model
    - Define AzureChatCompletionRequest, AzureChatCompletionResponse models
    - Implement GuardedAzureOpenAI class with __init__
    - Implement chat property and deployments property
    - Implement deployment-to-model mapping function
    - _Requirements: 6.1, 6.2, 6.5, 6.16, 7.1, 7.2_
  
  - [x] 10.2 Implement GuardedAzureOpenAI.chat.completions.create() method
    - Implement input guardrail execution
    - Implement deployment-to-model mapping for pricing
    - Implement cost estimation and budget checking
    - Implement actual Azure OpenAI API call using AsyncAzureOpenAI
    - Implement output guardrail execution
    - Implement actual cost calculation with mapped model
    - Implement cost storage and budget recording
    - Return response with security metadata
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.17_
  
  - [x] 10.3 Write property tests for GuardedAzureOpenAI
    - **Property 37: Azure deployment to model mapping**
    - **Property 38: Azure input guardrail execution**
    - **Property 39: Azure cost estimation with deployment mapping**
    - **Property 40: Azure budget verification**
    - **Property 41: Azure budget blocking**
    - **Property 42: Azure output guardrail execution**
    - **Property 43: Azure actual cost calculation**
    - **Validates: Requirements 6.3, 6.5, 6.6, 6.7, 6.8, 6.10, 6.12**
  
  - [x] 10.4 Write unit tests for GuardedAzureOpenAI
    - Test with mocked Azure OpenAI API responses
    - Test deployment mapping for various deployment names
    - Test both chat.completions and deployments.chat.completions APIs
    - Test Azure AD token authentication
    - Test error handling
    - _Requirements: 6.1, 6.2, 6.5, 6.16_

- [x] 11. Checkpoint - Ensure all guarded client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Update package exports and documentation
  - [x] 12.1 Update src/agentguard/__init__.py
    - Export all cost tracking classes and types
    - Export all guarded client classes
    - Update __version__ to '0.2.2'
    - Update __all__ list
    - _Requirements: 10.1, 10.2_
  
  - [x] 12.2 Update src/agentguard/cost/__init__.py
    - Export CostTracker, CostStorage, InMemoryCostStorage, BudgetManager
    - Export all types from types.py
    - Export pricing functions from pricing.py
    - _Requirements: 10.1_
  
  - [x] 12.3 Update src/agentguard/clients/__init__.py
    - Export GuardedOpenAI, GuardedAnthropic, GuardedAzureOpenAI
    - Export configuration classes
    - _Requirements: 10.1_

- [x] 13. Create example scripts
  - [x] 13.1 Create examples/cost_tracking_demo.py
    - Demonstrate CostTracker usage
    - Show cost estimation and calculation
    - Show custom pricing
    - _Requirements: 8.4, 9.4_
  
  - [x] 13.2 Create examples/budget_management_demo.py
    - Demonstrate BudgetManager usage
    - Show budget creation and checking
    - Show alert generation
    - _Requirements: 8.4, 9.4_
  
  - [x] 13.3 Create examples/guarded_openai_demo.py
    - Demonstrate GuardedOpenAI usage
    - Show guardrails and cost tracking integration
    - _Requirements: 8.4, 9.4_
  
  - [x] 13.4 Create examples/guarded_anthropic_demo.py
    - Demonstrate GuardedAnthropic usage
    - Show guardrails and cost tracking integration
    - _Requirements: 8.4, 9.4_
  
  - [x] 13.5 Create examples/guarded_azure_openai_demo.py
    - Demonstrate GuardedAzureOpenAI usage
    - Show deployment mapping and cost tracking
    - _Requirements: 8.4, 9.4_

- [x] 14. Update documentation
  - [x] 14.1 Update README.md
    - Add Cost Tracking section with examples
    - Add Budget Management section with examples
    - Add Guarded Clients section with examples
    - Add installation instructions for new dependencies
    - Update feature list
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 14.2 Update CHANGELOG.md
    - Add v0.2.2 section
    - List all new features (cost tracking, budgets, guarded clients)
    - List all new classes and methods
    - Note feature parity with TypeScript SDK v0.2.2
    - _Requirements: 9.6_
  
  - [x] 14.3 Create API reference documentation
    - Document all cost tracking classes and methods
    - Document all budget management classes and methods
    - Document all guarded client classes and methods
    - Include type signatures and examples
    - _Requirements: 9.5_

- [x] 15. Update dependencies and configuration
  - [x] 15.1 Update pyproject.toml
    - Add openai dependency (for GuardedOpenAI and GuardedAzureOpenAI)
    - Add anthropic dependency (for GuardedAnthropic)
    - Add hypothesis dependency for property-based testing
    - Update version to 0.2.2
    - _Requirements: 8.1_
  
  - [x] 15.2 Update setup.py if needed
    - Ensure all dependencies are listed
    - Update version to 0.2.2
    - _Requirements: 8.1_

- [x] 16. Final checkpoint - Run full test suite
  - Run pytest with coverage
  - Verify coverage is above 80%
  - Run all example scripts
  - Verify no linting errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- All async methods use Python's async/await syntax
- All data models use Pydantic for type safety and validation
- The implementation maintains backward compatibility with existing guardrail features
