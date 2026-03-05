# Changelog

<<<<<<< HEAD
All notable changes to the TealTiger SDK will be documented in this file.
=======
All notable changes to the AgentGuard SDK will be documented in this file.
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<<<<<<< HEAD
## [1.1.0] - 2026-02-11

### Added - Multi-Provider Expansion
- **7 LLM Provider Support**: OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, Mistral AI, Cohere
- **95%+ Market Coverage**: Support for 50+ models across all major providers
- **TealGemini Client**: Google Gemini with multimodal support (text + images)
- **TealBedrock Client**: AWS Bedrock with multi-model access (Claude, Titan, Jurassic, Command, Llama)
- **TealAzureOpenAI Client**: Azure OpenAI with deployment-based routing and Azure AD auth
- **TealMistral Client**: Mistral AI with European data residency and GDPR compliance
- **TealCohere Client**: Cohere with RAG capabilities, citations, and web search connectors
- **TealMultiProvider**: Multi-provider orchestration with automatic failover and load balancing
- **CostCalculator Utility**: Compare costs across providers and generate optimization recommendations
- **Provider Comparison Matrix**: Comprehensive documentation comparing all 7 providers

### Added - TealEngine v1.1.0 Components
- **TealEngine**: Centralized policy engine with declarative policy DSL
- **TealGuard**: Input/output validation with PII detection and content moderation
- **TealMonitor**: Real-time metrics tracking and alerting
- **TealCircuit**: Circuit breaker pattern for resilience
- **TealAudit**: Comprehensive audit logging with structured events

### Enhanced
- **Cost Tracking**: Extended to support all 7 providers with accurate pricing
- **Budget Management**: Multi-provider budget enforcement
- **Security Guardrails**: Enhanced PII detection, prompt injection prevention, content moderation
- **Integration Tests**: Comprehensive tests for all providers with TealTiger components
- **Documentation**: Provider comparison guide, migration guides, 7 new example files

### Features
- **Multi-Provider Routing**: Priority-based, round-robin, cost-based, and use-case routing strategies
- **Automatic Failover**: High availability with configurable failover attempts
- **Cost Optimization**: Real-time cost comparison and recommendations
- **Provider-Specific Features**: Multimodal (Gemini), RAG (Cohere), EU residency (Mistral)
- **Backward Compatible**: Zero breaking changes, existing code works unchanged

### Performance
- **<20ms Overhead**: Minimal latency per provider
- **802 Tests Passing**: Comprehensive test coverage across all providers
- **Production Ready**: Stable, tested, and documented

### Documentation
- 7 provider-specific examples (Gemini, Bedrock, Azure, Mistral, Cohere, multi-provider, cost comparison)
- Provider comparison matrix with feature comparison
- Migration guides from native SDKs
- Cost comparison utilities documentation
- Updated README with v1.1.0 features
=======
## [0.2.2] - 2026-01-31

### Added
- Complete GuardedAzureOpenAI documentation in README
- Updated "What's New" section to highlight v0.2.1+ features

### Fixed
- README now properly showcases all three client wrappers
- Version consistency across all files

## [0.2.1] - 2026-01-31

### Added
- **Drop-in Client Wrappers** - Secure replacements for AI provider clients
  - `GuardedOpenAI` - Drop-in replacement for OpenAI client with integrated security
  - `GuardedAnthropic` - Drop-in replacement for Anthropic client with integrated security
  - `GuardedAzureOpenAI` - Drop-in replacement for Azure OpenAI client with integrated security
  - 100% API compatibility with original clients
  - Automatic guardrail execution on input and output
  - Integrated cost tracking and budget enforcement
  - Security metadata in responses
  - Configurable features (enable/disable guardrails, cost tracking)
- **Cost Tracking & Budget Management**
  - `CostTracker` - Track AI model costs across 30+ models
  - `BudgetManager` - Enforce spending limits with automatic blocking
  - Support for OpenAI, Anthropic, Google, Cohere models
  - Cost estimation before requests
  - Actual cost calculation after requests
  - Budget alerts at configurable thresholds (50%, 75%, 90%, 100%)
  - Agent-scoped budgets
  - Custom pricing support
- **Azure OpenAI Support**
  - Deployment-based API (uses deployment names instead of model names)
  - `deployments.chat.completions.create` API endpoint
  - Intelligent deployment-to-model mapping for pricing
  - Azure API version support (default: "2024-02-15-preview")
  - Azure AD token authentication support
