# Publish v0.2.1 - Quick Reference

**Run these commands to publish AgentGuard SDK v0.2.1 to npm**

---

## Pre-Flight Check ✅

```bash
cd packages/agent-guard-sdk

# 1. Verify version
cat package.json | grep '"version"'
# Expected: "version": "0.2.1"

# 2. Clean and build
npm run clean && npm run build

# 3. Run all tests
npm test
# Expected: 318 tests passing

# 4. Preview what will be published
npm pack --dry-run
```

---

## Publish to npm 🚀

```bash
# 1. Login to npm (if needed)
npm login
# Enter your npm credentials

# 2. Verify you're logged in
npm whoami
# Should show your npm username

# 3. Publish!
npm publish

# Expected output:
# + agentguard-sdk@0.2.1
# npm notice 📦  agentguard-sdk@0.2.1
```

---

## Verify Publication ✅

```bash
# 1. Check npm shows v0.2.1
npm view agentguard-sdk version
# Expected: 0.2.1

# 2. Test install in clean directory
cd /tmp
mkdir test-install && cd test-install
npm init -y
npm install agentguard-sdk

# 3. Test imports
node -e "const { GuardedOpenAI, GuardedAnthropic, GuardedAzureOpenAI, CostTracker, BudgetManager, GuardrailEngine } = require('agentguard-sdk'); console.log('✅ All imports successful!');"
```

---

## Create GitHub Release 🏷️

```bash
# 1. Return to project root
cd /path/to/AI\ Agent\ Security\ Platform

# 2. Create and push tag
git tag -a v0.2.1 -m "Release v0.2.1 - Drop-in Client Wrappers & Cost Tracking"
git push origin v0.2.1

# 3. Create GitHub release
# Go to: https://github.com/agentguard-ai/agentguard-sdk/releases/new
# - Tag: v0.2.1
# - Title: v0.2.1 - Drop-in Client Wrappers & Cost Tracking
# - Description: Copy from CHANGELOG.md
# - Click "Publish release"
```

---

## Quick Verification Links

After publishing, check these:

1. **npm Package**: https://www.npmjs.com/package/agentguard-sdk
2. **GitHub Releases**: https://github.com/agentguard-ai/agentguard-sdk/releases
3. **GitHub Tags**: https://github.com/agentguard-ai/agentguard-sdk/tags

---

## If Something Goes Wrong

### Build fails
```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Tests fail
```bash
npm test -- --verbose
```

### Already published
```bash
# Increment version and try again
npm version patch  # This will bump to 0.2.2
npm publish
```

### Need to rollback
```bash
# Deprecate the version (within 72 hours)
npm deprecate agentguard-sdk@0.2.1 "Please use 0.2.0"
```

---

## What's Being Published

### Package Contents
- `dist/` - Compiled JavaScript and TypeScript definitions
- `README.md` - Complete documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

### Features in v0.2.1
- ✅ GuardedOpenAI client wrapper
- ✅ GuardedAnthropic client wrapper
- ✅ GuardedAzureOpenAI client wrapper
- ✅ Cost tracking for 30+ models
- ✅ Budget management system
- ✅ 3 built-in guardrails
- ✅ 318 tests passing

---

## After Publishing

1. **Announce on social media** (Twitter, LinkedIn, Reddit)
2. **Post in GitHub Discussions**
3. **Update documentation sites**
4. **Monitor npm downloads**
5. **Respond to issues within 24 hours**

---

**Ready? Let's ship! 🚀**

```bash
cd packages/agent-guard-sdk && npm publish
```
