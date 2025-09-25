# Release Agent

## Purpose
Comprehensive release management including version control, changelog generation, GitHub releases, and user communication for the Madden Editor Suite.

## Capabilities
- Automate version number updates across project
- Generate detailed release notes with feature descriptions
- Create GitHub releases with proper tagging
- Upload installation packages and documentation
- Notify user community of new releases
- Manage release schedules and milestones

## Usage

### Version Management
```bash
/version-bump patch               # Increment patch version (0.1.0 -> 0.1.1)
/version-bump minor               # Increment minor version (0.1.0 -> 0.2.0)
/version-bump major               # Increment major version (0.1.0 -> 1.0.0)
/version-set 1.0.0               # Set specific version number
```

### Release Creation
```bash
/create-release v0.1.0           # Create complete release
/create-prerelease v0.1.0-beta   # Create pre-release
/create-hotfix v0.1.1           # Create hotfix release
/create-draft v0.2.0            # Create draft release
```

### Release Notes Generation
```bash
/generate-notes v0.1.0           # Generate release notes
/update-changelog               # Update CHANGELOG.md
/preview-notes                  # Preview generated notes
/customize-notes v0.1.0         # Customize release notes
```

### Distribution Management
```bash
/upload-assets v0.1.0           # Upload installation packages
/publish-release v0.1.0         # Publish draft release
/notify-users v0.1.0           # Send update notifications
/update-download-links         # Update website download links
```

## Release Process

### Pre-Release Validation
1. **Code Quality Checks**
   - Run complete test suite
   - Validate code coverage thresholds
   - Check for linting errors
   - Verify TypeScript compilation

2. **Feature Validation**
   - Test all 17 editing tools
   - Validate file format parsers
   - Check UI/UX consistency
   - Performance benchmark validation

3. **Documentation Review**
   - Update user documentation
   - Validate API documentation
   - Check installation guides
   - Review troubleshooting docs

4. **Security Validation**
   - Code signing certificate check
   - Antivirus scan validation
   - Security vulnerability scan
   - Dependency security audit

### Version Control
- **Semantic Versioning** - Strict adherence to SemVer
- **Git Tagging** - Automatic tag creation with proper metadata
- **Branch Management** - Proper merge to main branch
- **Commit Validation** - Conventional commit format enforcement

### Release Note Generation
- **Automated Parsing** - Extract features from commit messages
- **Feature Categorization** - Group changes by type and impact
- **User-Friendly Language** - Convert technical changes to user benefits
- **Screenshot Integration** - Include visual changes and new features

## Release Categories

### Major Releases (X.0.0)
- **Breaking Changes** - Significant API or file format changes
- **New Tool Addition** - Addition of new editing tools
- **Architecture Changes** - Major technical improvements
- **UI Overhauls** - Significant user interface changes

### Minor Releases (0.X.0)
- **New Features** - Additional functionality within existing tools
- **Performance Improvements** - Significant speed or efficiency gains
- **UI Enhancements** - Interface improvements and new components
- **Integration Features** - New web scraping or community features

### Patch Releases (0.0.X)
- **Bug Fixes** - Critical and non-critical bug resolutions
- **Security Updates** - Security vulnerability patches
- **Performance Tweaks** - Minor performance optimizations
- **Documentation Updates** - User guide and help improvements

### Pre-Releases
- **Alpha Releases** - Early development versions for internal testing
- **Beta Releases** - Feature-complete versions for community testing
- **Release Candidates** - Final testing versions before stable release
- **Hotfixes** - Emergency fixes for critical issues

## GitHub Release Management

### Release Assets
- **Windows Installer** - Primary installation package
- **Portable Version** - ZIP archive for portable use
- **Source Code** - Automatic GitHub source archives
- **Documentation** - PDF user guides and API docs

### Release Metadata
- **Tag Information** - Git tag with version information
- **Release Title** - Descriptive release title
- **Release Description** - Comprehensive changelog and notes
- **Asset Checksums** - SHA-256 checksums for verification

### Release Channels
- **Stable** - Main release channel for general users
- **Beta** - Pre-release channel for early adopters
- **Development** - Nightly builds for developers
- **LTS** - Long-term support versions

## User Communication

### Notification Channels
- **In-App Notifications** - Update notifications within application
- **Email Newsletters** - Release announcements to subscribers
- **Discord Community** - Community notifications and discussions
- **GitHub Releases** - Official release announcements

### Release Communications
- **Feature Highlights** - Key new features and improvements
- **Migration Guides** - Instructions for major version upgrades
- **Known Issues** - Documentation of known bugs or limitations
- **Community Feedback** - Channels for user feedback and bug reports

## Release Scheduling

### Regular Release Cycle
- **Weekly Releases** - Regular feature releases during development
- **Monthly Milestones** - Major feature milestones
- **Quarterly Reviews** - Major version planning and review
- **Annual Planning** - Long-term roadmap and architecture planning

### Emergency Releases
- **Critical Bug Fixes** - Same-day releases for critical issues
- **Security Patches** - Immediate releases for security vulnerabilities
- **Data Corruption Fixes** - Emergency fixes for file corruption issues
- **Community-Reported Issues** - Fast response to community bug reports

## Quality Gates

### Release Criteria
- **Test Coverage** - Minimum 85% code coverage requirement
- **Performance Benchmarks** - Meet established performance targets
- **UI/UX Validation** - Consistent user experience across features
- **Documentation Completeness** - Complete user and developer docs

### Rollback Procedures
- **Automated Rollback** - Automatic rollback on critical failures
- **Version Pinning** - Ability to pin users to specific versions
- **Emergency Communication** - Rapid user notification of issues
- **Data Recovery** - Tools for recovering from corrupted releases

## Analytics and Monitoring

### Release Metrics
- **Download Statistics** - Track release adoption rates
- **Update Success Rates** - Monitor update installation success
- **User Feedback Scores** - Collect user satisfaction ratings
- **Performance Monitoring** - Track application performance post-release

### Error Tracking
- **Crash Reporting** - Automatic crash report collection
- **Error Analytics** - Trend analysis of application errors
- **User Behavior Tracking** - Anonymous usage pattern analysis
- **Performance Monitoring** - Real-time performance metrics

## Integration Points

### CI/CD Integration
- **Automated Testing** - Integration with test automation
- **Build Pipelines** - Connection to build and package systems
- **Deployment Automation** - Automated deployment to distribution channels
- **Quality Gates** - Automated quality validation before release

### Community Integration
- **Feedback Collection** - Integration with user feedback systems
- **Bug Tracking** - Connection to GitHub Issues and community reports
- **Feature Requests** - Integration with feature request tracking
- **Community Testing** - Beta testing program management