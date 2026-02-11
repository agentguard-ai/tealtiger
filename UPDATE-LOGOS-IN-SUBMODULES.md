# Update Logos in Submodule Repositories

The logo has been added to the submodule folders locally, but since they're Git submodules, you need to push changes to each repository separately.

---

## ✅ Already Done

1. **Main Repository (tealtiger)** - ✅ Logo added and pushed

---

## 📋 Repositories to Update

### 2. Python SDK Repository
**Repository:** https://github.com/agentguard-ai/tealtiger-python

### 3. TypeScript SDK Repository  
**Repository:** https://github.com/agentguard-ai/tealtiger-typescript

### 4. Internal Docs Repository (Optional)
**Repository:** https://github.com/nagasatish007/agentguard-internal-docs

---

## 🚀 How to Update Each Repository

### Option A: Update via GitHub Web Interface (Easiest)

For each repository:

1. **Go to the repository on GitHub**
2. **Upload logo files:**
   - Click "Add file" → "Upload files"
   - Create folder: `.github/logo/`
   - Upload all 6 logo files from your local `.github/logo/` folder
3. **Edit README.md:**
   - Click on README.md
   - Click the pencil icon (Edit)
   - Add the logo code at the top (see below)
   - Commit changes

---

### Option B: Update via Git Clone (More Control)

#### For Python SDK:

```bash
# Clone the Python SDK repository
git clone https://github.com/agentguard-ai/tealtiger-python.git
cd tealtiger-python

# Create logo folder
mkdir -p .github/logo

# Copy logo files (from your main repo)
# Copy the 6 logo files from: 
# C:\Users\satis\OneDrive\AI Agent Security Platform\.github\logo\
# To: tealtiger-python\.github\logo\

# Add and commit
git add .github/logo/
git add README.md
git commit -m "feat: add TealTiger logo with dark/light mode support"
git push origin main
```

#### For TypeScript SDK:

```bash
# Clone the TypeScript SDK repository
git clone https://github.com/agentguard-ai/tealtiger-typescript.git
cd tealtiger-typescript

# Create logo folder
mkdir -p .github/logo

# Copy logo files (from your main repo)
# Copy the 6 logo files from: 
# C:\Users\satis\OneDrive\AI Agent Security Platform\.github\logo\
# To: tealtiger-typescript\.github\logo\

# Add and commit
git add .github/logo/
git add README.md
git commit -m "feat: add TealTiger logo with dark/light mode support"
git push origin main
```

---

## 📝 README Logo Code

Add this at the top of each README.md:

```markdown
<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo/tealtiger-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo/tealtiger-logo-light.png">
    <img alt="TealTiger Logo" src=".github/logo/tealtiger-logo-light.png" width="200">
  </picture>
  
  # [Repository Name]
  
  [Rest of README content...]
</div>
```

---

## 🎯 Quick Summary

**What's been done:**
- ✅ Main tealtiger repo - Logo added and pushed
- ✅ Logo files copied to submodule folders locally

**What you need to do:**
- [ ] Push logo to tealtiger-python repository
- [ ] Push logo to tealtiger-typescript repository
- [ ] (Optional) Add logo to internal docs repository

**Estimated time:** 10-15 minutes per repository

---

## 💡 Recommendation

**Easiest approach:**

1. Go to https://github.com/agentguard-ai/tealtiger-python
2. Click "Add file" → "Create new file"
3. Type: `.github/logo/README.md` (this creates the folder)
4. Add any text, commit
5. Then upload the 6 logo PNG files to that folder
6. Edit the README.md to add the logo code

Repeat for tealtiger-typescript repository.

---

## ✅ Verification

After updating each repository, verify:
- [ ] Logo files visible in `.github/logo/` folder
- [ ] README shows logo at the top
- [ ] Logo switches between light/dark based on GitHub theme

---

**Need help with any of these steps? Let me know!**
