@echo off
echo ========================================
echo Copying files to agentguard repository
echo ========================================
echo.

REM Check if agentguard folder exists
if not exist "agentguard" (
    echo Cloning agentguard repository...
    git clone https://github.com/agentguard-ai/agentguard.git
    echo.
)

echo Copying examples folder...
xcopy /E /I /Y examples agentguard\examples

echo Copying LICENSE, CHANGELOG, SECURITY...
copy /Y LICENSE agentguard\
copy /Y CHANGELOG.md agentguard\
copy /Y SECURITY.md agentguard\

echo Creating .github directory structure...
if not exist "agentguard\.github\ISSUE_TEMPLATE" mkdir agentguard\.github\ISSUE_TEMPLATE

echo Copying GitHub templates...
copy /Y agentguard-main-repo\.github\ISSUE_TEMPLATE\bug_report.md agentguard\.github\ISSUE_TEMPLATE\
copy /Y agentguard-main-repo\.github\ISSUE_TEMPLATE\feature_request.md agentguard\.github\ISSUE_TEMPLATE\
copy /Y agentguard-main-repo\.github\ISSUE_TEMPLATE\question.md agentguard\.github\ISSUE_TEMPLATE\
copy /Y agentguard-main-repo\.github\PULL_REQUEST_TEMPLATE.md agentguard\.github\

echo.
echo ========================================
echo Files copied successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Update examples/README.md URLs (change nagasatish007/ai-agent-security-platform to agentguard-ai/agentguard)
echo 2. cd agentguard
echo 3. git add .
echo 4. git commit -m "Add examples, LICENSE, CHANGELOG, SECURITY, and GitHub templates"
echo 5. git push origin main
echo.
pause
