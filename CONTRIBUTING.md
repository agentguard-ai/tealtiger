# Contributing to AI Agent Security Platform

Thank you for your interest in contributing to the AI Agent Security Platform! We welcome contributions from the community and are excited to work with you.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+ and pip
- Docker and Docker Compose
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-agent-security-platform.git
   cd ai-agent-security-platform
   ```

2. **Install dependencies**
   ```bash
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Start local development environment**
   ```bash
   docker-compose up -d
   npm run dev
   ```

4. **Run tests**
   ```bash
   npm test
   python -m pytest
   ```

## 📋 How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or request features
- Search existing issues before creating new ones
- Provide detailed information including:
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details
  - Relevant logs or screenshots

### Submitting Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow our coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run test:all
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat: add new security policy validation"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 🎯 Development Guidelines

### Code Style

- **TypeScript/JavaScript**: Use ESLint and Prettier configurations
- **Python**: Follow PEP 8, use Black for formatting
- **Documentation**: Use clear, concise language with examples

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### Testing Requirements

- **Unit Tests**: Required for all new functions/classes
- **Integration Tests**: Required for API endpoints and service interactions
- **Property-Based Tests**: Required for security-critical components
- **Documentation Tests**: Ensure all examples work

### Security Considerations

Since this is a security platform, all contributions must:

- Follow secure coding practices
- Include security-focused tests
- Consider threat modeling implications
- Avoid introducing vulnerabilities

## 📚 Project Structure

```
ai-agent-security-platform/
├── docs/                    # Documentation
├── packages/
│   ├── sdk-js/             # JavaScript/TypeScript SDK
│   ├── sdk-python/         # Python SDK
│   ├── ssa/                # Security Sidecar Agent
│   ├── policy-engine/      # Policy evaluation service
│   └── shared/             # Shared utilities
├── examples/               # Example applications
├── tests/                  # Integration tests
└── docker/                 # Docker configurations
```

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `security` - Security-related issues
- `performance` - Performance improvements

## 🎖️ Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Annual contributor appreciation posts

## 📞 Getting Help

- **Discord**: Join our [community Discord](https://discord.gg/ai-security)
- **GitHub Discussions**: Use for questions and ideas
- **Email**: security@yourcompany.com for security-related concerns

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Every contribution, no matter how small, helps make AI agents more secure. Thank you for being part of this important mission!

---

**Questions?** Feel free to reach out in our Discord or create a GitHub Discussion.