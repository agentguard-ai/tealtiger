# Quick Launch Guide - 5 Minutes to GitHub

This is the fastest path to get your SDK on GitHub. For detailed instructions, see `GITHUB-SETUP.md`.

## Prerequisites
- [ ] GitHub account logged in
- [ ] Git installed locally
- [ ] npm account with token ready

## Step 1: Create GitHub Organization (2 minutes)

1. Go to: https://github.com/organizations/new
2. Organization name: `agentguard`
3. Contact email: your-email@example.com
4. Plan: Free
5. Click "Create organization"

## Step 2: Create Repository (1 minute)

1. Go to: https://github.com/organizations/agentguard/repositories/new
2. Repository name: `agentguard-sdk`
3. Description: `TypeScript/JavaScript SDK for AI Agent Security - Drop-in security for LangChain, CrewAI, AutoGPT and custom agents`
4. Visibility: **Public** ✅
5. Do NOT initialize with README
6. Click "Create repository"

## Step 3: Push Code (1 minute)

Open terminal in `packages/agent-guard-sdk/` directory:

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: AgentGuard SDK v0.1.1"

# Add remote
git remote add origin https://github.com/agentguard-ai/agentguard-sdk.git

# Push
git branch -M main
git push -u origin main
```

## Step 4: Configure Secrets (1 minute)

1. Go to: https://github.com/agentguard-ai/agentguard-sdk/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Your npm token from https://www.npmjs.com/settings/YOUR_USERNAME/tokens
5. Click "Add secret"

## Step 5: Create Release (30 seconds)

```bash
# Tag version
git tag -a v0.1.1 -m "Release v0.1.1 - Initial public release"

# Push tag
git push origin v0.1.1
```

Then on GitHub:
1. Go to: https://github.com/agentguard-ai/agentguard-sdk/releases/new
2. Choose tag: `v0.1.1`
3. Title: `v0.1.1 - Initial Public Release`
4. Description: Copy from below
5. Click "Publish release"

### Release Description Template

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
\`\`\`javascript
const { AgentGuard } = require('agentguard-sdk');

const guard = new AgentGuard({
  apiKey: 'your-api-key',
  endpoint: 'http://localhost:3000'
});

await guard.evaluateAction({
  agentId: 'agent-1',
  action: 'read_file',
  resource: '/etc/passwd'
});
\`\`\`

### Stats
- 📦 137 npm downloads in first 24 hours!
- 🚀 Production-ready
- 📚 Full documentation included

### Links
- [Documentation](https://github.com/agentguard-ai/agentguard-sdk#readme)
- [npm Package](https://www.npmjs.com/package/agentguard-sdk)
- [Report Issues](https://github.com/agentguard-ai/agentguard-sdk/issues)
```

## Done! 🎉

Your SDK is now public on GitHub!

### Verify Everything Works

- [ ] Repository visible at: https://github.com/agentguard-ai/agentguard-sdk
- [ ] README displays correctly
- [ ] GitHub Actions running (check Actions tab)
- [ ] Release published
- [ ] npm package links to GitHub

### Next Steps

1. **Add Topics**: Click "Add topics" on repo page
   - Add: `ai`, `security`, `sdk`, `typescript`, `javascript`, `langchain`, `openai`, `agent`, `llm`, `guardrails`

2. **Enable Branch Protection**:
   - Go to Settings → Branches
   - Add rule for `main` branch
   - Enable: "Require pull request reviews before merging"

3. **Announce**:
   - Share on Twitter/X
   - Post on LinkedIn
   - Submit to Product Hunt
   - Share in AI/ML communities

## Troubleshooting

**Problem**: `git push` fails with authentication error
- **Solution**: Use personal access token instead of password
- Create token: https://github.com/settings/tokens

**Problem**: GitHub Actions fail
- **Solution**: Check that NPM_TOKEN secret is set correctly
- Verify token has "Read and write" permissions

**Problem**: npm publish fails
- **Solution**: Ensure you're logged into npm: `npm whoami`
- Login if needed: `npm login`

## Support

- Detailed guide: `GITHUB-SETUP.md`
- Release checklist: `RELEASE-CHECKLIST.md`
- Issues: https://github.com/agentguard-ai/agentguard-sdk/issues
