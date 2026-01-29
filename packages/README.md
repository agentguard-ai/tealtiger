# AI Agent Security Platform - Packages

This directory contains all the packages for the AI Agent Security Platform MVP.

## Package Structure

### Core Services
- `ssa/` - Security Sidecar Agent (main service)
- `policy-engine/` - Policy evaluation engine
- `audit-logger/` - Audit trail and logging service
- `shadow-discovery/` - Shadow agent discovery service

### SDKs
- `sdk-js/` - JavaScript/TypeScript SDK
- `sdk-python/` - Python SDK

### Shared Libraries
- `shared/` - Shared types, utilities, and configurations
- `testing/` - Shared testing utilities and fixtures

## Development

Each package is independently deployable but shares common development tooling and CI/CD pipelines.

See individual package README files for specific setup and development instructions.