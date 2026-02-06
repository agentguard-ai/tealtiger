# Changelog

All notable changes to the TealTiger SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/nagasatish007/ai-agent-security-platform/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nagasatish007/ai-agent-security-platform/releases/tag/v0.1.0