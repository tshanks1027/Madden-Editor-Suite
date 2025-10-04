# Packaging Workflow

## Quick Start - Create Distribution

```bash
# 1. Run the full packaging workflow
npm run package

# 2. Create ZIP distribution
npm run zip
```

The ZIP file will be at: `dist/Madden-Editor-Suite-Portable.zip`

## What Happens

### Pre-Package Checks (Automatic)
When you run `npm run package`, the `prepackage` hook runs automatically and checks:
- ✅ No hardcoded paths (C:\Users\tshan)
- ✅ No `nul` file in project or package
- ✅ Required dependencies (bit-buffer, stream-parser, crc-32) are in package.json
- ✅ forge.config.ts is configured correctly

**If checks fail, packaging stops.**

### Packaging Steps
1. Vite builds main.ts and preload.ts
2. Copies `data/`, `parsers/`, and `lib/` to `.vite/build/`
3. Copies required node_modules (bit-buffer, stream-parser, crc-32) to `.vite/build/node_modules/`
4. Electron Forge packages everything to `out/Madden Editor Suite-win32-x64/`
5. Result: 1.35GB package with 53,881 files

### ZIP Creation
1. 7-Zip compresses the package to ~533MB
2. Creates `dist/Madden-Editor-Suite-Portable.zip`
3. Users extract and run - no installation needed

## Testing Before Distribution

**CRITICAL:** Always test the extracted ZIP in a DIFFERENT location:

```bash
# Extract to temp location
mkdir C:\temp\madden-test
# Extract Madden-Editor-Suite-Portable.zip to C:\temp\madden-test

# Test the app
cd C:\temp\madden-test\Madden Editor Suite-win32-x64
./madden-editor-suite.exe

# Test saving
1. Load a roster file
2. Make a change
3. Save to a NEW file
4. Verify saved file size matches original (should be ~6.4KB, not 2.4KB)
5. Load the saved file in Madden to verify it works
```

## Common Issues

### Issue: Saved files are 2.4KB instead of 6.4KB
**Cause:** `nul` file in package interferes with file I/O
**Fix:** Delete `nul` file before packaging (pre-package check handles this)

### Issue: "Cannot find module 'bit-buffer'" in packaged app
**Cause:** Modules not copied to build
**Fix:** Check vite.main.config.ts copies modules to `.vite/build/node_modules/`

### Issue: App works from `out/` but not from extracted ZIP
**Cause:** Hardcoded paths or missing files
**Fix:** Run pre-package check, fix any hardcoded paths

## File Structure (Packaged)

```
Madden Editor Suite-win32-x64/
├── madden-editor-suite.exe          # Main executable
├── resources/
│   ├── app/
│   │   ├── .vite/
│   │   │   └── build/
│   │   │       ├── main.js           # Bundled main process
│   │   │       ├── preload.js        # Bundled preload
│   │   │       ├── data/             # Lookup CSVs
│   │   │       ├── parsers/          # RosterParser.js
│   │   │       ├── lib/              # Vendored madden-franchise code
│   │   │       └── node_modules/     # bit-buffer, stream-parser, crc-32
│   │   ├── node_modules/             # All production dependencies
│   │   └── package.json
│   └── electron.asar (not used - asar disabled)
└── ... (Electron framework files)
```

## Forge Configuration (forge.config.ts)

Key settings:
- `asar: false` - Disabled because of native modules (sqlite3, sharp)
- `prune: true` - Removes devDependencies
- Ignores dev files (tests, docs, temp directories, **nul**)
- Does NOT ignore `node_modules` (needed for runtime)

## Vite Configuration (vite.main.config.ts)

Key plugin actions:
1. Copies `data/lookups/*.csv` to `.vite/build/data/`
2. Copies `src/main/parsers/*.js` to `.vite/build/parsers/`
3. Copies `src/main/lib/` to `.vite/build/lib/` (excludes node_modules, tests)
4. **Copies bit-buffer, stream-parser, crc-32 to `.vite/build/node_modules/`**

## Distribution Checklist

Before distributing to users:

- [ ] Ran `npm run package` successfully
- [ ] Pre-package checks passed
- [ ] Created ZIP with `npm run zip`
- [ ] Extracted ZIP to different location
- [ ] Tested app launches
- [ ] Tested loading roster file
- [ ] Tested saving roster file (verify file size is correct)
- [ ] Tested saved file loads in Madden
- [ ] Checked ZIP size is ~533MB
- [ ] No `nul` file in ZIP

## Version Updates

When releasing a new version:

1. Update version in `package.json`
2. Run packaging workflow
3. Rename ZIP to include version: `Madden-Editor-Suite-v1.0.1-Portable.zip`
4. Test extracted ZIP
5. Upload to distribution location
