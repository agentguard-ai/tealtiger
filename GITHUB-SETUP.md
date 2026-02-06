# GitHub Repository Setup Guide

This guide will help you set up the public GitHub repository for the AgentGuard SDK.

## Prerequisites

- GitHub account
- Git installed locally
- npm account with publishing rights
- Repository admin access

## Step 1: Create GitHub Organization and Repository

1. **Create GitHub Organization** (if not exists):
   - Go to https://github.com/organizations/new
   - Organization name: `agentguard-ai`
   - Contact email: agentguard@proton.me
   - Choose "Free" plan

2. **Create Repository**:
   - Go to https://github.com/organizations/agentguard-ai/repositories/new
   - Repository name: `agentguard-sdk`
   - Description: "TypeScript/JavaScript SDK for AI Agent Security - Drop-in security for LangChain, CrewAI, AutoGPT and custom agents"
   - Visibility: **Public**
   - Do NOT initialize with README (we'll push existing code)
   - Click "Create repository"

## Step 2: Prepare Local Repository

```bash
# Navigate to SDK directory
cd packages/agent-guard-sdk

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: AgentGuard SDK v0.1.1"

# Add remote origin
git remote add origin https://github.com/agentguard-ai/agentguard-sdk.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Configure Repository Settings

### Branch Protection Rules
1. Go to Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

### Repository Secrets
1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `NPM_TOKEN`: Your npm authentication token
     - Get from: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
     - Create "Automation" token with "Read and write" permissions

### Topics
1. Go to repository main page
2. Click "Add topics"
3. Add: `ai`, `security`, `sdk`, `typescript`, `javascript`, `langchain`, `openai`, `agent`, `llm`, `guardrails`

### About Section
1. Click the gear icon next to "About"
2. Description: "TypeScript/JavaScript SDK for AI Agent Security - Drop-in security for LangChain, CrewAI, AutoGPT and custom agents"
3. Website: https://www.npmjs.com/package/agentguard-sdk
4. Topics: (already added above)
5. ✅ Releases
6. ✅ Packages

## Step 4: Enable GitHub Features

### Issues
1. Go to Settings → Features
2. ✅ Enable Issues
3. Issue templates are already configured in `.github/ISSUE_TEMPLATE/`

### Discussions (Optional)
1. Go to Settings → Features
2. ✅ Enable Discussions
3. Create categories:
   - General
   - Q&A
   - Show and Tell
   - Feature Requests

### Projects (Optional)
1. Go to Projects tab
2. Create project: "SDK Development Roadmap"
3. Add columns: Backlog, In Progress, Done

## Step 5: Configure npm Package

The package.json needs to be updated with correct URLs:
- Repository: https://github.com/agentguard-ai/agentguard-sdk
- Issues: https://github.com/agentguard-ai/agentguard-sdk/issues
- Homepage: https://github.com/agentguard-ai/agentguard-sdk

No changes needed!

## Step 6: Create Initial Release

```bash
# Tag the current version
git tag -a v0.1.1 -m "Release v0.1.1 - Initial public release"

# Push tags
git push origin v0.1.1
```

Then on GitHub:
1. Go to Releases → Draft a new release
2. Choose tag: `v0.1.1`
3. Release title: `v0.1.1 - Initial Public Release`
4. Description:
```markdown
## 🎉 Initial Public Release

AgentGuard SDK is now publicly available! This release provides core security features for AI agents.

### Features
- ✅ Drop-in security for LangChain, CrewAI, AutoGPT
- ✅ Policy-based access control
- ✅ Real-time security monitoring
- ✅ Comprehensive audit logging
- ✅ TypeScript support with full type definitions

### Installation
\`\`\`bash
npm install agentguard-sdk
\`\`\`

### Quick Start
See [README](https://github.com/agentguard/agentguard-sdk#readme) for usage examples.

### Stats
- 📦 137 npm downloads in first 24 hours!
- 🚀 Production-ready
- 📚 Full documentation included
```
5. Click "Publish release"

## Step 7: Add Badges to README

The README.github.md already includes badges for:
- npm version
- npm downloads
- License
- Build status
- Coverage

These will automatically work once the repository is public.

## Step 8: Set Up Integrations (Optional)

### Codecov
1. Go to https://codecov.io/
2. Sign in with GitHub
3. Add repository: `agentguard-ai/agentguard-sdk`
4. Copy token and add as `CODECOV_TOKEN` secret in GitHub

### Dependabot
1. Go to Settings → Security & analysis
2. Enable "Dependabot alerts"
3. Enable "Dependabot security updates"

## Step 9: Announce the Release

### npm Package Page
- Already published at: https://www.npmjs.com/package/agentguard-sdk
- Update package description if needed

### Social Media / Community
- Share on Twitter/X with hashtags: #AI #Security #OpenSource
- Post in relevant communities (Reddit r/MachineLearning, r/artificial)
- Share in AI/ML Discord servers
- Post on LinkedIn

### Documentation Sites
- Submit to:
  - https://www.producthunt.com/
  - https://github.com/topics/ai-security
  - https://github.com/topics/langchain

## Verification Checklist

- [ ] Repository created at https://github.com/agentguard-ai/agentguard-sdk
- [ ] Code pushed to main branch
- [ ] Branch protection rules configured
- [ ] NPM_TOKEN secret added
- [ ] GitHub Actions workflows running
- [ ] Issue templates working
- [ ] PR template working
- [ ] Release v0.1.1 published
- [ ] README displays correctly
- [ ] Badges showing correct information
- [ ] npm package links to GitHub repo

## Next Steps

1. Monitor GitHub Issues for bug reports and feature requests
2. Respond to community feedback
3. Plan v0.2.0 features based on user needs
4. Continue development following the roadmap

## Support

For questions or issues during setup:
- Create an issue: https://github.com/agentguard-ai/agentguard-sdk/issues
- Email: agentguard@proton.me

---

**Congratulations!** Your SDK is now publicly available on GitHub! 🎉
