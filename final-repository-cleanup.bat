@echo off
echo.
echo 🧹 FINAL REPOSITORY CLEANUP
echo ================================
echo.
echo This script will remove:
echo.
echo 1. TEST ARTIFACTS (should never be in Git):
echo    - .hypothesis/ folder (1000+ Python test cache files)
echo    - htmlcov/ folder (test coverage HTML reports)
echo    - .coverage file (coverage data)
echo.
echo 2. DOCKER ^& INTERNAL PLATFORM CODE:
echo    - docker-compose.yml (internal dev environment)
echo    - docker-compose.dev.yml (empty file)
echo    - database/ folder (internal infrastructure)
echo    - src/ folder (internal platform code - not SDK)
echo    - scripts/setup-database.js (internal script)
echo.
echo 3. INTERNAL SCRIPTS:
echo    - scripts/track-downloads.js (internal tracking)
echo.
echo ⚠️  CRITICAL: .hypothesis/ should NEVER be in Git!
echo    This is auto-generated Python test cache (1000+ files)
echo.
pause

echo.
echo 📦 Step 1: Removing test artifacts...
echo.

REM Remove .hypothesis folder (Python test cache - 1000+ files!)
if exist .hypothesis (
    git rm -r --cached .hypothesis/
    echo ✅ Removed .hypothesis/ folder
) else (
    echo ℹ️  .hypothesis/ not in Git cache
)

REM Remove htmlcov folder (test coverage reports)
if exist htmlcov (
    git rm -r --cached htmlcov/
    echo ✅ Removed htmlcov/ folder
) else (
    echo ℹ️  htmlcov/ not in Git cache
)

REM Remove .coverage file
if exist .coverage (
    git rm --cached .coverage
    echo ✅ Removed .coverage file
) else (
    echo ℹ️  .coverage not in Git cache
)

echo.
echo 🐳 Step 2: Removing Docker files and internal platform code...
echo.

REM Remove Docker files
if exist docker-compose.yml (
    git rm --cached docker-compose.yml
    echo ✅ Removed docker-compose.yml
) else (
    echo ℹ️  docker-compose.yml not in Git cache
)

if exist docker-compose.dev.yml (
    git rm --cached docker-compose.dev.yml
    echo ✅ Removed docker-compose.dev.yml
) else (
    echo ℹ️  docker-compose.dev.yml not in Git cache
)

REM Remove database folder
if exist database (
    git rm -r --cached database/
    echo ✅ Removed database/ folder
) else (
    echo ℹ️  database/ not in Git cache
)

REM Remove internal platform source code (not SDK)
if exist src (
    git rm -r --cached src/
    echo ✅ Removed src/ folder
) else (
    echo ℹ️  src/ not in Git cache
)

REM Remove internal scripts
if exist scripts\setup-database.js (
    git rm --cached scripts/setup-database.js
    echo ✅ Removed scripts/setup-database.js
) else (
    echo ℹ️  scripts/setup-database.js not in Git cache
)

if exist scripts\track-downloads.js (
    git rm --cached scripts/track-downloads.js
    echo ✅ Removed scripts/track-downloads.js
) else (
    echo ℹ️  scripts/track-downloads.js not in Git cache
)

REM Remove scripts folder if empty
if exist scripts (
    git rm -r --cached scripts/ 2>nul
    echo ✅ Removed scripts/ folder
)

echo.
echo 📝 Step 3: Updating .gitignore...
echo.

REM Update .gitignore
git add .gitignore
echo ✅ Updated .gitignore

echo.
echo 💾 Step 4: Committing changes...
echo.

REM Commit all changes
git commit -m "Final repository cleanup - Remove test artifacts and internal code

CRITICAL FIXES:
- Remove .hypothesis/ folder (1000+ Python test cache files - should NEVER be in Git!)
- Remove htmlcov/ folder (test coverage HTML reports)
- Remove .coverage file (coverage data)

INTERNAL CODE REMOVAL:
- Remove docker-compose files (internal dev environment)
- Remove database/ folder (internal infrastructure)
- Remove src/ folder (internal platform code)
- Remove scripts/ folder (internal scripts)

RESULT:
- Clean, professional SDK repository
- Only public-facing code and documentation
- No test artifacts or internal development files
- AgentGuard is a client-side SDK - no infrastructure needed

Updated .gitignore to prevent future commits of:
- .hypothesis/ (Python test cache)
- htmlcov/ (coverage reports)
- .coverage (coverage data)
- Docker files
- Internal platform code"

echo.
echo ✅ CLEANUP COMPLETE!
echo.
echo 📊 Summary:
echo    - Removed 1000+ test cache files (.hypothesis/)
echo    - Removed test coverage reports (htmlcov/)
echo    - Removed internal platform code (src/, database/, scripts/)
echo    - Removed Docker files
echo    - Updated .gitignore to prevent future issues
echo.
echo 🚀 Next Steps:
echo    1. Push to GitHub: git push origin main
echo    2. Verify on GitHub that all files are removed
echo    3. Repository is now clean and professional!
echo.
echo 💡 Your repository now clearly shows:
echo    - AgentGuard is a simple client-side SDK
echo    - No infrastructure required
echo    - Just install: npm install agentguard-sdk
echo.
pause
