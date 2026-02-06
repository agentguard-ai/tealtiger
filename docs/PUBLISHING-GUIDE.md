# Publishing Guide - v0.2.0 Release

This guide documents the steps to publish AgentGuard SDK v0.2.0 to npm and PyPI.

**Release Date**: January 30, 2026  
**Version**: 0.2.0  
**Major Feature**: Client-Side Guardrails

---

## Pre-Publishing Checklist

### ✅ Code Quality
- [x] All tests passing (199 tests for TypeScript, 50 for Python)
- [x] Build successful (TypeScript compiled without errors)
- [x] No linting errors
- [x] Version numbers updated in all files

### ✅ Documentation
- [x] CHANGELOG.md updated for both SDKs
- [x] README.md showcases new guardrails feature
- [x] Business strategy documented
- [x] Examples created and tested

### ✅ Git
- [x] All changes committed
- [x] Changes pushed to GitHub
- [x] Working on clean main branch

---

## Publishing to npm (TypeScript SDK)

### Step 1: Verify Package

```bash
cd packages/agent-guard-sdk

# Verify package.json version
cat package.json | grep version
# Should show: "version": "0.2.0"

# Verify build
npm run build

# Verify tests
npm test

# Check what will be published
npm pack --dry-run
```

### Step 2: Login to npm

```bash
# Login to npm (if not already logged in)
npm login

# Verify you're logged in
npm whoami
```

### Step 3: Publish

```bash
# Publish to npm
npm publish

# Expected output:
# + agentguard-sdk@0.2.0
```

### Step 4: Verify Publication

```bash
# Check on npm
npm view agentguard-sdk

# Install in a test project
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install agentguard-sdk
node -e "const ag = require('agentguard-sdk'); console.log(ag.VERSION);"
# Should output: 0.2.0
```

---

## Publishing to PyPI (Python SDK)

### Step 1: Verify Package

```bash
cd packages/agentguard-python

# Verify pyproject.toml version
cat pyproject.toml | grep "version ="
# Should show: version = "0.2.0"

# Run tests
pytest

# Check package structure
python -m build --sdist --wheel
```

### Step 2: Build Distribution

```bash
# Clean previous builds
rm -rf dist/ build/ *.egg-info

# Build source distribution and wheel
python -m build

# Verify build artifacts
ls dist/
# Should show:
# agentguard_sdk-0.2.0-py3-none-any.whl
# agentguard-sdk-0.2.0.tar.gz
```

### Step 3: Test with TestPyPI (Optional but Recommended)

```bash
# Upload to TestPyPI first
python -m twine upload --repository testpypi dist/*

# Test install from TestPyPI
pip install --index-url https://test.pypi.org/simple/ agentguard-sdk==0.2.0

# Test import
python -c "from agentguard import AgentGuard; print('Success!')"
```

### Step 4: Publish to PyPI

```bash
# Upload to PyPI
python -m twine upload dist/*

# Enter credentials when prompted:
# Username: __token__
# Password: pypi-... (your API token)

# Expected output:
# Uploading agentguard_sdk-0.2.0-py3-none-any.whl
# Uploading agentguard-sdk-0.2.0.tar.gz
# View at: https://pypi.org/project/agentguard-sdk/0.2.0/
```

### Step 5: Verify Publication

```bash
# Check on PyPI
pip index versions agentguard-sdk

# Install in a test environment
python -m venv /tmp/test-env
source /tmp/test-env/bin/activate  # On Windows: /tmp/test-env/Scripts/activate
pip install agentguard-sdk==0.2.0

# Test import
python -c "from agentguard import AgentGuard, GuardrailEngine; print('Success!')"
```

---

## Post-Publishing Tasks

### 1. Create GitHub Release

