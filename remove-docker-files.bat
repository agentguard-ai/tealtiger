@echo off
echo.
echo 🧹 Removing Docker files and internal infrastructure...
echo.
echo Files to remove:
echo - docker-compose.yml (internal dev environment)
echo - docker-compose.dev.yml (empty file)
echo - database/ (internal database scripts)
echo - src/ (internal platform code - not SDK)
echo.
echo ⚠️  Note: This removes internal platform code, keeping only the SDK
echo.
pause

REM Remove Docker files
git rm --cached docker-compose.yml
git rm --cached docker-compose.dev.yml

REM Remove database folder
git rm -r --cached database/

REM Remove internal platform source code (not SDK)
git rm -r --cached src/

REM Update .gitignore
git add .gitignore

REM Update README
git add README.md

REM Commit
git commit -m "Remove internal platform code and Docker files

- Remove docker-compose files (internal dev environment)
- Remove database/ folder (internal infrastructure)
- Remove src/ folder (internal platform code)
- AgentGuard is a client-side SDK - no infrastructure needed
- Users just install: npm install agentguard-sdk
- Simplifies repository and removes confusion"

echo.
echo ✅ Docker files and internal code removed!
echo.
echo 📝 Next: Push to GitHub with: git push origin main
echo.
echo 💡 Repository is now clean and focused on the SDK
echo.
pause
