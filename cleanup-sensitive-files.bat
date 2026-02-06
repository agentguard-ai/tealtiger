@echo off
echo.
echo 🧹 Cleaning up sensitive business documents from repository...
echo.
echo ⚠️  WARNING: This will remove files from Git tracking but keep them locally
echo.
pause

REM Remove sensitive files from Git tracking (but keep locally)
git rm --cached *STRATEGY*.md
git rm --cached *BUSINESS*.md
git rm --cached *COMPETITIVE*.md
git rm --cached *ANALYSIS*.md
git rm --cached *ROADMAP*.md
git rm --cached *STANDUP*.md
git rm --cached *PROGRESS*.md
git rm --cached *STATUS*.md
git rm --cached *SUMMARY*.md
git rm --cached *PLAN*.md
git rm --cached *CHECKLIST*.md
git rm --cached *GUIDE*.md
git rm --cached *FRAMEWORK*.md
git rm --cached *TEMPLATE*.md
git rm --cached *REPORT*.md
git rm --cached *LAUNCH*.md
git rm --cached *MARKETING*.md
git rm --cached *DISCOVERY*.md
git rm --cached *POSITIONING*.md
git rm --cached *COMPARISON*.md
git rm --cached *INSIGHTS*.md
git rm --cached *SCENARIOS*.md
git rm --cached *FINOPS*.md
git rm --cached *VENDOR*.md
git rm --cached *HUMAN-RESOURCES*.md
git rm --cached *PROJECT-MANAGEMENT*.md
git rm --cached *SDLC*.md
git rm --cached *SPRINT*.md
git rm --cached *SAAS*.md
git rm --cached *MVP*.md
git rm --cached *PUBLISHING*.md
git rm --cached *SOCIAL-MEDIA*.md
git rm --cached *BLOG-POST*.md
git rm --cached *BLOGGING*.md
git rm --cached *GITHUB-RELEASE*.md
git rm --cached *PYPI*.md
git rm --cached *PYTHON-SDK*.md
git rm --cached *RELEASE*.md
git rm --cached *PUBLISH*.md
git rm --cached *DOWNLOAD*.md
git rm --cached *METRICS*.md
git rm --cached *WEEK-*.md
git rm --cached *DAY-*.md
git rm --cached *PHASE*.md
git rm --cached *NEXT-STEPS*.md
git rm --cached *ACTION-PLAN*.md
git rm --cached *TOMORROW*.md
git rm --cached *DEVTO*.md
git rm --cached *EXAMPLES-CREATED*.md
git rm --cached Document.txt

REM Remove sensitive docs folder files
git rm --cached docs/ARCHITECTURE-REFINEMENT.md
git rm --cached docs/BUSINESS-CONTINUITY-PLAN.md
git rm --cached docs/BUSINESS-STRATEGY.md
git rm --cached docs/CODE-REVIEW-CHECKLIST.md
git rm --cached docs/COMPETITIVE-DESIGN.md
git rm --cached docs/COMPETITIVE-REQUIREMENTS.md
git rm --cached docs/COMPETITIVE-STRATEGY.md
git rm --cached docs/COMPREHENSIVE-TESTING-REPORT.md
git rm --cached docs/design.md
git rm --cached docs/FINOPS-FRAMEWORK.md
git rm --cached docs/HUMAN-RESOURCES-FRAMEWORK.md
git rm --cached docs/MVP-STRATEGY.md
git rm --cached docs/PROJECT-MANAGEMENT-FRAMEWORK.md
git rm --cached docs/PUBLISHING-GUIDE.md
git rm --cached docs/requirements.md
git rm --cached docs/SAAS-ANALYSIS.md
git rm --cached docs/SDLC-FRAMEWORK.md
git rm --cached docs/SPRINT-PLANNING-TEMPLATE.md
git rm --cached docs/SPRINT-RETROSPECTIVE-TEMPLATE.md
git rm --cached docs/TASK4-INTEGRATION-TEST-REPORT.md
git rm --cached docs/tasks.md
git rm --cached docs/TESTING-EXECUTION-GUIDE.md
git rm --cached docs/TESTING-STRATEGY.md
git rm --cached docs/VENDOR-MANAGEMENT-FRAMEWORK.md

REM Add updated .gitignore
git add .gitignore

REM Commit the changes
git commit -m "Remove sensitive business documents from public repository

- Add comprehensive .gitignore patterns for business documents
- Remove strategy, planning, and internal documents
- Keep only essential public documentation (README, CONTRIBUTING, etc.)
- Files remain locally but are no longer tracked in Git"

echo.
echo ✅ Sensitive files removed from Git tracking
echo.
echo 📝 Next steps:
echo 1. Review the changes with: git status
echo 2. Push to GitHub with: git push origin main
echo 3. Files are still on your local machine, just not in Git
echo.
pause
