@echo off
echo.
echo 📦 Copying Confidential Files to Private Repository
echo ====================================================
echo.
echo Source: C:\Users\satis\OneDrive\AI Agent Security Platform
echo Target: C:\Users\satis\OneDrive\AI Agent Security Platform\agentguard-internal-docs
echo.
pause

cd "C:\Users\satis\OneDrive\AI Agent Security Platform"

echo.
echo Copying files...
echo.

REM Copy all confidential markdown files
copy *STRATEGY*.md "agentguard-internal-docs\" 2>nul
copy *BUSINESS*.md "agentguard-internal-docs\" 2>nul
copy *COMPETITIVE*.md "agentguard-internal-docs\" 2>nul
copy *ANALYSIS*.md "agentguard-internal-docs\" 2>nul
copy *ROADMAP*.md "agentguard-internal-docs\" 2>nul
copy *STANDUP*.md "agentguard-internal-docs\" 2>nul
copy *PROGRESS*.md "agentguard-internal-docs\" 2>nul
copy *STATUS*.md "agentguard-internal-docs\" 2>nul
copy *SUMMARY*.md "agentguard-internal-docs\" 2>nul
copy *PLAN*.md "agentguard-internal-docs\" 2>nul
copy *CHECKLIST*.md "agentguard-internal-docs\" 2>nul
copy *GUIDE*.md "agentguard-internal-docs\" 2>nul
copy *FRAMEWORK*.md "agentguard-internal-docs\" 2>nul
copy *TEMPLATE*.md "agentguard-internal-docs\" 2>nul
copy *REPORT*.md "agentguard-internal-docs\" 2>nul
copy *LAUNCH*.md "agentguard-internal-docs\" 2>nul
copy *MARKETING*.md "agentguard-internal-docs\" 2>nul
copy *DISCOVERY*.md "agentguard-internal-docs\" 2>nul
copy *POSITIONING*.md "agentguard-internal-docs\" 2>nul
copy *COMPARISON*.md "agentguard-internal-docs\" 2>nul
copy *INSIGHTS*.md "agentguard-internal-docs\" 2>nul
copy *SCENARIOS*.md "agentguard-internal-docs\" 2>nul
copy *FINOPS*.md "agentguard-internal-docs\" 2>nul
copy *VENDOR*.md "agentguard-internal-docs\" 2>nul
copy *HUMAN-RESOURCES*.md "agentguard-internal-docs\" 2>nul
copy *PROJECT-MANAGEMENT*.md "agentguard-internal-docs\" 2>nul
copy *SDLC*.md "agentguard-internal-docs\" 2>nul
copy *SPRINT*.md "agentguard-internal-docs\" 2>nul
copy *SAAS*.md "agentguard-internal-docs\" 2>nul
copy *MVP*.md "agentguard-internal-docs\" 2>nul
copy *PUBLISHING*.md "agentguard-internal-docs\" 2>nul
copy *SOCIAL-MEDIA*.md "agentguard-internal-docs\" 2>nul
copy *BLOG-POST*.md "agentguard-internal-docs\" 2>nul
copy *BLOGGING*.md "agentguard-internal-docs\" 2>nul
copy *GITHUB-RELEASE*.md "agentguard-internal-docs\" 2>nul
copy *PYPI*.md "agentguard-internal-docs\" 2>nul
copy *PYTHON-SDK*.md "agentguard-internal-docs\" 2>nul
copy *RELEASE*.md "agentguard-internal-docs\" 2>nul
copy *PUBLISH*.md "agentguard-internal-docs\" 2>nul
copy *DOWNLOAD*.md "agentguard-internal-docs\" 2>nul
copy *METRICS*.md "agentguard-internal-docs\" 2>nul
copy *WEEK-*.md "agentguard-internal-docs\" 2>nul
copy *DAY-*.md "agentguard-internal-docs\" 2>nul
copy *PHASE*.md "agentguard-internal-docs\" 2>nul
copy *NEXT-STEPS*.md "agentguard-internal-docs\" 2>nul
copy *ACTION-PLAN*.md "agentguard-internal-docs\" 2>nul
copy *TOMORROW*.md "agentguard-internal-docs\" 2>nul
copy *DEVTO*.md "agentguard-internal-docs\" 2>nul
copy *EXAMPLES-CREATED*.md "agentguard-internal-docs\" 2>nul
copy *VERIFICATION*.md "agentguard-internal-docs\" 2>nul
copy *QUICKSTART*.md "agentguard-internal-docs\" 2>nul
copy *DATABASE-SETUP*.md "agentguard-internal-docs\" 2>nul
copy *DEVELOPMENT-LOG*.md "agentguard-internal-docs\" 2>nul

REM Copy docs folder internal files
copy "docs\ARCHITECTURE-REFINEMENT.md" "agentguard-internal-docs\" 2>nul
copy "docs\BUSINESS-*.md" "agentguard-internal-docs\" 2>nul
copy "docs\COMPETITIVE-*.md" "agentguard-internal-docs\" 2>nul
copy "docs\design.md" "agentguard-internal-docs\" 2>nul
copy "docs\requirements.md" "agentguard-internal-docs\" 2>nul
copy "docs\tasks.md" "agentguard-internal-docs\" 2>nul
copy "docs\*FRAMEWORK*.md" "agentguard-internal-docs\" 2>nul
copy "docs\*STRATEGY*.md" "agentguard-internal-docs\" 2>nul
copy "docs\*TEMPLATE*.md" "agentguard-internal-docs\" 2>nul
copy "docs\*REPORT*.md" "agentguard-internal-docs\" 2>nul
copy "docs\*GUIDE*.md" "agentguard-internal-docs\" 2>nul

echo.
echo ✅ Files copied!
echo.
echo Now committing and pushing to GitHub...
echo.

cd agentguard-internal-docs

REM Add all files
git add .

REM Commit
git commit -m "Add confidential business documents

- Business strategy and competitive analysis
- Marketing plans and social media content
- Development roadmaps and architecture docs
- Internal progress reports and status updates
- Framework documents and templates
- All internal planning documents"

REM Push
git push

echo.
echo ✅ All confidential files are now in your private repository!
echo.
echo 🔒 Repository: https://github.com/nagasatish007/agentguard-internal-docs
echo.
echo ⚠️  Make sure it's set to PRIVATE on GitHub!
echo.
pause
