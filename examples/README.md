# AI Agent Security Platform Examples

This directory contains practical examples demonstrating how to integrate the AI Agent Security Platform with different types of AI agents and use cases.

## 📁 Example Categories

### 🤖 Basic Integration
- **[simple-chatbot/](./simple-chatbot/)** - Basic chatbot with security controls
- **[hello-world/](./hello-world/)** - Minimal integration example
- **[policy-testing/](./policy-testing/)** - How to test security policies locally

### 🏢 Industry Use Cases
- **[healthcare-agent/](./healthcare-agent/)** - HIPAA-compliant medical assistant
- **[finance-agent/](./finance-agent/)** - Financial data analysis with SOX compliance
- **[customer-support/](./customer-support/)** - Customer service bot with data protection

### 🔧 Framework Integrations
- **[langchain-integration/](./langchain-integration/)** - LangChain agent with security
- **[autogen-integration/](./autogen-integration/)** - AutoGen multi-agent security
- **[custom-framework/](./custom-framework/)** - Custom agent framework integration

### 🛡️ Advanced Security
- **[zero-trust-agent/](./zero-trust-agent/)** - Full zero-trust implementation
- **[policy-transformation/](./policy-transformation/)** - Request transformation examples
- **[audit-compliance/](./audit-compliance/)** - Comprehensive audit trail usage

## 🚀 Quick Start

Each example includes:
- **README.md** - Setup instructions and explanation
- **Source code** - Complete working implementation
- **Policies** - Security policy configurations
- **Tests** - Unit and integration tests
- **Docker setup** - Local development environment

### Running an Example

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-agent-security-platform.git
cd ai-agent-security-platform

# Start the security infrastructure
docker-compose up -d

# Navigate to an example
cd examples/simple-chatbot

# Install dependencies
npm install

# Run the example
npm start
```

## 📋 Example Structure

Each example follows this structure:

```
example-name/
├── README.md              # Setup and usage instructions
├── package.json           # Dependencies and scripts
├── src/
│   ├── agent.js          # Main agent implementation
│   ├── config.js         # Configuration
│   └── policies/         # Security policies
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docker-compose.yml    # Local development setup
└── .env.example          # Environment variables template
```

## 🎯 Use Case Matrix

| Example | Risk Level | Industry | Framework | Features |
|---------|------------|----------|-----------|----------|
| Simple Chatbot | Low | General | Custom | Basic security, policy testing |
| Healthcare Agent | High | Healthcare | LangChain | HIPAA compliance, data anonymization |
| Finance Agent | Critical | Finance | Custom | SOX compliance, audit trails |
| Customer Support | Medium | General | AutoGen | Multi-agent, data protection |
| Zero-Trust Agent | Critical | Security | Custom | Full zero-trust, attestation |

## 🛠️ Development Guidelines

### Creating New Examples

1. **Copy template structure** from `examples/_template/`
2. **Follow naming convention**: `kebab-case` directory names
3. **Include comprehensive README** with setup instructions
4. **Add security policies** appropriate for the use case
5. **Write tests** for both functionality and security
6. **Document security decisions** and trade-offs

### Security Considerations

Each example should demonstrate:
- **Appropriate risk level** for the use case
- **Principle of least privilege** in policy configuration
- **Proper error handling** for security failures
- **Audit trail usage** for compliance requirements
- **Testing strategies** for security controls

## 📚 Learning Path

### Beginner
1. Start with **hello-world** for basic concepts
2. Try **simple-chatbot** for policy configuration
3. Explore **policy-testing** for development workflow

### Intermediate
4. Study **langchain-integration** for framework usage
5. Review **customer-support** for multi-agent scenarios
6. Examine **audit-compliance** for logging practices

### Advanced
7. Analyze **healthcare-agent** for regulatory compliance
8. Implement **zero-trust-agent** for maximum security
9. Customize **policy-transformation** for specific needs

## 🤝 Contributing Examples

We welcome community contributions! To add a new example:

1. **Fork the repository**
2. **Create example** following our structure
3. **Test thoroughly** in local environment
4. **Document clearly** with README and comments
5. **Submit pull request** with description

### Example Ideas Wanted

- **E-commerce agent** with PCI DSS compliance
- **Legal research agent** with confidentiality controls
- **IoT device agent** with edge security
- **Multi-cloud agent** with cross-cloud policies
- **Real-time trading agent** with latency optimization

## 🔍 Troubleshooting

### Common Issues

**Security services not starting:**
```bash
# Check Docker services
docker-compose ps

# View logs
docker-compose logs ssa policy-engine
```

**Policy validation errors:**
```bash
# Test policies locally
npx @ai-security/policy-tester validate ./policies/my-policy.json
```

**SDK connection issues:**
```bash
# Verify service endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Getting Help

- **Discord**: [Join our community](https://discord.gg/ai-security)
- **GitHub Issues**: [Report problems](https://github.com/yourusername/ai-agent-security-platform/issues)
- **Documentation**: [Full docs](https://ai-agent-security.dev)

---

**Ready to secure your AI agents?** Start with the [hello-world](./hello-world/) example and work your way up to more complex use cases!