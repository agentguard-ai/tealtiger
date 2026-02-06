# Release Checklist

Use this checklist when preparing a new release of the AgentGuard SDK.

## Pre-Release

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code coverage meets threshold (>80%)
- [ ] All TypeScript types properly defined
- [ ] No console.log or debug statements in production code

### Documentation
- [ ] README.md updated with new features
- [ ] CHANGELOG.md updated with version changes
- [ ] API documentation updated
- [ ] Examples updated if API changed
- [ ] Migration guide created (if breaking changes)

### Version Management
- [ ] Version number updated in package.json
- [ ] Version follows semantic versioning (MAJOR.MINOR.PATCH)
- [ ] Git tag created for version

### Dependencies
- [ ] Dependencies updated to latest stable versions
- [ ] Security vulnerabilities checked (`npm audit`)
- [ ] Peer dependencies verified
- [ ] Package size checked (`npm pack --dry-run`)

## Release Process

### Build & Test
- [ ] Clean build (`npm run clean && npm run build`)
- [ ] Test installation in fresh project
- [ ] Test with Node 16.x, 18.x, 20.x
- [ ] Test on Windows, macOS, Linux

### GitHub
- [ ] All PRs merged to main
- [ ] Branch protection rules respected
- [ ] CI/CD pipeline passing
- [ ] Create release notes draft

### npm Publishing
- [ ] Logged into npm (`npm whoami`)
- [ ] Dry run publish (`npm publish --dry-run`)
- [ ] Publish to npm (`npm publish`)
- [ ] Verify package on npm registry

### GitHub Release
- [ ] Create git tag (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`)
- [ ] Push tag (`git push origin vX.Y.Z`)
- [ ] Create GitHub release from tag
- [ ] Add release notes
- [ ] Attach build artifacts (if applicable)

## Post-Release

### Verification
- [ ] Package installable via npm (`npm install agentguard-sdk`)
- [ ] GitHub release visible
- [ ] Badges updated (version, downloads)
- [ ] Documentation site updated

### Communication
- [ ] Announce on GitHub Discussions
- [ ] Tweet/post on social media
- [ ] Update project website
- [ ] Notify major users (if breaking changes)
- [ ] Post in relevant communities

### Monitoring
- [ ] Monitor npm download stats
- [ ] Watch for GitHub issues
- [ ] Check error tracking (if configured)
- [ ] Review user feedback

## Rollback Plan

If critical issues are discovered:

1. **Immediate Actions**
   - [ ] Deprecate broken version on npm
   - [ ] Publish hotfix version
   - [ ] Update GitHub release notes with warning

2. **Communication**
   - [ ] Post issue on GitHub
   - [ ] Notify users via social media
   - [ ] Update documentation

3. **Fix & Re-release**
   - [ ] Create hotfix branch
   - [ ] Fix critical issues
   - [ ] Follow release process for patch version

## Version-Specific Notes

### v0.1.1 (Current)
- Initial public release
- Core security features
- 137 downloads in first 24 hours

### v0.2.0 (Planned)
- Drop-in clients for LangChain, CrewAI, AutoGPT
- Enhanced guardrails system
- Cost tracking and optimization
- Approval workflows
- Web UI dashboard

### v0.3.0 (Future)
- Trace analysis
- Program analysis
- Advanced threat detection
- Research-inspired features

## Emergency Contacts

- **Release Manager**: [Name/Email]
- **Technical Lead**: [Name/Email]
- **npm Account Owner**: [Name/Email]
- **GitHub Admin**: [Name/Email]

## Useful Commands

```bash
# Check current version
npm version

# Bump version (patch)
npm version patch

# Bump version (minor)
npm version minor

# Bump version (major)
npm version major

# View package contents
npm pack --dry-run

# Test installation
npm install agentguard-sdk@latest

# View npm package info
npm info agentguard-sdk

# Check download stats
npm info agentguard-sdk downloads
```

## Notes

- Always test in a clean environment before publishing
- Never publish directly from feature branches
- Keep release notes clear and user-focused
- Celebrate successful releases with the team! 🎉
