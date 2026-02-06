# Publish v0.2.0 NOW - Step-by-Step Commands

**Status**: Ready to publish ✅  
**Date**: January 30, 2026

---

## Part 1: Publish TypeScript SDK to npm

### Step 1: Check npm Login Status

```bash
cd packages/agent-guard-sdk
npm whoami
```

**If you see your username**: You're logged in, proceed to Step 3  
**If you get an error**: You need to login, proceed to Step 2

### Step 2: Login to npm (if needed)

```bash
npm login
```

Enter your credentials when prompted.

### Step 3: Final Verification

```bash
# Verify version
cat package.json | grep version
# Should show: "version": "0.2.0"

# Run tests one more time
npm test
# Should show: 199 tests passing

# Verify build
npm run build
# Should complete without errors
```

### Step 4: Publish to npm

```bash
npm publish
```

**Expected output:**
```
+ agentguard-sdk@0.2.0
```

### Step 5: Verify npm Publication

```bash
# Check package on npm
npm view agentguard-sdk

# Should show version 0.2.0
```

---

## Part 2: Publish Python SDK to PyPI

### Step 1: Navigate to Python Package

```bash
cd ../../packages/agentguard-python
```

### Step 2: Clean Previous Builds

```bash
# Remove old build artifacts
rm -rf dist/ build/ *.egg-info
```

### Step 3: Run Tests

```bash
pytest
```

**Expected**: 50 tests passing

### Step 4: Build Distribution

```bash
python -m build
```

**Expected output:**
```
Successfully built agentguard-sdk-0.2.0.tar.gz and agentguard_sdk-0.2.0-py3-none-any.whl
```

### Step 5: Verify Build Artifacts

```bash
ls dist/
```

**Should show:**
- `agentguard-sdk-0.2.0.tar.gz`
- `agentguard_sdk-0.2.0-py3-none-any.whl`

### Step 6: Publish to PyPI

```bash
python -m twine upload dist/*
```

**You'll be prompted for:**
- Username: `__token__`
- Password: Your PyPI API token (starts with `pypi-...`)

**Expected output:**
```
Uploading distributions to https://upload.pypi.org/legacy/
Uploading agentguard_sdk-0.2.0-py3-none-any.whl
Uploading agentguard-sdk-0.2.0.tar.gz
View at: https://pypi.org/project/agentguard-sdk/0.2.0/
```

### Step 7: Verify PyPI Publication

```bash
pip index versions agentguard-sdk
```

**Should show version 0.2.0**

---

## Part 3: Create GitHub Release

### Step 1: Tag the Release

```bash
cd ../..  # Back to root
git tag -a v0.2.0 -m "Release v0.2.0 - Client-Side Guardrails"
git push origin v0.2.0
```

### Step 2: Create GitHub Release

1. Go to: https://github.com/agentguard-ai/agentguard-sdk/releases/new
2. Select tag: `v0.2.0`
3. Release title: `v0.2.0 - Client-Side Guardrails`
4. Description: Copy from `RELEASE-v0.2.0.md`
5. Click "Publish release"

---

## Troubleshooting

### npm: "You must be logged in"
```bash
npm login
```

### npm: "403 Forbidden"
- Verify you have publish rights to `agentguard-sdk`
- Check you're logged in with correct account

### PyPI: "Invalid credentials"
- Verify your API token is correct
- Token should start with `pypi-`
- Use `__token__` as username

### PyPI: "File already exists"
- Version 0.2.0 already published
- Cannot republish same version
- Increment to 0.2.1 if needed

---

## Success! 🎉

Once both packages are published:

1. ✅ npm: https://www.npmjs.com/package/agentguard-sdk
2. ✅ PyPI: https://pypi.org/project/agentguard-sdk/
3. ✅ GitHub: Create release tag

**Next**: Execute marketing plan from `RELEASE-v0.2.0.md`
