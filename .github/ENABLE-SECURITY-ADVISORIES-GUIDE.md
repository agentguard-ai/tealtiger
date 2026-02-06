# Enable GitHub Security Advisories - Manual Steps Required

## Overview
GitHub Security Advisories allow security researchers to privately report vulnerabilities. This feature must be enabled manually through the GitHub repository settings.

## Why Security Advisories?
- **Private Reporting** - Vulnerabilities reported privately before public disclosure
- **Coordinated Disclosure** - Work with researchers to fix issues before going public
- **CVE Assignment** - Automatically request CVE IDs for vulnerabilities
- **Security Credits** - Recognize researchers who help improve security
- **Professional Process** - Industry-standard vulnerability disclosure workflow

## Repositories to Enable

1. **Main Repository**: `agentguard-ai/tealtiger`
2. **TypeScript SDK**: `agentguard-ai/tealtiger-sdk` (or tealtiger-typescript)
3. **Python SDK**: `agentguard-ai/tealtiger-python`

## Step-by-Step Instructions

### For Each Repository:

1. **Navigate to Repository Settings**
   - Go to the repository on GitHub
   - Click "Settings" tab (requires admin access)

2. **Enable Security Advisories**
   - Scroll down to "Security" section in left sidebar
   - Click "Code security and analysis"
   - Find "Private vulnerability reporting"
   - Click "Enable" button

3. **Verify It's Working**
   - Go to the "Security" tab in your repository
   - Click "Advisories" in the left sidebar
   - You should see "New draft security advisory" button
   - Test the reporting URL: `https://github.com/OWNER/REPO/security/advisories/new`

## Alternative: Use GitHub Issues Template

If Security Advisories cannot be enabled immediately, users can report via:

1. **Security Issue Template** (already created)
   - Located at `.github/ISSUE_TEMPLATE/security_issue.md`
   - Warns users not to include sensitive details in public issues
   - Provides alternative contact methods

2. **Direct Contact** (temporary)
   - Email: security@tealtiger.io (when email is set up)
   - Or use GitHub Issues with "[SECURITY]" prefix for non-sensitive reports

## Update SECURITY.md After Enabling

Once enabled, the SECURITY.md files already have the correct URLs:
- Main: `https://github.com/agentguard-ai/tealtiger/security/advisories/new`
- TypeScript: `https://github.com/agentguard-ai/tealtiger-sdk/security/advisories/new`
- Python: `https://github.com/agentguard-ai/tealtiger-python/security/advisories/new`

## Benefits of Enabling

### For Security Researchers:
- Private reporting channel
- Coordinated disclosure timeline
- Credit in security advisories
- Professional vulnerability handling

### For Project Maintainers:
- Control disclosure timeline
- Fix vulnerabilities before public disclosure
- Automatic CVE assignment
- Security Hall of Fame
- Professional security posture

### For Users:
- Confidence in security process
- Timely security updates
- Transparent vulnerability handling
- Industry-standard practices

## Verification Checklist

After enabling on all repos:

- [ ] Main repo: Security Advisories enabled
- [ ] TypeScript SDK: Security Advisories enabled
- [ ] Python SDK: Security Advisories enabled
- [ ] Test URLs work (no 404 errors)
- [ ] "Security" tab shows "Advisories" section
- [ ] Can create draft security advisory
- [ ] SECURITY.md files have correct URLs

## Timeline

**Estimated Time**: 5 minutes per repository (15 minutes total)

**Priority**: High - Professional security reporting is important for open source projects

## Notes

- Requires repository admin access
- Cannot be enabled via API or CLI
- Takes effect immediately after enabling
- Can be disabled later if needed (but not recommended)
- Free for public repositories
- Part of GitHub's security features

## Troubleshooting

### "Enable" button not visible
- Ensure you have admin access to the repository
- Check if repository is public (required for free tier)
- Try refreshing the page

### Still getting 404 after enabling
- Wait a few minutes for GitHub to propagate changes
- Clear browser cache
- Try in incognito/private browsing mode
- Verify you're logged into GitHub

### Can't find "Code security and analysis"
- Make sure you're in repository Settings (not account settings)
- Look in the left sidebar under "Security"
- Scroll down if needed

## References

- [GitHub Security Advisories Documentation](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories)
- [Privately Reporting a Security Vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
- [Best Practices for Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/best-practices-for-writing-repository-security-advisories)
