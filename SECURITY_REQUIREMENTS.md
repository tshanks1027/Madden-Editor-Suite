# Security Requirements - Madden Editor Suite

This document outlines security considerations for the Madden Editor Suite project.

## Project Security Profile

**Project Type:** Madden Modding / Game File Editor

**Security Classification:**
- Code protection: **YES** (intellectual property)
- User data storage: **NO** (only reads/writes local Madden game files)
- Payment processing: **NO**
- Network communications: **LIMITED** (GitHub releases, web scraping only)

**Risk Level:** Low to Medium
- Desktop application, not web-exposed
- Local file operations only
- No remote code execution
- Optional web scraping (user-initiated)

---

## Security Requirements

### Code Protection

**Requirement:** Protect intellectual property while allowing open-source distribution

**Current Status:**
- Source code: Public GitHub repository (MIT License)
- Distribution: Portable ZIP, no code obfuscation
- Electron packaging: asar disabled (due to native modules)

**Recommendations:**
- Consider code obfuscation for commercial distribution (optional)
- License enforcement via GitHub releases
- User attribution in bundled credits

### Dependency Scanning

**Requirement:** Verify third-party dependencies don't introduce vulnerabilities

**Current Tools:**
```bash
# Check for known vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix
```

**Frequency:**
- Before every release
- Monthly for active development
- After adding new dependencies

**Critical Dependencies to Monitor:**
- Electron (security patches frequent)
- Puppeteer (Chromium vulnerabilities)
- Sharp (image processing, native module)
- SQLite3 (database security)

### Secrets Detection

**Requirement:** Ensure no hardcoded secrets in codebase or distributions

**What to Check:**
- No API keys in source code
- No hardcoded user paths (pre-package check handles this)
- No GitHub personal access tokens
- No database credentials (app uses local files only)

**Current Safeguards:**
- `.gitignore` excludes `.env` files
- Pre-package script scans for `C:\Users\` paths
- No network APIs requiring authentication

---

## Electron Security Posture

### Current Security Features

1. **Context Isolation: ENABLED**
   ```javascript
   // In BrowserWindow config
   webPreferences: {
     contextIsolation: true,
     nodeIntegration: false,
     sandbox: true
   }
   ```
   - Renderer has no direct Node.js access
   - Prevents XSS → RCE escalation

2. **IPC Validation**
   - All communication through `preload.ts`
   - Whitelisted APIs only
   - No arbitrary code execution from renderer

3. **File Access Restrictions**
   - File dialogs limit user to specific directories
   - No arbitrary file system access
   - Madden save directories only: `Documents\Madden NFL 26\Saves\`

4. **Fuses Plugin (Electron 21+)**
   ```javascript
   // In forge.config.ts
   new FusesPlugin({
     version: FuseVersion.V1,
     [FuseV1Options.RunAsNode]: false,
     [FuseV1Options.EnableNodeCliInspectArguments]: false
   })
   ```
   - Disables Node.js CLI inspection
   - Prevents debugging in production

### Security Best Practices Applied

- **No eval() or Function() constructor usage**
- **No inline scripts in HTML**
- **Content Security Policy** (could be stricter)
- **Auto-updates** via electron-updater (signed releases recommended)

---

## File Operations Security

### Input Validation

**Requirement:** Validate all user-provided file inputs before parsing

**Current Validation:**
```javascript
// Check file exists
if (!fs.existsSync(filePath)) {
  throw new Error('File not found');
}

// Check file extension
if (!filePath.endsWith('.M26') && !filePath.endsWith('ROSTER')) {
  throw new Error('Invalid file type');
}

