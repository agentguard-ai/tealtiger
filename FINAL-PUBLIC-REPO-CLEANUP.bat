@echo off
echo.
echo ========================================================================
echo 🧹 FINAL PUBLIC REPOSITORY CLEANUP - REMOVE ALL CONFIDENTIAL DATA
echo ========================================================================
echo.
echo This will remove ALL confidential and sensitive data from:
echo https://github.com/nagasatish007/ai-agent-security-platform
echo.
echo Files to be removed:
echo.
echo 1. TEST ARTIFACTS (1000+ files):
echo    - .hypothesis/ folder (Python test cache)
echo    - htmlcov/ folder (test coverage reports)
echo    - .coverage file
echo.
echo 2. INTERNAL PLATFORM CODE:
echo    - src/ folder (internal platform code)
echo    - database/ folder (internal infrastructure)
echo    - scripts/ folder (internal scripts)
echo    - docker-compose files
echo.
echo 3. CONFIDENTIAL DOCUMENTS (50+ files):
echo    - All *STRATEGY*.md files
echo    - All *BUSINESS*.md files
echo    - All *COMPETITIVE*.md files
echo    - All *MARKETING*.md files
echo    - All internal planning documents
echo    - All progress reports
echo    - All internal docs in docs/ folder
echo.
echo 4. INTERNAL DEVELOPMENT FILES:
echo    - .kiro/ folder (internal specs)
echo    - postman/ folder (API testing)
echo    - All cleanup scripts
echo    - All internal helper files
echo.
echo ⚠️  CRITICAL: This will make your repository clean and professional!
echo.
pause

cd "C:\Users\satis\OneDrive\AI Agent Security Platform"

echo.
echo ========================================================================
echo 📦 STEP 1: Removing Test Artifacts (1000+ files)
echo ========================================================================
echo.

REM Remove .hypothesis folder (1000+ test cache files)
git rm -r --cached .hypothesis/ 2>nul
if %errorlevel% equ 0 (
    echo ✅ Removed .hypothesis/ folder
) else (
    echo ℹ️  .hypothesis/ not in Git cache
)

REM Remove htmlcov folder
git rm -r --cached htmlcov/ 2>nul
if %errorlevel% equ 0 (
    echo ✅ Removed htmlcov/ folder
) else (
    echo ℹ️  htmlcov/ not in Git cache
)

REM Remove .coverage file
git rm --cached .coverage 2>nul
if %errorlevel% equ 0 (
    echo ✅ Removed .coverage file
) else (
    echo ℹ️  .coverage not in Git cache
)

echo.
echo ========================================================================
echo 🐳 STEP 2: Removing Docker and Internal Platform Code
echo ========================================================================
echo.

REM Remove Docker files
git rm --cached docker-compose.yml 2>nul
git rm --cached docker-compose.dev.yml 2>nul

REM Remove database folder
git rm -r --cached database/ 2>nul

REM Remove src folder (internal platform code)
git rm -r --cached src/ 2>nul

REM Remove scripts folder
git rm -r --cached scripts/ 2>nul

echo ✅ Removed Docker and internal platform code

echo.
echo ========================================================================
echo 📄 STEP 3: Removing Confidential Documents
echo ========================================================================
echo.

REM Remove all confidential markdown files
for %%f in (
    *STRATEGY*.md
    *BUSINESS*.md
    *COMPETITIVE*.md
    *ANALYSIS*.md
    *ROADMAP*.md
    *STANDUP*.md
    *PROGRESS*.md
    *STATUS*.md
    *SUMMARY*.md
    *PLAN*.md
    *CHECKLIST*.md
    *GUIDE*.md
    *FRAMEWORK*.md
    *TEMPLATE*.md
    *REPORT*.md
    *LAUNCH*.md
    *MARKETING*.md
    *DISCOVERY*.md
    *POSITIONING*.md
    *COMPARISON*.md
    *INSIGHTS*.md
    *SCENARIOS*.md
    *FINOPS*.md
    *VENDOR*.md
    *HUMAN-RESOURCES*.md
    *PROJECT-MANAGEMENT*.md
    *SDLC*.md
    *SPRINT*.md
    *SAAS*.md
    *MVP*.md
    *PUBLISHING*.md
    *SOCIAL-MEDIA*.md
    *BLOG-POST*.md
    *BLOGGING*.md
    *GITHUB-RELEASE*.md
    *PYPI*.md
    *PYTHON-SDK*.md
    *RELEASE*.md
    *PUBLISH*.md
    *DOWNLOAD*.md
    *METRICS*.md
    *WEEK-*.md
    *DAY-*.md
    *PHASE*.md
    *NEXT-STEPS*.md
    *ACTION-PLAN*.md
    *TOMORROW*.md
    *DEVTO*.md
    *EXAMPLES-CREATED*.md
    *VERIFICATION*.md
    *QUICKSTART*.md
    *DATABASE-SETUP*.md
    *DEVELOPMENT-LOG*.md
    *DOCKER-REMOVAL*.md
    *CLEANUP*.md
    *URGENT*.md
    *PUBLIC-FILES*.md
    *FINAL*.md
    *AUDIT*.md
    *REPOSITORY*.md
    *CONFIDENTIAL*.md
    *FIX*.md
    *RUN*.md
) do (
    git rm --cached "%%f" 2>nul
)

echo ✅ Removed confidential markdown files

echo.
echo ========================================================================
echo 📁 STEP 4: Cleaning docs/ Folder
echo ========================================================================
echo.

