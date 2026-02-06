@echo off
echo.
echo 🧹 Cleaning up docs/ folder...
echo.
echo Keeping only public documentation:
echo   ✅ docs/getting-started.md
echo   ✅ docs/FAQ.md
echo.
echo Removing internal files:
echo   ❌ docs/challenges
echo   ❌ docs/ARCHITECTURE-REFINEMENT.md
echo   ❌ docs/BUSINESS-*.md
echo   ❌ docs/COMPETITIVE-*.md
echo   ❌ docs/design.md
echo   ❌ docs/requirements.md
echo   ❌ docs/tasks.md
echo   ❌ And many more internal files...
echo.
pause

REM Remove internal documentation files
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

echo.
echo ✅ Docs folder cleaned!
echo.
echo Only keeping:
echo   - docs/getting-started.md
echo   - docs/FAQ.md
echo.
echo Committing changes...

git commit -m "Clean up docs folder - Remove internal documentation

- Remove internal strategy and planning documents
- Remove internal testing reports
- Remove internal framework documents
- Remove challenges file
- Keep only public documentation (getting-started.md, FAQ.md)
- Docs folder now contains only user-facing documentation"

echo.
echo ✅ Docs folder cleanup complete!
echo.
echo 📝 Next: Push to GitHub with: git push origin main
echo.
pause
