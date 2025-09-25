# Package Agent

## Purpose
Automated building, packaging, and distribution of the Madden Editor Suite with professional installer creation and code signing for Windows.

## Capabilities
- Build application for production
- Create Windows installer with Squirrel
- Code signing to prevent antivirus false positives
- Generate checksums for releases
- Upload releases to GitHub
- Manage auto-update system

## Usage

### Build Operations
```bash
/build dev                        # Development build
/build prod                       # Production build
/build clean                      # Clean build artifacts
/build test                       # Test build integrity
```

### Package Operations
```bash
/package windows                  # Package for Windows
/package installer                # Create installer with Squirrel
/package portable                 # Create portable version
/package sign                     # Code sign executables
```

### Release Operations
```bash
/release patch                    # Create patch release (0.1.0 -> 0.1.1)
/release minor                    # Create minor release (0.1.0 -> 0.2.0)
/release major                    # Create major release (0.1.0 -> 1.0.0)
/release beta                     # Create beta release
```

### Distribution
```bash
/upload github                    # Upload to GitHub releases
/upload checksums                 # Generate and upload checksums
/notify update                    # Notify users of new version
```

## Build Configuration

### Electron Forge Setup
- **Squirrel Maker** - Windows installer creation
- **ZIP Maker** - Portable version packaging
- **Auto-unpack Natives** - Native module handling
- **Fuses Plugin** - Security hardening

### Code Signing
- **Certificate Management** - Code signing certificate handling
- **Timestamp Server** - RFC 3161 timestamping
- **Hash Algorithm** - SHA-256 signing
- **Cross-signing** - Multiple certificate support

### Build Optimization
- **Tree Shaking** - Remove unused code
- **Minification** - JavaScript/CSS compression
- **Asset Optimization** - Image and resource compression
- **Bundle Analysis** - Size optimization reporting

## Installer Features

### Professional Installer
- **Custom Branding** - Application icon and branding
- **Directory Selection** - User-selectable install path
- **Desktop Shortcut** - Optional desktop shortcut creation
- **Start Menu Entry** - Windows start menu integration
- **Uninstaller** - Clean uninstall process

### Security Features
- **Code Signing** - Authenticode signature
- **Certificate Validation** - Publisher verification
- **Installer Integrity** - Checksum validation
- **Admin Privileges** - UAC handling

### User Experience
- **Silent Installation** - Command-line install options
- **Progress Indication** - Installation progress feedback
- **Error Handling** - Graceful error recovery
- **Rollback Support** - Installation failure recovery

## Auto-Update System

### Update Mechanism
- **Squirrel Updates** - Native Windows update system
- **Delta Updates** - Incremental update patches
- **Background Checks** - Automatic update detection
- **User Control** - Update notification and control

### Update Distribution
- **GitHub Releases** - Primary distribution channel
- **CDN Support** - Content delivery network integration
- **Fallback Servers** - Multiple download sources
- **Region Selection** - Geographic download optimization

### Update Validation
- **Signature Verification** - Update authenticity
- **Checksum Validation** - Update integrity
- **Version Compatibility** - Update compatibility checks
- **Rollback Capability** - Failed update recovery

## Release Management

### Version Strategy
- **Semantic Versioning** - MAJOR.MINOR.PATCH format
- **Pre-release Tags** - Alpha, beta, RC tagging
- **Build Metadata** - Build number and date
- **Git Integration** - Tag-based versioning

### Release Pipeline
1. **Pre-release Validation**
   - Run full test suite
   - Validate all parsers
   - Check UI functionality
   - Performance benchmarks

2. **Build Process**
   - Clean build environment
   - Production optimization
   - Asset compilation
   - Native module packaging

3. **Packaging**
   - Create installer package
   - Code sign executables
   - Generate checksums
   - Create portable version

4. **Quality Assurance**
   - Installer testing
   - Clean installation validation
   - Update mechanism testing
   - Antivirus scanning

5. **Distribution**
   - Upload to GitHub releases
   - Update download servers
   - Notify update system
   - Generate release notes

## Build Artifacts

### Primary Outputs
- **Setup.exe** - Windows installer
- **Portable.zip** - Portable application version
- **Update.nupkg** - Squirrel update package
- **RELEASES** - Update manifest file

### Support Files
- **Checksums.txt** - SHA-256 checksums
- **Release-Notes.md** - Version release notes
- **Installation-Guide.pdf** - User installation guide
- **Technical-Notes.txt** - Technical specifications

## Performance Optimization

### Bundle Size Optimization
- **Code Splitting** - Lazy loading for features
- **Asset Optimization** - Image and font compression
- **Dead Code Elimination** - Unused code removal
- **External Dependencies** - CDN for common libraries

### Startup Performance
- **Preload Optimization** - Critical resource preloading
- **Cache Strategy** - Intelligent caching system
- **Lazy Initialization** - On-demand feature loading
- **Memory Management** - Efficient memory usage

## Security Measures

### Code Protection
- **Obfuscation** - Code obfuscation for production
- **Integrity Checks** - Runtime integrity validation
- **Anti-tampering** - Tamper detection mechanisms
- **Secure Storage** - Encrypted configuration storage

### Distribution Security
- **HTTPS Only** - Secure download channels
- **Certificate Pinning** - SSL certificate validation
- **Checksum Verification** - Download integrity checks
- **Malware Scanning** - Automated security scanning

## Quality Assurance

### Automated Testing
- **Installer Testing** - Automated install/uninstall
- **Update Testing** - Update mechanism validation
- **Cross-platform Testing** - Windows version compatibility
- **Performance Testing** - Build performance benchmarks

### Manual Validation
- **Clean Machine Testing** - Fresh Windows installation
- **Antivirus Testing** - Multiple antivirus validation
- **User Experience Testing** - Installation flow validation
- **Documentation Review** - User guide accuracy