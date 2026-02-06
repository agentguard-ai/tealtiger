#!/bin/bash

# Push new example files to GitHub

echo "🚀 Pushing new example files to GitHub..."
echo ""

# Add all new example files
git add examples/cost-tracking-demo.js
git add examples/budget-management-demo.js
git add examples/guarded-openai-demo.js
git add examples/guarded-anthropic-demo.js
git add examples/guarded-azure-demo.js
git add examples/README.md
git add DEVTO-LINKS-FIX.md

# Commit
git commit -m "Add comprehensive demo examples for all AgentGuard features

- Add cost-tracking-demo.js: Real-time cost tracking across providers
- Add budget-management-demo.js: Budget creation and enforcement
- Add guarded-openai-demo.js: GuardedOpenAI with all features
- Add guarded-anthropic-demo.js: GuardedAnthropic for Claude models
- Add guarded-azure-demo.js: GuardedAzureOpenAI for Azure deployments
- Update examples/README.md with new examples
- Add DEVTO-LINKS-FIX.md with corrected links for blog post

All examples include:
- Complete working code
- Multiple use cases
- Detailed comments
- Error handling
- Support for both live and demo modes"

# Push to GitHub
git push origin main

echo ""
echo "✅ Done! All example files pushed to GitHub"
echo ""
echo "📝 Next steps:"
echo "1. Wait 30 seconds for GitHub to process"
echo "2. Update your Dev.to post with the new links from DEVTO-LINKS-FIX.md"
echo "3. Test all links to make sure they work"
echo ""
echo "🔗 Links will be available at:"
echo "   https://github.com/nagasatish007/ai-agent-security-platform/tree/main/examples"
