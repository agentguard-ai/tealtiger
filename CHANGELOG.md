# Changelog

All notable changes to the TealTiger SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.1.0] - 2024-01-29

### Added
- Initial release of TealTiger SDK
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

[Unreleased]: https://github.com/nagasatish007/ai-agent-security-platform/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/v1.1.0
[0.1.0]: https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/v0.1.0