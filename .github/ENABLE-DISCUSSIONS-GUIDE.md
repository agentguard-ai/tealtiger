# Enable GitHub Discussions - Manual Steps Required

## Overview
GitHub Discussions must be enabled manually through the GitHub web interface. This guide provides step-by-step instructions for enabling discussions on all three TealTiger repositories.

## Why Discussions?
- **Community Engagement** - Centralized place for questions, ideas, and announcements
- **Reduce Issue Clutter** - Move general questions out of Issues
- **Knowledge Base** - Build searchable Q&A archive
- **Show and Tell** - Let users share their implementations
- **Feedback Loop** - Gather feature requests and ideas

## Repositories to Enable

1. **Main Repository**: `agentguard-ai/tealtiger`
2. **TypeScript SDK**: `agentguard-ai/tealtiger-sdk`
3. **Python SDK**: `agentguard-ai/tealtiger-python`

## Step-by-Step Instructions

### For Each Repository:

1. **Navigate to Repository Settings**
   - Go to the repository on GitHub
   - Click "Settings" tab (requires admin access)

2. **Enable Discussions**
   - Scroll down to "Features" section
   - Check the box next to "Discussions"
   - Click "Set up discussions"

3. **Create Discussion Categories**
   
   Create these categories in order:
   
   **📢 Announcements** (Announcement type)
   - Description: "Official announcements from the TealTiger team"
   - Format: Announcement
   - ✅ Enable reactions
   
   **💡 Ideas** (Open-ended discussion)
   - Description: "Share ideas for new features and improvements"
   - Format: Open-ended discussion
   - ✅ Enable reactions
   
   **🙏 Q&A** (Question/Answer type)
   - Description: "Ask questions and get help from the community"
   - Format: Question/Answer
   - ✅ Enable reactions
   - ✅ Mark answers
   
   **📣 Show and Tell** (Open-ended discussion)
   - Description: "Show off what you've built with TealTiger"
   - Format: Open-ended discussion
   - ✅ Enable reactions
   
   **💬 General** (Open-ended discussion)
   - Description: "General discussions about TealTiger"
   - Format: Open-ended discussion
   - ✅ Enable reactions

4. **Create Welcome Discussion**
   
   Create a pinned welcome discussion in the "Announcements" category:
   
   **Title**: "Welcome to TealTiger Discussions! 👋"
   
   **Body**:
   ```markdown
   # Welcome to TealTiger Discussions! 👋
   
   We're excited to have you here! This is the place to:
   
   - 💬 Ask questions and get help
   - 💡 Share ideas for new features
   - 📣 Show off what you've built
   - 🐛 Report bugs (or use Issues for detailed bug reports)
   - 🤝 Connect with other TealTiger users
   
   ## Quick Links
   
   - 📚 [Documentation](https://github.com/agentguard-ai/tealtiger#readme)
   - 🐛 [Report a Bug](https://github.com/agentguard-ai/tealtiger/issues/new?template=bug_report.md)
   - 💡 [Request a Feature](https://github.com/agentguard-ai/tealtiger/issues/new?template=feature_request.md)
   - 🔒 [Security Issues](https://github.com/agentguard-ai/tealtiger/security/advisories/new)
   
   ## Community Guidelines
   
   - Be respectful and constructive
   - Search before posting to avoid duplicates
   - Use appropriate categories for your discussions
   - Follow our [Code of Conduct](https://github.com/agentguard-ai/tealtiger/blob/main/CODE_OF_CONDUCT.md)
   
   Let's build something amazing together! 🚀
   ```
   
   - Pin this discussion
   - Lock it (so it stays as announcement only)

5. **Update Discussion Settings**
   - Go to Settings > Discussions
   - Enable "Require contributors to sign off on web-based commits"
   - Set default category to "Q&A"

## Verification

After enabling discussions on all three repos:

- [ ] Main repo has Discussions enabled
- [ ] TypeScript SDK has Discussions enabled  
- [ ] Python SDK has Discussions enabled
- [ ] All 5 categories created on each repo
- [ ] Welcome discussion created and pinned on each repo
- [ ] Issue templates link to Discussions (already done via config.yml)
- [ ] SUPPORT.md links to Discussions (already done)

## Benefits

Once enabled, users will be able to:

1. **Ask Questions** - Get help from the community in Q&A category
2. **Share Ideas** - Propose features in Ideas category
3. **Show Projects** - Share implementations in Show and Tell
4. **Stay Updated** - Follow announcements
5. **Search Knowledge** - Find answers to common questions

## Next Steps

After enabling discussions:

1. **Announce on Social Media** - Let users know discussions are available
2. **Monitor Regularly** - Respond to questions and engage with community
3. **Migrate Common Questions** - Move FAQ from Issues to Discussions
4. **Create Guides** - Post helpful guides in Announcements
5. **Highlight Projects** - Feature cool projects in Show and Tell

## Notes

- Discussions cannot be enabled via API or CLI
- Requires repository admin access
- Takes effect immediately after enabling
- Can be disabled later if needed (but discussions will be preserved)
- Consider enabling on main repo first, then SDKs

## Timeline

**Estimated Time**: 15-20 minutes per repository (45-60 minutes total)

**Priority**: High - Improves community engagement and reduces issue clutter
