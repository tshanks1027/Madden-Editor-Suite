# Project Setup - Madden Editor Suite

This document describes how to build, run, and package the Madden Editor Suite Electron application.

## Prerequisites

- **Node.js**: Version 18+ (implied by dependencies)
- **npm**: Comes with Node.js
- **7-Zip**: Required for creating distribution ZIPs (install to `C:\Program Files\7-Zip\`)
- **Windows**: Primary development platform (Win32 x64)

## Quick Start

### Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm start
# OR
npm run dev
```

The application will launch in development mode with hot-reload enabled.

### Testing with Real Files

The app is designed to work with Madden NFL 26 save files located at:
```
C:\Users\[your-username]\OneDrive\Documents\Madden NFL 26\Saves\
```

**Test file types:**
- Roster files: `ROSTER-*` (FBCHUNKS format)
- Franchise files: `CAREER-*` (TDB2 database format)
- Draft class files: `*.M26` binary format

## Build Commands

### Development

```bash
# Start dev server (with hot-reload)
npm start

# Type checking only
npm run typecheck

# Linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Testing

```bash
# Run E2E tests (Playwright)
npm test

# Run unit tests (Jest)
npm run test:jest

# Watch mode for unit tests
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Coverage thresholds (enforced by Jest):**
- Branches: 85%
- Functions: 85%
- Lines: 85%
- Statements: 85%

### Production Build

```bash
# Package for distribution
npm run package

# Create installer with electron-builder
npm run dist

# Simple build without NSIS installer
npm run dist:simple

# Create portable ZIP (after packaging)
npm run zip
```

**Output locations:**
- Packaged app: `out/Madden Editor Suite-win32-x64/`
- ZIP distribution: `dist/Madden-Editor-Suite-Portable.zip`
- Installer (if using dist): `dist/Madden-Editor-Suite-Setup-{version}.exe`

## Critical Dependencies

### Runtime Dependencies (Must Be Bundled)

These dependencies **MUST** be copied to `.vite/build/node_modules/` during build:

- **bit-buffer** (`^0.2.5`) - Binary data parsing for TDB2/FBCHUNKS files
- **stream-parser** (`^0.3.1`) - Streaming parser for large files
- **crc-32** (`^1.2.2`) - CRC32 checksums for file integrity

**If these are missing, the packaged app will crash with "Cannot find module" errors.**

### Major Dependencies

- **Electron**: `38.1.2` - Desktop app framework
- **Handsontable**: `^16.1.1` - Data grid for roster/franchise editing
- **Puppeteer**: `^24.23.0` - Web scraping for historical rosters
- **madden-franchise**: `^4.1.2` - Franchise file parser (npm package)
- **madden-draft-class-tools**: `^1.1.0` - Draft class parser (npm package)
- **Sharp**: `^0.34.4` - Image processing for portraits
- **SQLite3**: `^5.1.7` - Database operations

### Vendored Libraries (in src/main/lib/)

These are **NOT** npm packages but vendored code:

- **madden-file-tools** (in `lib/helpers/MaddenRosterHelper.js`) - Roster file parser
- **madden-draft-class** (in `lib/draft-class/`) - M25/M26 draft class parser

**These use CommonJS require() and have been customized for this project.**

## Pre-Package Requirements

Before running `npm run package`, the `prepackage` hook automatically checks:

1. **No hardcoded user paths** - No `C:\Users\tshan` in code
2. **No `nul` file** - Windows-specific file that breaks I/O
3. **Required dependencies present** - bit-buffer, stream-parser, crc-32 in package.json
4. **forge.config.ts configured** - Correct ignore patterns

**If checks fail, packaging is aborted.**

## Environment Notes

### File Paths

- Use `app.getAppPath()` for accessing data files in production
- Use `app.isPackaged` checks for conditional paths
- Never hardcode `C:\Users\[username]` paths

### Data Files Location

**Development:**
- CSV lookups: `data/lookups/*.csv`
- Portraits: `data/portrait-sprites/`, `data/portrait-atlas.json`
- Templates: `data/Templates/`

**Production (after build):**
```
.vite/build/
├── data/
│   ├── lookups/*.csv
│   ├── portrait-sprites/
│   └── portrait-atlas.json
├── lib/
│   ├── helpers/
│   └── draft-class/
└── node_modules/
    ├── bit-buffer/
    ├── stream-parser/
    └── crc-32/
```

## Common Issues

### Issue: "Cannot find module 'bit-buffer'"

**Cause:** Required modules not copied to `.vite/build/node_modules/`

**Fix:**
1. Check `vite.main.config.ts` has plugin that copies these modules
2. Verify `.vite/build/node_modules/` exists after build
3. Re-run `npm run package`

### Issue: Saved roster files are 2.4KB instead of 6.4KB

**Cause:** `nul` file in package interferes with Windows file I/O

**Fix:**
1. Delete any `nul` file in project root or `out/` directory
2. Pre-package check should catch this automatically
3. Re-run `npm run package`

### Issue: App works in dev but not in packaged version

**Cause:** Hardcoded paths or missing data files

**Fix:**
1. Check all file paths use `app.getAppPath()` or relative paths
2. Verify data files copied to `.vite/build/data/`
3. Test from `out/` directory, not just dev server

### Issue: Puppeteer crashes in packaged app

**Cause:** Chromium bundled with Puppeteer missing or path incorrect

**Fix:**
- Puppeteer is bundled as production dependency
- Should work automatically - don't exclude from packaging
- Check console logs for actual Chromium path

### Issue: Portrait images don't load

**Cause:** sprite-atlas.json or portrait-sprites/ missing

**Fix:**
1. Verify `data/portrait-sprites/` and `data/portrait-atlas.json` exist
2. Check Vite config copies these to `.vite/build/data/`
3. 124MB sprite sheet must be present

## Package Structure (After Build)

```
Madden Editor Suite-win32-x64/
├── madden-editor-suite.exe           # Main executable
├── resources/
│   └── app/
│       ├── .vite/
│       │   └── build/
│       │       ├── main.js            # Bundled main process
│       │       ├── preload.js         # Bundled preload script
│       │       ├── data/              # Lookup CSVs, portraits
│       │       ├── lib/               # Vendored libraries
│       │       └── node_modules/      # bit-buffer, stream-parser, crc-32
│       ├── node_modules/              # All production dependencies
│       └── package.json
└── ... (Electron framework files)
```

**Total size:** ~1.35GB packaged, ~533MB as ZIP

## Testing Packaged Build

**CRITICAL:** Always test the packaged build before distribution:

```bash
# 1. Package the app
npm run package

# 2. Create ZIP
npm run zip

# 3. Extract to different location
mkdir C:\temp\madden-test
# Extract Madden-Editor-Suite-Portable.zip to C:\temp\madden-test

# 4. Test the executable
cd C:\temp\madden-test\Madden Editor Suite-win32-x64
./madden-editor-suite.exe

# 5. Test functionality
# - Load a roster file
# - Make a change
# - Save to NEW file
# - Verify saved file size matches original (~6.4KB, NOT 2.4KB)
# - Load saved file in Madden 26 to verify it works
```

## Version Release Checklist

When releasing a new version:

- [ ] Update version in `package.json`
- [ ] Run `npm run typecheck` (no errors)
- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm test` (all E2E tests pass)
- [ ] Run `npm run test:jest` (all unit tests pass)
- [ ] Run `npm run package` (pre-package checks pass)
- [ ] Run `npm run zip`
- [ ] Extract ZIP to temp location and test
- [ ] Verify no `nul` file in package
- [ ] Rename ZIP: `Madden-Editor-Suite-v{version}-Portable.zip`
- [ ] Upload to distribution location

## Additional Resources

- **PACKAGING.md** - Detailed packaging workflow
- **CLAUDE.md** - Complete technical documentation
- **TESTING_STRATEGY.md** - Test categories and coverage expectations
- **KNOWN_ISSUES.md** - Solutions to common problems
