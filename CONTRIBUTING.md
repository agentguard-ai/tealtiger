# Contributing to TealTiger

Thank you for considering contributing to TealTiger! It's people like you that make TealTiger a great tool for securing AI agents.

## Ways to Contribute

- 🐛 **Report bugs** — Help us identify and fix issues
- 💡 **Suggest features** — Share ideas for new functionality
- 📝 **Improve documentation** — Help others understand and use the SDK
- 🔧 **Submit pull requests** — Contribute code improvements
- 🔍 **Add secret detection patterns** — Expand our 500+ pattern library
- 💬 **Answer questions** — Help other users in [Discussions](https://github.com/agentguard-ai/tealtiger/discussions)

## Getting Started

### Which repo?

TealTiger uses separate repos for each SDK:

| SDK | Repo | Setup |
|-----|------|-------|
| TypeScript | [tealtiger-typescript-prod](https://github.com/agentguard-ai/tealtiger-typescript-prod) | `npm install && npm test` |
| Python | [tealtiger-python-prod](https://github.com/agentguard-ai/tealtiger-python-prod) | `pip install -e ".[dev]" && pytest` |

### Development Setup

**TypeScript SDK:**
```bash
git clone https://github.com/agentguard-ai/tealtiger-typescript-prod.git
cd tealtiger-typescript-prod
npm install
npm test
npm run build
```

**Python SDK:**
```bash
git clone https://github.com/agentguard-ai/tealtiger-python-prod.git
cd tealtiger-python-prod
pip install -e ".[dev]"
pytest
```

## Your First PR (Step-by-Step)

Never submitted a PR before? Here's the exact workflow:

### 1. Fork & Clone
```bash
# Fork the repo via GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/tealtiger.git
cd tealtiger
```

### 2. Create a Branch
```bash
git checkout -b fix/your-change-name
```

### 3. Make Your Change
Edit the file(s) you want to change. Start small — typo fixes and doc improvements count!

### 4. Test Locally
```bash
# TypeScript SDK
cd tealtiger-typescript-prod
npm install && npm test

# Python SDK
cd tealtiger-python-prod
pip install -e ".[dev]" && pytest
```

### 5. Commit & Push
```bash
git add .
git commit -m "docs: fix typo in CONTRIBUTING.md"
git push origin fix/your-change-name
```

### 6. Open a PR
- Go to your fork on GitHub
- Click "Compare & pull request"
- Fill out the PR template — reviewers look for: clear description, tests passing, scope focused
- Submit and wait for review (typically 2–3 business days)

---

## Development Workflow

### 1. Create a branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`

### 2. Make your changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Test

```bash
# TypeScript
npm test
npm run lint

# Python
pytest
ruff check .
```

### 4. Commit

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add Twilio secret detection pattern"
git commit -m "fix: resolve timeout in TealCircuit"
git commit -m "docs: add CrewAI integration example"
```

### 5. Submit a PR

1. Push to your fork
2. Open a PR against the appropriate SDK repo
3. Fill out the PR template
4. Wait for review (typically 2-3 business days)

## PR Checklist

- [ ] Tests pass (`npm test` or `pytest`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits
- [ ] No merge conflicts with main

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/agentguard-ai/tealtiger/issues?q=label%3A%22good+first+issue%22) — these are specifically designed for new contributors.

**Easy wins:**
- Add secret detection patterns (e.g., SendGrid, Twilio, Slack webhook)
- Add quickstart examples for specific providers
- Improve documentation and add code comments
- Add cost comparison tables

## Code Style

### TypeScript
- Use TypeScript for all new code
- Define interfaces for public APIs
- Avoid `any` types
- Add JSDoc comments for public methods

### Python
- Type hints on all public functions
- Docstrings on all public classes and methods
- Follow PEP 8 (enforced by ruff)

## Recognition

Contributors are:
- Listed in [Contributors](https://github.com/agentguard-ai/tealtiger/graphs/contributors)
- Mentioned in release notes for significant contributions
- First 25 merged PRs get **"Founding Contributor"** recognition

## Getting Help

- **Discord:** [Join the TealTiger Community](https://discord.gg/X2ePf8QAj)
- **Questions?** Open a [Discussion](https://github.com/agentguard-ai/tealtiger/discussions)
- **Bug?** Open an [Issue](https://github.com/agentguard-ai/tealtiger/issues)
- **Security?** See [SECURITY.md](SECURITY.md)
- **Email:** [reachout@tealtiger.ai](mailto:reachout@tealtiger.ai)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to TealTiger! 🐯