// Check file size (prevent loading multi-GB files)
const stats = fs.statSync(filePath);
if (stats.size > 100 * 1024 * 1024) { // 100MB limit
  throw new Error('File too large');
}
```

**Recommendations:**
- Add file size limits for all parsers
- Validate binary file headers before full parse
- Sanitize file paths to prevent directory traversal

### Safe File Writing

**Requirement:** Prevent file overwrites and data corruption

**Current Safeguards:**
- File dialogs prevent accidental overwrites (user confirms)
- Backup creation optional but recommended
- Fresh file reload before save (prevents in-memory corruption)

**Recommendations:**
- Always create backup before overwriting roster/franchise files
- Verify file integrity after write (checksum validation)
- Atomic writes (write to temp, then rename)

---

## Network Security

### Web Scraping (Puppeteer)

**Attack Surface:**
- Headless Chromium browser
- HTTP requests to pro-football-reference.com
- DOM manipulation and data extraction

**Current Safeguards:**
- User-initiated only (not automatic)
- Whitelisted domains (no arbitrary URL scraping)
- Puppeteer runs in isolated process

**Recommendations:**
- Add timeout limits (prevent hung scraping sessions)
- Sanitize scraped data before use (prevent XSS if displaying)
- Cache results to minimize network calls

### Auto-Update Checking

**Attack Surface:**
- GitHub API requests
- Downloading release binaries

**Current Implementation:**
```javascript
// In UpdateChecker.ts
const response = await fetch('https://api.github.com/repos/tshanks1027/Madden-Editor-Suite/releases/latest');
```

**Recommendations:**
- Verify GitHub SSL certificate
- Implement signature verification for downloads
- Use electron-updater's built-in security (already in use)

---

## Data Privacy

### User Data Handling

**What Data is Accessed:**
- Local Madden save files (roster, franchise, draft class)
- Portrait sprite sheets (bundled with app)
- CSV lookup data (bundled with app)

**What Data is NOT Collected:**
- No telemetry or analytics
- No crash reporting (could add optional Sentry integration)
- No user tracking
- No cloud sync

**Privacy Compliance:**
- GDPR: Not applicable (no personal data collected)
- CCPA: Not applicable (no data sale)

---

## Build and Distribution Security

### Package Integrity

**Requirement:** Ensure distributed packages haven't been tampered with

**Current Process:**
1. Build via `npm run package`
2. Pre-package checks verify no malicious code
3. 7-Zip compression creates ZIP
4. Manual upload to GitHub releases

**Recommendations:**
- Add checksum file to releases (SHA256)
- Sign executables with code signing certificate
- Use GitHub Actions for reproducible builds

**Example Checksum Generation:**
```bash
# After creating ZIP
certUtil -hashfile dist/Madden-Editor-Suite-Portable.zip SHA256 > dist/checksums.txt
```

### Code Signing

**Current Status:** Not implemented

**Benefits:**
- Windows SmartScreen won't warn users
- Verifies publisher identity
- Detects tampering

**Implementation:**
- Purchase code signing certificate (e.g., DigiCert, Sectigo)
- Configure electron-builder to sign executables
- Document fingerprint in README

---

## Security Scanning Workflow

### Pre-Release Checklist

- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Scan for hardcoded secrets (pre-package check)
- [ ] Verify no user paths in code
- [ ] Test file input validation
- [ ] Verify IPC handler permissions
- [ ] Check Electron security settings
- [ ] Generate checksums for ZIP
- [ ] (Optional) Sign executable
- [ ] Test anti-virus false positives

### Monthly Security Tasks

- [ ] Update Electron to latest stable
- [ ] Update Puppeteer (Chromium security patches)
- [ ] Review npm audit report
- [ ] Check GitHub security advisories
- [ ] Review IPC handler access

---

## Incident Response

### If Vulnerability Discovered

1. **Assess Severity**
   - Can it compromise user files?
   - Can it execute arbitrary code?
   - Does it affect all versions?

2. **Patch Immediately**
   - Create hotfix branch
   - Test fix thoroughly
   - Release emergency update

3. **Notify Users**
   - GitHub release notes
   - Security advisory
   - Recommend immediate update

4. **Document**
   - Add to KNOWN_ISSUES.md
   - Update SECURITY_REQUIREMENTS.md
   - Add regression test

### Security Contact

- GitHub Issues: https://github.com/tshanks1027/Madden-Editor-Suite/issues
- Security issues: Mark as "security" label
- Responsible disclosure: 90-day window before public disclosure

---

## Future Security Improvements

### Short Term (Next Release)

1. Add checksum validation for distributed ZIPs
2. Implement file size limits in all parsers
3. Add crash reporting (opt-in)

### Medium Term (6 months)

1. Code signing certificate for Windows
2. Automated security scanning in CI/CD
3. Dependency update automation (Dependabot)

### Long Term (1 year)

1. Consider Electron sandbox mode (currently disabled due to native modules)
2. Implement automatic backup before all saves
3. Add file encryption for sensitive user data (if added)

---

## Compliance Notes

### Open Source License (MIT)

**Obligations:**
- Include MIT license in distributions ✓
- Attribute third-party libraries ✓
- No warranty disclaimer ✓

**Vendored Libraries:**
- madden-file-tools (MIT) - Attributed
- madden-draft-class (custom) - Documented

### Third-Party Licenses

All dependencies use compatible licenses:
- Electron: MIT
- Puppeteer: Apache 2.0
- Handsontable: Commercial/Free (check edition)
- Sharp: Apache 2.0

**Action Required:** Verify Handsontable edition (Community is free, Pro requires license)

---

## Related Documentation

- `PROJECT_SETUP.md` - Pre-package security checks
- `KNOWN_ISSUES.md` - Historical security-related bugs
- `TESTING_STRATEGY.md` - Security test coverage
