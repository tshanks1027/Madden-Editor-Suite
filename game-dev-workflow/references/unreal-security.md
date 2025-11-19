# Unreal Security for Payment-Protected Games

Complete security checklist for Unreal games that handle user payments or store user data.

## Security Scanning Requirements

### 1. Dependency Vulnerability Scanning

**Tools:**
- Snyk: Scans C++ dependencies and plugins
- OWASP Dependency-Check: General dependency vulnerabilities
- NVD (National Vulnerability Database): CVE checking

**What to scan:**
- All third-party plugins (especially from marketplace)
- C++ library dependencies
- Visual Studio/UE4 build tools versions

**Action items:**
- Keep UE4/UE5 updated to latest patch
- Document all third-party plugin versions in SECURITY_REQUIREMENTS.md
- Before each release: scan all dependencies
- Block any dependencies with critical CVEs
- Track vulnerability status in security_scans.json

### 2. Secrets Detection

**What you're looking for:**
- Hardcoded API keys (payment processors, analytics, auth)
- Database connection strings
- Private encryption keys
- OAuth tokens
- AWS credentials, Azure keys
- Third-party service credentials

**How to prevent:**
- Use config files (gitignored) instead of hardcoding
- Use Unreal's Configuration System (.ini files)
- Use environment variables for sensitive data
- NEVER commit secrets to version control

**Scanning tools:**
- TruffleHog: Git history secret scanning
- git-secrets: Local pre-commit hook
- Semgrep: Pattern-based secret detection

**Action items:**
- Run secrets scan before every commit
- Audit code for any hardcoded strings that look like credentials
- Check git history for any accidentally committed secrets
- Use .gitignore for config files containing credentials

### 3. Code Obfuscation & Protection

**Why it matters:**
Users can reverse-engineer your game binary to find exploits, bypass payment checks, or steal code.

**Obfuscation techniques:**
- Name mangling (make variable names cryptic)
- Control flow obfuscation (hide the logic path)
- String obfuscation (encrypt sensitive strings)
- Dead code insertion (confuse analysis)
- Function inlining (hide function boundaries)

**Tools for Unreal:**
- Unreal's built-in obfuscation (Project Settings → Packaging)
- Themida (commercial, C++ obfuscation)
- VMProtect (commercial, runtime protection)
- Custom obfuscation scripts

**Action items:**
- Enable Project Settings → Packaging → Obfuscate names
- Obfuscate payment verification code specifically
- Obfuscate any DRM logic
- Consider commercial obfuscation for sensitive modules
- Document obfuscation applied in security_scans.json

### 4. Payment Processing Security

**Critical controls:**
- NEVER store credit card data (use PCI-compliant third parties)
- Use established payment providers: Stripe, Apple In-App Purchase, Google Play Billing
- Validate all transactions server-side (not client-side)
- Implement rate limiting on payment endpoints
- Log all payment attempts (for fraud detection)

**Code patterns to avoid:**
- Storing user card details anywhere
- Validating purchases on client side only
- Using unencrypted communication for payment data

**Action items:**
- Use official payment SDKs (Stripe SDK, Apple SDK, Google Play SDK)
- Implement server-side receipt validation
- All payment communication over HTTPS only
- Audit payment code for vulnerabilities before release

### 5. Data Protection

**If storing user data:**
- Encrypt data at rest (AES-256)
- Encrypt data in transit (TLS 1.2+)
- Implement access controls
- Log data access
- Have data retention/deletion policies
- GDPR compliance if EU users

**Tools:**
- Unreal's Encryption subsystem
- OpenSSL for additional encryption
- Database encryption (PostgreSQL, MongoDB encryption at rest)

**Action items:**
- Document what user data you store
- Define encryption standards
- Implement encrypted storage for sensitive data
- Regular encryption key rotation
- Data breach response plan

## Pre-Release Security Checklist

Before every release to users:

- [ ] Run dependency vulnerability scan (Snyk/OWASP)
- [ ] Run secrets detection (TruffleHog)
- [ ] Verify code obfuscation is enabled
- [ ] Audit payment processing code (manual review)
- [ ] Verify HTTPS/TLS for all network calls
- [ ] Test payment flow with test transactions
- [ ] Check third-party plugin security advisories
- [ ] Verify all sensitive data is encrypted
- [ ] Generate SBOM (Software Bill of Materials)
- [ ] Document security measures applied
- [ ] Security testing against known exploits

## SBOM Generation

Software Bill of Materials documents all components used in your game.

**Why:** Users and security auditors need to know what's in your code for vulnerability tracking.

**What to include:**
- Unreal Engine version and patches
- All third-party plugins and versions
- C++ dependencies and versions
- Any open-source code used
- Build tools and compiler versions

**Format:** SPDX or CycloneDX

**Action items:**
- Generate SBOM before each release
- Include in release notes or security documentation
- Make available to users who request it (liability/transparency)
- Update SBOM when dependencies change

## Ongoing Security

- **Monthly:** Check for security updates to UE4/UE5, plugins, dependencies
- **Before each release:** Full security scan (dependencies + secrets + code review)
- **Quarterly:** Review and update obfuscation strategy
- **After incidents:** Post-mortem and prevention measures

## Documentation

Document all security measures in SECURITY_REQUIREMENTS.md:
```
# Security Applied
- Obfuscation: Names, control flow, strings (enabled)
- Dependencies scanned: Yes (2024-11-03, no critical CVEs)
- Secrets scanning: Yes, pre-commit hook enabled
- Payment validation: Server-side with Stripe
- Data encryption: AES-256 at rest, TLS 1.2+ in transit
- SBOM: Generated 2024-11-03
```

Keep this updated as you release patches and updates.
