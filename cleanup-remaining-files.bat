@echo off
echo.
echo 🧹 Cleaning up remaining unnecessary files from repository...
echo.
echo Files to remove:
echo - .kiro/specs/ (internal spec files)
echo - DATABASE-SETUP.md (internal setup)
echo - DEVELOPMENT-LOG.md (internal log)
echo - README-VERIFICATION.md (internal verification)
echo - SDK-QUICKSTART.md (duplicate of getting-started)
echo - sdk-repo-structure.md (internal structure doc)
echo - postman/ (internal testing collection)
echo - cleanup scripts (these helper files)
echo.
pause

REM Remove .kiro specs (internal development specs)
git rm -r --cached .kiro/

REM Remove internal documentation
git rm --cached DATABASE-SETUP.md
git rm --cached DEVELOPMENT-LOG.md
git rm --cached README-VERIFICATION.md
git rm --cached SDK-QUICKSTART.md
git rm --cached sdk-repo-structure.md

REM Remove postman collection (internal testing)
git rm -r --cached postman/

REM Remove cleanup helper files
git rm --cached cleanup-sensitive-files.bat
git rm --cached cleanup-remaining-files.bat
git rm --cached push-examples.bat
git rm --cached push-examples.sh
git rm --cached PUBLIC-FILES-ONLY.md
git rm --cached URGENT-CLEANUP-INSTRUCTIONS.md
git rm --cached DEVTO-LINKS-FIX.md
git rm --cached EXAMPLES-CREATED-SUMMARY.md

REM Update .gitignore
git add .gitignore

REM Commit
git commit -m "Clean up internal and duplicate documentation

- Remove .kiro/specs/ (internal development specs)
- Remove internal setup and verification docs
- Remove duplicate quickstart guides
- Remove postman testing collection
- Remove cleanup helper scripts
- Keep only essential public documentation"

echo.
echo ✅ Cleanup complete!
echo.
echo 📝 Next: Push to GitHub with: git push origin main
echo.
pause