```bash
# Tag the release
git tag -a v0.2.0 -m "Release v0.2.0 - Client-Side Guardrails"
git push origin v0.2.0

# Create release on GitHub
# Go to: https://github.com/agentguard-ai/agentguard-sdk/releases/new
# - Tag: v0.2.0
# - Title: v0.2.0 - Client-Side Guardrails
# - Description: Copy from CHANGELOG.md
```

### 2. Update Documentation Sites

- [ ] Update npm package page
- [ ] Update PyPI package page
- [ ] Update GitHub README badges
- [ ] Update documentation links

### 3. Announce Release

#### Blog Post
- [ ] Write announcement blog post
- [ ] Include code examples
- [ ] Highlight key features
- [ ] Publish on company blog

#### Social Media
- [ ] Twitter/X announcement thread
- [ ] LinkedIn post
- [ ] Reddit posts (r/LangChain, r/LocalLLaMA, r/MachineLearning)
- [ ] Hacker News submission

#### Community
- [ ] Post in GitHub Discussions
- [ ] Update Discord/Slack communities
- [ ] Email newsletter to subscribers

#### Product Hunt
- [ ] Prepare Product Hunt launch
- [ ] Create demo video
- [ ] Gather testimonials
- [ ] Schedule launch date

---

## Rollback Procedure (If Needed)

### npm Rollback

```bash
# Deprecate the version
npm deprecate agentguard-sdk@0.2.0 "This version has been deprecated. Please use 0.1.2"

# Or unpublish within 72 hours
npm unpublish agentguard-sdk@0.2.0
```

### PyPI Rollback

```bash
# PyPI doesn't allow unpublishing
# Instead, yank the release (hides it but keeps it available)
# Go to: https://pypi.org/manage/project/agentguard-sdk/release/0.2.0/
# Click "Options" → "Yank release"
```

---

## Troubleshooting

### npm Publish Fails

**Error**: `403 Forbidden`
- **Solution**: Verify you're logged in with correct account
- **Solution**: Check package name isn't taken
- **Solution**: Verify you have publish rights

**Error**: `ENEEDAUTH`
- **Solution**: Run `npm login` again
- **Solution**: Check npm token is valid

### PyPI Upload Fails

**Error**: `403 Forbidden`
- **Solution**: Verify API token is correct
- **Solution**: Check token has upload permissions

**Error**: `File already exists`
- **Solution**: Version already published, increment version number
- **Solution**: Delete dist/ and rebuild

### Tests Fail

- **Solution**: Run `npm test` or `pytest` to identify failing tests
- **Solution**: Fix issues before publishing
- **Solution**: Never publish with failing tests

---

## Success Metrics to Track

After publishing, monitor these metrics:

### Week 1
- npm downloads: Target 100+
- PyPI downloads: Target 50+
- GitHub stars: Target 20+
- Issues/questions: Respond within 24 hours

### Month 1
- npm downloads: Target 1,000+
- PyPI downloads: Target 500+
- GitHub stars: Target 100+
- Community engagement: 10+ discussions

### Month 3
- npm downloads: Target 5,000+
- PyPI downloads: Target 2,500+
- GitHub stars: Target 500+
- First paying customers: Target 10+

---

## Next Steps After v0.2.0

1. **Monitor Adoption**
   - Track download metrics
   - Monitor GitHub issues
   - Engage with community feedback

2. **Plan v0.3.0**
   - Cost tracking and budget enforcement
   - Approval workflows
   - Drop-in integrations (LangChain, CrewAI)

3. **Platform Development**
   - Build web UI for policy management
   - Implement monitoring dashboard
   - Add team collaboration features

4. **Marketing & Sales**
   - Content marketing (blog posts, tutorials)
   - Community building
   - Enterprise outreach

---

## Contact

For publishing issues or questions:
- **Email**: agentguard@proton.me
- **GitHub**: https://github.com/agentguard-ai
- **npm**: https://www.npmjs.com/package/agentguard-sdk
- **PyPI**: https://pypi.org/project/agentguard-sdk/

---

**Ready to publish? Let's ship! 🚀**
