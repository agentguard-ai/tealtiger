# Recommended Public SDK Repository Structure

## Repository: `agent-guard-sdk` (Public)

```
agent-guard-sdk/
├── src/                          # SDK source code
│   ├── client/
│   ├── config/
│   ├── policy/
│   ├── types/
│   └── utils/
├── examples/                     # Usage examples
│   ├── basic-usage.js
│   ├── advanced-usage.ts
│   └── framework-examples/
├── docs/                         # SDK-specific docs
│   ├── api-reference.md
│   ├── getting-started.md
│   └── integration-guide.md
├── README.md                     # SDK documentation
├── LICENSE                       # MIT license
├── CHANGELOG.md                  # Version history
├── package.json                  # Package config
├── tsconfig.json                 # TypeScript config
├── jest.config.js                # Test config
├── .eslintrc.js                  # Linting config
├── .gitignore                    # Git ignore
└── .github/                      # GitHub templates
    ├── ISSUE_TEMPLATE/
    └── workflows/
```

## Files to EXCLUDE from public repo:
- Business plans and VC discussions
- Internal documentation
- Platform server code
- Database schemas
- Deployment configs
- Financial information
- Strategic roadmaps
- Customer information