- Demo examples for all three client wrappers
- Comprehensive test suite (318 tests passing)

### Features
- **Zero Migration**: Drop-in replacements require no code changes
- **Transparent Security**: Security evaluation happens automatically
- **Cost Visibility**: See costs in real-time with every request
- **Budget Protection**: Prevent runaway costs with automatic blocking
- **Multi-Provider**: Works with OpenAI, Anthropic, Azure OpenAI
- **Enterprise Ready**: Azure AD authentication, deployment mapping

### Performance
- < 100ms overhead for security evaluation
- Parallel guardrail execution
- Efficient cost calculation

### Documentation
- Updated README with all three client wrappers
- Added GuardedOpenAI documentation and examples
- Added GuardedAnthropic documentation and examples
- Added GuardedAzureOpenAI documentation and examples
- Cost tracking and budget management guides
- Microsoft Agentic Framework compatibility notes

## [0.2.0] - 2026-01-30

### Added
- **Client-Side Guardrails** - Offline security protection without server dependency
  - `GuardrailEngine` for parallel/sequential guardrail execution
  - `PIIDetectionGuardrail` - Detect and redact PII (emails, phones, SSNs, credit cards)
  - `ContentModerationGuardrail` - Detect harmful content (hate, violence, harassment)
  - `PromptInjectionGuardrail` - Detect jailbreak and injection attempts
  - Configurable actions: block, allow, redact, mask, transform
  - Timeout protection and error handling
  - Result caching for performance
- Comprehensive test suite for guardrails (199 tests passing)
- Guardrails demo example with 10+ test cases
- Full TypeScript support for all guardrail classes

### Features
- **Offline Capability**: Run guardrails without network calls
- **Parallel Execution**: Execute multiple guardrails simultaneously
- **Flexible Actions**: Block, redact, mask, or transform risky content
- **Risk Scoring**: Quantify security risks (0-100 scale)
- **Pattern Detection**: Regex-based detection with high accuracy
- **OpenAI Integration**: Optional OpenAI Moderation API support

### Performance
- < 50ms guardrail execution (parallel mode)
- Configurable timeouts per guardrail
- Efficient pattern matching with compiled regex
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a

## [0.1.0] - 2024-01-29

### Added
<<<<<<< HEAD
- Initial release of TealTiger SDK
=======
- Initial release of AgentGuard SDK
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
- Core security evaluation functionality
- Tool execution with security decisions (allow/deny/transform)
- Security Sidecar Agent (SSA) HTTP client
- Configuration management with validation
- Comprehensive error handling with specific error types
- Audit trail functionality
- Policy validation and management
- TypeScript support with full type definitions
- Comprehensive test suite (148 tests)
- Examples for basic and advanced usage
- Complete API documentation

### Features
- **Security Evaluation**: Evaluate tool calls before execution
- **Policy Enforcement**: Automatic policy-based decision making  
- **Request Transformation**: Safe transformation of risky operations
- **Audit Trail**: Complete audit logging for compliance
- **Performance**: < 100ms security evaluation overhead
- **TypeScript Support**: Full type safety and IntelliSense
- **Framework Agnostic**: Works with any JavaScript/Node.js agent

### Security
- API key authentication with SSA
- Input validation and sanitization
- Secure HTTP communication with configurable timeouts
- Error handling that doesn't leak sensitive information

### Developer Experience
- Comprehensive documentation with examples
- Self-documenting code with TypeScript
- Jest test suite with 100% core functionality coverage
- ESLint configuration for code quality
- Examples for common integration patterns

<<<<<<< HEAD
[Unreleased]: https://github.com/nagasatish007/ai-agent-security-platform/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/v1.1.0
[0.1.0]: https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/v0.1.0
=======
[Unreleased]: https://github.com/agentguard-ai/agentguard-sdk/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/agentguard-ai/agentguard-sdk/releases/tag/v0.2.2
[0.2.1]: https://github.com/agentguard-ai/agentguard-sdk/releases/tag/v0.2.1
[0.2.0]: https://github.com/agentguard-ai/agentguard-sdk/releases/tag/v0.2.0
[0.1.0]: https://github.com/agentguard-ai/agentguard-sdk/releases/tag/v0.1.0
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