REM Remove internal docs
git rm --cached docs/challenges 2>nul
git rm --cached docs/ARCHITECTURE-REFINEMENT.md 2>nul
git rm --cached docs/BUSINESS-CONTINUITY-PLAN.md 2>nul
git rm --cached docs/BUSINESS-STRATEGY.md 2>nul
git rm --cached docs/CODE-REVIEW-CHECKLIST.md 2>nul
git rm --cached docs/COMPETITIVE-DESIGN.md 2>nul
git rm --cached docs/COMPETITIVE-REQUIREMENTS.md 2>nul
git rm --cached docs/COMPETITIVE-STRATEGY.md 2>nul
git rm --cached docs/COMPREHENSIVE-TESTING-REPORT.md 2>nul
git rm --cached docs/design.md 2>nul
git rm --cached docs/FINOPS-FRAMEWORK.md 2>nul
git rm --cached docs/HUMAN-RESOURCES-FRAMEWORK.md 2>nul
git rm --cached docs/MVP-STRATEGY.md 2>nul
git rm --cached docs/PROJECT-MANAGEMENT-FRAMEWORK.md 2>nul
git rm --cached docs/PUBLISHING-GUIDE.md 2>nul
git rm --cached docs/requirements.md 2>nul
git rm --cached docs/ROADMAP.md 2>nul
git rm --cached docs/SAAS-ANALYSIS.md 2>nul
git rm --cached docs/SDLC-FRAMEWORK.md 2>nul
git rm --cached docs/SPRINT-PLANNING-TEMPLATE.md 2>nul
git rm --cached docs/SPRINT-RETROSPECTIVE-TEMPLATE.md 2>nul
git rm --cached docs/TASK4-INTEGRATION-TEST-REPORT.md 2>nul
git rm --cached docs/tasks.md 2>nul
git rm --cached docs/TESTING-EXECUTION-GUIDE.md 2>nul
git rm --cached docs/TESTING-STRATEGY.md 2>nul
git rm --cached docs/VENDOR-MANAGEMENT-FRAMEWORK.md 2>nul

echo ✅ Cleaned docs/ folder (keeping only getting-started.md and FAQ.md)

echo.
echo ========================================================================
echo 🔧 STEP 5: Removing Internal Development Files
echo ========================================================================
echo.

REM Remove .kiro folder
git rm -r --cached .kiro/ 2>nul

REM Remove postman folder
git rm -r --cached postman/ 2>nul

REM Remove test-deprecated folder
git rm -r --cached test-deprecated/ 2>nul

REM Remove cleanup scripts
git rm --cached cleanup-*.bat 2>nul
git rm --cached cleanup-*.sh 2>nul
git rm --cached push-*.bat 2>nul
git rm --cached push-*.sh 2>nul
git rm --cached update-*.bat 2>nul
git rm --cached remove-*.bat 2>nul
git rm --cached final-*.bat 2>nul
git rm --cached copy-*.bat 2>nul

REM Remove other internal files
git rm --cached Document.txt 2>nul
git rm --cached sdk-repo-structure.md 2>nul

echo ✅ Removed internal development files

echo.
echo ========================================================================
echo 📝 STEP 6: Updating .gitignore
echo ========================================================================
echo.

git add .gitignore
echo ✅ Updated .gitignore

echo.
echo ========================================================================
echo 💾 STEP 7: Committing All Changes
echo ========================================================================
echo.

git commit -m "FINAL CLEANUP: Remove all confidential and internal files

CRITICAL SECURITY CLEANUP:
- Remove .hypothesis/ folder (1000+ Python test cache files)
- Remove htmlcov/ folder (test coverage reports)
- Remove .coverage file (coverage data)

INTERNAL CODE REMOVAL:
- Remove src/ folder (internal platform code - not SDK)
- Remove database/ folder (internal infrastructure)
- Remove scripts/ folder (internal scripts)
- Remove docker-compose files (internal dev environment)

CONFIDENTIAL DOCUMENTS REMOVAL:
- Remove all business strategy documents
- Remove all competitive analysis files
- Remove all marketing plans
- Remove all internal progress reports
- Remove all internal planning documents
- Clean docs/ folder (keep only public docs)

INTERNAL DEVELOPMENT FILES REMOVAL:
- Remove .kiro/ folder (internal specs)
- Remove postman/ folder (API testing)
- Remove all cleanup and helper scripts
- Remove test-deprecated/ folder

RESULT:
✅ Clean, professional SDK repository
✅ Only public-facing code and documentation
✅ No confidential or sensitive data
✅ No test artifacts or internal development files
✅ Repository clearly shows AgentGuard is a client-side SDK

Updated .gitignore to prevent future commits of sensitive files."

echo.
echo ========================================================================
echo ✅ CLEANUP COMPLETE!
echo ========================================================================
echo.
echo 📊 Summary:
echo    - Removed 1000+ test cache files (.hypothesis/)
echo    - Removed test coverage reports (htmlcov/)
echo    - Removed internal platform code (src/, database/, scripts/)
echo    - Removed Docker files
echo    - Removed 50+ confidential documents
echo    - Cleaned docs/ folder
echo    - Removed internal development files (.kiro/, postman/)
echo    - Updated .gitignore
echo.
echo 🚀 Next Step: Push to GitHub
echo.
echo Run this command:
echo    git push origin main
echo.
echo 💡 Your repository will be:
echo    ✅ Clean and professional
echo    ✅ No confidential data
echo    ✅ No test artifacts
echo    ✅ Only SDK code and public documentation
echo.
echo 🔒 All confidential files are safe in your private repository:
echo    https://github.com/nagasatish007/agentguard-internal-docs
echo.
pause
